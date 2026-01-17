import type { ApiResponse } from "@/api";
import { api } from "@/lib/axios";

export type InitialResponse = ApiResponse<{
  userId: string;
  username: string;
  avatar: string;
  serverNow: string;
}>;

export type ProfileUserResponse = ApiResponse<{
  userId: string;
  username: string;
  avatar: string;
}>;

type RegisterRequest = {
  username: string;
  email: string;
  password: string;
  verificationCode: string;
};

export const registerUser = async (data: RegisterRequest) => {
  const res = await api.post<ProfileUserResponse>("/auth/register", data);
  return res.data;
};

type LoginRequest = {
  email: string;
  password: string;
};

export const loginUser = async (data: LoginRequest) => {
  const res = await api.post<ProfileUserResponse>("/auth/login", data);
  return res.data;
};

type ResetPasswordRequest = {
  email: string;
  password: string;
  verificationCode: string;
};

export const resetPasswordUser = async (data: ResetPasswordRequest) => {
  const res = await api.post<ProfileUserResponse>("/auth/reset", data);
  return res.data;
};

export const logoutUser = async () => {
  const res = await api.post<ApiResponse<null>>("/auth/logout");
  return res.data;
};

export const initialGetUser = async () => {
  const res = await api.get<InitialResponse>("/auth/initial");
  return res.data;
};

type sendCodeRequest = {
  email: string;
};

export const sendCode = async (data: sendCodeRequest) => {
  const res = await api.post<ApiResponse<null>>("/auth/code", data);
  return res.data;
};

type EditProfileRequest = {
  username: string;
  avatar: string;
};
export const editProfile = async (data: EditProfileRequest) => {
  const res = await api.post<ProfileUserResponse>("/auth/edit-profile", data);
  return res.data;
};
