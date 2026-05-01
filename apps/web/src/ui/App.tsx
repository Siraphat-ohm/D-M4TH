import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, RefreshCcw, ScrollText, SkipForward, Undo2 } from "lucide-react";
import { createClassicalConfig, type MatchConfig } from "@d-m4th/config";
import type { Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import { useTurnController } from "../turn/use-turn-controller";
import { BoardCanvas } from "./BoardCanvas";
import { FaceSelectionDialog, LogDialog } from "./Dialogs";
import { LobbyRoom } from "./LobbyRoom";
import { MatchTopBar } from "./MatchTopBar";
import { Rack } from "./Rack";
import type { LogEntry, NoticeTone } from "./types";

type ViewMode = "create" | "join";
const EMPTY_RACK: Tile[] = [];
const EMPTY_DRAFT: Placement[] = [];
const NOTICE_AUTO_DISMISS_MS = 4000;
const DEFAULT_PLAYER_COLOR = "#EF476F";

interface PrivateState {
  playerId: string;
  rack: Tile[];
}

interface NoticeState {
  text: string;
  tone: NoticeTone;
  sticky?: boolean;
}

export function App() {
  const initialRoomCode = readInitialRoomCode();
  const [viewMode, setViewMode] = useState<ViewMode>(initialRoomCode ? "join" : "create");
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_PLAYER_COLOR);
  const [roomCode, setRoomCode] = useState(normalizeRoomCode(initialRoomCode));
  const [config, setConfig] = useState<MatchConfig>(createClassicalConfig());
  const [snapshot, setSnapshot] = useState<PublicSnapshot>();
  const [privateState, setPrivateState] = useState<PrivateState>();
  const [notice, setNotice] = useState<NoticeState>();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const turnHandleRef = useRef<(message: ServerMessage) => boolean>(() => false);
  const nextLogIdRef = useRef(1);

  const client = useMemo(() => {
    return new ProtocolClient(defaultWebSocketUrl(), handleMessage, () => {});

    function handleMessage(message: ServerMessage): void {
      if (turnHandleRef.current(message)) return;

      if (message.type === "room:snapshot") {
        setSnapshot(message.snapshot);

        if (message.private) {
          setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
        }
      }

      if (message.type === "action:accepted") {
        addLog(message.action, "success");
      }

      if (message.type === "action:rejected") {
        addLog(message.reason, "danger");
        setNotice({ text: message.reason, tone: "danger" });
      }

      if (message.type === "match:ended") {
        addLog(`Match ended: ${message.snapshot.endedReason ?? "complete"}`, "info");
        setNotice({
          text: `Match ended: ${message.snapshot.endedReason ?? "complete"}`,
          tone: "info",
          sticky: true
        });
      }
    }
  }, []);

  function addLog(text: string, tone: NoticeTone): void {
    setLogEntries((entries) => [
      { id: nextLogIdRef.current++, text, tone, at: Date.now() },
      ...entries
    ].slice(0, 30));
  }

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  useEffect(() => {
    if (!notice || notice.sticky) {
      return;
    }

    const timerId = window.setTimeout(() => setNotice(undefined), NOTICE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timerId);
  }, [notice]);

  const isMyTurn = snapshot?.currentPlayerId === privateState?.playerId;
  const isPlaying = snapshot?.status === "playing";
  const activeConfig = snapshot?.config ?? config;
  const rack = privateState?.rack ?? EMPTY_RACK;
  const ownColor = snapshot?.players.find((player) => player.id === privateState?.playerId)?.color ?? color;
  const activeColor = snapshot?.players.find((player) => player.id === snapshot.currentPlayerId)?.color ?? ownColor ?? DEFAULT_PLAYER_COLOR;
  const playerName = name.trim();
  const showSetupPreview = !isPlaying;

  const turn = useTurnController({ client, isMyTurn, rack, rackSize: activeConfig.rackSize });
  turnHandleRef.current = turn.handleMessage;

  function createRoom(): void {
    if (!playerName) {
      return;
    }

    client.send({ type: "room:create", requestId: createRequestId(), name: playerName, color, config });
  }

  function joinRoom(): void {
    const normalizedRoomCode = normalizeRoomCode(roomCode);

    if (!playerName || normalizedRoomCode.length !== 6) {
      return;
    }

    if (normalizedRoomCode !== roomCode) {
      setRoomCode(normalizedRoomCode);
    }

    client.send({ type: "room:join", requestId: createRequestId(), code: normalizedRoomCode, name: playerName, color });
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
    <div
      className="puzzle-theme-root"
      style={
        {
          "--active-player-color": activeColor,
          "--button-accent": activeColor
        } as CSSProperties
      }
    >
      <main className={`app-shell ${isPlaying ? "app-shell--playing" : "app-shell--lobby"}`}>
        {!isPlaying && (
          <>
            <LobbyRoom
              color={color}
              config={activeConfig}
              name={name}
              nameRequired={playerName.length === 0}
              roomCode={roomCode}
              snapshot={snapshot?.status === "lobby" ? snapshot : undefined}
              viewMode={viewMode}
              onColorChange={setColor}
              onConfigChange={configure}
              onCreateRoom={createRoom}
              onJoinRoom={joinRoom}
              onNameChange={setName}
              onRoomCodeChange={(nextRoomCode) => setRoomCode(normalizeRoomCode(nextRoomCode))}
              onStartMatch={startMatch}
              onViewModeChange={setViewMode}
            />
            {notice && (
              <section className="lobby-notice">
                <NoticeBanner notice={notice} onDismiss={() => setNotice(undefined)} />
              </section>
            )}
          </>
        )}

        {isPlaying && (
          <section className="match-topbar">
            <MatchTopBar snapshot={snapshot} previewScore={turn.previewScore} />
          </section>
        )}

        {showSetupPreview && (
          <section className="setup-preview">
            <BoardCanvas
              previewBoardSize={activeConfig.boardSize}
              draft={EMPTY_DRAFT}
              rack={EMPTY_RACK}
              placementDisabled
              onCellClick={() => {}}
              onDraftTileDoubleClick={() => {}}
              onTileDrop={() => {}}
              variant="preview"
            />
          </section>
        )}

        {isPlaying && (
          <section className="play-surface">
            <section className="board-stage">
              <div className="board-scroll-container">
                <BoardCanvas
                  snapshot={snapshot}
                  draft={turn.draft}
                  rack={rack}
                  currentPlayerId={privateState?.playerId}
                  selectedTileId={turn.selectedTileId}
                  placementDisabled={turn.placementDisabled}
                  onCellClick={turn.handleBoardCellClick}
                  onDraftTileDoubleClick={turn.handleBoardCellDoubleClick}
                  onTileDrop={turn.placeRackTile}
                />
              </div>            </section>
            <section className="control-strip">
              <section className="rack-panel">
                <Rack
                  rackSlots={turn.rackSlots}
                  selectedTileIds={turn.selectedRackTileIds}
                  playerColor={ownColor}
                  canDrag={turn.turnMode === "play"}
                  onSelect={turn.handleRackSelect}
                />
              </section>
              <section className="action-panel">
                <div className="action-bar">
                  <button
                    className="primary"
                    style={{ "--button-accent": activeColor } as CSSProperties}
                    onClick={turn.commitPlay}
                    disabled={!isMyTurn || turn.draft.length === 0}
                  >
                    <Check size={15} aria-hidden="true" />
                    Play
                  </button>
                  <button onClick={turn.handleSwapAction} disabled={!isMyTurn || (turn.turnMode === "swap" && turn.swapSelectedTileIds.length === 0)}>
                    <RefreshCcw size={15} aria-hidden="true" />
                    {turn.turnMode === "swap" ? `Swap ${turn.swapSelectedTileIds.length}` : "Swap"}
                  </button>
                  <button onClick={turn.passTurn} disabled={!isMyTurn || turn.turnMode === "swap"}>
                    <SkipForward size={15} aria-hidden="true" />
                    Pass
                  </button>
                  <button onClick={turn.recallRack} disabled={turn.turnMode === "play" && turn.draft.length === 0}>
                    <Undo2 size={15} aria-hidden="true" />
                    {turn.turnMode === "swap" ? "Cancel" : "Recall"}
                  </button>
                </div>
              </section>
            </section>
            <button
              type="button"
              className="floating-log-button"
              aria-label="Open match log"
              onClick={() => setLogOpen(true)}
            >
              <ScrollText size={18} aria-hidden="true" />
              {logEntries.length > 0 && (
                <span className="floating-log-badge" aria-label="Log entries">
                  {Math.min(logEntries.length, 99)}
                </span>
              )}
            </button>
            {turn.pendingFacePlacement && (
              <FaceSelectionDialog
                playerColor={ownColor}
                tile={turn.pendingFacePlacement.tile}
                onCancel={turn.cancelPendingFace}
                onSelect={(face) => turn.placeResolvedRackTile(turn.pendingFacePlacement!.tile, turn.pendingFacePlacement!.x, turn.pendingFacePlacement!.y, face)}
              />
            )}
          </section>
        )}

        {logOpen && <LogDialog entries={logEntries} onClose={() => setLogOpen(false)} />}
      </main>
    </div>
  );
}

function NoticeBanner(props: { notice: NoticeState; onDismiss: () => void }) {
  return (
    <div className={`notice ${props.notice.tone}`} role="status" aria-live="polite">
      <span>{props.notice.text}</span>
      <button type="button" aria-label="Dismiss notice" onClick={props.onDismiss}>
        Close
      </button>
    </div>
  );
}

function normalizeRoomCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
}

function readInitialRoomCode(): string {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");
}
