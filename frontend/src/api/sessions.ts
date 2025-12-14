import type { ApiRequestQuery, ApiResponse, ApiResponseQuery } from "@/api";
import { api } from "@/lib/axios";

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
  host: UserInfo;
  quiz: QuizInfo;
  settings: GameSettings;
  players: UserInfo[];
  status: "lobby" | "started" | "ended";
  createdAt: number;
};

export const hostQuiz = async (quizId: string) => {
  const res = await api.post<ApiResponse<{ gameCode: string }>>(
    `/sessions/host`,
    {
      quizId,
    },
  );
  return res.data;
};

export const getLobby = async (gameCode: string) => {
  const res = await api.get<ApiResponse<LobbyState>>(`/sessions/${gameCode}`);
  return res.data;
};
