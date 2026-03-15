import { createContext, useContext, useState, type ReactNode } from 'react';

interface SpaceContextType {
  activeSpaceId: string | null;
  setActiveSpaceId: (id: string | null) => void;
}

const SpaceContext = createContext<SpaceContextType | null>(null);

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  return (
    <SpaceContext.Provider value={{ activeSpaceId, setActiveSpaceId }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpaceContext() {
  const context = useContext(SpaceContext);
  if (!context) throw new Error('useSpaceContext must be used within SpaceProvider');
  return context;
}
