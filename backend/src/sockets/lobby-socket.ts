import type { Server, Socket } from "socket.io";
import Quiz from "../models/Quiz.js";
import { EXPIRY_SECONDS, redis } from "../redis/index.js";
import {
  addPlayer,
  AnswerLog,
  deleteLobbySession,
  getAllPlayers,
  getFullLobby,
  getHostData,
  getLobby,
  getQuestions,
  Question,
  removePlayer,
  saveHostData,
  saveLobby,
  saveQuestions,
  updateUserInfo,
  UserInfo,
} from "../redis/lobby.js";
import { shuffleArray } from "../utils/tools.js";
import {
  HistoryDetail,
  HistoryPlayerResult,
  HistoryQuery,
} from "../models/History.js";

type ParsedAnswer = {
  _id: string;
  optionIndex: number | null;
  key: "A" | "B" | "C" | "D" | null;
  score: number;
};

export const parseRedisHash = <T = any>(
  raw: Record<string, string>
): ParsedAnswer[] =>
  Object.entries(raw).map(([playerId, json]) => ({
    _id: playerId,
    ...JSON.parse(json),
  }));

const gameFlowTimers = new Map<string, NodeJS.Timeout>();
function scheduleNextGameFlow(io: Server, gameCode: string, duration: number) {
  // clear existing timer
  const existing = gameFlowTimers.get(gameCode);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    gameFlowTimers.delete(gameCode);
    handleNextGameFlow(io, gameCode);
  }, duration);

  gameFlowTimers.set(gameCode, timer);
}

export function skipGameFlow(io: Server, gameCode: string) {
  const timer = gameFlowTimers.get(gameCode);
  if (timer) {
    clearTimeout(timer);
    gameFlowTimers.delete(gameCode);
  }

  handleNextGameFlow(io, gameCode);
}

export const handleNextGameFlow = async (io: Server, gameCode: string) => {
  const [lobby, questions, allPlayers, hostUser] = await Promise.all([
    getLobby(gameCode),
    getQuestions(gameCode),
    getAllPlayers(gameCode),
    getHostData(gameCode),
  ]);
  if (
    !lobby ||
    lobby.status !== "started" ||
    !questions ||
    questions.length <= 0 ||
    !hostUser
  )
    return;

  if (lobby.gameState.status === "cooldown") {
    lobby.gameState.questionIndex += 1;
    lobby.gameState.duration = Number(lobby.settings.timePerQuestion) * 1000;
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

    const scoreKey = `game:answer:score:${gameCode}`;
    const totalScores = await redis.hGetAll(scoreKey);

    const playerKey = `game:players:${gameCode}`;

    const multi = redis.multi();
    for (const player of allPlayers) {
      multi.hSet(
        playerKey,
        player._id,
        JSON.stringify({
          ...player,
          totalScore: Number(totalScores[player._id] ?? 0),
        })
      );
    }
    multi.expire(scoreKey, EXPIRY_SECONDS);
    multi.expire(playerKey, EXPIRY_SECONDS);
    await multi.exec();
  } else if (
    lobby.gameState.status === "result" &&
    lobby.gameState.questionIndex + 1 < questions.length
  ) {
    const correctKey = `game:answer:correct:${gameCode}`;

    await redis.set(correctKey, allPlayers.length, {
      EX: EXPIRY_SECONDS,
    });

    lobby.gameState.duration = Number(lobby.settings.cooldown) * 1000;
    lobby.gameState.status = "cooldown";
  } else if (lobby.gameState.status === "result") {
    lobby.status = "ended";
  }
  lobby.gameState.startTime = new Date().toISOString();

  await saveLobby(gameCode, lobby);
  const emitLobby = await getFullLobby(gameCode);

  // after cooldown mode, because this was just set to question
  if (lobby.gameState.status === "question") {
    const questionKey = `game:answer:answers:${gameCode}:${lobby.gameState.questionIndex}`; // new qIndex
    const rawAnswers = await redis.hGetAll(questionKey);
    const playersAnswer = parseRedisHash(rawAnswers);

    io.to(`user:${hostUser?._id}:${gameCode}`).emit(
      "question-dashboard",
      playersAnswer
    );
  }

  if (lobby.status !== "ended") {
    scheduleNextGameFlow(io, gameCode, lobby.gameState.duration);
  } else {
    // -------------- LAYER 1 --------------
    const winnerUser = (emitLobby?.players ?? []).reduce((best, p) => {
      return p.totalScore > best.totalScore ? p : best;
    });
    const layer1 = new HistoryQuery({
      gameCode: emitLobby?.gameCode,
      quiz: {
        title: emitLobby?.quiz.title ?? "",
        description: emitLobby?.quiz.description ?? "",
        questionCount: emitLobby?.settings.questionCount ?? 0,
      },
      host: emitLobby?.host._id ?? "",
      players: (emitLobby?.players ?? [])
        .map((player) => player._id)
        .filter((p) => !p.startsWith("guest_")),
      playerCount: (emitLobby?.players ?? []).length ?? 0,
      winner: {
        userId: winnerUser._id.startsWith("guest_") ? null : winnerUser._id,
        guestId: winnerUser._id.startsWith("guest_") ? winnerUser._id : null,
        username: winnerUser?.username ?? "",
        avatar: winnerUser?.avatar ?? "",
        totalScore: winnerUser?.totalScore ?? 0,
      },
      sessionCreatedAt: emitLobby?.sessionCreatedAt ?? new Date().toISOString(),
    });

    const allPlayersSnapshot =
      emitLobby?.players
        .map((p) => ({
          userId: p._id.startsWith("guest_") ? null : p._id,
          guestId: p._id.startsWith("guest_") ? p._id : null,
          username: p?.username ?? "",
          avatar: p?.avatar ?? "",
          totalScore: p?.totalScore ?? 0,
        }))
        .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0)) ?? [];

    // -------------- LAYER 2 --------------
    const layer2 = new HistoryDetail({
      _id: layer1._id,
      gameCode: emitLobby?.gameCode,
      quiz: {
        title: emitLobby?.quiz.title ?? "",
        description: emitLobby?.quiz.description ?? "",
        questions: questions,
      },
      host: emitLobby?.host._id ?? "",
      players: allPlayersSnapshot,
      settings: emitLobby?.settings,
      sessionCreatedAt: emitLobby?.sessionCreatedAt ?? new Date().toISOString(),
    });

    // -------------- LAYER 3 --------------

    const questionCount = emitLobby?.settings.questionCount ?? 0;

    const playerResults = await Promise.all(
      allPlayersSnapshot.map(async (p, rankIdx) => {
        const multi = redis.multi();
        const playerKey = (p.userId || p.guestId) as string;

        for (let i = 0; i < questionCount; i++) {
          multi.hGet(`game:answer:answers:${gameCode}:${i}`, playerKey);
        }

        const results = await multi.exec();

        const answers: (AnswerLog & { questionIndex: number })[] = results.map(
          (r, qIdx) => {
            if (typeof r === "string") {
              try {
                return { ...JSON.parse(r), questionIndex: qIdx };
              } catch {}
            }
            return {
              optionIndex: null,
              key: null,
              score: 0,
              questionIndex: qIdx,
            };
          }
        );

        return {
          gameId: layer1._id,
          player: p,
          totalScore: p.totalScore,
          rank: rankIdx + 1,
          answers,
        };
      })
    );

    await Promise.all([
      layer1.save(),
      layer2.save(),
      HistoryPlayerResult.insertMany(playerResults),
    ]);

    if (emitLobby) emitLobby.gameId = String(layer1._id);
    await deleteLobbySession(gameCode, hostUser._id, lobby.quiz._id);
  }

  io.to(gameCode).emit("lobby-updated", emitLobby);
};

export const setupLobbySocket = (io: Server, socket: Socket) => {
  const user = { ...socket.data.user, totalScore: 0 } as UserInfo;

  const handleLeaveLobby = async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return;

    const [lobby, hostUser] = await Promise.all([
      getLobby(gameCode),
      getHostData(gameCode),
    ]);

    if (!lobby || !hostUser) return;

    if (lobby.status === "lobby") {
      if (hostUser?._id === user._id) {
        await saveHostData(gameCode, { ...hostUser, online: false });
      } else {
        await removePlayer(gameCode, user._id);
      }

      const emitLobby = await getFullLobby(gameCode);
      io.to(gameCode).emit("lobby-updated", emitLobby);
    }
  };

  // Join a game/lobby
  socket.on("join-game", async ({ gameCode }: { gameCode: string }) => {
    const currentLobby = socket.data.gameCode;
    if (currentLobby && currentLobby !== gameCode) {
      socket.leave(currentLobby);
      socket.leave(`user:${user._id}:${currentLobby}`);
    }

    const lobby = await getFullLobby(gameCode);

    if (!lobby) return socket.emit("error", { message: "Lobby not found" });

    if (
      lobby.status === "lobby" ||
      user._id === lobby.host._id ||
      lobby.players.map((u) => u._id).includes(user._id)
    ) {
      socket.join(gameCode);
      socket.join(`user:${user._id}:${gameCode}`);
      socket.data.gameCode = gameCode;

      if (lobby.status === "lobby") {
        if (lobby.host._id === user._id) {
          await saveHostData(gameCode, { ...lobby.host, online: true });
        } else {
          await addPlayer(gameCode, user);
        }
      }

      const emitLobby = await getFullLobby(gameCode);
      io.to(gameCode).emit("lobby-updated", emitLobby);

      if (user._id === lobby.host._id) {
        const questionKey = `game:answer:answers:${gameCode}:${lobby.gameState.questionIndex}`;
        const rawAnswers = await redis.hGetAll(questionKey);
        const playersAnswer = parseRedisHash(rawAnswers);
        io.to(`user:${lobby.host?._id}:${gameCode}`).emit(
          "question-dashboard",
          playersAnswer
        );
      }
    }
  });

  // Update settings (only host)
  socket.on("update-settings", async ({ settings }) => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    const lobby = await getLobby(gameCode);
    const hostData = await getHostData(gameCode);

    if (!lobby || !hostData)
      return socket.emit("error", { message: "Lobby not found" });

    if (hostData?._id !== user._id)
      return socket.emit("error", {
        message: "Only host can update settings",
      });

    lobby.settings = { ...lobby.settings, ...settings };
    await saveLobby(gameCode, lobby);

    const emitLobby = await getFullLobby(gameCode);
    io.to(gameCode).emit("lobby-updated", emitLobby);
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

      const emitLobby = await getFullLobby(gameCode);
      io.to(gameCode).emit("lobby-updated", emitLobby);
    }
  );

  // Close lobbby
  socket.on("close-lobby", async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    const lobby = await getLobby(gameCode);
    const hostData = await getHostData(gameCode);

    if (!lobby || !hostData)
      return socket.emit("error", { message: "Lobby not found" });

    if (hostData?._id !== user._id)
      return socket.emit("error", {
        message: "Only host can update settings",
      });

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

  socket.on(
    "submit-answer",
    async (
      {
        optionIndex,
        key,
      }: {
        optionIndex: number;
        key: "A" | "B" | "C" | "D";
      },
      ack: (res: { ok: boolean; message?: string }) => void
    ) => {
      const gameCode = socket.data.gameCode;
      if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

      const [lobby, questions, hostUser, allPlayers] = await Promise.all([
        getLobby(gameCode),
        getQuestions(gameCode),
        getHostData(gameCode),
        getAllPlayers(gameCode),
      ]);

      if (!lobby || !questions || !hostUser) {
        ack?.({ ok: false });
        return socket.emit("error", { message: "Not in a lobby" });
      }

      if (lobby.gameState.status !== "question") {
        ack?.({ ok: false });
        return socket.emit("error", { message: "Time is up!" });
      }

      const qIndex = lobby.gameState.questionIndex;
      const curQuestion = questions[qIndex] as Question;

      const questionKey = `game:answer:answers:${gameCode}:${qIndex}`;
      const scoreKey = `game:answer:score:${gameCode}`;
      const correctKey = `game:answer:correct:${gameCode}`;

      const raw = await redis.hGet(questionKey, user._id);
      if (!raw) {
        ack?.({ ok: false });
        return socket.emit("error", {
          message: "Answer state not initialized",
        });
      }

      const data: AnswerLog = JSON.parse(raw);
      if (data.key) {
        ack?.({ ok: false });
        return socket.emit("error", {
          message: "You already answered this question!",
        });
      }

      const updated: AnswerLog = {
        optionIndex,
        key,
        score: 0,
        answeredAt: new Date().toISOString(),
      };

      if (curQuestion.correctKey === key) {
        const remaining = await redis.decr(correctKey);
        const baseScore = Math.ceil(allPlayers.length / 2);
        const scoreYouGet = Math.max(remaining + 1, 0) + baseScore;

        await redis.hSet(
          questionKey,
          user._id,
          JSON.stringify({
            ...updated,
            optionIndex,
            key,
            score: scoreYouGet,
          })
        );

        await redis.hIncrBy(scoreKey, user._id, scoreYouGet);
      } else {
        await redis.hSet(questionKey, user._id, JSON.stringify(updated));
      }

      const rawAnswers = await redis.hGetAll(questionKey);
      const playersAnswer = parseRedisHash(rawAnswers);
      io.to(`user:${hostUser?._id}:${gameCode}`).emit(
        "question-dashboard",
        playersAnswer
      );

      // Check if everyone answered
      const someUnanswered = playersAnswer.some((p) => p.key === null);
      if (!someUnanswered) {
        skipGameFlow(io, gameCode);
      }

      ack?.({ ok: true });
    }
  );

  // Kick Player
  socket.on("kick-player", async (userId: string) => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    const [lobby, hostUser] = await Promise.all([
      getLobby(gameCode),
      getHostData(gameCode),
    ]);

    if (!lobby || !hostUser)
      return socket.emit("error", { message: "Lobby not found" });
    if (hostUser._id !== user._id)
      return socket.emit("error", {
        message: "Only host can update settings",
      });

    await removePlayer(gameCode, userId, true);

    io.to(`user:${userId}:${gameCode}`).emit(
      "kicked",
      "You were kicked from the lobby"
    );
    const emitLobby = await getFullLobby(gameCode);
    io.to(gameCode).emit("lobby-updated", emitLobby);
  });

  socket.on("leave-game", handleLeaveLobby);
  socket.on("disconnect", handleLeaveLobby);

  // Start game (host only)
  socket.on("start-game", async () => {
    const gameCode = socket.data.gameCode;
    if (!gameCode) return socket.emit("error", { message: "Not in a lobby" });

    const [lobby, hostUser, allPlayers] = await Promise.all([
      getLobby(gameCode),
      getHostData(gameCode),
      getAllPlayers(gameCode),
    ]);
    if (!lobby || !hostUser || !allPlayers)
      return socket.emit("error", { message: "Lobby not found" });

    if (lobby.status !== "lobby")
      return socket.emit("error", { message: "The game already started" });

    if (hostUser._id !== user._id)
      return socket.emit("error", { message: "Only host can start game" });

    if (allPlayers.length < 1)
      return socket.emit("error", {
        message: "Need at least 1 player to start the game",
      });

    const quiz = await Quiz.findById(lobby.quiz._id).lean();
    if (!quiz) {
      return socket.emit("error", { message: "Quiz not found" });
    }

    const wasAlreadyStarted = await redis.getSet(
      `game:started:${gameCode}`,
      "true"
    );
    if (wasAlreadyStarted) return;

    let processedQuestions = [...quiz.questions] as Question[];

    if (lobby.settings.shuffleQuestions) {
      processedQuestions = shuffleArray(processedQuestions);
    }

    processedQuestions = processedQuestions.slice(
      0,
      lobby.settings.questionCount
    );

    if (lobby.settings.shuffleAnswers) {
      processedQuestions = processedQuestions.map((q) => {
        const shuffledOptions = shuffleArray([...q.options]);
        return {
          ...q,
          options: shuffledOptions,
        };
      });
    }

    lobby.status = "started";
    lobby.gameState.questionIndex = -1;
    lobby.gameState.duration = 10000;
    lobby.gameState.startTime = new Date().toISOString();
    lobby.gameState.status = "cooldown";

    const scoreKey = `game:answer:score:${gameCode}`;
    const correctKey = `game:answer:correct:${gameCode}`;
    const multi = redis.multi();

    for (const player of allPlayers) {
      multi.hSet(scoreKey, player._id, 0);
    }
    multi.expire(scoreKey, EXPIRY_SECONDS);

    processedQuestions.forEach((_, qIndex) => {
      const questionKey = `game:answer:answers:${gameCode}:${qIndex}`;
      for (const player of allPlayers) {
        multi.hSet(
          questionKey,
          player._id,
          JSON.stringify({ optionIndex: null, key: null, score: 0 })
        );
      }
      multi.expire(questionKey, EXPIRY_SECONDS);
    });

    await Promise.all([
      multi.exec(),
      redis.set(correctKey, allPlayers.length, { EX: EXPIRY_SECONDS }),
      saveQuestions(gameCode, processedQuestions),
      saveLobby(gameCode, lobby),
    ]);

    const emitLobby = await getFullLobby(gameCode);
    io.to(gameCode).emit("lobby-updated", emitLobby);

    scheduleNextGameFlow(io, gameCode, lobby.gameState.duration);
  });
};
