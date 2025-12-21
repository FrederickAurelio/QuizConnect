import Quiz from "../models/Quiz.js";
import {
  addPlayer,
  deleteLobbySession,
  getLobby,
  getQuestions,
  Question,
  removePlayer,
  saveLobby,
  saveQuestions,
  updateUserInfo,
  UserInfo,
} from "../redis/lobby.js";
import type { Server, Socket } from "socket.io";
import { shuffleArray } from "../utils/tools.js";

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

  const handleGameFlow = async (gameCode: string, duration: number) => {
    setTimeout(async () => {
      const lobby = await getLobby(gameCode);
      const questions = await getQuestions(gameCode);
      if (
        !lobby ||
        lobby.status !== "started" ||
        !questions ||
        questions.length <= 0
      )
        return;

      if (lobby.gameState.status === "cooldown") {
        lobby.gameState.questionIndex += 1;
        lobby.gameState.duration =
          Number(lobby.settings.timePerQuestion) * 1000;
        lobby.gameState.status = "question";
        lobby.quiz.curQuestion = {
          ...questions[lobby.gameState.questionIndex],
          correctKey: undefined,
        } as Question;
      } else if (lobby.gameState.status === "question") {
        lobby.gameState.duration = 5 * 1000;
        lobby.gameState.status = "result";
        lobby.quiz.curQuestion = {
          ...questions[lobby.gameState.questionIndex],
        } as Question;
      } else if (
        lobby.gameState.status === "result" &&
        lobby.gameState.questionIndex + 1 < questions.length
      ) {
        lobby.gameState.duration = Number(lobby.settings.cooldown) * 1000;
        lobby.gameState.status = "cooldown";
      } else if (lobby.gameState.status === "result") {
        lobby.status = "ended";
      }
      lobby.gameState.startTime = new Date().toISOString();

      io.to(gameCode).emit("lobby-updated", lobby);
      await saveLobby(gameCode, lobby);

      if (lobby.status !== "ended") {
        handleGameFlow(gameCode, lobby.gameState.duration);
      }
    }, duration);
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

    if (lobby.status !== "lobby")
      return socket.emit("error", { message: "The game already started" });

    if (lobby.host._id !== user._id)
      return socket.emit("error", { message: "Only host can start game" });

    const quiz = await Quiz.findById(lobby.quiz._id);
    if (!quiz) {
      return socket.emit("error", { message: "Quiz not found" });
    }

    let processedQuestions = [...quiz.questions] as Question[];

    if (lobby.settings.shuffleQuestions) {
      processedQuestions = shuffleArray(processedQuestions);
    }

    processedQuestions = processedQuestions.slice(
      0,
      lobby.settings.questionCount
    );

    if (lobby.settings.shuffleAnswers) {
      processedQuestions = processedQuestions.map((q) => ({
        ...q,
        options: shuffleArray([...q.options]),
      }));
    }

    // 4. Update Lobby State
    await saveQuestions(gameCode, processedQuestions);

    lobby.status = "started";
    lobby.gameState.questionIndex = -1;
    lobby.gameState.duration = 30000;
    lobby.gameState.startTime = new Date().toISOString();
    lobby.gameState.status = "cooldown";

    await saveLobby(gameCode, lobby);

    io.to(gameCode).emit("lobby-updated", lobby);
    handleGameFlow(gameCode, lobby.gameState.duration);
  });
};
