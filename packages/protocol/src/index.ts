import type { MatchConfig } from "@d-m4th/config";
import type { BoardTile, Placement, PrivatePlayerPayload, PublicSnapshot, ScoreBreakdown } from "@d-m4th/game";

export type ClientMessage =
  | { type: "room:create"; requestId: string; name: string; color: string; config?: MatchConfig }
  | { type: "room:join"; requestId: string; code: string; name: string; color: string }
  | { type: "match:configure"; requestId: string; config: MatchConfig }
  | { type: "match:start"; requestId: string }
  | { type: "placement:draft"; requestId: string; placements: Placement[] }
  | { type: "play:preview"; requestId: string; placements: Placement[] }
  | { type: "play:commit"; requestId: string; placements: Placement[] }
  | { type: "turn:swap"; requestId: string; tileIds: string[] }
  | { type: "turn:pass"; requestId: string }
  | { type: "rack:recall"; requestId: string };

export type ServerMessage =
  | { type: "room:snapshot"; snapshot: PublicSnapshot; private?: PrivatePlayerPayload }
  | { type: "placement:ghost"; playerId: string; placements: BoardTile[] }
  | { type: "play:previewed"; requestId: string; score: ScoreBreakdown }
  | { type: "action:accepted"; requestId: string; action: string }
  | { type: "action:rejected"; requestId?: string; reason: string }
  | { type: "match:ended"; snapshot: PublicSnapshot };

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
    minPlayers: readInteger(value, "minPlayers"),
    maxPlayers: readInteger(value, "maxPlayers"),
    rackSize: readInteger(value, "rackSize"),
    totalTimeMs: readInteger(value, "totalTimeMs"),
    turnTimeMs: readInteger(value, "turnTimeMs"),
    incrementMs: readInteger(value, "incrementMs"),
    skillNodesEnabled: readBoolean(value, "skillNodesEnabled")
  };
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
