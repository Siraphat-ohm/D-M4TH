import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createClassicalConfig, createPartyConfig, tileBagScaleForPlayerCount, type MatchConfig } from "@d-m4th/config";
import { faceOptionsForTileLabel, type PublicSnapshot, type Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import { createDragPreviewSize, textColorForPlayerColor } from "../board/board-interaction";
import { useTurnController } from "../turn/use-turn-controller";
import { BoardCanvas } from "./BoardCanvas";

type ViewMode = "create" | "join";
const EMPTY_RACK: Tile[] = [];

interface PrivateState {
  playerId: string;
  rack: Tile[];
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
  const [notice, setNotice] = useState("");

  const turnHandleRef = useRef<(message: ServerMessage) => boolean>(() => false);

  const client = useMemo(() => {
    return new ProtocolClient(defaultWebSocketUrl(), handleMessage, setConnected);

    function handleMessage(message: ServerMessage): void {
      if (turnHandleRef.current(message)) return;

      if (message.type === "room:snapshot") {
        setSnapshot(message.snapshot);

        if (message.private) {
          setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
        }
      }

      if (message.type === "action:accepted") {
        setNotice(message.action);
      }

      if (message.type === "action:rejected") {
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
  const rack = privateState?.rack ?? EMPTY_RACK;
  const ownColor = snapshot?.players.find((player) => player.id === privateState?.playerId)?.color ?? color;

  const turn = useTurnController({ client, isMyTurn, rack });
  turnHandleRef.current = turn.handleMessage;

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
              <LobbyPanel snapshot={snapshot} onStart={startMatch} />
              <Hud snapshot={snapshot} />
            </>
          )}

          {notice && <p className="notice">{notice}</p>}
        </section>

        <section className="play-surface">
          <BoardCanvas
            snapshot={snapshot}
            draft={turn.draft}
            rack={rack}
            currentPlayerId={privateState?.playerId}
            selectedTileId={turn.selectedTileId}
            placementDisabled={turn.placementDisabled}
            onCellClick={turn.handleBoardCellClick}
            onTileDrop={turn.placeRackTile}
          />
          <div className="control-strip">
            <section className="rack-panel">
              <Rack
                rack={turn.visibleRack}
                selectedTileIds={turn.selectedRackTileIds}
                playerColor={ownColor}
                canDrag={turn.turnMode === "play"}
                onSelect={turn.handleRackSelect}
              />
            </section>
            <section className="action-panel">
              <div className="action-bar">
                <button className="primary" onClick={turn.commitPlay} disabled={!isMyTurn || turn.draft.length === 0}>
                  Play
                </button>
                <button onClick={turn.handleSwapAction} disabled={!isMyTurn || (turn.turnMode === "swap" && turn.swapSelectedTileIds.length === 0)}>
                  {turn.turnMode === "swap" ? `Swap ${turn.swapSelectedTileIds.length}` : "Swap"}
                </button>
                <button onClick={turn.passTurn} disabled={!isMyTurn || turn.turnMode === "swap"}>
                  Pass
                </button>
                <button onClick={turn.recallRack} disabled={turn.turnMode === "play" && turn.draft.length === 0}>
                  {turn.turnMode === "swap" ? "Cancel" : "Recall"}
                </button>
                {activeConfig.mode !== "classical" && <button disabled>Use Skill</button>}
              </div>
              {turn.previewScore !== undefined && <strong className="preview-score">Score +{turn.previewScore}</strong>}
            </section>
          </div>
          {turn.pendingFacePlacement && (
            <FaceSelectionDialog
              playerColor={ownColor}
              tile={turn.pendingFacePlacement.tile}
              onCancel={turn.cancelPendingFace}
              onSelect={(face) => turn.placeResolvedRackTile(turn.pendingFacePlacement!.tile, turn.pendingFacePlacement!.x, turn.pendingFacePlacement!.y, face)}
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

function LobbyPanel(props: { snapshot: PublicSnapshot; onStart: () => void }) {
  const inviteUrl = `${window.location.origin}?room=${props.snapshot.code}`;

  return (
    <div className="panel compact">
      <div className="room-code">
        <span>{props.snapshot.code}</span>
        <button onClick={() => copyText(inviteUrl)}>Copy link</button>
      </div>
      <button className="primary" onClick={props.onStart} disabled={props.snapshot.status !== "lobby"}>
        Start
      </button>
    </div>
  );
}

function Hud(props: { snapshot: PublicSnapshot }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (props.snapshot.status !== "playing") return;

    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [props.snapshot.status, props.snapshot.turnStartedAt, props.snapshot.currentPlayerId]);

  const now = Date.now();

  return (
    <div className="player-list">
      {props.snapshot.players.map((player) => {
        const isActive = props.snapshot.currentPlayerId === player.id;
        const elapsed = isActive ? Math.max(0, now - props.snapshot.turnStartedAt) : 0;
        const remaining = Math.max(0, player.remainingMs - elapsed);

        return (
          <div className={isActive ? "player-row current" : "player-row"} key={player.id}>
            <span className="swatch" style={{ background: player.color }} />
            <span>{player.name}</span>
            <strong>{player.score}</strong>
            <time>{formatTime(remaining)}</time>
          </div>
        );
      })}
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

function copyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  el.remove();
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
