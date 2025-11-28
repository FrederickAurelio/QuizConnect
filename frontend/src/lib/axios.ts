import type { ApiResponse } from "@/api";
import axios, { AxiosError } from "axios";
import { toast } from "sonner";

export const api = axios.create({
  baseURL: "/api", // ⬅️ IMPORTANT: Vite will proxy this or Nginx When in production
  withCredentials: true,
  timeout: 10000,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // 1) Backend returned HTML (Vite 500 OR Nginx 502/504)
    if (error.response && typeof error.response.data === "string") {
      error.response = {
        data: {
          message: "Server is offline or unreachable.",
          data: null,
          errors: null,
        },
      } as any;
    }

    // If backend is down or network fails → create a predefined message
    if (error.code === "ERR_NETWORK") {
      error.response = {
        data: {
          message: "Cannot reach server. Please try again later.",
          data: null,
          errors: null,
        },
      } as any;
    }

    // If timeout occurs
    if (error.code === "ECONNABORTED") {
      error.response = {
        data: {
          message: "Request timed out. Please retry.",
          data: null,
          errors: null,
        },
      } as any;
    }

    return Promise.reject(error);
  }
);

export const handleGeneralError = (error: AxiosError<ApiResponse<null>>) => {
  const msg =
    error.response?.data?.message ?? error.message ?? "Something went wrong";
  toast.error(msg);
};

export const handleGeneralSuccess = (data: ApiResponse<any>) => {
  toast.success(data.message ?? "Success");
};
