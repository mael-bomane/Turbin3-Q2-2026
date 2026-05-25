"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type CollectionsTab = "collections" | "trending" | "favorites" | "points";

interface CollectionsTabsContextType {
  selected: CollectionsTab;
  setSelected: (tab: CollectionsTab) => void;
}

const CollectionsTabsContext = createContext<CollectionsTabsContextType | undefined>(undefined);

export const CollectionsTabsProvider = ({ children }: { children: ReactNode }) => {
  const [selected, setSelected] = useState<CollectionsTab>("collections");

  return (
    <CollectionsTabsContext.Provider value={{ selected, setSelected }}>
      {children}
    </CollectionsTabsContext.Provider>
  );
};

export const useCollectionsTabs = () => {
  const context = useContext(CollectionsTabsContext);
  if (!context) {
    throw new Error("useCollectionsTabs must be used within CollectionsTabsProvider");
  }
  return context;
};
