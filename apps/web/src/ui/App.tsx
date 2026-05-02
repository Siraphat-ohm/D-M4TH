import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { MatchConfig } from "@d-m4th/config";
import type { ServerMessage } from "@d-m4th/protocol";
import { useShallow } from "zustand/react/shallow";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "../protocol-client";
import { useAppStore, type AppRoute, type NoticeState } from "../store/app-store";
import { useTurnController } from "../turn/use-turn-controller";
import { LogDialog } from "./Dialogs";
import { LobbyLayout } from "./LobbyLayout";
import { MatchLayout } from "./MatchLayout";
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
  "--lobby-side-min": "280px",
  "--lobby-side-max": "360px",
  "--lobby-center-min": "400px"
} as CSSProperties;

export function App() {
  const {
    viewMode,
    name,
    color,
    roomCode,
    config,
    logOpen,
    notice,
    route,
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
    setRoute,
    setSnapshot,
    setPrivateState,
    setGhostPlacements
  } = useAppStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      name: state.name,
      color: state.color,
      roomCode: state.roomCode,
      config: state.config,
      logOpen: state.logOpen,
      notice: state.notice,
      route: state.route,
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
      setRoute: state.setRoute,
      setSnapshot: state.setSnapshot,
      setPrivateState: state.setPrivateState,
      setGhostPlacements: state.setGhostPlacements
    }))
  );
  const turnHandleRef = useRef<(message: ServerMessage) => boolean>(() => false);

  const client = useMemo(() => {
    return new ProtocolClient(defaultWebSocketUrl(), handleMessage, () => {});

    function handleMessage(message: ServerMessage): void {
      if (turnHandleRef.current(message)) return;

      switch (message.type) {
        case "room:snapshot":
          setSnapshot(message.snapshot);
          if (message.private) {
            setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
          } else {
            setPrivateState(undefined);
          }
          break;

        case "room:presence":
          setGhostPlacements(message.ghostPlacements);
          break;

        case "action:accepted":
          useAppStore.getState().addLog(message.action, "success");
          break;

        case "action:rejected":
          useAppStore.getState().addLog(message.reason, "danger");
          useAppStore.getState().setNotice({ text: message.reason, tone: "danger" });
          break;

        case "match:ended":
          useAppStore.getState().addLog(`Match ended: ${message.snapshot.endedReason ?? "complete"}`, "info");
          useAppStore.getState().setNotice({
            text: `Match ended: ${message.snapshot.endedReason ?? "complete"}`,
            tone: "info",
            sticky: true
          });
          break;
      }
    }
  }, []);

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

  useEffect(() => {
    const onPopState = () => {
      setRoute(toRoute(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setRoute]);

  // -- Derived State --
  const isPlaying = snapshot?.status === "playing";
  const activeConfig = snapshot?.config ?? config;
  const rack = privateState?.rack ?? [];
  const isMyTurn = snapshot?.currentPlayerId === privateState?.playerId;
  const ownColor = snapshot?.players.find((p) => p.id === privateState?.playerId)?.color ?? color;
  const activeColor = snapshot?.players.find((p) => p.id === snapshot.currentPlayerId)?.color ?? ownColor;

  const turn = useTurnController({ client, isMyTurn, rack, rackSize: activeConfig.rackSize, board: snapshot?.board ?? [] });

  useEffect(() => {
    turnHandleRef.current = turn.handleMessage;
  });

  // -- Handlers --
  const navigate = useCallback((nextRoute: AppRoute, options?: { replace?: boolean }) => {
    if (toRoute(window.location.pathname) !== nextRoute) {
      if (options?.replace) {
        window.history.replaceState(null, "", nextRoute);
      } else {
        window.history.pushState(null, "", nextRoute);
      }
    }
    setRoute(nextRoute);
  }, [setRoute]);

  const createRoom = () => {
    if (!name.trim()) return;
    client.send({ type: "room:create", requestId: createRequestId(), name: name.trim(), color, config });
    navigate("/lobby");
  };

  const joinRoom = () => {
    const code = normalizeRoomCode(roomCode);
    if (!name.trim() || code.length !== 6) return;
    if (code !== roomCode) setRoomCode(code);
    client.send({ type: "room:join", requestId: createRequestId(), code, name: name.trim(), color });
    navigate("/lobby");
  };

  const configure = (nextConfig: MatchConfig) => {
    setConfig(nextConfig);
    if (snapshot?.status === "lobby") {
      client.send({ type: "match:configure", requestId: createRequestId(), config: nextConfig });
    }
  };

  const startMatch = () => client.send({ type: "match:start", requestId: createRequestId() });

  useEffect(() => {
    if (snapshot?.status === "playing" && route !== "/match") {
      navigate("/match", { replace: true });
      return;
    }

    if (snapshot?.status === "lobby" && route === "/") {
      navigate("/lobby", { replace: true });
    }
  }, [navigate, route, snapshot?.status]);

  const showLobbyPage = route !== "/match";
  const canShowMatchPage = snapshot?.status === "playing";

  return (
    <div
      className="puzzle-theme-root"
      style={{ ...STATIC_LAYOUT_VARS, "--active-player-color": activeColor, "--button-accent": activeColor } as CSSProperties}
    >
      <main className={`app-shell ${isPlaying ? "app-shell--playing" : "app-shell--lobby"}`}>
        {showLobbyPage ? (
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
                <NoticeBanner notice={notice} onDismiss={() => setNotice()} />
              </section>
            )}
          </>
        ) : canShowMatchPage ? (
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
        ) : (
          <section className="lobby-notice">
            <NoticeBanner notice={{ text: "Match not ready yet", tone: "info" }} onDismiss={() => navigate("/")} />
          </section>
        )}

        {logOpen && <LogDialog entries={logEntries} onClose={() => setLogOpen(false)} />}
      </main>
    </div>
  );
}

function toRoute(pathname: string): AppRoute {
  if (pathname === "/match") return "/match";
  if (pathname === "/lobby") return "/lobby";
  return "/";
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
