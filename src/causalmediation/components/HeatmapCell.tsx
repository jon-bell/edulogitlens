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
  // Crosshair highlight when a cell is selected: the column it sits in is
  // "everything this layer produced in one parallel forward pass," and the
  // row it sits in is "this token's prediction trajectory through depth."
  // The causal cone (strictly earlier layers, equal-or-earlier positions)
  // is the set of cells whose outputs were actually available to compute
  // the selected cell — rendered as a subtle tint underlay. Cells outside
  // the crosshair AND the cone get dimmed.
  inColumn?: boolean;
  inRow?: boolean;
  inCone?: boolean;
  isOutsideCrosshair?: boolean;
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
  inColumn = false,
  inRow = false,
  inCone = false,
  isOutsideCrosshair = false,
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
  // Background-tint overlays for the three highlight regions. Cells that fall
  // in more than one region stack the overlays naturally — e.g. a cell in
  // BOTH the cone and the column reads darker than a cone-only cell.
  const coneFill = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.18)`;
  const crosshairFill = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.35)`;

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

        {/* Dim cells that are neither in the crosshair nor in the causal
            cone, so the selected cell's column, row, and input-dependency
            rectangle all visually pop. Mutually exclusive with inColumn /
            inRow / inCone / isSelected on the same cell. */}
        {isOutsideCrosshair && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)' }}
          />
        )}
        {/* Causal cone underlay: cells whose outputs actually fed into the
            selected cell (strictly earlier layers, equal-or-earlier positions
            under the causal mask). Drawn before the crosshair rings so they
            sit on top of it cleanly. */}
        {inCone && !isSelected && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: coneFill }}
          />
        )}
        {/* Crosshair arms as background tints (stacked, so cells in both arms
            read strongest). Column = this layer's parallel output across
            positions; row = this token's depth trajectory. Not drawn on the
            selected cell itself — it already carries the yellow outline. */}
        {inColumn && !isSelected && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: crosshairFill }}
          />
        )}
        {inRow && !isSelected && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: crosshairFill }}
          />
        )}
      </motion.div>
    </div>
  );
};
