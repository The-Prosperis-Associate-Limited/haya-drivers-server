import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt, { Secret } from "jsonwebtoken";
import { CustomJwtPayload, Role } from "../interface";

const { ACCESS_TOKEN_SECRET } = process.env;

interface SocketData {
  userId: string;
  userRole: Role;
}

type TypedSocket = Socket<any, any, any, SocketData>;
type TypedServer = Server<any, any, any, SocketData>;

let io: TypedServer;

export const initializeSocket = function (server: HttpServer): TypedServer {
  io = new Server(server, {
    cors: { origin: true, credentials: true },
  });

  io.on("connection", (socket: TypedSocket) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const { id, role } = jwt.verify(token, ACCESS_TOKEN_SECRET as Secret) as CustomJwtPayload;

      socket.data.userId = id;
      socket.data.userRole = role;

      socket.join(id);

      if (role === "ADMIN") socket.join("support-pool");
    } catch {
      socket.disconnect();
      return;
    }

    socket.on("disconnect", () => {});
  });

  return io;
};

export const getSocketIO = function (): TypedServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

export const notifyUser = function (userId: string, notification: unknown): void {
  io?.to(userId).emit("notification", notification);
};

export const notifySupportPool = function (data: unknown): void {
  io?.to("support-pool").emit("support-notification", data);
};
