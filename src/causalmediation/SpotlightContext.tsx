import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * A cell the host app can spotlight inside the explorer — used by guided
 * tutorials to point at the exact cell to patch from ("Show me"). `'last'`
 * resolves at render time to the final layer / last token position, so callers
 * don't hard-code a model's layer count.
 */
export type CellSpotlight = {
  grid: 'source' | 'target' | 'result';
  layer: number | 'last';
  position: number | 'last';
};

interface SpotlightContextValue {
  target: CellSpotlight | null;
  setTarget: (target: CellSpotlight | null) => void;
}

// Default is a no-op so the explorer renders normally when no provider is
// mounted (the context is purely additive / opt-in).
const SpotlightContext = createContext<SpotlightContextValue>({
  target: null,
  setTarget: () => {},
});

/**
 * Wrap the explorer (and whatever sets the spotlight) in this provider to enable
 * the "Show me" highlight. The host calls `useSpotlight().setTarget(...)`; the
 * explorer consumes the same context internally to ring the matching cell.
 */
export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<CellSpotlight | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>;
}

export function useSpotlight(): SpotlightContextValue {
  return useContext(SpotlightContext);
}
