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
}

export function LobbyRoom(props: LobbyRoomProps) {
  const normalizedRoomCode = normalizeRoomCode(props.roomCode);
  const canCreateRoom = !props.nameRequired && !props.snapshot;
  const canJoinRoom = !props.nameRequired && normalizedRoomCode.length === 6;

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
              <button type="button" className={props.viewMode === "create" ? "active" : ""} onClick={() => props.onViewModeChange("create")}>
                Create
              </button>
              <button type="button" className={props.viewMode === "join" ? "active" : ""} onClick={() => props.onViewModeChange("join")}>
                Join
              </button>
            </div>
          )}
          <label>
            Name
            <input value={props.name} maxLength={24} onChange={(event) => props.onNameChange(event.target.value)} />
          </label>
          <label>
            Color
            <ColorPicker value={props.color} onChange={props.onColorChange} />
          </label>
          {props.viewMode === "create" || props.snapshot ? (
            <CreateControls
              config={props.config}
              disabled={!canCreateRoom}
              roomCreated={props.snapshot !== undefined}
              onChange={props.onConfigChange}
            />
          ) : (
            <JoinControls
              disabled={!canJoinRoom}
              roomCode={normalizedRoomCode}
              onChange={props.onRoomCodeChange}
            />
          )}
        </form>
      </section>
      <LobbyStatusPanel config={props.config} snapshot={props.snapshot} onStart={props.onStartMatch} />
    </>
  );
}

function CreateControls(props: {
  config: MatchConfig;
  disabled: boolean;
  roomCreated: boolean;
  onChange: (config: MatchConfig) => void;
}) {
  const { config, onChange } = props;

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
      <label>
        Board size
        <input
          type="number"
          min={15}
          max={25}
          step={2}
          value={config.boardSize}
          onChange={(event) => onChange(createPartyConfig({ ...config, boardSize: Number(event.target.value) }))}
        />
      </label>
      {config.mode === "party" && (
        <label>
          Map layout
          <select
            value={config.premiumMapId}
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
        <button type="submit" className="primary" disabled={props.disabled}>
          Create room
        </button>
      )}
    </>
  );
}

function JoinControls(props: { disabled: boolean; roomCode: string; onChange: (roomCode: string) => void }) {
  return (
    <>
      <label>
        Room code
        <input
          value={props.roomCode}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => props.onChange(normalizeRoomCode(event.target.value))}
        />
      </label>
      <button type="submit" className="primary" disabled={props.disabled}>
        Join room
      </button>
    </>
  );
}

function LobbyStatusPanel(props: { config: MatchConfig; snapshot?: PublicSnapshot; onStart: () => void }) {
  const snapshot = props.snapshot;
  const canStart = snapshot !== undefined && snapshot.players.length >= snapshot.config.minPlayers;
  const maxPlayers = snapshot?.config.maxPlayers ?? props.config.maxPlayers;

  return (
    <aside className="lobby-status">
      <section className="panel compact lobby-room-card">
        <div className="room-code">
          <span>Room code</span>
          <strong>{snapshot?.code ?? "------"}</strong>
        </div>
        {!snapshot && <p className="lobby-empty-state">Create room first</p>}
        <button type="button" className="primary" onClick={props.onStart} disabled={!canStart}>
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
