import React from 'react';
import { useDrag } from 'react-dnd';
import { motion } from 'motion/react';

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
  animationDelay?: number;
  highlightRef?: (ref: HTMLDivElement | null) => void;
  width?: number;
  height?: number;
  fontSize?: number;
  // Context-highlight overlays (mirrors LogitLensGrid): when a cell is the
  // selected position, every earlier-token/earlier-layer cell is "context"
  // and every cell in the same token row is the "generated" trajectory.
  // Cells OUTSIDE the upper-left rectangle get a dim overlay so the context
  // region visually pops.
  inContext?: boolean;
  inGenerated?: boolean;
  isOutsideContext?: boolean;
  highlightColor?: string;
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
  animationDelay = 0,
  highlightRef,
  width = 72,
  height = 48,
  fontSize = 12,
  inContext = false,
  inGenerated = false,
  isOutsideContext = false,
  highlightColor = '#8844ff',
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
  const hl = parseHex(highlightColor);
  const contextFill = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.15)`;
  const generatedRing = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.55)`;

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
          border: isHighlighted
            ? `2px solid ${baseColor}`
            : `1px solid rgba(0,0,0,0.06)`,
          outline: isSelected ? `2px solid #facc15` : 'none',
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
          {predictedToken}
        </span>

        {/* Dim cells outside the upper-left context rectangle so the selected
            cell's "context" region pops. Drawn only when something is selected
            in this grid (isOutsideContext is mutually exclusive with inContext/
            isSelected/inGenerated on the same cell). */}
        {isOutsideContext && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)' }}
          />
        )}
        {/* Subtle positive tint over the in-context region (skipped on the
            selected cell itself, which already shows a yellow outline). */}
        {inContext && !isSelected && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: contextFill }}
          />
        )}
        {inGenerated && !isSelected && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: `inset 0 0 0 2px ${generatedRing}` }}
          />
        )}
      </motion.div>
    </div>
  );
};
