import { useEffect, useMemo, useRef, useState } from "react";
import { createClassicalConfig, type MatchConfig } from "@d-m4th/config";
import type { Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import { useTurnController } from "../turn/use-turn-controller";
import { BoardCanvas } from "./BoardCanvas";
import { FaceSelectionDialog, LogDialog } from "./Dialogs";
import { LobbyRoom } from "./LobbyRoom";
import { PlayerInfoList } from "./PlayerInfoList";
import { Rack } from "./Rack";
import type { LogEntry, NoticeTone } from "./types";

type ViewMode = "create" | "join";
const EMPTY_RACK: Tile[] = [];
const EMPTY_DRAFT: Placement[] = [];
const NOTICE_AUTO_DISMISS_MS = 4000;

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
  const [color, setColor] = useState("#f97316");
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [config, setConfig] = useState<MatchConfig>(createClassicalConfig());
  const [snapshot, setSnapshot] = useState<PublicSnapshot>();
  const [privateState, setPrivateState] = useState<PrivateState>();
  const [notice, setNotice] = useState<NoticeState>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        setNotice({ text: message.action, tone: "success" });
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
    if (!playerName) {
      return;
    }

    client.send({ type: "room:join", requestId: createRequestId(), code: roomCode, name: playerName, color });
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
              onRoomCodeChange={setRoomCode}
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
          <section className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
            <div className="sidebar-header">
              <h1>D-M4TH</h1>
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              >
                {sidebarCollapsed ? "▶" : "◀"}
              </button>
            </div>
            {snapshot && <PlayerInfoList snapshot={snapshot} previewScore={turn.previewScore} />}
            {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(undefined)} />}
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

        {isPlaying && <section className="play-surface min-w-0">
          <div className="board-scroll-container px-1 md:px-0">
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
          </div>
          <div className="control-strip">
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
                  onClick={turn.commitPlay}
                  disabled={!isMyTurn || turn.draft.length === 0}
                >
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
              </div>
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
        </section>}

        {isPlaying && (
          <button className="floating-log-button" onClick={() => setLogOpen(true)}>
            Log {logEntries.length}
          </button>
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

function readInitialRoomCode(): string {
  return new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
}
