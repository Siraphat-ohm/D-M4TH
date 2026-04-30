import type { ClientMessage, ServerMessage } from "@d-m4th/protocol";

export type MessageHandler = (message: ServerMessage) => void;

export class ProtocolClient {
  private socket?: WebSocket;

  constructor(
    private readonly url: string,
    private readonly onMessage: MessageHandler,
    private readonly onStatus: (connected: boolean) => void
  ) {}

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => this.onStatus(true));
    socket.addEventListener("close", () => this.onStatus(false));
    socket.addEventListener("message", (event) => {
      this.onMessage(JSON.parse(String(event.data)) as ServerMessage);
    });
  }

  send(message: ClientMessage): void {
    this.connect();
    this.socket?.send(JSON.stringify(message));
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function defaultWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_SERVER_URL as string | undefined;

  if (configuredUrl) {
    return configuredUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:2567/ws`;
}
