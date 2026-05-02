import { DEFAULT_PREMIUM_MAP_ID, PREMIUM_MAP_OPTIONS, type MatchConfig, type PremiumMapId } from "@d-m4th/config";
import type { BoardTile, Placement, PrivatePlayerPayload, PublicSnapshot, ScoreBreakdown } from "@d-m4th/game";

export type ClientMessage =
  | { type: "room:create"; requestId: string; name: string; color: string; config?: MatchConfig }
  | { type: "room:join"; requestId: string; code: string; name: string; color: string }
  | { type: "room:resume"; requestId: string; code: string; reconnectToken: string }
  | { type: "room:leave"; requestId: string }
  | { type: "match:configure"; requestId: string; config: MatchConfig }
  | { type: "match:start"; requestId: string }
  | { type: "placement:draft"; requestId: string; placements: Placement[] }
  | { type: "play:preview"; requestId: string; placements: Placement[] }
  | { type: "play:commit"; requestId: string; placements: Placement[] }
  | { type: "turn:swap"; requestId: string; tileIds: string[] }
  | { type: "turn:pass"; requestId: string }
  | { type: "rack:recall"; requestId: string };

export type ServerMessage =
  | { type: "room:snapshot"; snapshot: PublicSnapshot; private?: PrivatePlayerPayload & { reconnectToken?: string } }
  | { type: "room:presence"; ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }> }
  | { type: "play:previewed"; requestId: string; score: ScoreBreakdown }
  | { type: "action:accepted"; requestId: string; action: string; roomCode?: string; reconnectToken?: string }
  | { type: "action:rejected"; requestId?: string; reason: string; statusCode?: number; roomCode?: string }
  | { type: "match:ended"; snapshot: PublicSnapshot };

export interface ReconnectIssueRequest {
  roomCode: string;
  playerId: string;
}

export interface ReconnectIssueResponse {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  expiresAtMs: number;
}

export interface ReconnectResumeRequest {
  roomCode: string;
  playerId?: string;
  reconnectToken: string;
}

export interface ReconnectResumeResponse {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  expiresAtMs: number;
}

export function parseClientMessage(rawMessage: string): ClientMessage {
  const parsed: unknown = JSON.parse(rawMessage);

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("Invalid protocol message");
  }

  switch (parsed.type) {
    case "room:create":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId"),
        name: readString(parsed, "name"),
        color: readString(parsed, "color"),
        config: readOptionalConfig(parsed.config)
      };
    case "room:join":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId"),
        code: readString(parsed, "code").toUpperCase(),
        name: readString(parsed, "name"),
        color: readString(parsed, "color")
      };
    case "room:resume":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId"),
        code: readString(parsed, "code").toUpperCase(),
        reconnectToken: readString(parsed, "reconnectToken")
      };
    case "room:leave":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId")
      };
    case "match:configure":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId"),
        config: readConfig(parsed.config)
      };
    case "match:start":
    case "rack:recall":
    case "turn:pass":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId")
      };
    case "placement:draft":
    case "play:preview":
    case "play:commit":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId"),
        placements: readPlacements(parsed.placements)
      };
    case "turn:swap":
      return {
        type: parsed.type,
        requestId: readString(parsed, "requestId"),
        tileIds: readStringArray(parsed.tileIds)
      };
    default:
      throw new Error(`Unsupported protocol message: ${parsed.type}`);
  }
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

export function parseReconnectIssueRequest(payload: unknown): ReconnectIssueRequest {
  if (!isRecord(payload)) {
    throw new Error("Request body must be an object");
  }

  return {
    roomCode: readString(payload, "roomCode").toUpperCase(),
    playerId: readString(payload, "playerId")
  };
}

export function parseReconnectResumeRequest(payload: unknown): ReconnectResumeRequest {
  if (!isRecord(payload)) {
    throw new Error("Request body must be an object");
  }

  return {
    roomCode: readString(payload, "roomCode").toUpperCase(),
    playerId: readOptionalString(payload, "playerId"),
    reconnectToken: readString(payload, "reconnectToken")
  };
}

function readPlacements(value: unknown): Placement[] {
  if (!Array.isArray(value)) {
    throw new Error("placements must be an array");
  }

  return value.map((placement) => {
    if (!isRecord(placement)) {
      throw new Error("placement must be an object");
    }

    return {
      tileId: readString(placement, "tileId"),
      x: readInteger(placement, "x"),
      y: readInteger(placement, "y"),
      face: readOptionalString(placement, "face")
    };
  });
}

function readOptionalConfig(value: unknown): MatchConfig | undefined {
  return value === undefined ? undefined : readConfig(value);
}

function readConfig(value: unknown): MatchConfig {
  if (!isRecord(value)) {
    throw new Error("config must be an object");
  }

  const mode = readString(value, "mode");

  if (mode !== "classical" && mode !== "party") {
    throw new Error("config mode must be classical or party");
  }

  return {
    mode,
    boardSize: readInteger(value, "boardSize"),
    premiumMapId: readOptionalPremiumMapId(value, "premiumMapId"),
    minPlayers: readInteger(value, "minPlayers"),
    maxPlayers: readInteger(value, "maxPlayers"),
    rackSize: readInteger(value, "rackSize"),
    totalTimeMs: readInteger(value, "totalTimeMs"),
    turnTimeMs: readInteger(value, "turnTimeMs"),
    incrementMs: readInteger(value, "incrementMs"),
    skillNodesEnabled: readBoolean(value, "skillNodesEnabled")
  };
}

function readOptionalPremiumMapId(record: Record<string, unknown>, key: string): PremiumMapId {
  const value = record[key];

  if (value === undefined) {
    return DEFAULT_PREMIUM_MAP_ID;
  }

  if (typeof value !== "string" || !isPremiumMapId(value)) {
    throw new Error(`${key} must be a supported premium map`);
  }

  return value;
}

function isPremiumMapId(value: string): value is PremiumMapId {
  return PREMIUM_MAP_OPTIONS.some((option) => option.id === value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected string array");
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("Expected string array");
    }

    return item;
  });
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }

  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }

  return value;
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }

  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
