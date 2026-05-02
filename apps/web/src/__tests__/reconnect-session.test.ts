import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import {
  clearReconnectSession,
  readLatestReconnectSession,
  readReconnectSession,
  writeReconnectSession
} from "../reconnect-session";

const ORIGINAL_WARN = console.warn;
const ORIGINAL_WINDOW = globalThis.window;

describe("reconnect-session", () => {
  beforeEach(() => {
    globalThis.window = { localStorage: createLocalStorageMock() } as Window & typeof globalThis;
    window.localStorage.clear();
    console.warn = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.warn = ORIGINAL_WARN;
    globalThis.window = ORIGINAL_WINDOW;
  });

  test("writes and reads room-scoped reconnect session", () => {
    writeReconnectSession({ roomCode: "ab12cd", reconnectToken: "token-a" });

    expect(readReconnectSession("AB12CD")).toEqual({
      roomCode: "AB12CD",
      reconnectToken: "token-a"
    });
  });

  test("returns latest reconnect session across rooms", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(100).mockReturnValueOnce(200);

    writeReconnectSession({ roomCode: "AAAAAA", reconnectToken: "token-a" });
    writeReconnectSession({ roomCode: "BBBBBB", reconnectToken: "token-b" });

    expect(readLatestReconnectSession()).toEqual({
      roomCode: "BBBBBB",
      reconnectToken: "token-b"
    });
  });

  test("clears malformed payload and returns undefined", () => {
    window.localStorage.setItem("d-m4th:reconnect:ROOM42", "{bad json");

    expect(readReconnectSession("ROOM42")).toBeUndefined();
    expect(window.localStorage.getItem("d-m4th:reconnect:ROOM42")).toBeNull();
  });

  test("clears reconnect session by room code", () => {
    writeReconnectSession({ roomCode: "AB12CD", reconnectToken: "token-a" });

    clearReconnectSession("ab12cd");

    expect(readReconnectSession("AB12CD")).toBeUndefined();
  });
});

function createLocalStorageMock(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}
