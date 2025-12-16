import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupLobbySocket } from "./lobby-socket.js";

export const setupSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3221",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    setupLobbySocket(io, socket);
  });

  return io;
};
