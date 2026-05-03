import { describe, expect, test } from "bun:test";
import { BINGO_BONUS, createClassicalConfig, createPartyConfig } from "@d-m4th/config";
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

  test("blocks swaps when selecting more tiles than available in the bag", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();
    // Bag has 7 tiles, host tries to swap 8
    match.tileBag = match.tileBag.slice(0, 7);
    const tileIds = host.rack.map(t => t.id);
    expect(tileIds).toHaveLength(8);

    const result = engine.swapTiles(match, host.id, tileIds);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("cannot swap more tiles than available");
    expect(host.rack).toHaveLength(8);
    expect(match.tileBag).toHaveLength(7);
  });

  test("allows swap when bag count equals selected count (if > 5)", () => {
    const { engine, match, host } = startedMatch();
    host.rack = equationRack();
    match.tileBag = match.tileBag.slice(0, 6);
    const tileIds = host.rack.slice(0, 6).map(t => t.id);

    const result = engine.swapTiles(match, host.id, tileIds);

    expect(result.ok).toBe(true);
    expect(host.rack).toHaveLength(8);
    expect(match.tileBag).toHaveLength(6);
  });

  test("prevents redrawing the same tiles in a swap", () => {
    const { engine, match, host } = startedMatch();
    // Force bag to have specific tiles
    const bagTiles = [
      { id: "bag1", label: "1", value: 1 },
      { id: "bag2", label: "2", value: 2 },
      { id: "bag3", label: "3", value: 3 },
      { id: "bag4", label: "4", value: 4 },
      { id: "bag5", label: "5", value: 5 },
      { id: "bag6", label: "6", value: 6 }
    ];
    match.tileBag = bagTiles;
    
    const originalRackTileId = host.rack[0].id;
    const result = engine.swapTiles(match, host.id, [originalRackTileId]);

    expect(result.ok).toBe(true);
    // The tile we just put in the bag should NOT be in the rack
    expect(host.rack.find(t => t.id === originalRackTileId)).toBeUndefined();
    // It should now be in the bag
    expect(match.tileBag.find(t => t.id === originalRackTileId)).toBeDefined();
  });

  test("ends a 2-player bag-empty rack-empty turn with A-Math-style final scoring", () => {
    const { engine, match, host, guest } = startedMatch();
    host.rack = [
      { id: "a", label: "3", value: 2 },
      { id: "b", label: "=", value: 1 },
      { id: "c", label: "3", value: 2 }
    ];
    guest.rack = [
      { id: "g1", label: "7", value: 3 },
      { id: "g2", label: "+", value: 1 }
    ];
    match.tileBag = [];

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
    expect(match.status).toBe("ended");
    expect(match.endedReason).toBe("rack-empty");
    expect(host.score).toBe(17);
    expect(guest.score).toBe(0);
    expect(match.winnerIds).toEqual([host.id]);
  });

  test("ends a 2-player exhausted bag pass cycle and supports ties in winnerIds", () => {
    const { engine, match, host, guest } = startedMatch();
    host.score = 10;
    guest.score = 9;
    host.rack = [{ id: "h1", label: "4", value: 2 }];
    guest.rack = [{ id: "g1", label: "1", value: 1 }];
    match.tileBag = [];

    expect(engine.passTurn(match, host.id, 0).ok).toBe(true);
    expect(match.status).toBe("playing");
    expect(match.consecutivePasses).toBe(1);

    expect(engine.passTurn(match, guest.id, 0).ok).toBe(true);

    expect(match.status).toBe("ended");
    expect(match.endedReason).toBe("exhausted-pass-cycle");
    expect(host.score).toBe(8);
    expect(guest.score).toBe(8);
    expect(match.winnerIds.sort()).toEqual([guest.id, host.id].sort());
  });

  test("ends a 3-player exhausted bag pass cycle only after all active players pass once", () => {
    const { engine, match, host, guest, third } = startedThreePlayerMatch();
    match.playerOrder = [host.id, guest.id, third.id];
    match.currentPlayerId = host.id;
    host.score = 10;
    guest.score = 10;
    third.score = 10;
    host.rack = [{ id: "h1", label: "1", value: 1 }];
    guest.rack = [{ id: "g1", label: "2", value: 2 }];
    third.rack = [{ id: "t1", label: "3", value: 3 }];
    match.tileBag = [];

    expect(engine.passTurn(match, host.id, 0).ok).toBe(true);
    expect(engine.passTurn(match, guest.id, 0).ok).toBe(true);

    expect(match.status).toBe("playing");
    expect(match.consecutivePasses).toBe(2);

    expect(engine.passTurn(match, third.id, 0).ok).toBe(true);

    expect(match.status).toBe("ended");
    expect(match.endedReason).toBe("exhausted-pass-cycle");
    expect(host.score).toBe(9);
    expect(guest.score).toBe(8);
    expect(third.score).toBe(7);
    expect(match.winnerIds).toEqual([host.id]);
  });

  test("does not end a 3-player match by pass cycle while the bag still has tiles", () => {
    const { engine, match, host, guest, third } = startedThreePlayerMatch();
    match.playerOrder = [host.id, guest.id, third.id];
    match.currentPlayerId = host.id;

    expect(engine.passTurn(match, host.id, 0).ok).toBe(true);
    expect(engine.passTurn(match, guest.id, 0).ok).toBe(true);
    expect(engine.passTurn(match, third.id, 0).ok).toBe(true);

    expect(match.status).toBe("playing");
    expect(match.endedReason).toBeUndefined();
    expect(match.consecutivePasses).toBe(0);
  });

  test("successful play resets the exhausted bag pass cycle", () => {
    const { engine, match, host, guest, third } = startedThreePlayerMatch();
    match.playerOrder = [host.id, guest.id, third.id];
    match.currentPlayerId = host.id;
    match.tileBag = [];
    guest.rack = [
      { id: "a", label: "3", value: 2 },
      { id: "b", label: "=", value: 1 },
      { id: "c", label: "3", value: 2 },
      { id: "d", label: "1", value: 1 }
    ];

    expect(engine.passTurn(match, host.id, 0).ok).toBe(true);
    expect(match.consecutivePasses).toBe(1);

    expect(
      engine.commitPlay(
        match,
        guest.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 8, y: 7 },
          { tileId: "c", x: 9, y: 7 }
        ],
        0
      ).ok
    ).toBe(true);

    expect(match.status).toBe("playing");
    expect(match.consecutivePasses).toBe(0);

    expect(engine.passTurn(match, third.id, 0).ok).toBe(true);
    expect(engine.passTurn(match, host.id, 0).ok).toBe(true);

    expect(match.status).toBe("playing");
    expect(match.consecutivePasses).toBe(2);
  });

  test("does not apply overtime penalty before or at the turn limit", () => {
    const { engine, match, host, guest } = startedMatch();
    match.turnStartedAt = 0;

    expect(engine.passTurn(match, host.id, match.config.turnTimeMs).ok).toBe(true);
    expect(host.score).toBe(0);
    expect(host.lastPenaltyPoints).toBeUndefined();
    expect(match.status).toBe("playing");

    expect(engine.passTurn(match, guest.id, match.config.turnTimeMs).ok).toBe(true);
    expect(guest.score).toBe(0);
    expect(guest.lastPenaltyPoints).toBeUndefined();
  });

  test("applies -10 for 1 ms or 1 second overtime", () => {
    expect(passWithOvertime(matchWithPenalty(), 1).host.lastPenaltyPoints).toBe(10);
    expect(passWithOvertime(matchWithPenalty(), 1_000).host.lastPenaltyPoints).toBe(10);
  });

  test("applies -10 at exactly 60 seconds overtime and -20 at 60 seconds plus 1 ms", () => {
    expect(passWithOvertime(matchWithPenalty(), 60_000).host.lastPenaltyPoints).toBe(10);
    expect(passWithOvertime(matchWithPenalty(), 60_001).host.lastPenaltyPoints).toBe(20);
  });

  test("applies -30 for 2 minutes and 13 seconds overtime", () => {
    const { host } = passWithOvertime(matchWithPenalty(), 133_000);
    expect(host.lastPenaltyPoints).toBe(30);
    expect(host.score).toBe(-30);
  });

  test("clears shown penalty when that player's next turn starts and resets next-turn overtime accounting", () => {
    const { engine, match, host, guest } = startedMatch();
    match.turnStartedAt = 0;

    expect(engine.passTurn(match, host.id, match.config.turnTimeMs + 60_001).ok).toBe(true);
    expect(host.lastPenaltyPoints).toBe(20);
    expect(match.currentPlayerId).toBe(guest.id);

    expect(engine.passTurn(match, guest.id, 1).ok).toBe(true);
    expect(match.currentPlayerId).toBe(host.id);
    expect(host.lastPenaltyPoints).toBeUndefined();

    match.turnStartedAt = 0;
    expect(engine.passTurn(match, host.id, match.config.turnTimeMs + 1).ok).toBe(true);
    expect(host.lastPenaltyPoints).toBe(10);
  });

  test("overtime does not end the match by itself even when remaining time reaches zero", () => {
    const { engine, match, host } = startedMatch();
    host.remainingMs = 5;
    match.turnStartedAt = 0;

    expect(engine.passTurn(match, host.id, match.config.turnTimeMs + 120_000).ok).toBe(true);

    expect(host.remainingMs).toBe(0);
    expect(host.lastPenaltyPoints).toBe(20);
    expect(match.status).toBe("playing");
    expect(match.endedReason).toBeUndefined();
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

  describe("cross equation validation", () => {
    test("rejects preview and commit when a valid main equation creates an invalid cross equation", () => {
      const { engine, match, host, guest } = startedMatch();
      match.board = [
        boardTile("top", "8", 4, 6, 3, guest.id),
        boardTile("bottom", "9", 4, 6, 5, guest.id)
      ];
      host.rack = [
        tile("left", "3", 2),
        tile("middle", "=", 1),
        tile("right", "3", 2)
      ];

      const placements = [
        { tileId: "left", x: 5, y: 4 },
        { tileId: "middle", x: 6, y: 4 },
        { tileId: "right", x: 7, y: 4 }
      ];

      const preview = engine.previewPlay(match, host.id, placements);
      expect(preview.ok).toBe(false);
      expect(preview.error).toContain("same value");

      const commit = engine.commitPlay(match, host.id, placements, 0);
      expect(commit.ok).toBe(false);
      expect(commit.error).toContain("same value");
      expect(match.board).toHaveLength(2);
      expect(host.score).toBe(0);
    });

    test("accepts a valid main equation when no cross-line longer than one cell is created", () => {
      const { engine, match, host, guest } = startedMatch();
      match.board = [boardTile("seed", "7", 3, 0, 0, guest.id)];
      host.rack = [
        tile("a", "2", 1),
        tile("b", "+", 1),
        tile("c", "2", 1),
        tile("d", "=", 1),
        tile("e", "4", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 5, y: 4 },
          { tileId: "b", x: 6, y: 4 },
          { tileId: "c", x: 7, y: 4 },
          { tileId: "d", x: 8, y: 4 },
          { tileId: "e", x: 9, y: 4 }
        ],
        0
      );

      expect(result.ok).toBe(true);
      expect(result.value?.expression).toBe("2 + 2 = 4");
      expect(result.value?.totalScore).toBe(6);
    });

    test("accepts a valid main equation with a valid cross equation", () => {
      const { engine, match, host, guest } = startedMatch();
      match.board = [
        boardTile("top", "8", 4, 6, 3, guest.id),
        boardTile("bottom", "8", 4, 6, 5, guest.id)
      ];
      host.rack = [
        tile("left", "3", 2),
        tile("middle", "=", 1),
        tile("right", "3", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "left", x: 5, y: 4 },
          { tileId: "middle", x: 6, y: 4 },
          { tileId: "right", x: 7, y: 4 }
        ],
        0
      );

      expect(result.ok).toBe(true);
      expect(result.value?.expression).toBe("3 = 3");
      expect(result.value?.totalScore).toBe(14);
    });

    test("rejects a cross-line longer than one tile when it has no equals sign", () => {
      const { engine, match, host, guest } = startedMatch();
      match.board = [
        boardTile("top", "1", 1, 6, 3, guest.id),
        boardTile("bottom", "1", 1, 6, 5, guest.id)
      ];
      host.rack = [
        tile("a", "2", 1),
        tile("b", "+", 1),
        tile("c", "2", 1),
        tile("d", "=", 1),
        tile("e", "4", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 5, y: 4 },
          { tileId: "b", x: 6, y: 4 },
          { tileId: "c", x: 7, y: 4 },
          { tileId: "d", x: 8, y: 4 },
          { tileId: "e", x: 9, y: 4 }
        ],
        0
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("equals");
    });

    test("accepts multiple valid cross equations and scores each exactly once", () => {
      const { engine, match, host, guest } = startedMatch();
      match.board = [
        boardTile("top-left", "1", 1, 6, 3, guest.id),
        boardTile("bottom-left", "1", 1, 6, 5, guest.id),
        boardTile("top-right", "3", 2, 8, 3, guest.id),
        boardTile("bottom-right", "3", 2, 8, 5, guest.id)
      ];
      host.rack = [
        tile("a", "2", 2),
        tile("b", "=", 1),
        tile("c", "2", 2),
        tile("d", "=", 1),
        tile("e", "2", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 5, y: 4 },
          { tileId: "b", x: 6, y: 4 },
          { tileId: "c", x: 7, y: 4 },
          { tileId: "d", x: 8, y: 4 },
          { tileId: "e", x: 9, y: 4 }
        ],
        0
      );

      expect(result.ok).toBe(true);
      expect(result.value?.expression).toBe("2 = 2 = 2");
      expect(result.value?.bingoBonus).toBe(0);
      expect(result.value?.totalScore).toBe(16);
    });

    test("rejects the full play when any one of multiple cross equations is invalid", () => {
      const { engine, match, host, guest } = startedMatch();
      match.board = [
        boardTile("top-left", "1", 1, 6, 3, guest.id),
        boardTile("bottom-left", "1", 1, 6, 5, guest.id),
        boardTile("top-right", "3", 2, 8, 3, guest.id),
        boardTile("bottom-right", "4", 2, 8, 5, guest.id)
      ];
      host.rack = [
        tile("a", "2", 2),
        tile("b", "=", 1),
        tile("c", "2", 2),
        tile("d", "=", 1),
        tile("e", "2", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 5, y: 4 },
          { tileId: "b", x: 6, y: 4 },
          { tileId: "c", x: 7, y: 4 },
          { tileId: "d", x: 8, y: 4 },
          { tileId: "e", x: 9, y: 4 }
        ],
        0
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("same value");
    });

    test("applies the bingo bonus only once when a full-rack play also creates cross equations", () => {
      const { engine, match, host, guest } = startedMatch();
      match.config.rackSize = 5;
      match.board = [
        boardTile("top-left", "1", 1, 6, 3, guest.id),
        boardTile("bottom-left", "1", 1, 6, 5, guest.id),
        boardTile("top-right", "3", 2, 8, 3, guest.id),
        boardTile("bottom-right", "3", 2, 8, 5, guest.id)
      ];
      host.rack = [
        tile("a", "2", 2),
        tile("b", "=", 1),
        tile("c", "2", 2),
        tile("d", "=", 1),
        tile("e", "2", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 5, y: 4 },
          { tileId: "b", x: 6, y: 4 },
          { tileId: "c", x: 7, y: 4 },
          { tileId: "d", x: 8, y: 4 },
          { tileId: "e", x: 9, y: 4 }
        ],
        0
      );

      expect(result.ok).toBe(true);
      expect(result.value?.bingoBonus).toBe(BINGO_BONUS);
      expect(result.value?.totalScore).toBe(16 + BINGO_BONUS);
    });

    test("keeps first-play contiguity rules unchanged", () => {
      const { engine, match, host } = startedMatch();
      match.board = [];
      host.rack = [
        tile("a", "3", 2),
        tile("b", "=", 1),
        tile("c", "3", 2)
      ];

      const result = engine.commitPlay(
        match,
        host.id,
        [
          { tileId: "a", x: 7, y: 7 },
          { tileId: "b", x: 9, y: 7 },
          { tileId: "c", x: 10, y: 7 }
        ],
        0
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("empty gaps");
    });
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

  describe("intentional leave", () => {
    test("ends a two-player match when the current player intentionally leaves", () => {
      const { engine, match, host, guest } = startedMatch();

      const result = engine.leaveMatch(match, host.id, 1000);

      expect(result.ok).toBe(true);
      expect(host.left).toBe(true);
      expect(host.connected).toBe(false);
      expect(match.status).toBe("ended");
      expect(match.endedReason).toBe("player-left");
      expect(match.winnerIds).toEqual([guest.id]);
      expect(match.playerOrder).toEqual([guest.id]);
      expect(match.currentPlayerId).toBe(guest.id);
    });

    test("continues a three-player match after one leave and ends after another leaves", () => {
      const { engine, match } = startedThreePlayerMatch();

      const firstLeavingPlayer = match.players.find((player) => player.id !== match.currentPlayerId)!;
      const firstLeave = engine.leaveMatch(match, firstLeavingPlayer.id, 1000);

      expect(firstLeave.ok).toBe(true);
      expect(firstLeavingPlayer.left).toBe(true);
      expect(match.status).toBe("playing");
      expect(match.playerOrder).not.toContain(firstLeavingPlayer.id);
      expect(match.players.find((player) => player.id === match.currentPlayerId)?.left).not.toBe(true);

      const secondLeavingPlayer = match.players.find((player) => !player.left && player.id !== match.currentPlayerId)!;
      const secondLeave = engine.leaveMatch(match, secondLeavingPlayer.id, 2000);

      expect(secondLeave.ok).toBe(true);
      expect(secondLeavingPlayer.left).toBe(true);
      expect(match.status).toBe("ended");
      expect(match.endedReason).toBe("player-left");
      expect(match.winnerIds).toEqual([match.currentPlayerId!]);
      expect(match.players.filter((player) => !player.left)).toHaveLength(1);
      expect(match.players.find((player) => player.id === match.currentPlayerId)?.left).not.toBe(true);
    });

    test("skips a left player when advancing the turn", () => {
      const { engine, match, host, guest, third } = startedThreePlayerMatch();
      match.playerOrder = [host.id, guest.id, third.id];
      match.currentPlayerId = host.id;

      const leaveResult = engine.leaveMatch(match, guest.id, 1000);
      expect(leaveResult.ok).toBe(true);

      const passResult = engine.passTurn(match, host.id, 2000);

      expect(passResult.ok).toBe(true);
      expect(match.currentPlayerId).toBe(third.id);
      expect(match.players.find((player) => player.id === match.currentPlayerId)?.left).not.toBe(true);
    });

    test("advances to the next original turn player when the current player leaves", () => {
      const { engine, match, host, guest, third } = startedThreePlayerMatch();
      match.playerOrder = [host.id, guest.id, third.id];
      match.currentPlayerId = guest.id;

      const leaveResult = engine.leaveMatch(match, guest.id, 1000);

      expect(leaveResult.ok).toBe(true);
      expect(match.status).toBe("playing");
      expect(match.playerOrder).toEqual([host.id, third.id]);
      expect(match.currentPlayerId).toBe(third.id);
      expect(match.players.find((player) => player.id === match.currentPlayerId)?.left).not.toBe(true);
    });

    test("uses active non-left players for exhausted bag pass cycle after a leave", () => {
      const { engine, match, host, guest, third } = startedThreePlayerMatch();
      match.playerOrder = [host.id, guest.id, third.id];
      match.currentPlayerId = host.id;
      match.tileBag = [];

      expect(engine.leaveMatch(match, third.id, 1000).ok).toBe(true);
      expect(engine.passTurn(match, host.id, 2000).ok).toBe(true);
      expect(match.status).toBe("playing");

      expect(engine.passTurn(match, guest.id, 3000).ok).toBe(true);

      expect(match.status).toBe("ended");
      expect(match.endedReason).toBe("exhausted-pass-cycle");
    });
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

      guest.rack = [
        tile("guest-top", "3", 2),
        tile("guest-bottom", "3", 2)
      ];
      engine.commitPlay(
        match,
        guest.id,
        [
          { tileId: "guest-top", x: 8, y: 6 },
          { tileId: "guest-bottom", x: 8, y: 8 }
        ],
        0
      );

      expect(match.lastPlacements).toHaveLength(2);
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

function startedThreePlayerMatch(): {
  engine: GameEngine;
  match: MatchState;
  host: Player;
  guest: Player;
  third: Player;
} {
  const engine = new GameEngine();
  const match = engine.createMatch({
    hostName: "Ada",
    hostColor: "#f97316",
    config: createPartyConfig({ maxPlayers: 3 }),
    now: 0
  });
  const guestResult = engine.joinMatch(match, { name: "Grace", color: "#2563eb" });
  const thirdResult = engine.joinMatch(match, { name: "Katherine", color: "#06d6a0" });

  if (!guestResult.ok || !guestResult.value || !thirdResult.ok || !thirdResult.value) {
    throw new Error("test setup failed");
  }

  const startResult = engine.startMatch(match, 0);

  if (!startResult.ok) {
    throw new Error(startResult.error);
  }

  return {
    engine,
    match,
    host: match.players[0],
    guest: guestResult.value,
    third: thirdResult.value
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

function tile(id: string, label: string, value: number): Tile {
  return { id, label, value };
}

function boardTile(id: string, label: string, value: number, x: number, y: number, ownerId: string) {
  return { id, label, value, x, y, ownerId };
}

function matchWithPenalty() {
  return startedMatch();
}

function passWithOvertime(
  fixture: ReturnType<typeof startedMatch>,
  overtimeMs: number
): ReturnType<typeof startedMatch> {
  fixture.match.turnStartedAt = 0;
  fixture.engine.passTurn(fixture.match, fixture.host.id, fixture.match.config.turnTimeMs + overtimeMs);
  return fixture;
}
