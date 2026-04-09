import type { ApiRequestQuery, ApiResponse, ApiResponseQuery } from "@/api";
import type { UserInfo } from "@/api/sessions";
import { api } from "@/lib/axios";
import type { Question } from "@/pages/create-page";

export type AiExplanationPayload = {
  verifiedCorrectKey: "A" | "B" | "C" | "D";
  agreesWithQuizKey: boolean;
  rationale: string;
  feedback: string;
  sources: { title: string; urlOrNote: string }[];
};

export type AiExplanationEnvelope = {
  payload: AiExplanationPayload;
  model: string;
  createdAt: string;
  schemaVersion: number;
};

export type PostHistoryExplainResponseData = {
  explanation?: AiExplanationEnvelope;
  cached?: boolean;
  coalesced?: boolean;
  status?: "processing";
  retryAfterMs?: number;
};

type GetHistoriesRequest = ApiRequestQuery & {
  type: "play" | "host";
};

export interface AnswerLog {
  _id: string;
  questionIndex: number;
  optionIndex: number | null;
  key: "A" | "B" | "C" | "D" | null;
  score: number;
}

export interface PlayerSnapshot {
  _id: string;
  userId: string | null;
  guestId: string | null;
  username: string;
  avatar: string;
  totalScore: number;
}

export interface HistoryList {
  _id: string;
  gameCode: string;
  quiz: {
    title: string;
    description: string;
    questionCount: number;
  };
  playerCount: number;
  host: UserInfo;
  winner?: PlayerSnapshot;
  myResult?: {
    totalScore: number;
    rank: number;
  }[];
  sessionCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryDetailBase {
  _id: string;
  gameCode: string;
  quiz: {
    title: string;
    description: string;
    questions: Question[];
  };
  host: PlayerSnapshot;
  players: PlayerSnapshot[];
  settings: {
    maxPlayers: number;
    questionCount: number;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    timePerQuestion: string;
    cooldown: string;
  };
  sessionCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryDetailHostView extends HistoryDetailBase {
  playersAnswer: AnswerLog[][];
  myAnswer: null;
}

export interface HistoryDetailPlayerView extends HistoryDetailBase {
  playersAnswer: null;
  myAnswer: AnswerLog[];
}

export type HistoryDetail = HistoryDetailHostView | HistoryDetailPlayerView;

export const getHistories = async ({
  page = 1,
  pageSize = 10,
  type,
}: GetHistoriesRequest) => {
  const res = await api.get<ApiResponseQuery<HistoryList>>(
    `/history?page=${page}&pageSize=${pageSize}&type=${type}`,
  );
  return res.data;
};

export const getHistoryDetail = async (gameId: string) => {
  const res = await api.get<ApiResponse<HistoryDetail>>(`/history/${gameId}`);

  const data = {
    ...res.data.data,
    players: res.data.data?.players.map((p) => ({
      ...p,
      _id: p.guestId || p.userId || "",
    })),
  };
  const resData = { ...res.data, data: data };
  return resData as ApiResponse<HistoryDetail>;
};

export const postHistoryQuestionExplain = async (
  gameId: string,
  body: { questionIndex: number },
) => {
  const res = await api.post<ApiResponse<PostHistoryExplainResponseData>>(
    `/history/${gameId}/explain`,
    body,
    {
      timeout: 120_000,
      validateStatus: (status) => status === 200 || status === 202,
    },
  );
  return res.data;
};
