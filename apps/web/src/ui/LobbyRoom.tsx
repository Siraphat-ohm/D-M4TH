import type { FormEvent } from "react";
import { PREMIUM_MAP_OPTIONS, createClassicalConfig, createPartyConfig, type MatchConfig, type PremiumMapId } from "@d-m4th/config";
import type { PublicSnapshot } from "@d-m4th/game";
import { ColorPicker } from "./ColorPicker";
import { normalizeRoomCode } from "./format";
import type { ViewMode } from "./types";

interface LobbyRoomProps {
  color: string;
  config: MatchConfig;
  name: string;
  nameRequired: boolean;
  roomCode: string;
  snapshot?: PublicSnapshot;
  viewMode: ViewMode;
  onColorChange: (color: string) => void;
  onConfigChange: (config: MatchConfig) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onNameChange: (name: string) => void;
  onRoomCodeChange: (roomCode: string) => void;
  onStartMatch: () => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  actionsDisabled: boolean;
}

export function LobbyRoom(props: LobbyRoomProps) {
  const normalizedRoomCode = normalizeRoomCode(props.roomCode);
  const canCreateRoom = !props.actionsDisabled && !props.nameRequired && !props.snapshot;
  const canJoinRoom = !props.actionsDisabled && !props.nameRequired && normalizedRoomCode.length === 6;

  function submitLobbyAction(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (props.snapshot) {
      return;
    }

    if (props.viewMode === "create") {
      if (canCreateRoom) {
        props.onCreateRoom();
      }
      return;
    }

    if (canJoinRoom) {
      props.onJoinRoom();
    }
  }

  return (
    <>
      <section className="lobby-setup-panel">
        <div className="sidebar-header">
          <h1>D-M4TH</h1>
        </div>
        <form className="panel" onSubmit={submitLobbyAction}>
          {!props.snapshot && (
            <div className="tabs">
              <button
                type="button"
                className={props.viewMode === "create" ? "active" : ""}
                onClick={() => props.onViewModeChange("create")}
                disabled={props.actionsDisabled}
              >
                Create
              </button>
              <button
                type="button"
                className={props.viewMode === "join" ? "active" : ""}
                onClick={() => props.onViewModeChange("join")}
                disabled={props.actionsDisabled}
              >
                Join
              </button>
            </div>
          )}
          <label>
            Name
            <input
              id="player-name"
              name="playerName"
              value={props.name}
              maxLength={24}
              autoComplete="nickname"
              disabled={props.actionsDisabled}
              onChange={(event) => props.onNameChange(event.target.value)}
            />
          </label>
          <label>
            Color
            <ColorPicker value={props.color} onChange={props.onColorChange} disabled={props.actionsDisabled} />
          </label>
          {props.viewMode === "create" || props.snapshot ? (
            <CreateControls
              color={props.color}
              config={props.config}
              disabled={!canCreateRoom}
              roomCreated={props.snapshot !== undefined}
              onChange={props.onConfigChange}
              actionsDisabled={props.actionsDisabled}
            />
          ) : (
            <JoinControls
              color={props.color}
              disabled={!canJoinRoom}
              roomCode={normalizedRoomCode}
              onChange={props.onRoomCodeChange}
              actionsDisabled={props.actionsDisabled}
            />
          )}
        </form>
      </section>
      <LobbyStatusPanel
        color={props.color}
        config={props.config}
        snapshot={props.snapshot}
        onStart={props.onStartMatch}
        actionsDisabled={props.actionsDisabled}
      />
    </>
  );
}

function CreateControls(props: {
  color: string;
  config: MatchConfig;
  disabled: boolean;
  roomCreated: boolean;
  onChange: (config: MatchConfig) => void;
  actionsDisabled: boolean;
}) {
  const { config, onChange } = props;

  return (
    <>
      <label>
        Mode
        <select
          id="match-mode"
          name="matchMode"
          value={config.mode}
          disabled={props.actionsDisabled}
          onChange={(event) => onChange(event.target.value === "classical" ? createClassicalConfig() : createPartyConfig())}
        >
          <option value="classical">Classical</option>
          <option value="party">Party</option>
        </select>
      </label>
      <label>
        Max players
        <input
          id="max-players"
          name="maxPlayers"
          type="number"
          min={2}
          max={6}
          value={config.maxPlayers}
          disabled={props.actionsDisabled}
          onChange={(event) => onChange(createPartyConfig({ ...config, maxPlayers: Number(event.target.value) }))}
        />
      </label>
      <label>
        Board size
        <input
          id="board-size"
          name="boardSize"
          type="number"
          min={15}
          max={25}
          step={2}
          value={config.boardSize}
          disabled={props.actionsDisabled}
          onChange={(event) => onChange(createPartyConfig({ ...config, boardSize: Number(event.target.value) }))}
        />
      </label>
      {config.mode === "party" && (
        <label>
          Map layout
          <select
            id="map-layout"
            name="mapLayout"
            value={config.premiumMapId}
            disabled={props.actionsDisabled}
            onChange={(event) => onChange(createPartyConfig({ ...config, premiumMapId: event.target.value as PremiumMapId }))}
          >
            {PREMIUM_MAP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {!props.roomCreated && (
        <button type="submit" className="primary" disabled={props.disabled} style={{ "--button-accent": props.color } as React.CSSProperties}>
          Create room
        </button>
      )}
    </>
  );
}

function JoinControls(props: { color: string; disabled: boolean; roomCode: string; onChange: (roomCode: string) => void; actionsDisabled: boolean }) {
  return (
    <>
      <label>
        Room code
        <input
          id="room-code"
          name="roomCode"
          value={props.roomCode}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          disabled={props.actionsDisabled}
          onChange={(event) => props.onChange(normalizeRoomCode(event.target.value))}
        />
      </label>
      <button type="submit" className="primary" disabled={props.disabled} style={{ "--button-accent": props.color } as React.CSSProperties}>
        Join room
      </button>
    </>
  );
}

function LobbyStatusPanel(props: { color: string; config: MatchConfig; snapshot?: PublicSnapshot; onStart: () => void; actionsDisabled: boolean }) {
  const snapshot = props.snapshot;
  const canStart = !props.actionsDisabled && snapshot !== undefined && snapshot.players.length >= snapshot.config.minPlayers;
  const maxPlayers = snapshot?.config.maxPlayers ?? props.config.maxPlayers;

  return (
    <aside className="lobby-status">
      <section className="panel compact lobby-room-card">
        <div className="room-code">
          <span>Room code</span>
          <strong>{snapshot?.code ?? "------"}</strong>
        </div>
        {!snapshot && <p className="lobby-empty-state">Create room first</p>}
        <button type="button" className="primary" onClick={props.onStart} disabled={!canStart} style={{ "--button-accent": props.color } as React.CSSProperties}>
          Start
        </button>
      </section>
      <section className="panel compact lobby-players-card">
        <div className="lobby-panel-heading">
          <span>Players</span>
          <strong>
            {snapshot?.players.length ?? 0} / {maxPlayers}
          </strong>
        </div>
        <div className="lobby-player-list">
          {snapshot?.players.map((player) => (
            <div className="lobby-player-row" key={player.id}>
              <span className="swatch" style={{ background: player.color }} />
              <span className="player-name">{player.name}</span>
              <span className="lobby-player-score">{player.score} pts</span>
              <span className="lobby-player-state">{player.connected ? "Ready" : "Offline"}</span>
            </div>
          ))}
          {createWaitingSlots({ maxPlayers, playerCount: snapshot?.players.length ?? 0 }).map((slot) => (
            <div className="lobby-player-row waiting" key={slot}>
              <span className="swatch" />
              <span className="player-name">Waiting for player...</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function createWaitingSlots(params: { maxPlayers: number; playerCount: number }): number[] {
  const waitingCount = Math.max(0, params.maxPlayers - params.playerCount);
  return Array.from({ length: waitingCount }, (_, index) => index);
}
