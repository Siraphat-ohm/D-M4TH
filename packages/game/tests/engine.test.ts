import { describe, expect, test } from "bun:test";
import { createClassicalConfig, createPartyConfig } from "@d-m4th/config";
import { GameEngine } from "../src/engine";
import type { MatchState, Player, Tile } from "../src/types";
import { createTileSet } from "../src/tile-catalog";

describe("game engine", () => {
  test("normalizes unsafe party config when creating a match", () => {
    const engine = new GameEngine();
    const unsafePartyConfig = {
      ...createPartyConfig({ boardSize: 19, maxPlayers: 4, premiumMapId: "cross" }),
      boardSize: 14,
      maxPlayers: 99
    };

    const match = engine.createMatch({
      hostName: "Ada",
      hostColor: "#f97316",
      config: unsafePartyConfig
    });

    expect(match.config.mode).toBe("party");
    expect(match.config.boardSize).toBe(15);
    expect(match.config.maxPlayers).toBe(6);
    expect(match.config.premiumMapId).toBe("cross");
  });

  test("normalizes unsafe classical config when configuring a lobby match", () => {
    const engine = new GameEngine();
    const match = engine.createMatch({ hostName: "Ada", hostColor: "#f97316", config: createClassicalConfig() });
    const unsafeClassicalConfig = {
      ...createClassicalConfig(),
      boardSize: 23,
      maxPlayers: 6,
      premiumMapId: "cross" as const
    };

    const result = engine.configureMatch(match, unsafeClassicalConfig);

    expect(result.ok).toBe(true);
    expect(match.config.mode).toBe("classical");
    expect(match.config.boardSize).toBe(15);
    expect(match.config.maxPlayers).toBe(2);
    expect(match.config.premiumMapId).toBe("scaled-classic");
  });

  test("rejects the first play when it misses the start star", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "a", x: 6, y: 6 },
        { tileId: "b", x: 7, y: 6 },
        { tileId: "c", x: 8, y: 6 }
      ],
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("start star");
  });

  test("accepts the first play on the start star and applies 3P", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "a", x: 7, y: 7 },
        { tileId: "b", x: 8, y: 7 },
        { tileId: "c", x: 9, y: 7 }
      ],
      0
    );

    expect(result.ok).toBe(true);
    expect(result.value?.baseScore).toBe(9);
    expect(host.score).toBe(9);
  });

  test("keeps preview non-mutating", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();

    const result = engine.previewPlay(match, host.id, [
      { tileId: "a", x: 7, y: 7 },
      { tileId: "b", x: 8, y: 7 },
      { tileId: "c", x: 9, y: 7 }
    ]);

    expect(result.ok).toBe(true);
    expect(match.board).toHaveLength(0);
    expect(host.score).toBe(0);
  });

  test("blocks swaps when the bag has 5 or fewer tiles", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();
    match.tileBag = match.tileBag.slice(0, 5);

    const result = engine.swapTiles(match, host.id, ["a"]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("5 or fewer");
  });

  test("ends by party stalemate when bag is empty and consecutive passes equal player count", () => {
    const { engine, match, host, guest } = startedMatch(createPartyConfig({ maxPlayers: 3 }));
    match.tileBag = [];

    expect(engine.passTurn(match, host.id, 0).ok).toBe(true);
    expect(engine.passTurn(match, guest.id, 0).ok).toBe(true);

    expect(match.status).toBe("ended");
    expect(match.endedReason).toBe("stalemate");
  });

  test("deducts overtime penalty at turn end", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();
    match.turnStartedAt = 0;

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "a", x: 7, y: 7 },
        { tileId: "b", x: 8, y: 7 },
        { tileId: "c", x: 9, y: 7 }
      ],
      match.config.turnTimeMs + 1
    );

    expect(result.ok).toBe(true);
    expect(host.score).toBe(-1);
    expect(host.lastPenaltyPoints).toBe(10);
  });

  test("clears shown penalty when that player's next turn starts", () => {
    const { engine, match, host, guest } = startedMatch();
    match.turnStartedAt = 0;

    expect(engine.passTurn(match, host.id, match.config.turnTimeMs + 1).ok).toBe(true);
    expect(host.lastPenaltyPoints).toBe(10);
    expect(match.currentPlayerId).toBe(guest.id);

    expect(engine.passTurn(match, guest.id, match.config.turnTimeMs + 2).ok).toBe(true);
    expect(match.currentPlayerId).toBe(host.id);
    expect(host.lastPenaltyPoints).toBeUndefined();
  });

  test("lets blank tiles choose a face while scoring zero", () => {
    const { engine, match, host } = startedMatch();
    host.rack = [
      { id: "blank", label: "BLANK", value: 0 },
      { id: "equals", label: "=", value: 1 },
      { id: "three", label: "3", value: 2 }
    ];

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "blank", face: "3", x: 7, y: 7 },
        { tileId: "equals", x: 8, y: 7 },
        { tileId: "three", x: 9, y: 7 }
      ],
      0
    );

    expect(result.ok).toBe(true);
    expect(result.value?.expression).toBe("3 = 3");
    expect(result.value?.baseScore).toBe(3);
  });

  test("rejects assignable tiles without a chosen face", () => {
    const { engine, match, host } = startedMatch();
    host.rack = [
      { id: "blank", label: "BLANK", value: 0 },
      { id: "equals", label: "=", value: 1 },
      { id: "three", label: "3", value: 2 }
    ];

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "blank", x: 7, y: 7 },
        { tileId: "equals", x: 8, y: 7 },
        { tileId: "three", x: 9, y: 7 }
      ],
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Assignable tile must choose a face");
  });

  test("lets combo operation tiles choose a face", () => {
    const { engine, match, host } = startedMatch();
    host.rack = [
      { id: "left", label: "2", value: 1 },
      { id: "combo", label: "×/÷", value: 4 },
      { id: "right", label: "2", value: 1 },
      { id: "equals", label: "=", value: 1 },
      { id: "result", label: "4", value: 2 }
    ];

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "left", x: 7, y: 7 },
        { tileId: "combo", face: "×", x: 8, y: 7 },
        { tileId: "right", x: 9, y: 7 },
        { tileId: "equals", x: 10, y: 7 },
        { tileId: "result", x: 11, y: 7 }
      ],
      0
    );

    expect(result.ok).toBe(true);
    expect(result.value?.expression).toBe("2 × 2 = 4");
  });

  test("uses centered start star for larger boards", () => {
    const { engine, match, host } = startedMatch(createPartyConfig({ boardSize: 19, maxPlayers: 2 }));
    host.rack = equationRack();

    const result = engine.commitPlay(
      match,
      host.id,
      [
        { tileId: "a", x: 9, y: 9 },
        { tileId: "b", x: 10, y: 9 },
        { tileId: "c", x: 11, y: 9 }
      ],
      0
    );

    expect(result.ok).toBe(true);
  });

  test("scales the tile bag for 2-6 players", () => {
    expect(createTileSet(1)).toHaveLength(100);
    expect(createTileSet(2)).toHaveLength(200);
    expect(createTileSet(3)).toHaveLength(300);
  });

  test("randomizes start player order", () => {
    const engine = new GameEngine();
    
    // We run multiple starts with different match IDs (which are used as seeds)
    const startRoles = new Set<string>();
    
    for (let i = 0; i < 20; i++) {
      const match = engine.createMatch({ hostName: "Ada", hostColor: "#f97316" });
      const hostId = match.players[0].id;
      const guest = engine.joinMatch(match, { name: "Grace", color: "#2563eb" });
      const guestId = guest.value!.id;
      
      engine.startMatch(match, 0);
      startRoles.add(match.currentPlayerId === hostId ? "host" : "guest");
    }
    
    // With 20 runs, it's extremely unlikely (1 in 2^20) that the same role always starts
    expect(startRoles.size).toBe(2);
  });

  describe("lastPlacements tracking", () => {
    test("records placed tiles after commitPlay", () => {
      const { engine, match, host } = startedMatch();
      host.rack = equationRack();

      engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 8, y: 7 },
          { tileId: "c", x: 9, y: 7 }
        ],
        0
      );

      expect(match.lastPlacements).toHaveLength(3);
      expect(match.lastPlacements.map((t) => t.x)).toEqual([7, 8, 9]);
      expect(match.lastPlacements.every((t) => t.ownerId === host.id)).toBe(true);
    });

    test("replaces lastPlacements on subsequent play", () => {
      const { engine, match, host, guest } = startedMatch();
      host.rack = equationRack();

      engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 8, y: 7 },
          { tileId: "c", x: 9, y: 7 }
        ],
        0
      );

      const hostPlacements = match.lastPlacements.slice();

      guest.rack = equationRack();
      engine.commitPlay(
        match,
        guest.id,
        [
          { tileId: "a", x: 7, y: 8 },
          { tileId: "b", x: 8, y: 8 },
          { tileId: "c", x: 9, y: 8 }
        ],
        0
      );

      expect(match.lastPlacements).toHaveLength(3);
      expect(match.lastPlacements).not.toEqual(hostPlacements);
      expect(match.lastPlacements.every((t) => t.ownerId === guest.id)).toBe(true);
    });

    test("preserves lastPlacements after pass", () => {
      const { engine, match, host, guest } = startedMatch();
      host.rack = equationRack();

      engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 8, y: 7 },
          { tileId: "c", x: 9, y: 7 }
        ],
        0
      );

      const played = match.lastPlacements.slice();

      engine.passTurn(match, guest.id, 0);

      expect(match.lastPlacements).toEqual(played);
    });

    test("preserves lastPlacements after swap", () => {
      const { engine, match, host, guest } = startedMatch();
      host.rack = equationRack();

      engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 8, y: 7 },
          { tileId: "c", x: 9, y: 7 }
        ],
        0
      );

      const played = match.lastPlacements.slice();

      engine.swapTiles(match, guest.id, [guest.rack[0].id], 0);

      expect(match.lastPlacements).toEqual(played);
    });

    test("includes lastPlacements in snapshot", () => {
      const { engine, match, host } = startedMatch();
      host.rack = equationRack();

      engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 8, y: 7 },
          { tileId: "c", x: 9, y: 7 }
        ],
        0
      );

      const snapshot = engine.createSnapshot(match);

      expect(snapshot.lastPlacements).toEqual(match.lastPlacements);
    });
  });
});

function startedMatch(config = createPartyConfig({ maxPlayers: 2 })): {
  engine: GameEngine;
  match: MatchState;
  host: Player;
  guest: Player;
} {
  const engine = new GameEngine();
  const match = engine.createMatch({ hostName: "Ada", hostColor: "#f97316", config, now: 0 });
  const guestResult = engine.joinMatch(match, { name: "Grace", color: "#2563eb" });

  if (!guestResult.ok || !guestResult.value) {
    throw new Error("test setup failed");
  }

  const startResult = engine.startMatch(match, 0);

  if (!startResult.ok) {
    throw new Error(startResult.error);
  }

  const host = match.players.find((p) => p.id === match.currentPlayerId)!;
  const guest = match.players.find((p) => p.id !== match.currentPlayerId)!;

  return {
    engine,
    match,
    host,
    guest
  };
}

function equationRack(): Tile[] {
  return [
    { id: "a", label: "3", value: 2 },
    { id: "b", label: "=", value: 1 },
    { id: "c", label: "3", value: 2 },
    { id: "d", label: "+", value: 1 },
    { id: "e", label: "4", value: 2 },
    { id: "f", label: "-", value: 1 },
    { id: "g", label: "0", value: 1 },
    { id: "h", label: "1", value: 1 }
  ];
}
