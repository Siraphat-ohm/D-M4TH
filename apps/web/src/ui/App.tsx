import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createClassicalConfig, type MatchConfig } from "@d-m4th/config";
import type { BoardTile, PublicSnapshot, Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import { useTurnController } from "../turn/use-turn-controller";
import { LogDialog } from "./Dialogs";
import { LobbyLayout } from "./LobbyLayout";
import { MatchLayout } from "./MatchLayout";
import type { LogEntry, NoticeTone } from "./types";

type ViewMode = "create" | "join";
const NOTICE_AUTO_DISMISS_MS = 4000;
const DEFAULT_PLAYER_COLOR = "#EF476F";
const LOG_HISTORY_LIMIT = 30;

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
  
  // -- UI State --
  const [viewMode, setViewMode] = useState<ViewMode>(initialRoomCode ? "join" : "create");
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_PLAYER_COLOR);
  const [roomCode, setRoomCode] = useState(normalizeRoomCode(initialRoomCode));
  const [config, setConfig] = useState<MatchConfig>(createClassicalConfig());
  const [logOpen, setLogOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState>();

  // -- Game State --
  const [snapshot, setSnapshot] = useState<PublicSnapshot>();
  const [privateState, setPrivateState] = useState<PrivateState>();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [ghostPlacements, setGhostPlacements] = useState<Array<{ playerId: string; placements: BoardTile[] }>>([]);

  const turnHandleRef = useRef<(message: ServerMessage) => boolean>(() => false);
  const nextLogIdRef = useRef(1);

  const client = useMemo(() => {
    return new ProtocolClient(defaultWebSocketUrl(), handleMessage, () => {});

    function handleMessage(message: ServerMessage): void {
      if (turnHandleRef.current(message)) return;

      switch (message.type) {
        case "room:snapshot":
          setSnapshot(message.snapshot);
          if (message.private) {
            setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
          }
          break;

        case "room:presence":
          setGhostPlacements(message.ghostPlacements);
          break;

        case "action:accepted":
          addLog(message.action, "success");
          break;

        case "action:rejected":
          addLog(message.reason, "danger");
          setNotice({ text: message.reason, tone: "danger" });
          break;

        case "match:ended":
          addLog(`Match ended: ${message.snapshot.endedReason ?? "complete"}`, "info");
          setNotice({
            text: `Match ended: ${message.snapshot.endedReason ?? "complete"}`,
            tone: "info",
            sticky: true
          });
          break;
      }
    }
  }, []);

  function addLog(text: string, tone: NoticeTone): void {
    setLogEntries((entries) => [
      { id: nextLogIdRef.current++, text, tone, at: Date.now() },
      ...entries
    ].slice(0, LOG_HISTORY_LIMIT));
  }

  // -- Lifecycle --
  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  useEffect(() => {
    if (!notice || notice.sticky) return;
    const timerId = window.setTimeout(() => setNotice(undefined), NOTICE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timerId);
  }, [notice]);

  // -- Derived State --
  const isPlaying = snapshot?.status === "playing";
  const activeConfig = snapshot?.config ?? config;
  const rack = privateState?.rack ?? [];
  const isMyTurn = snapshot?.currentPlayerId === privateState?.playerId;
  const ownColor = snapshot?.players.find((p) => p.id === privateState?.playerId)?.color ?? color;
  const activeColor = snapshot?.players.find((p) => p.id === snapshot.currentPlayerId)?.color ?? ownColor;

  const turn = useTurnController({ client, isMyTurn, rack, rackSize: activeConfig.rackSize });
  turnHandleRef.current = turn.handleMessage;

  // -- Handlers --
  const createRoom = () => {
    if (!name.trim()) return;
    client.send({ type: "room:create", requestId: createRequestId(), name: name.trim(), color, config });
  };

  const joinRoom = () => {
    const code = normalizeRoomCode(roomCode);
    if (!name.trim() || code.length !== 6) return;
    if (code !== roomCode) setRoomCode(code);
    client.send({ type: "room:join", requestId: createRequestId(), code, name: name.trim(), color });
  };

  const configure = (nextConfig: MatchConfig) => {
    setConfig(nextConfig);
    if (snapshot?.status === "lobby") {
      client.send({ type: "match:configure", requestId: createRequestId(), config: nextConfig });
    }
  };

  const startMatch = () => client.send({ type: "match:start", requestId: createRequestId() });

  return (
    <div
      className="puzzle-theme-root"
      style={{ "--active-player-color": activeColor, "--button-accent": activeColor } as CSSProperties}
    >
      <main className={`app-shell ${isPlaying ? "app-shell--playing" : "app-shell--lobby"}`}>
        {!isPlaying ? (
          <>
            <LobbyLayout
              viewMode={viewMode}
              name={name}
              color={color}
              roomCode={roomCode}
              activeConfig={activeConfig}
              snapshot={snapshot}
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
        ) : (
          <MatchLayout
            snapshot={snapshot}
            ghostPlacements={ghostPlacements}
            privateState={privateState}
            logEntries={logEntries}
            activeColor={activeColor}
            ownColor={ownColor}
            turn={turn}
            isMyTurn={isMyTurn}
            onOpenLog={() => setLogOpen(true)}
            onCommitPlay={turn.commitPlay}
            onSwapAction={turn.handleSwapAction}
            onPassTurn={turn.passTurn}
            onRecallRack={turn.recallRack}
          />
        )}

        {logOpen && <LogDialog entries={logEntries} onClose={() => setLogOpen(false)} />}
      </main>
    </div>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: NoticeState; onDismiss: () => void }) {
  return (
    <div className={`notice ${notice.tone}`} role="status" aria-live="polite">
      <span>{notice.text}</span>
      <button type="button" aria-label="Dismiss notice" onClick={onDismiss}>
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
