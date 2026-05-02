import { createContext, useContext, type ReactNode } from "react";
import type { useTurnController } from "./use-turn-controller";

type TurnContextType = ReturnType<typeof useTurnController>;

const TurnContext = createContext<TurnContextType | null>(null);

export function TurnProvider({ turn, children }: { turn: TurnContextType; children: ReactNode }) {
  return <TurnContext.Provider value={turn}>{children}</TurnContext.Provider>;
}

export function useTurn() {
  const context = useContext(TurnContext);
  if (!context) {
    throw new Error("useTurn must be used within a TurnProvider");
  }
  return context;
}
