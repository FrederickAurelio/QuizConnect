import type { ApiResponse } from "@/api";
import { api } from "@/lib/axios";
import type { Question } from "@/pages/create-page";

export type AnswerLog = {
  _id: string;
  optionIndex: number | null;
  key: ("A" | "B" | "C" | "D") | null;
  score?: number;
};

export type UserInfo = {
  _id: string;
  username: string;
  avatar: string;
  totalScore?: number;
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
  };
  status: "lobby" | "started" | "ended";

  gameState: {
    startTime: string;
    duration: number;
    status: "question" | "result" | "cooldown";
    questionIndex: number;
  };
  sessionCreatedAt: string;
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

export const getYourAnswer = async (gameCode: string) => {
  const res = await api.get<ApiResponse<AnswerLog[]>>(
    `/sessions/answer/${gameCode}`,
  );
  return res.data;
};

export const checkLobbyStatus = async (gameCode: string) => {
  const res = await api.post<ApiResponse<{ gameCode: string }>>(
    `/sessions/check/${gameCode}`,
  );
  return res.data;
};
