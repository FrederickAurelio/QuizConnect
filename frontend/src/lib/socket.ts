import { io } from "socket.io-client";

export const socket = io("/socket.io", {
  withCredentials: true,
  autoConnect: false,
});
