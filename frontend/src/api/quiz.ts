import type { ApiRequestQuery, ApiResponse, ApiResponseQuery } from "@/api";
import { api } from "@/lib/axios";
import type { Quiz } from "@/pages/create-page";

export type QuizBackend = Quiz & {
  draft: boolean;
  _id?: string;
  updatedAt?: string;
};

// Lightweight quiz item returned from backend
export type QuizListItem = {
  _id: string;
  title: string;
  description: string;
  draft: boolean;
  questionCount: number;
  updatedAt: string;
};

export const createQuiz = async (data: QuizBackend) => {
  const res = await api.post<ApiResponse<QuizBackend>>("/quiz/create", data);
  return res.data;
};

export const updateQuiz = async (data: {
  data: QuizBackend;
  quizId: string;
}) => {
  const res = await api.put<ApiResponse<QuizBackend>>(
    `/quiz/update/${data.quizId}`,
    data.data,
  );
  return res.data;
};

export const deleteQuiz = async (quizId: string) => {
  const res = await api.delete<ApiResponse<null>>(`/quiz/delete/${quizId}`);
  return res.data;
};

export const copyQuiz = async (quizId: string) => {
  const res = await api.post<ApiResponse<QuizBackend>>(`/quiz/copy/${quizId}`);
  return res.data;
};

type getQuizzesRequest = ApiRequestQuery & {
  draftOnly?: boolean;
  readyOnly?: boolean;
};

export const getQuizzes = async ({
  page = 1,
  pageSize = 10,
  draftOnly = false,
  readyOnly = false,
}: getQuizzesRequest) => {
  const res = await api.get<ApiResponseQuery<QuizListItem>>(
    `/quiz?page=${page}&pageSize=${pageSize}&draftOnly=${draftOnly}&readyOnly=${readyOnly}`,
  );
  return res.data;
};

export const getDetailQuiz = async (quizId: string) => {
  const res = await api.get<ApiResponse<QuizBackend>>(`/quiz/${quizId}`);
  return res.data;
};
