import { GameEngine, type BoardTile, type MatchState, type Placement, type Player, getPlayer as readPlayer } from "@d-m4th/game";
import { faceOptionsForTileLabel, tileRequiresFace } from "@d-m4th/game";
import { encodeServerMessage, parseClientMessage, type ClientMessage, type ServerMessage } from "@d-m4th/protocol";

export interface RoomConnection {
  id: string;
  send(message: string): void;
}

interface RoomSession {
  roomCode: string;
  playerId: string;
}

interface RoomRecord {
  match: MatchState;
  connections: Map<string, RoomConnection>;
  sessions: Map<string, RoomSession>;
  ghostPlacements: Map<string, BoardTile[]>;
}

export class RoomRegistry {
  private readonly roomsByCode = new Map<string, RoomRecord>();
  private readonly sessionsByConnection = new Map<string, RoomSession>();

  constructor(private readonly engine = new GameEngine()) {}

  handleRawMessage(connection: RoomConnection, rawMessage: string): void {
    try {
      this.handleMessage(connection, parseClientMessage(rawMessage));
    } catch (error) {
      this.send(connection, {
        type: "action:rejected",
        reason: error instanceof Error ? error.message : "Invalid request"
      });
    }
  }

  disconnect(connection: RoomConnection): void {
    const session = this.sessionsByConnection.get(connection.id);

    if (!session) {
      return;
    }

    const room = this.roomsByCode.get(session.roomCode);
    if (room) {
      room.connections.delete(connection.id);
      room.sessions.delete(connection.id);
      room.ghostPlacements.delete(session.playerId);
      this.broadcastPresence(room, connection.id);

      const player = room.match.players.find((candidate) => candidate.id === session.playerId);
      if (player) {
        player.connected = false;
        this.broadcastSnapshot(room);
      }
    }

    this.sessionsByConnection.delete(connection.id);
  }

  getRoom(code: string): MatchState | undefined {
    return this.roomsByCode.get(code.toUpperCase())?.match;
  }

  private handleMessage(connection: RoomConnection, message: ClientMessage): void {
    switch (message.type) {
      case "room:create":
        this.createRoom(connection, message);
        break;
      case "room:join":
        this.joinRoom(connection, message);
        break;
      case "match:configure":
        this.configureMatch(connection, message);
        break;
      case "match:start":
        this.startMatch(connection, message);
        break;
      case "placement:draft":
        this.draftPlacement(connection, message);
        break;
      case "play:preview":
        this.previewPlay(connection, message);
        break;
      case "play:commit":
        this.commitPlay(connection, message);
        break;
      case "turn:swap":
        this.swapTiles(connection, message);
        break;
      case "turn:pass":
        this.passTurn(connection, message);
        break;
      case "rack:recall":
        this.recallRack(connection, message);
        break;
    }
  }

  private createRoom(connection: RoomConnection, message: Extract<ClientMessage, { type: "room:create" }>): void {
    const match = this.engine.createMatch({
      hostName: message.name,
      hostColor: message.color,
      config: message.config
    });
    const host = match.players[0];
    const room: RoomRecord = {
      match,
      connections: new Map(),
      sessions: new Map(),
      ghostPlacements: new Map()
    };

    this.roomsByCode.set(match.code, room);
    this.attach(connection, room, host.id);
    this.send(connection, { type: "action:accepted", requestId: message.requestId, action: "room:create" });
    this.broadcastSnapshot(room);
  }

  private joinRoom(connection: RoomConnection, message: Extract<ClientMessage, { type: "room:join" }>): void {
    const room = this.readRoom(message.code);
    const result = this.engine.joinMatch(room.match, { name: message.name, color: message.color });

    if (!result.ok || !result.value) {
      this.reject(connection, message.requestId, result.error);
      return;
    }

    this.attach(connection, room, result.value.id);
    this.send(connection, { type: "action:accepted", requestId: message.requestId, action: "room:join" });
    this.broadcastSnapshot(room);
  }

  private configureMatch(connection: RoomConnection, message: Extract<ClientMessage, { type: "match:configure" }>): void {
    const room = this.readSessionRoom(connection);
    const result = this.engine.configureMatch(room.match, message.config);
    this.acceptOrReject(connection, message.requestId, result.ok, result.error, "match:configure");
    this.broadcastSnapshot(room);
  }

  private startMatch(connection: RoomConnection, message: Extract<ClientMessage, { type: "match:start" }>): void {
    const room = this.readSessionRoom(connection);
    const result = this.engine.startMatch(room.match);
    this.acceptOrReject(connection, message.requestId, result.ok, result.error, "match:start");
    this.broadcastSnapshot(room);
  }

  private draftPlacement(connection: RoomConnection, message: Extract<ClientMessage, { type: "placement:draft" }>): void {
    const room = this.readSessionRoom(connection);
    const session = this.readSession(connection);
    const player = readPlayer(room.match, session.playerId);
    const rackById = new Map(player.rack.map((tile) => [tile.id, tile]));

    const ghostTiles: BoardTile[] = message.placements.map((p) => {
      const rackTile = rackById.get(p.tileId);
      return {
        id: p.tileId,
        label: p.face ?? rackTile?.label ?? "?",
        value: rackTile?.value ?? 0,
        x: p.x,
        y: p.y,
        ownerId: player.id
      };
    });

    room.ghostPlacements.set(session.playerId, ghostTiles);
    this.broadcastPresence(room, connection.id);
  }

  private previewPlay(connection: RoomConnection, message: Extract<ClientMessage, { type: "play:preview" }>): void {
    const room = this.readSessionRoom(connection);
    const session = this.readSession(connection);
    const result = this.engine.previewPlay(room.match, session.playerId, message.placements);

    if (!result.ok || !result.value) {
      this.reject(connection, message.requestId, result.error);
      return;
    }

    this.send(connection, { type: "play:previewed", requestId: message.requestId, score: result.value });
  }

  private commitPlay(connection: RoomConnection, message: Extract<ClientMessage, { type: "play:commit" }>): void {
    const room = this.readSessionRoom(connection);
    const session = this.readSession(connection);
    const result = this.engine.commitPlay(room.match, session.playerId, message.placements);

    if (!result.ok) {
      this.reject(connection, message.requestId, result.error);
      return;
    }

    room.ghostPlacements.delete(session.playerId);
    this.broadcastPresence(room, connection.id);
    this.send(connection, { type: "action:accepted", requestId: message.requestId, action: "play:commit" });
    this.broadcastSnapshot(room);
    this.broadcastEndedIfNeeded(room);
  }

  private swapTiles(connection: RoomConnection, message: Extract<ClientMessage, { type: "turn:swap" }>): void {
    const room = this.readSessionRoom(connection);
    const session = this.readSession(connection);
    const result = this.engine.swapTiles(room.match, session.playerId, message.tileIds);

    if (result.ok) {
      room.ghostPlacements.delete(session.playerId);
      this.broadcastPresence(room, connection.id);
    }

    this.acceptOrReject(connection, message.requestId, result.ok, result.error, "turn:swap");
    this.broadcastSnapshot(room);
  }

  private passTurn(connection: RoomConnection, message: Extract<ClientMessage, { type: "turn:pass" }>): void {
    const room = this.readSessionRoom(connection);
    const session = this.readSession(connection);
    const result = this.engine.passTurn(room.match, session.playerId);

    if (result.ok) {
      room.ghostPlacements.delete(session.playerId);
      this.broadcastPresence(room, connection.id);
    }

    this.acceptOrReject(connection, message.requestId, result.ok, result.error, "turn:pass");
    this.broadcastSnapshot(room);
    this.broadcastEndedIfNeeded(room);
  }

  private recallRack(connection: RoomConnection, message: Extract<ClientMessage, { type: "rack:recall" }>): void {
    const room = this.readSessionRoom(connection);
    const session = this.readSession(connection);
    room.ghostPlacements.delete(session.playerId);
    this.broadcastPresence(room, connection.id);
    this.send(connection, { type: "action:accepted", requestId: message.requestId, action: "rack:recall" });
    this.broadcastSnapshot(room);
  }

  private attach(connection: RoomConnection, room: RoomRecord, playerId: string): void {
    const session = { roomCode: room.match.code, playerId };
    room.connections.set(connection.id, connection);
    room.sessions.set(connection.id, session);
    this.sessionsByConnection.set(connection.id, session);
    readPlayer(room.match, playerId).connected = true;
  }

  private broadcastSnapshot(room: RoomRecord | undefined): void {
    if (!room) {
      return;
    }

    for (const [connectionId, connection] of room.connections) {
      const session = room.sessions.get(connectionId);
      const message = {
        type: "room:snapshot",
        snapshot: this.engine.createSnapshot(room.match),
        private: session ? this.engine.createPrivatePayload(room.match, session.playerId) : undefined
      } satisfies ServerMessage;
      this.send(connection, message);
    }
  }

  private broadcastPresence(room: RoomRecord, exceptConnectionId?: string): void {
    const ghostPlacements = [...room.ghostPlacements].map(([playerId, placements]) => ({ playerId, placements }));
    this.broadcast(room, { type: "room:presence", ghostPlacements }, exceptConnectionId);
  }

  private broadcastEndedIfNeeded(room: RoomRecord): void {
    if (room.match.status !== "ended") {
      return;
    }

    this.broadcast(room, { type: "match:ended", snapshot: this.engine.createSnapshot(room.match) });
  }

  private broadcast(room: RoomRecord, message: ServerMessage, exceptConnectionId?: string): void {
    for (const connection of room.connections.values()) {
      if (connection.id !== exceptConnectionId) {
        this.send(connection, message);
      }
    }
  }

  private acceptOrReject(
    connection: RoomConnection,
    requestId: string,
    ok: boolean,
    error: string | undefined,
    action: string
  ): void {
    if (ok) {
      this.send(connection, { type: "action:accepted", requestId, action });
      return;
    }

    this.reject(connection, requestId, error);
  }

  private reject(connection: RoomConnection, requestId: string | undefined, reason = "Action rejected"): void {
    this.send(connection, { type: "action:rejected", requestId, reason });
  }

  private send(connection: RoomConnection, message: ServerMessage): void {
    connection.send(encodeServerMessage(message));
  }

  private readSession(connection: RoomConnection): RoomSession {
    const session = this.sessionsByConnection.get(connection.id);

    if (!session) {
      throw new Error("Connection is not in a room");
    }

    return session;
  }

  private readSessionRoom(connection: RoomConnection): RoomRecord {
    return this.readRoom(this.readSession(connection).roomCode);
  }

  private readRoom(code: string): RoomRecord {
    const room = this.roomsByCode.get(code.toUpperCase());

    if (!room) {
      throw new Error("Room not found");
    }

    return room;
  }
}
