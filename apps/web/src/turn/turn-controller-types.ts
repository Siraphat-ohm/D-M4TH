import type { BoardTile, Placement, Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import type { ProtocolClient } from "../client/protocol-client";
import type { TurnMode } from "./turn-controls";

export interface UseTurnControllerParams {
  client: ProtocolClient;
  isMyTurn: boolean;
  actionsFrozen?: boolean;
  rack: Tile[];
  rackSize: number;
  board: BoardTile[];
}

export interface TurnControllerState {
  draft: readonly Placement[];
  selectedTileId?: string;
  pendingFacePlacement?: {
    tile: Tile;
    x: number;
    y: number;
  };
  turnMode: TurnMode;
  previewScore?: number;
  visibleRack: Tile[];
  rackSlots: Array<Tile | undefined>;
  selectedRackTileIds: ReadonlySet<string>;
  swapSelectedTileIds: string[];
  placementDisabled: boolean;
  handleBoardCellClick(x: number, y: number): void;
  handleBoardCellDoubleClick(x: number, y: number): void;
  placeRackTile(tileId: string, x: number, y: number): void;
  placeResolvedRackTile(tile: Tile, x: number, y: number, face?: string): void;
  commitPlay(): void;
  handleSwapAction(): void;
  passTurn(): void;
  recallRack(): void;
  handleRackSelect(tile: Tile): void;
  cancelPendingFace(): void;
  handleMessage(message: ServerMessage): boolean;
  actionsFrozen: boolean;
}
