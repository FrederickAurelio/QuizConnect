import {
  addPlayer,
  deleteLobbySession,
  getLobby,
  removePlayer,
  saveLobby,
  updateUserInfo,
  UserInfo,
} from "../redis/lobby.js";
import type { Server, Socket } from "socket.io";

export const setupLobbySocket = (io: Server, socket: Socket) => {
  const user = socket.data.user as UserInfo;

  const handleLeaveLobby = async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return;

    let lobby = await getLobby(gameCode);
    if (!lobby) return;

    if (lobby.status === "lobby") {
      if (lobby.host._id === user._id) {
        lobby.host.online = false;
        await saveLobby(gameCode, lobby);
      } else {
        lobby = await removePlayer(gameCode, user._id);
      }

      if (lobby) io.to(gameCode).emit("lobby-updated", lobby);
    }
  };

  // Join a game/lobby
  socket.on("join-game", async ({ gameCode }: { gameCode: string }) => {
    const currentLobby = socket.data.gameCode;
    if (currentLobby && currentLobby !== gameCode) {
      socket.leave(currentLobby);
    }

    let lobby = await getLobby(gameCode);
    if (!lobby) return socket.emit("error", { message: "Lobby not found" });

    if (
      lobby.status === "lobby" ||
      user._id === lobby.host._id ||
      lobby.players.map((u) => u._id).includes(user._id)
    ) {
      socket.join(gameCode);
      socket.data.gameCode = gameCode;

      if (lobby.status === "lobby") {
        if (lobby.host._id === user._id) {
          lobby.host.online = true;
          await saveLobby(gameCode, lobby);
        } else {
          lobby = await addPlayer(gameCode, user);
        }
      }
      io.to(gameCode).emit("lobby-updated", lobby);
    }
  });

  // Update settings (only host)
  socket.on("update-settings", async ({ settings }) => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    const lobby = await getLobby(gameCode);
    if (!lobby) return socket.emit("error", { message: "Lobby not found" });
    if (lobby.host._id !== user._id)
      return socket.emit("error", {
        message: "Only host can update settings",
      });

    lobby.settings = { ...lobby.settings, ...settings };
    await saveLobby(gameCode, lobby);

    io.to(gameCode).emit("lobby-updated", lobby);
  });

  // Update Profile
  socket.on(
    "update-profile",
    async (newProfile: { username: string; avatar: string }) => {
      const gameCode = socket.data.gameCode;
      if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

      const lobby = await updateUserInfo(gameCode, {
        ...newProfile,
        _id: user._id,
      });
      if (!lobby) return socket.emit("error", { message: "Lobby not found" });

      io.to(gameCode).emit("lobby-updated", lobby);
    }
  );

  // Close lobbby
  socket.on("close-lobby", async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    let lobby = await getLobby(gameCode);
    if (!lobby) return socket.emit("error", { message: "Lobby not found" });

    if (lobby.host._id !== user._id) {
      return socket.emit("error", { message: "Only host can close lobby" });
    }

    try {
      io.to(gameCode).emit("kicked", "The host has closed the lobby.");

      setTimeout(async () => {
        await deleteLobbySession(gameCode, user._id, lobby.quiz._id);
      }, 400);

      io.in(gameCode).socketsLeave(gameCode);
    } catch (error) {
      socket.emit("error", { message: "Failed to close lobby" });
    }
  });

  // Kick Player
  socket.on("kick-player", async (userId: string) => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    let lobby = await getLobby(gameCode);
    if (!lobby) return socket.emit("error", { message: "Lobby not found" });
    if (lobby.host._id !== user._id)
      return socket.emit("error", {
        message: "Only host can update settings",
      });

    lobby = await removePlayer(gameCode, userId, true);

    io.to(`user:${userId}`).emit("kicked", "You were kicked from the lobby");
    io.to(gameCode).emit("lobby-updated", lobby);
  });

  socket.on("leave-game", handleLeaveLobby);
  socket.on("disconnect", handleLeaveLobby);

  // Start game (host only)
  socket.on("start-game", async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    const lobby = await getLobby(gameCode);
    if (!lobby) return socket.emit("error", { message: "Lobby not found" });
    if (lobby.host._id !== user._id)
      return socket.emit("error", { message: "Only host can start game" });

    lobby.status = "started";
    await saveLobby(gameCode, lobby);
  });
};
