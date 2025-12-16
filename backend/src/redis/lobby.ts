import { redis } from "./index.js";

export type UserInfo = {
  _id: string;
  username: string;
  avatar: string;
};

export type QuizInfo = {
  _id: string;
  title: string;
  description: string;
  questionCount: number;
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
  status: "lobby" | "started" | "ended";
  createdAt: number;
};

export const getLobby = async (
  gameCode: string
): Promise<LobbyState | null> => {
  const data = await redis.get(`game:${gameCode}`);
  return data ? JSON.parse(data) : null;
};

export const saveLobby = async (gameCode: string, lobby: LobbyState) => {
  await redis.set(`game:${gameCode}`, JSON.stringify(lobby), { EX: 7200 });
};

export const addPlayer = async (gameCode: string, player: UserInfo) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;
  if (!lobby.players.find((p) => p._id === player._id))
    lobby.players.push(player);
  await saveLobby(gameCode, lobby);
  return lobby;
};

export const removePlayer = async (gameCode: string, playerId: string) => {
  const lobby = await getLobby(gameCode);
  if (!lobby) return null;
  lobby.players = lobby.players.filter((p) => p._id !== playerId);
  await saveLobby(gameCode, lobby);
  return lobby;
};
