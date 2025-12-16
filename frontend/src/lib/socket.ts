import { io } from "socket.io-client";

export const socket = io("http://localhost:2000", {
  withCredentials: true,
});
