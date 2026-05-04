import { type MatchConfig } from "@d-m4th/config";
import type { Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { BoardCanvas } from "@/board/BoardCanvas";
import { LobbyRoom } from "@/ui/lobby/LobbyRoom";

interface LobbyLayoutProps {
  viewMode: "create" | "join";
  name: string;
  color: string;
  roomCode: string;
  activeConfig: MatchConfig;
  snapshot: PublicSnapshot | undefined;
  localPlayerId?: string;
  onColorChange: (color: string) => void;
  onConfigChange: (config: MatchConfig) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onNameChange: (name: string) => void;
  onRoomCodeChange: (code: string) => void;
  onStartMatch: () => void;
  onViewModeChange: (mode: "create" | "join") => void;
  actionsDisabled: boolean;
}

const EMPTY_RACK: Tile[] = [];
const EMPTY_DRAFT: Placement[] = [];
const NOOP = () => {};

export function LobbyLayout(props: LobbyLayoutProps) {
  const {
    viewMode,
    name,
    color,
    roomCode,
    activeConfig,
    snapshot,
    onColorChange,
    onConfigChange,
    onCreateRoom,
    onJoinRoom,
    onNameChange,
    onRoomCodeChange,
    onStartMatch,
    onViewModeChange,
    actionsDisabled
  } = props;

  const playerName = name.trim();

  return (
    <>
      <LobbyRoom
        color={color}
        config={activeConfig}
        localPlayerId={props.localPlayerId}
        name={name}
        nameRequired={playerName.length === 0}
        roomCode={roomCode}
        snapshot={snapshot?.status === "lobby" ? snapshot : undefined}
        viewMode={viewMode}
        onColorChange={onColorChange}
        onConfigChange={onConfigChange}
        onCreateRoom={onCreateRoom}
        onJoinRoom={onJoinRoom}
        onNameChange={onNameChange}
        onRoomCodeChange={onRoomCodeChange}
        onStartMatch={onStartMatch}
        onViewModeChange={onViewModeChange}
        actionsDisabled={actionsDisabled}
      />

      <section className="setup-preview">
        <BoardCanvas
          previewBoardSize={activeConfig.boardSize}
          previewPremiumMapId={activeConfig.premiumMapId}
          draft={EMPTY_DRAFT}
          rack={EMPTY_RACK}
          placementDisabled
          onCellClick={NOOP}
          onDraftTileDoubleClick={NOOP}
          onTileDrop={NOOP}
          variant="preview"
        />
      </section>
    </>
  );
}
