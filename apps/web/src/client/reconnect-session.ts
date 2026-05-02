const STORAGE_PREFIX = "d-m4th:reconnect:";

interface StoredReconnectSession {
  roomCode: string;
  reconnectToken: string;
  updatedAt: number;
}

export interface ReconnectSession {
  roomCode: string;
  reconnectToken: string;
}

export function readReconnectSession(roomCode: string): ReconnectSession | undefined {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  if (!normalizedRoomCode) {
    return undefined;
  }

  const raw = window.localStorage.getItem(storageKey(normalizedRoomCode));
  if (!raw) {
    return undefined;
  }

  const parsed = parseStoredSession(raw);
  if (!parsed) {
    window.localStorage.removeItem(storageKey(normalizedRoomCode));
    return undefined;
  }

  if (parsed.roomCode !== normalizedRoomCode) {
    window.localStorage.removeItem(storageKey(normalizedRoomCode));
    return undefined;
  }

  return { roomCode: parsed.roomCode, reconnectToken: parsed.reconnectToken };
}

export function readLatestReconnectSession(): ReconnectSession | undefined {
  let latest: StoredReconnectSession | undefined;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(STORAGE_PREFIX)) {
      continue;
    }

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    const parsed = parseStoredSession(raw);
    if (!parsed) {
      window.localStorage.removeItem(key);
      continue;
    }

    if (!latest || parsed.updatedAt > latest.updatedAt) {
      latest = parsed;
    }
  }

  return latest ? { roomCode: latest.roomCode, reconnectToken: latest.reconnectToken } : undefined;
}

export function writeReconnectSession(session: ReconnectSession): void {
  const normalizedRoomCode = normalizeRoomCode(session.roomCode);
  if (!normalizedRoomCode || !session.reconnectToken.trim()) {
    return;
  }

  const payload: StoredReconnectSession = {
    roomCode: normalizedRoomCode,
    reconnectToken: session.reconnectToken,
    updatedAt: Date.now()
  };
  window.localStorage.setItem(storageKey(normalizedRoomCode), JSON.stringify(payload));
}

export function clearReconnectSession(roomCode: string): void {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  if (!normalizedRoomCode) {
    return;
  }
  window.localStorage.removeItem(storageKey(normalizedRoomCode));
}

function parseStoredSession(raw: string): StoredReconnectSession | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return undefined;
    }

    const roomCode = normalizeRoomCode(readString(parsed, "roomCode"));
    const reconnectToken = readString(parsed, "reconnectToken").trim();
    const updatedAt = readNumber(parsed, "updatedAt");

    if (!roomCode || !reconnectToken) {
      return undefined;
    }

    return { roomCode, reconnectToken, updatedAt };
  } catch (error) {
    console.warn("Failed to parse reconnect session from localStorage", error);
    return undefined;
  }
}

function storageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${normalizeRoomCode(roomCode)}`;
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
