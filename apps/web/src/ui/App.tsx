import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createClassicalConfig, createPartyConfig, tileBagScaleForPlayerCount, type MatchConfig } from "@d-m4th/config";
import { faceOptionsForTileLabel, tileRequiresFace, type Placement, type PublicSnapshot, type Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import { createDragPreviewSize, textColorForPlayerColor } from "../board/board-interaction";
import {
  findDraftPlacementAt,
  moveOrSwapDraftPlacement,
  toggleSelection,
  type TurnMode,
  upsertDraftPlacement
} from "../turn/turn-controls";
import { BoardCanvas } from "./BoardCanvas";

type ViewMode = "create" | "join";
const EMPTY_RACK: Tile[] = [];

interface PrivateState {
  playerId: string;
  rack: Tile[];
}

interface PendingFacePlacement {
  tile: Tile;
  x: number;
  y: number;
}

export function App() {
  const initialRoomCode = readInitialRoomCode();
  const [viewMode, setViewMode] = useState<ViewMode>(initialRoomCode ? "join" : "create");
  const [name, setName] = useState("Player");
  const [color, setColor] = useState("#f97316");
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [config, setConfig] = useState<MatchConfig>(createClassicalConfig());
  const [snapshot, setSnapshot] = useState<PublicSnapshot>();
  const [privateState, setPrivateState] = useState<PrivateState>();
  const [connected, setConnected] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string>();
  const [pendingFacePlacement, setPendingFacePlacement] = useState<PendingFacePlacement>();
  const [draft, setDraft] = useState<Placement[]>([]);
  const draftRef = useRef<Placement[]>([]);
  const autoPreviewRequestIdRef = useRef<string | undefined>(undefined);
  const [turnMode, setTurnMode] = useState<TurnMode>("play");
  const [swapSelectedTileIds, setSwapSelectedTileIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [previewScore, setPreviewScore] = useState<number>();
  const client = useMemo(() => {
    return new ProtocolClient(defaultWebSocketUrl(), handleMessage, setConnected);

    function handleMessage(message: ServerMessage): void {
      if (message.type === "room:snapshot") {
        setSnapshot(message.snapshot);

        if (message.private) {
          setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
        }
      }

      if (message.type === "play:previewed") {
        if (message.requestId !== autoPreviewRequestIdRef.current) {
          return;
        }

        setPreviewScore(message.score.totalScore);
      }

      if (message.type === "action:accepted") {
        setNotice(message.action);
      }

      if (message.type === "action:rejected") {
        if (message.requestId === autoPreviewRequestIdRef.current) {
          setPreviewScore(undefined);
          return;
        }

        setNotice(message.reason);
      }

      if (message.type === "match:ended") {
        setNotice(`Match ended: ${message.snapshot.endedReason ?? "complete"}`);
      }
    }
  }, []);

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  const isMyTurn = snapshot?.currentPlayerId === privateState?.playerId;
  const activeConfig = snapshot?.config ?? config;
  const currentPlayer = snapshot?.players.find((player) => player.id === snapshot.currentPlayerId);
  const draftTileIds = new Set(draft.map((placement) => placement.tileId));
  const rack = privateState?.rack ?? EMPTY_RACK;
  const visibleRack = turnMode === "swap" ? rack : rack.filter((tile) => !draftTileIds.has(tile.id));
  const ownColor = snapshot?.players.find((player) => player.id === privateState?.playerId)?.color ?? color;
  const selectedRackTileIds = turnMode === "swap" ? new Set(swapSelectedTileIds) : new Set(selectedTileId ? [selectedTileId] : []);
  const tileBagScale = tileBagScaleForPlayerCount(snapshot?.players.length ?? activeConfig.maxPlayers);

  useEffect(() => {
    if (!isMyTurn || draft.length === 0) {
      autoPreviewRequestIdRef.current = undefined;
      setPreviewScore(undefined);
      return;
    }

    const requestId = `auto-preview:${createRequestId()}`;
    autoPreviewRequestIdRef.current = requestId;
    const timerId = window.setTimeout(() => {
      client.send({ type: "play:preview", requestId, placements: draft });
    }, 150);

    return () => window.clearTimeout(timerId);
  }, [client, draft, isMyTurn]);

  function createRoom(): void {
    client.send({ type: "room:create", requestId: createRequestId(), name, color, config });
  }

  function joinRoom(): void {
    client.send({ type: "room:join", requestId: createRequestId(), code: roomCode, name, color });
  }

  function configure(nextConfig: MatchConfig): void {
    setConfig(nextConfig);

    if (snapshot?.status === "lobby") {
      client.send({ type: "match:configure", requestId: createRequestId(), config: nextConfig });
    }
  }

  function startMatch(): void {
    client.send({ type: "match:start", requestId: createRequestId() });
  }

  function handleBoardCellClick(x: number, y: number): void {
    if (turnMode !== "play" || !isMyTurn) {
      return;
    }

    const target = { x, y };
    const targetDraft = findDraftPlacementAt(draftRef.current, target);

    if (!selectedTileId) {
      setSelectedTileId(targetDraft?.tileId);
      return;
    }

    const selectedDraft = draftRef.current.find((placement) => placement.tileId === selectedTileId);

    if (selectedDraft) {
      updateAndBroadcastDraft(moveOrSwapDraftPlacement({ draft: draftRef.current, tileId: selectedTileId, target }));
      setSelectedTileId(undefined);
      return;
    }

    if (targetDraft) {
      setSelectedTileId(targetDraft.tileId);
      return;
    }

    placeRackTile(selectedTileId, x, y);
  }

  function placeRackTile(tileId: string, x: number, y: number): void {
    const tile = privateState?.rack.find((candidate) => candidate.id === tileId);

    if (turnMode !== "play" || !isMyTurn || !tile) {
      return;
    }

    if (tileRequiresFace(tile.label)) {
      setPendingFacePlacement({ tile, x, y });
      return;
    }

    placeResolvedRackTile(tile, x, y);
  }

  function placeResolvedRackTile(tile: Tile, x: number, y: number, face?: string): void {
    const placement: Placement = face ? { tileId: tile.id, x, y, face } : { tileId: tile.id, x, y };
    updateAndBroadcastDraft(upsertDraftPlacement(draftRef.current, placement));
    setSelectedTileId(undefined);
    setPendingFacePlacement(undefined);
  }

  function commitPlay(): void {
    client.send({ type: "play:commit", requestId: createRequestId(), placements: draftRef.current });
    updateDraft([]);
    setPreviewScore(undefined);
  }

  function handleSwapAction(): void {
    if (turnMode !== "swap") {
      enterSwapMode();
      return;
    }

    if (swapSelectedTileIds.length === 0) {
      return;
    }

    client.send({ type: "turn:swap", requestId: createRequestId(), tileIds: swapSelectedTileIds });
    setSwapSelectedTileIds([]);
    setTurnMode("play");
  }

  function passTurn(): void {
    client.send({ type: "turn:pass", requestId: createRequestId() });
  }

  function recallRack(): void {
    if (turnMode === "swap") {
      setTurnMode("play");
      setSwapSelectedTileIds([]);
      return;
    }

    updateDraft([]);
    setSelectedTileId(undefined);
    setPendingFacePlacement(undefined);
    setPreviewScore(undefined);
    client.send({ type: "rack:recall", requestId: createRequestId() });
  }

  function enterSwapMode(): void {
    setTurnMode("swap");
    setSelectedTileId(undefined);
    setPendingFacePlacement(undefined);
    setSwapSelectedTileIds([]);

    if (draftRef.current.length > 0) {
      updateDraft([]);
      client.send({ type: "rack:recall", requestId: createRequestId() });
    }
  }

  function handleRackSelect(tile: Tile): void {
    if (turnMode === "swap") {
      setSwapSelectedTileIds((selectedIds) => toggleSelection(selectedIds, tile.id));
      return;
    }

    setSelectedTileId(tile.id);
    setPreviewScore(undefined);
  }

  function updateAndBroadcastDraft(nextDraft: Placement[]): void {
    updateDraft(nextDraft);
    setPreviewScore(undefined);
    client.send({ type: "placement:draft", requestId: createRequestId(), placements: nextDraft });
  }

  function updateDraft(nextDraft: Placement[]): void {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  return (
    <div className="puzzle-theme-root">
      <main className="app-shell">
        <section className="sidebar">
          <div className="brand-row">
            <h1>D-M4TH</h1>
            <span className={connected ? "status online" : "status"}>{connected ? "Online" : "Offline"}</span>
          </div>

          {!snapshot && (
            <div className="panel">
              <div className="tabs">
                <button className={viewMode === "create" ? "active" : ""} onClick={() => setViewMode("create")}>
                  Create
                </button>
                <button className={viewMode === "join" ? "active" : ""} onClick={() => setViewMode("join")}>
                  Join
                </button>
              </div>
              <label>
                Name
                <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Color
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              </label>
              {viewMode === "create" ? (
                <CreateControls config={config} onChange={configure} onSubmit={createRoom} />
              ) : (
                <>
                  <label>
                    Room code
                    <input value={roomCode} maxLength={6} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
                  </label>
                  <button className="primary" onClick={joinRoom}>
                    Join room
                  </button>
                </>
              )}
            </div>
          )}

          {snapshot && (
            <>
              <LobbyPanel snapshot={snapshot} tileBagScale={tileBagScale} onStart={startMatch} />
              <TurnStatus currentPlayerName={currentPlayer?.name} isMyTurn={isMyTurn} status={snapshot.status} />
              <Hud snapshot={snapshot} />
            </>
          )}

          {notice && <p className="notice">{notice}</p>}
        </section>

        <section className="play-surface">
          <BoardCanvas
            snapshot={snapshot}
            draft={draft}
            rack={rack}
            currentPlayerId={privateState?.playerId}
            selectedTileId={selectedTileId}
            placementDisabled={turnMode === "swap"}
            onCellClick={handleBoardCellClick}
            onTileDrop={placeRackTile}
          />
          <div className="control-strip">
            <section className="rack-panel">
              <Rack
                rack={visibleRack}
                selectedTileIds={selectedRackTileIds}
                playerColor={ownColor}
                canDrag={turnMode === "play"}
                onSelect={handleRackSelect}
              />
            </section>
            <section className="action-panel">
              <div className="action-bar">
                <button className="primary" onClick={commitPlay} disabled={!isMyTurn || draft.length === 0}>
                  Play
                </button>
                <button onClick={handleSwapAction} disabled={!isMyTurn || (turnMode === "swap" && swapSelectedTileIds.length === 0)}>
                  {turnMode === "swap" ? `Swap ${swapSelectedTileIds.length}` : "Swap"}
                </button>
                <button onClick={passTurn} disabled={!isMyTurn || turnMode === "swap"}>
                  Pass
                </button>
                <button onClick={recallRack} disabled={turnMode === "play" && draft.length === 0}>
                  {turnMode === "swap" ? "Cancel" : "Recall"}
                </button>
                {activeConfig.mode !== "classical" && <button disabled>Use Skill</button>}
              </div>
              {previewScore !== undefined && <strong className="preview-score">Score +{previewScore}</strong>}
            </section>
          </div>
          {pendingFacePlacement && (
            <FaceSelectionDialog
              playerColor={ownColor}
              tile={pendingFacePlacement.tile}
              onCancel={() => setPendingFacePlacement(undefined)}
              onSelect={(face) => placeResolvedRackTile(pendingFacePlacement.tile, pendingFacePlacement.x, pendingFacePlacement.y, face)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function CreateControls(props: { config: MatchConfig; onChange: (config: MatchConfig) => void; onSubmit: () => void }) {
  const { config, onChange, onSubmit } = props;

  return (
    <>
      <label>
        Mode
        <select
          value={config.mode}
          onChange={(event) => onChange(event.target.value === "classical" ? createClassicalConfig() : createPartyConfig())}
        >
          <option value="classical">Classical</option>
          <option value="party">Party</option>
        </select>
      </label>
      <label>
        Max players
        <input
          type="number"
          min={2}
          max={6}
          value={config.maxPlayers}
          onChange={(event) => onChange(createPartyConfig({ ...config, maxPlayers: Number(event.target.value) }))}
        />
      </label>
      <p className="config-hint">Bag scale at max: {tileBagScaleForPlayerCount(config.maxPlayers)}x</p>
      <label>
        Board size
        <input
          type="number"
          min={15}
          step={2}
          value={config.boardSize}
          onChange={(event) => onChange(createPartyConfig({ ...config, boardSize: Number(event.target.value) }))}
        />
      </label>
      <button className="primary" onClick={onSubmit}>
        Create room
      </button>
    </>
  );
}

function LobbyPanel(props: { snapshot: PublicSnapshot; tileBagScale: number; onStart: () => void }) {
  const { snapshot, tileBagScale, onStart } = props;
  const inviteUrl = `${window.location.origin}?room=${snapshot.code}`;

  return (
    <div className="panel compact">
      <div className="room-code">
        <span>{snapshot.code}</span>
        <button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy link</button>
      </div>
      <p className="config-hint">
        Bag scale now: {tileBagScale}x · Bag tiles: {snapshot.status === "playing" ? snapshot.tileBagCount : "not dealt"}
      </p>
      <button className="primary" onClick={onStart} disabled={snapshot.status !== "lobby"}>
        Start
      </button>
    </div>
  );
}

function TurnStatus(props: { currentPlayerName?: string; isMyTurn: boolean; status: PublicSnapshot["status"] }) {
  const label = props.status === "playing" ? props.currentPlayerName ?? "Unknown" : "Waiting";

  return (
    <div className="turn-status" role="status" aria-live="polite">
      <span>Turn</span>
      <strong>{props.isMyTurn ? "Your turn" : label}</strong>
    </div>
  );
}

function Hud(props: { snapshot: PublicSnapshot }) {
  return (
    <div className="player-list">
      {props.snapshot.players.map((player) => (
        <div className={props.snapshot.currentPlayerId === player.id ? "player-row current" : "player-row"} key={player.id}>
          <span className="swatch" style={{ background: player.color }} />
          <span>{player.name}</span>
          <strong>{player.score}</strong>
          <time>{formatTime(player.remainingMs)}</time>
        </div>
      ))}
    </div>
  );
}

function Rack(props: {
  rack: Tile[];
  selectedTileIds: ReadonlySet<string>;
  playerColor: string;
  canDrag: boolean;
  onSelect: (tile: Tile) => void;
}) {
  const textColor = textColorForPlayerColor(props.playerColor);

  return (
    <div className="rack">
      {props.rack.map((tile) => (
        <button
          className={props.selectedTileIds.has(tile.id) ? "tile selected" : "tile"}
          draggable={props.canDrag}
          key={tile.id}
          style={{ background: props.playerColor, color: textColor }}
          onClick={() => props.onSelect(tile)}
          onDragStart={(event) => {
            if (!props.canDrag) {
              event.preventDefault();
              return;
            }

            props.onSelect(tile);
            event.dataTransfer.setData("text/plain", tile.id);
            setTileDragImage({
              event,
              label: tile.label,
              playerColor: props.playerColor,
              textColor
            });
          }}
        >
          <span>{tile.label}</span>
          <small>{tile.value}</small>
        </button>
      ))}
    </div>
  );
}

function setTileDragImage(params: {
  event: DragEvent<HTMLButtonElement>;
  label: string;
  playerColor: string;
  textColor: string;
}): void {
  const size = createDragPreviewSize(readBoardCellSize());
  const preview = document.createElement("div");
  preview.textContent = params.label;
  preview.style.position = "fixed";
  preview.style.left = "-1000px";
  preview.style.top = "-1000px";
  preview.style.width = `${size}px`;
  preview.style.height = `${size}px`;
  preview.style.display = "grid";
  preview.style.placeItems = "center";
  preview.style.border = "3px solid #f7e6a6";
  preview.style.borderRadius = "0";
  preview.style.background = params.playerColor;
  preview.style.color = params.textColor;
  preview.style.font = `400 ${Math.max(10, Math.floor(size * 0.28))}px "Silkscreen", monospace`;
  document.body.append(preview);
  params.event.dataTransfer.effectAllowed = "move";
  params.event.dataTransfer.setDragImage(preview, size / 2, size / 2);
  window.setTimeout(() => preview.remove(), 0);
}

function readBoardCellSize(): number {
  const board = document.querySelector<HTMLElement>(".board-host");

  if (!board) {
    return 48;
  }

  const boardSize = Number(board.dataset.boardSize ?? 15);
  return Math.min(board.clientWidth, board.clientHeight) / boardSize;
}

function FaceSelectionDialog(props: {
  tile: Tile;
  playerColor: string;
  onCancel: () => void;
  onSelect: (face: string) => void;
}) {
  const textColor = textColorForPlayerColor(props.playerColor);
  const faces = faceOptionsForTileLabel(props.tile.label);

  return (
    <div className="dialog-backdrop">
      <div className="face-dialog" role="dialog" aria-modal="true" aria-label={`${props.tile.label} face`}>
        <strong>{props.tile.label}</strong>
        <div className="face-options">
          {faces.map((face) => (
            <button key={face} style={{ background: props.playerColor, color: textColor }} onClick={() => props.onSelect(face)}>
              {face}
            </button>
          ))}
        </div>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function readInitialRoomCode(): string {
  return new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
}
