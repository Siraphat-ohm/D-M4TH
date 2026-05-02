import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, defaultWebSocketUrl, ProtocolClient } from "./protocol-client";
import {
  clearReconnectSession,
  readLatestReconnectSession,
  readReconnectSession,
  type ReconnectSession,
  writeReconnectSession
} from "./reconnect-session";
import type { ReconnectState } from "./leave-match";
import type { PublicSnapshot } from "@d-m4th/game";
import type { NoticeState } from "../app/store/app-store";

export interface UseProtocolOrchestratorParams {
  location: string;
  snapshot?: PublicSnapshot;
  privateState?: { playerId: string; rack: any[] };
  turnHandleRef: React.MutableRefObject<(message: ServerMessage) => boolean>;
  setSnapshot: (snapshot: PublicSnapshot) => void;
  setPrivateState: (state: any) => void;
  setGhostPlacements: (placements: any) => void;
  addLog: (message: string, tone: "success" | "info" | "danger") => void;
  setNotice: (notice: NoticeState) => void;
}

export function useProtocolOrchestrator(params: UseProtocolOrchestratorParams) {
  const resumeRequestIdRef = useRef<string | undefined>(undefined);
  const resumeRoomCodeRef = useRef<string | undefined>(undefined);
  const resumeAttemptKeyRef = useRef<string | undefined>(undefined);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketEpoch, setSocketEpoch] = useState(0);
  const [reconnectState, setReconnectState] = useState<ReconnectState>("idle");
  const reconnectStateRef = useRef<ReconnectState>(reconnectState);
  const [reconnectSession, setReconnectSession] = useState<ReconnectSession | undefined>(() => readLatestReconnectSession());
  const reconnectSessionRef = useRef<ReconnectSession | undefined>(reconnectSession);
  
  const inActiveMatchContext = params.location === "/match" || params.snapshot?.status === "playing";
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
    if (!inActiveMatchContext || !reconnectSession || reconnectState !== "idle" || params.privateState?.playerId) {
      return;
    }
    setReconnectState("waiting");
  }, [inActiveMatchContext, params.privateState?.playerId, reconnectSession, reconnectState]);

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

  // Use a mutable ref to hold the latest params. This allows handleMessage
  // to always access the freshest state setters and references without needing
  // to be included in the useMemo dependency array, which would cause the
  // ProtocolClient to be recreated and drop the WebSocket connection on every render.
  const latestParams = useRef(params);
  latestParams.current = params;

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
      const p = latestParams.current;
      if (p.turnHandleRef.current(message)) return;

      switch (message.type) {
        case "room:snapshot":
          startTransition(() => {
            p.setSnapshot(message.snapshot);
            if (message.private) {
              p.setPrivateState({ playerId: message.private.playerId, rack: message.private.rack });
              if (message.private.reconnectToken) {
                persistReconnectSession({
                  roomCode: message.snapshot.code,
                  reconnectToken: message.private.reconnectToken
                });
              }
            } else {
              p.setPrivateState(undefined);
            }
            if (resumeRequestIdRef.current && message.private?.playerId) {
              resumeRequestIdRef.current = undefined;
              setReconnectState("idle");
            }
          });
          break;

        case "room:presence":
          startTransition(() => {
            p.setGhostPlacements(message.ghostPlacements);
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

          p.addLog(message.action, "success");
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

          p.addLog(message.reason, "danger");
          p.setNotice({ text: message.reason, tone: "danger" });
          break;

        case "match:ended":
          startTransition(() => {
            p.setSnapshot(message.snapshot);
            p.addLog(`Match ended: ${message.snapshot.endedReason ?? "complete"}`, "info");
            p.setNotice({
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
    const p = latestParams.current;
    const isGone =
      message.statusCode === 410 || (message.reason.toLowerCase().includes("410") && message.reason.toLowerCase().includes("gone"));
    const roomCode = message.roomCode ?? resumeRoomCodeRef.current ?? reconnectSessionRef.current?.roomCode;
    if (isGone && roomCode) {
      clearReconnectRoom(roomCode);
      setReconnectState("expired");
      p.setNotice({ text: "Reconnect expired. Please join the room again.", tone: "danger", sticky: true });
      return;
    }

    setReconnectState("failed");
    p.setNotice({ text: `Reconnect failed: ${message.reason}`, tone: "danger", sticky: true });
  }

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  useEffect(() => {
    if (!socketConnected || !isReconnectRoute(params.location)) {
      return;
    }

    const scopedSession = params.snapshot?.code ? readReconnectSession(params.snapshot.code) : undefined;
    const session = scopedSession ?? reconnectSessionRef.current;
    if (!session) {
      return;
    }

    if (params.privateState?.playerId && params.snapshot?.code === session.roomCode) {
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
  }, [client, params.privateState?.playerId, reconnectSession, params.location, params.snapshot?.code, socketConnected, socketEpoch]);

  return {
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
  };
}

function isReconnectRoute(route: string): boolean {
  return route === "/" || route === "/lobby" || route === "/match";
}
