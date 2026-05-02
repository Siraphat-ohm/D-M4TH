import type { ClientMessage, ServerMessage } from "@d-m4th/protocol";

export type MessageHandler = (message: ServerMessage) => void;

const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 15_000;
const MAX_RECONNECT_ATTEMPTS = 20;
const MAX_BUFFER_SIZE = 200;

export class ProtocolClient {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private intentionallyClosed = false;
  private messageBuffer: ClientMessage[] = [];

  constructor(
    private readonly url: string,
    private readonly onMessage: MessageHandler,
    private readonly onStatus: (connected: boolean) => void
  ) {}

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.intentionallyClosed = false;
    this.openSocket();
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    this.messageBuffer.push(message);
    if (this.messageBuffer.length > MAX_BUFFER_SIZE) {
      this.messageBuffer.shift();
    }

    this.connect();
  }

  close(): void {
    this.intentionallyClosed = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.messageBuffer = [];
    const socket = this.socket;
    this.socket = undefined;

    if (!socket) return;
    if (socket.readyState === WebSocket.CONNECTING) {
      return;
    }

    socket.close();
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private openSocket(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket !== socket || this.intentionallyClosed) {
        socket.close();
        return;
      }
      this.reconnectAttempts = 0;
      this.flushBuffer();
      this.onStatus(true);
    });

    socket.addEventListener("message", (event) => {
      if (this.socket !== socket || this.intentionallyClosed) {
        return;
      }
      const message = parseServerMessage(event.data);
      if (message) {
        this.onMessage(message);
      }
    });

    socket.addEventListener("error", () => {
      // error event is always followed by close; reconnection handled there
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = undefined;
      this.onStatus(false);
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    const jitter = Math.random() * BASE_RECONNECT_DELAY_MS;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts + jitter, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private flushBuffer(): void {
    while (this.messageBuffer.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(this.messageBuffer.shift()!));
    }
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

function parseServerMessage(raw: unknown): ServerMessage | undefined {
  try {
    return JSON.parse(String(raw)) as ServerMessage;
  } catch (error) {
    console.warn("Ignored malformed server message", error);
    return undefined;
  }
}
