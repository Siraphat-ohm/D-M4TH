import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type CSSProperties } from "react";
import type { MatchConfig } from "@d-m4th/config";
import type { ServerMessage } from "@d-m4th/protocol";
import { useShallow } from "zustand/react/shallow";
import { Route, Switch, useLocation } from "wouter";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import {
  clearReconnectSession,
  readLatestReconnectSession,
  readReconnectSession,
  type ReconnectSession,
  writeReconnectSession
} from "../reconnect-session";
import { useAppStore, type NoticeState } from "../store/app-store";
import { useTurnController } from "../turn/use-turn-controller";
import { TurnProvider } from "../turn/TurnContext";
import { LogDialog } from "./Dialogs";
import { leaveMatch as leaveMatchFlow, type ReconnectState } from "./leave-match";
import { LobbyLayout } from "./LobbyLayout";
import { MatchLayout } from "./MatchLayout";
import { NoticeToastStack } from "./NoticeToast";
import { normalizeRoomCode } from "./format";

const NOTICE_AUTO_DISMISS_MS = 4000;

const STATIC_LAYOUT_VARS = {
  "--layout-scale": "1",
  "--gap": "10px",
  "--topbar-height": "52px",
  "--rack-tile-size": "56px",
  "--rack-gap": "6px",
  "--rack-padding": "8px",
  "--action-width": "220px",
  "--ui-font-size": "16px",
  "--root-font-size": "16px",
  "--match-gap": "8px",
  "--topbar-card-height": "52px",
  "--rack-shell-padding": "8px",
  "--rack-shell-width": "502px",
  "--rack-strip-height": "72px",
  "--floating-log-width": "280px",
  "--actions-width": "220px",
  "--lobby-gap": "16px",
  "--lobby-padding": "16px",
  "--lobby-side-min": "240px",
  "--lobby-side-max": "300px",
  "--lobby-center-min": "560px"
} as CSSProperties;

export function App() {
  const [location, setLocation] = useLocation();
  const {
    viewMode,
    name,
    color,
    roomCode,
    config,
    logOpen,
    notice,
    snapshot,
    privateState,
    logEntries,
    ghostPlacements,
    setViewMode,
    setName,
    setColor,
    setRoomCode,
    setConfig,
    setLogOpen,
    setNotice,
    setSnapshot,
    setPrivateState,
    setGhostPlacements,
    addLog
  } = useAppStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      name: state.name,
      color: state.color,
      roomCode: state.roomCode,
      config: state.config,
      logOpen: state.logOpen,
      notice: state.notice,
      snapshot: state.snapshot,
      privateState: state.privateState,
      logEntries: state.logEntries,
      ghostPlacements: state.ghostPlacements,
      setViewMode: state.setViewMode,
      setName: state.setName,
      setColor: state.setColor,
      setRoomCode: state.setRoomCode,
      setConfig: state.setConfig,
      setLogOpen: state.setLogOpen,
      setNotice: state.setNotice,
      setSnapshot: state.setSnapshot,
      setPrivateState: state.setPrivateState,
      setGhostPlacements: state.setGhostPlacements,
      addLog: state.addLog
    }))
  );
  const turnHandleRef = useRef<(message: ServerMessage) => boolean>(() => false);
  const resumeRequestIdRef = useRef<string | undefined>(undefined);
  const resumeRoomCodeRef = useRef<string | undefined>(undefined);
  const resumeAttemptKeyRef = useRef<string | undefined>(undefined);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketEpoch, setSocketEpoch] = useState(0);
  const [reconnectState, setReconnectState] = useState<ReconnectState>("idle");
  const reconnectStateRef = useRef<ReconnectState>(reconnectState);
  const [reconnectSession, setReconnectSession] = useState<ReconnectSession | undefined>(() => readLatestReconnectSession());
  const reconnectSessionRef = useRef<ReconnectSession | undefined>(reconnectSession);
  const inActiveMatchContext = location === "/match" || snapshot?.status === "playing";
  const inActiveMatchContextRef = useRef<boolean>(inActiveMatchContext);

  useEffect(() => {
    reconnectSessionRef.current = reconnectSession;
  }, [reconnectSession]);

  useEffect(() => {
    reconnectStateRef.current = reconnectState;
  }, [reconnectState]);

  useEffect(() => {
    inActiveMatchContextRef.current = inActiveMatchContext;
  }, [inActiveMatchContext]);

  useEffect(() => {
    if (!inActiveMatchContext || !reconnectSession || reconnectState !== "idle" || privateState?.playerId) {
      return;
    }
    setReconnectState("waiting");
  }, [inActiveMatchContext, privateState?.playerId, reconnectSession, reconnectState]);

  useEffect(() => {
    if (!reconnectSession && reconnectState === "waiting") {
      setReconnectState("idle");
    }
  }, [reconnectSession, reconnectState]);

  useEffect(() => {
    if (inActiveMatchContext) return;
    if (reconnectState === "waiting" || reconnectState === "resuming") {
      setReconnectState("idle");
    }
  }, [inActiveMatchContext, reconnectState]);

  const client = useMemo(() => {
    return new ProtocolClient(defaultWebSocketUrl(), handleMessage, handleSocketStatus);

    function handleSocketStatus(connected: boolean): void {
      setSocketConnected(connected);

      if (connected) {
        setSocketEpoch((value) => value + 1);
        return;
      }

      if (reconnectSessionRef.current && inActiveMatchContextRef.current) {
        setReconnectState("waiting");
      }
    }

    function handleMessage(message: ServerMessage): void {
      if (turnHandleRef.current(message)) return;

      switch (message.type) {
        case "room:snapshot":
          startTransition(() => {
            setSnapshot(message.snapshot);
            if (message.private) {
              setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
              if (message.private.reconnectToken) {
                persistReconnectSession({
                  roomCode: message.snapshot.code,
                  reconnectToken: message.private.reconnectToken
                });
              }
            } else {
              setPrivateState(undefined);
            }
            if (resumeRequestIdRef.current && message.private?.playerId) {
              resumeRequestIdRef.current = undefined;
              setReconnectState("idle");
            }
          });
          break;

        case "room:presence":
          startTransition(() => {
            setGhostPlacements(message.ghostPlacements);
          });
          break;

        case "action:accepted":
          if (message.action === "room:resume" && message.requestId === resumeRequestIdRef.current) {
            resumeRequestIdRef.current = undefined;
            setReconnectState("idle");
          }

          if (message.reconnectToken) {
            const roomCode = message.roomCode ?? resumeRoomCodeRef.current;
            if (roomCode) {
              persistReconnectSession({ roomCode, reconnectToken: message.reconnectToken });
            }
          }

          addLog(message.action, "success");
          break;

        case "action:rejected":
          if (
            resumeRequestIdRef.current &&
            (message.requestId === resumeRequestIdRef.current || (message.requestId === undefined && reconnectStateRef.current === "resuming"))
          ) {
            resumeRequestIdRef.current = undefined;
            handleResumeRejected(message);
            break;
          }

          addLog(message.reason, "danger");
          setNotice({ text: message.reason, tone: "danger" });
          break;

        case "match:ended":
          startTransition(() => {
            setSnapshot(message.snapshot);
            addLog(`Match ended: ${message.snapshot.endedReason ?? "complete"}`, "info");
            setNotice({
              text: `Match ended: ${message.snapshot.endedReason ?? "complete"}`,
              tone: "info",
              sticky: true
            });
          });
          break;
      }
    }
  }, []);

  function persistReconnectSession(session: ReconnectSession): void {
    writeReconnectSession(session);
    setReconnectSession(session);
  }

  function clearReconnectRoom(roomCode: string): void {
    clearReconnectSession(roomCode);
    if (reconnectSessionRef.current?.roomCode === roomCode) {
      reconnectSessionRef.current = undefined;
    }
    setReconnectSession((current) => (current?.roomCode === roomCode ? undefined : current));
  }

  function handleResumeRejected(message: Extract<ServerMessage, { type: "action:rejected" }>): void {
    const isGone =
      message.statusCode === 410 || (message.reason.toLowerCase().includes("410") && message.reason.toLowerCase().includes("gone"));
    const roomCode = message.roomCode ?? resumeRoomCodeRef.current ?? reconnectSessionRef.current?.roomCode;
    if (isGone && roomCode) {
      clearReconnectRoom(roomCode);
      setReconnectState("expired");
      setNotice({ text: "Reconnect expired. Please join the room again.", tone: "danger", sticky: true });
      return;
    }

    setReconnectState("failed");
    setNotice({ text: `Reconnect failed: ${message.reason}`, tone: "danger", sticky: true });
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
  }, [notice, setNotice]);

  // -- Derived State --
  const isPlaying = snapshot?.status === "playing";
  const activeConfig = snapshot?.config ?? config;
  const rack = privateState?.rack ?? [];
  const isMyTurn = snapshot?.currentPlayerId === privateState?.playerId;
  const ownColor = snapshot?.players.find((p) => p.id === privateState?.playerId)?.color ?? color;
  const activeColor = snapshot?.players.find((p) => p.id === snapshot.currentPlayerId)?.color ?? ownColor;
  const actionsFrozen = reconnectState === "waiting" || reconnectState === "resuming";

  const turn = useTurnController({
    client,
    isMyTurn,
    actionsFrozen,
    rack,
    rackSize: activeConfig.rackSize,
    board: snapshot?.board ?? []
  });

  useEffect(() => {
    turnHandleRef.current = turn.handleMessage;
  });

  useEffect(() => {
    if (!socketConnected || !isReconnectRoute(location)) {
      return;
    }

    const scopedSession = snapshot?.code ? readReconnectSession(snapshot.code) : undefined;
    const session = scopedSession ?? reconnectSessionRef.current;
    if (!session) {
      return;
    }

    if (privateState?.playerId && snapshot?.code === session.roomCode) {
      setReconnectState("idle");
      return;
    }

    const attemptKey = `${socketEpoch}:${session.roomCode}:${session.reconnectToken}`;
    if (resumeAttemptKeyRef.current === attemptKey) {
      return;
    }

    const requestId = createRequestId();
    resumeAttemptKeyRef.current = attemptKey;
    resumeRequestIdRef.current = requestId;
    resumeRoomCodeRef.current = session.roomCode;
    setReconnectState("resuming");
    client.send({ type: "room:resume", requestId, code: session.roomCode, reconnectToken: session.reconnectToken });
  }, [client, privateState?.playerId, reconnectSession, location, snapshot?.code, socketConnected, socketEpoch]);

  // -- Handlers --
  const createRoom = () => {
    if (actionsFrozen) return;
    if (!name.trim()) return;
    client.send({ type: "room:create", requestId: createRequestId(), name: name.trim(), color, config });
    setLocation("/lobby");
  };

  const joinRoom = () => {
    if (actionsFrozen) return;
    const code = normalizeRoomCode(roomCode);
    if (!name.trim() || code.length !== 6) return;
    if (code !== roomCode) setRoomCode(code);
    client.send({ type: "room:join", requestId: createRequestId(), code, name: name.trim(), color });
    setLocation("/lobby");
  };

  const configure = (nextConfig: MatchConfig) => {
    if (actionsFrozen) return;
    setConfig(nextConfig);
    if (snapshot?.status === "lobby") {
      client.send({ type: "match:configure", requestId: createRequestId(), config: nextConfig });
    }
  };

  const startMatch = () => {
    if (actionsFrozen) return;
    client.send({ type: "match:start", requestId: createRequestId() });
  };

  const leaveMatch = () => {
    leaveMatchFlow({
      client,
      snapshotCode: snapshot?.code,
      reconnectSession: reconnectSessionRef.current,
      clearReconnectRoom,
      setSocketConnected,
      setReconnectState,
      resumeRequestIdRef,
      resumeRoomCodeRef,
      resumeAttemptKeyRef,
      inActiveMatchContextRef,
      turnHandleRef,
      setSnapshot,
      setPrivateState,
      setGhostPlacements,
      setLogOpen,
      setNotice,
      setRoomCode,
      setViewMode,
      setLocation
    });
  };

  useEffect(() => {
    if (snapshot?.status === "ended" && location === "/match") {
      setLocation("/", { replace: true });
      return;
    }

    if (snapshot?.status === "playing" && location !== "/match") {
      setLocation("/match", { replace: true });
      return;
    }

    if (snapshot?.status === "lobby" && location === "/") {
      setLocation("/lobby", { replace: true });
    }
  }, [location, setLocation, snapshot?.status]);

  const reconnectNotice = toReconnectNotice(reconnectState);
  const toastNotices = [
    ...(reconnectNotice ? [{ id: "reconnect", notice: reconnectNotice }] : []),
    ...(notice ? [{ id: "notice", notice, onDismiss: () => setNotice() }] : [])
  ];

  return (
    <div
      className="puzzle-theme-root"
      style={STATIC_LAYOUT_VARS}
    >
      <main className={`app-shell ${isPlaying ? "app-shell--playing" : "app-shell--lobby"}`}>
        <Switch>
          <Route path="/match">
            {snapshot?.status === "playing" ? (
              <TurnProvider turn={turn}>
                <MatchLayout onLeaveMatch={leaveMatch} />
              </TurnProvider>
            ) : (
              <NoticeToastStack
                notices={[{ id: "match-not-ready", notice: { text: "Match not ready yet", tone: "info" }, onDismiss: () => setLocation("/") }]}
              />
            )}
          </Route>

          <Route path="*">
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
              actionsDisabled={actionsFrozen}
            />
          </Route>
        </Switch>

        <NoticeToastStack notices={toastNotices} />

        {logOpen && <LogDialog entries={logEntries} onClose={() => setLogOpen(false)} />}
      </main>
    </div>
  );
}

function isReconnectRoute(route: string): boolean {
  return route === "/" || route === "/lobby" || route === "/match";
}

function toReconnectNotice(state: ReconnectState): NoticeState | undefined {
  switch (state) {
    case "waiting":
      return { text: "Connection lost. Reconnecting...", tone: "info", sticky: true };
    case "resuming":
      return { text: "Resuming your room session...", tone: "info", sticky: true };
    case "failed":
      return { text: "Reconnect failed. Join room again to continue.", tone: "danger", sticky: true };
    case "expired":
      return { text: "Reconnect expired for this room. Join again.", tone: "danger", sticky: true };
    default:
      return undefined;
  }
}
