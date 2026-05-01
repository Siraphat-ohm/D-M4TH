import { type MatchConfig } from "@d-m4th/config";
import type { Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { BoardCanvas } from "./BoardCanvas";
import { LobbyRoom } from "./LobbyRoom";

interface LobbyLayoutProps {
  viewMode: "create" | "join";
  name: string;
  color: string;
  roomCode: string;
  activeConfig: MatchConfig;
  snapshot: PublicSnapshot | undefined;
  onColorChange: (color: string) => void;
  onConfigChange: (config: MatchConfig) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onNameChange: (name: string) => void;
  onRoomCodeChange: (code: string) => void;
  onStartMatch: () => void;
  onViewModeChange: (mode: "create" | "join") => void;
}

const EMPTY_RACK: Tile[] = [];
const EMPTY_DRAFT: Placement[] = [];

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
    onViewModeChange
  } = props;

  const playerName = name.trim();

  return (
    <>
      <LobbyRoom
        color={color}
        config={activeConfig}
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
      />

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
    </>
  );
}
