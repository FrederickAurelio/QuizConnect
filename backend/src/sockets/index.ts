import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupLobbySocket } from "./lobby-socket.js";

export const setupSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3221",
      credentials: true,
    },
    // Ensure the server is listening for the path Vite is proxying
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    setupLobbySocket(io, socket);

    const user = socket.data.user;
    socket.join(`user:${user._id}`);
  });

  return io;
};
