import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../../shared/types";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.DEV ? `http://${window.location.hostname}:3001` : "/",
  { transports: ["websocket"] },
);