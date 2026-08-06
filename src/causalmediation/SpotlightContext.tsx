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
  /** Every spotlit cell, across grids. Empty when nothing is spotlit. */
  targets: CellSpotlight[];
  /**
   * First spotlit cell, or null.
   * @deprecated read `targets` — a spotlight can now name several cells.
   */
  target: CellSpotlight | null;
  /** Pass an array to spotlight several cells at once (e.g. both ends of a drag). */
  setTarget: (target: CellSpotlight | CellSpotlight[] | null) => void;
}

// Default is a no-op so the explorer renders normally when no provider is
// mounted (the context is purely additive / opt-in).
const SpotlightContext = createContext<SpotlightContextValue>({
  targets: [],
  target: null,
  setTarget: () => {},
});

/**
 * Wrap the explorer (and whatever sets the spotlight) in this provider to enable
 * the "Show me" highlight. The host calls `useSpotlight().setTarget(...)`; the
 * explorer consumes the same context internally to ring the matching cells.
 *
 * Several cells can be lit at once — a patching tutorial wants to show the cell
 * to drag *from* and the cell to drop *onto* together, since naming the
 * destination in prose is what makes the interaction undiscoverable.
 */
export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<CellSpotlight[]>([]);
  const value = useMemo(
    () => ({
      targets,
      target: targets[0] ?? null,
      setTarget: (next: CellSpotlight | CellSpotlight[] | null) =>
        setTargets(next == null ? [] : Array.isArray(next) ? next : [next]),
    }),
    [targets],
  );
  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>;
}

export function useSpotlight(): SpotlightContextValue {
  return useContext(SpotlightContext);
}
