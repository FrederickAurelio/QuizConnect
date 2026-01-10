import { EXPIRY_SECONDS, redis } from "./index.js";

export type AnswerLog = {
  optionIndex: number | null;
  key: ("A" | "B" | "C" | "D") | null;
  score: number;
};

export type UserInfo = {
  _id: string;
  username: string;
  avatar: string;
  totalScore: number;
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

export type FullLobbyState = {
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
  sessionCreatedAt: string;

  // will be available if the game was ended and data saved...
  gameId?: string;
};

export type LobbyState = {
  gameCode: string;
  quiz: QuizInfo;
  settings: GameSettings;
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
  sessionCreatedAt: string;
};

export const getLobby = async (
  gameCode: string
): Promise<LobbyState | null> => {
  const data = await redis.get(`game:${gameCode}`);
  return data ? JSON.parse(data) : null;
};

export const getFullLobby = async (
  gameCode: string
): Promise<FullLobbyState | null> => {
  const [lobbyRes, hostData, allPlayers] = await Promise.all([
    getLobby(gameCode),
    getHostData(gameCode),
    getAllPlayers(gameCode),
  ]);

  if (!lobbyRes || !hostData || !allPlayers) return null;

  const lobby: FullLobbyState = {
    ...(lobbyRes as LobbyState),
    players: allPlayers,
    host: hostData as UserInfo & { online: boolean },
  };

  return lobby;
};

export const saveLobby = async (gameCode: string, lobby: LobbyState) => {
  const hostUser = await getHostData(gameCode);

  const activeLobbyKey = `activeHostLobby:${hostUser?._id}:${lobby.quiz._id}`;
  const transaction = redis
    .multi()
    .set(`game:${gameCode}`, JSON.stringify(lobby), {
      EX: EXPIRY_SECONDS,
    })
    .set(activeLobbyKey, gameCode, { EX: EXPIRY_SECONDS });

  await transaction.exec();
};

export const getHostData = async (
  gameCode: string
): Promise<(UserInfo & { online: boolean }) | null> => {
  const data = await redis.get(`game:host:${gameCode}`);
  return data ? JSON.parse(data) : null;
};

export const saveHostData = async (
  gameCode: string,
  hostUser: UserInfo & { online: boolean }
) => {
  const activeLobbyKey = `game:host:${gameCode}`;
  await redis.set(activeLobbyKey, JSON.stringify(hostUser), {
    EX: EXPIRY_SECONDS,
  });
};

export const getAllPlayers = async (gameCode: string): Promise<UserInfo[]> => {
  const playerKey = `game:players:${gameCode}`;
  const raw = await redis.hGetAll(playerKey);

  if (!raw || Object.keys(raw).length === 0) return [];

  return Object.values(raw).map((v) => JSON.parse(v));
};

export const addPlayer = async (gameCode: string, player: UserInfo) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;

  const playerKey = `game:players:${gameCode}`;
  await redis.hSet(playerKey, player._id, JSON.stringify(player));
};

export const removePlayer = async (
  gameCode: string,
  playerId: string,
  banned?: boolean
) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;
  if (banned) {
    lobby.banned = [
      ...(lobby.banned ?? []).filter((p) => p.userId !== playerId),
      { userId: playerId, bannedAt: new Date().toISOString() },
    ];
  }
  const playerKey = `game:players:${gameCode}`;
  const multi = redis.multi();
  multi.hDel(playerKey, playerId);
  multi.set(`game:${gameCode}`, JSON.stringify(lobby), { EX: EXPIRY_SECONDS });
  await multi.exec();
};

export const updateUserInfo = async (
  gameCode: string,
  user: {
    _id: string;
    avatar: string;
    username: string;
  }
) => {
  const [lobby, host] = await Promise.all([
    getLobby(gameCode),
    getHostData(gameCode),
  ]);
  if (!lobby || !host) return null;

  if (user._id === host._id) {
    await saveHostData(gameCode, { ...host, ...user });
  } else {
    const playerKey = `game:players:${gameCode}`;
    await redis.hSet(
      playerKey,
      user._id,
      JSON.stringify({
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        totalScore: 0,
      })
    );
  }
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
    await redis.del(`activeHostLobby:${userId}:${quizId}`);

    let cursor = "0";
    const pattern = `*${gameCode}*`;

    do {
      const { cursor: nextCursor, keys } = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(keys as unknown as string[]);
      }
    } while (cursor !== "0");
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
