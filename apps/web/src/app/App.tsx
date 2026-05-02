import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type CSSProperties } from "react";
import type { MatchConfig } from "@d-m4th/config";
import type { ServerMessage } from "@d-m4th/protocol";
import { useShallow } from "zustand/react/shallow";
import { Route, Switch, useLocation } from "wouter";
import { useAppStore, type NoticeState } from "@/app/store/app-store";
import { useTurnController } from "@/turn/use-turn-controller";
import { TurnProvider } from "@/turn/TurnContext";
import { LogDialog } from "@/ui/dialogs/Dialogs";
import { leaveMatch as leaveMatchFlow, type ReconnectState } from "@/client/leave-match";
import { LobbyLayout } from "@/ui/lobby/LobbyLayout";
import { MatchLayout } from "@/ui/match/MatchLayout";
import { NoticeToastStack } from "@/ui/toast/NoticeToast";
import { normalizeRoomCode } from "@/ui/shared/format";
import { useProtocolOrchestrator } from "@/client/use-protocol-orchestrator";
import { useLobbyActions } from "@/client/use-lobby-actions";

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
  const {
    client,
    reconnectState,
    reconnectSessionRef,
    clearReconnectRoom,
    setSocketConnected,
    setReconnectState,
    resumeRequestIdRef,
    resumeRoomCodeRef,
    resumeAttemptKeyRef,
    inActiveMatchContextRef
  } = useProtocolOrchestrator({
    location,
    snapshot,
    privateState,
    turnHandleRef,
    setSnapshot,
    setPrivateState,
    setGhostPlacements,
    addLog,
    setNotice
  });

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

  // -- Handlers --
  const { createRoom, joinRoom, configure, startMatch } = useLobbyActions({
    client,
    actionsFrozen,
    name,
    color,
    roomCode,
    config,
    snapshot,
    setLocation,
    setRoomCode,
    setConfig
  });

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
