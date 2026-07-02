import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupLobbySocket, startLobbyTimeoutWorker } from "./lobby-socket.js";

export const setupSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    setupLobbySocket(io, socket);
  });

  startLobbyTimeoutWorker(io);

  return io;
};
