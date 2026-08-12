import React from 'react';
import { useDrag } from 'react-dnd';
import { motion } from 'motion/react';
import { formatTokenDisplay } from '../utils/formatToken';

interface HeatmapCellProps {
  tokenPosition: number;
  layer: number;
  predictedToken: string;
  probability: number;
  baseColor: string;
  promptId: string;
  isDraggable?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  isIntervention?: boolean;
  // Downstream of the patch: draws a purple border so a near-white
  // low-probability cell is still visibly marked as tainted.
  isTainted?: boolean;
  taintColor?: string;
  animationDelay?: number;
  highlightRef?: (ref: HTMLDivElement | null) => void;
  width?: number;
  height?: number;
  fontSize?: number;
  // When a cell is selected somewhere in this grid, every cell that is NOT
  // in the row, column, or causal cone gets dimmed so the highlighted region
  // pops. The actual row/column/cone tints are painted at GRID level (in
  // HeatmapGrid) so they show through the gutters between cells; cells keep
  // their probability backgrounds intact.
  isOutsideCrosshair?: boolean;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function probabilityToBg(baseColor: string, prob: number): string {
  const { r, g, b } = parseHex(baseColor);
  const p = Math.max(0, Math.min(1, prob));
  const rv = Math.round(255 - (255 - r) * p);
  const gv = Math.round(255 - (255 - g) * p);
  const bv = Math.round(255 - (255 - b) * p);
  return `rgb(${rv}, ${gv}, ${bv})`;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({
  tokenPosition,
  layer,
  predictedToken,
  probability,
  baseColor,
  promptId,
  isDraggable = false,
  isSelected = false,
  isHighlighted = false,
  onClick,
  isIntervention = false,
  isTainted = false,
  taintColor = '#9333ea',
  animationDelay = 0,
  highlightRef,
  width = 72,
  height = 48,
  fontSize = 12,
  isOutsideCrosshair = false,
}) => {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'HEATMAP_CELL',
      item: { tokenPosition, layer, promptId, sourceColor: baseColor },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      canDrag: isDraggable,
    }),
    [tokenPosition, layer, promptId, isDraggable, baseColor],
  );

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (isDraggable) drag(node);
      if (isHighlighted && highlightRef) highlightRef(node);
    },
    [drag, isDraggable, isHighlighted, highlightRef],
  );

  const bg = probabilityToBg(baseColor, probability);
  const textColor = probability < 0.5 ? '#1f2937' : '#ffffff';

  return (
    <div
      ref={setRefs}
      style={{
        width,
        height,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        onClick={onClick}
        className={`
          relative flex items-center justify-center
          ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
          ${isDragging ? 'opacity-40' : ''}
        `}
        style={{
          width,
          height,
          backgroundColor: bg,
          boxSizing: 'border-box',
          border: isTainted
            ? `2px solid ${taintColor}`
            : isHighlighted
              ? `2px solid ${baseColor}`
              : `1px solid rgba(0,0,0,0.06)`,
          // Blue, not yellow: the previous #facc15 was the same hue family as
          // the amber gap bands, so a selected cell was hard to distinguish.
          outline: isSelected ? `2px solid #3b82f6` : 'none',
          outlineOffset: isSelected ? 1 : 0,
        }}
        initial={isIntervention ? { scale: 0.85, opacity: 0 } : false}
        animate={isIntervention ? { scale: 1, opacity: 1 } : {}}
        transition={{
          delay: animationDelay,
          duration: 0.4,
          ease: [0.34, 1.56, 0.64, 1],
        }}
        whileHover={isDraggable ? { scale: 1.05 } : {}}
      >
        <span
          className="font-medium tracking-tight truncate px-1"
          style={{
            fontSize,
            color: textColor,
            maxWidth: width - 4,
          }}
          title={predictedToken}
        >
          {formatTokenDisplay(predictedToken)}
        </span>

        {/* Dim cells outside the row/column/cone so the highlighted region
            pops. The actual region tints are painted at GRID level and
            show through the gutters between cells. */}
        {isOutsideCrosshair && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)' }}
          />
        )}
      </motion.div>
    </div>
  );
};
