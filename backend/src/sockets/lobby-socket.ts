import {
  addPlayer,
  getLobby,
  removePlayer,
  saveLobby,
  UserInfo,
} from "../redis/lobby.js";
import type { Server, Socket } from "socket.io";

export const setupLobbySocket = (io: Server, socket: Socket) => {
  const user = socket.data.user as UserInfo;

  // Join a game/lobby
  socket.on("join-game", async ({ gameCode }: { gameCode: string }) => {
    let lobby = await getLobby(gameCode);
    if (!lobby) return socket.emit("error", { message: "Lobby not found" });

    socket.join(gameCode);
    socket.data.gameCode = gameCode; // track user's lobby

    if (lobby.host._id === user._id) {
      lobby.host.online = true;
      await saveLobby(gameCode, lobby);
    } else {
      lobby = await addPlayer(gameCode, user);
    }
    io.to(gameCode).emit("lobby-updated", lobby);
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

  // Leave game manually
  socket.on("leave-game", async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return;

    let lobby = await getLobby(gameCode);
    if (!lobby) return;

    if (lobby.host._id === user._id) {
      lobby.host.online = false;
      await saveLobby(gameCode, lobby);
    } else {
      lobby = await removePlayer(gameCode, user._id);
    }

    if (lobby) io.to(gameCode).emit("lobby-updated", lobby);
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return;

    let lobby = await getLobby(gameCode);
    if (!lobby) return;

    if (lobby.host._id === user._id) {
      lobby.host.online = false;
      await saveLobby(gameCode, lobby);
    } else {
      lobby = await removePlayer(gameCode, user._id);
    }

    if (lobby) io.to(gameCode).emit("lobby-updated", lobby);
  });

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

    io.to(gameCode).emit("game-started", { gameCode, quiz: lobby.quiz });
  });
};
