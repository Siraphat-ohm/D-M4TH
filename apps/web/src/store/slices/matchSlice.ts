import type { StateCreator } from "zustand";
import type { BoardTile, PublicSnapshot } from "@d-m4th/game";
import type { PrivateState } from "../app-store";

export interface MatchSlice {
  snapshot?: PublicSnapshot;
  privateState?: PrivateState;
  ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }>;
  setSnapshot: (snapshot?: PublicSnapshot) => void;
  setPrivateState: (privateState?: PrivateState) => void;
  setGhostPlacements: (ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }>) => void;
}

export const createMatchSlice: StateCreator<MatchSlice, [], [], MatchSlice> = (set) => ({
  snapshot: undefined,
  privateState: undefined,
  ghostPlacements: [],
  setSnapshot: (snapshot) => set({ snapshot }),
  setPrivateState: (privateState) => set({ privateState }),
  setGhostPlacements: (ghostPlacements) => set({ ghostPlacements }),
});
