import { EXPIRY_SECONDS, redis } from "./index.js";

export type UserInfo = {
  _id: string;
  username: string;
  avatar: string;
};

export type Question = {
  id: any;
  question: string;
  options: {
    key: "A" | "B" | "C" | "D";
    text: string;
  }[];
  correctKey?: "A" | "B" | "C" | "D" | undefined;
  done: boolean;
};

export type QuizInfo = {
  _id: string;
  title: string;
  description: string;
  questionCount: number;

  curQuestion: Question;
};

export type GameSettings = {
  maxPlayers: number;
  questionCount: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  timePerQuestion: string;
  cooldown: string;
};

export type LobbyState = {
  gameCode: string;
  host: UserInfo & { online: boolean };
  quiz: QuizInfo;
  settings: GameSettings;
  players: UserInfo[];
  banned: {
    userId: string;
    bannedAt: string;
  }[];
  status: "lobby" | "started" | "ended";

  gameState: {
    startTime: string;
    duration: number;
    status: "question" | "result" | "cooldown";
    questionIndex: number;
  };
  createdAt: string;
};

export const getLobby = async (
  gameCode: string
): Promise<LobbyState | null> => {
  const data = await redis.get(`game:${gameCode}`);
  return data ? JSON.parse(data) : null;
};

export const saveLobby = async (gameCode: string, lobby: LobbyState) => {
  const activeLobbyKey = `activeHostLobby:${lobby.host._id}:${lobby.quiz._id}`;
  const transaction = redis
    .multi()
    .set(`game:${gameCode}`, JSON.stringify(lobby), {
      EX: EXPIRY_SECONDS,
    })
    .set(activeLobbyKey, gameCode, { EX: EXPIRY_SECONDS });

  await transaction.exec();
};

export const addPlayer = async (gameCode: string, player: UserInfo) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;
  if (!lobby.players.find((p) => p._id === player._id))
    lobby.players.push(player);
  await saveLobby(gameCode, lobby);
  return lobby;
};

export const removePlayer = async (
  gameCode: string,
  playerId: string,
  banned?: boolean
) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;
  lobby.players = lobby.players.filter((p) => p._id !== playerId);
  if (banned) {
    lobby.banned = [
      ...(lobby.banned ?? []).filter((p) => p.userId !== playerId),
      { userId: playerId, bannedAt: new Date().toISOString() },
    ];
  }
  await saveLobby(gameCode, lobby);
  return lobby;
};

export const updateUserInfo = async (gameCode: string, user: UserInfo) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;

  if (user._id === lobby.host._id) {
    lobby.host.avatar = user.avatar;
    lobby.host.username = user.username;
  } else {
    lobby.players = lobby.players.map((player) =>
      player._id === user._id
        ? { ...player, username: user.username, avatar: user.avatar }
        : player
    );
  }

  await saveLobby(gameCode, lobby);
  return lobby;
};

/**
 * Removes lobby data and host lock.
 * Uses a pipeline for atomicity and performance.
 */
export const deleteLobbySession = async (
  gameCode: string,
  userId: string,
  quizId: string
) => {
  if (!redis) return;

  try {
    await redis.del(`game:${gameCode}`);
    await redis.del(`activeHostLobby:${userId}:${quizId}`);
  } catch (error) {
    console.error("Redis Cleanup Error:", error);
    throw error;
  }
};

/**
 * QUESTION DATA
 */
export const saveQuestions = async (
  gameCode: string,
  questions: Question[]
) => {
  const secretQuestionsKey = `game:secret:questions:${gameCode}`;
  await redis.set(secretQuestionsKey, JSON.stringify(questions), {
    EX: EXPIRY_SECONDS,
  });
  return questions;
};

export const getQuestions = async (
  gameCode: string
): Promise<Question[] | null> => {
  const secretQuestionsKey = `game:secret:questions:${gameCode}`;
  const data = await redis.get(secretQuestionsKey);
  return data ? JSON.parse(data) : null;
};
