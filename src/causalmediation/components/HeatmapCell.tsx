import React from 'react';
import { useDrag } from 'react-dnd';
import { motion } from 'motion/react';

interface HeatmapCellProps {
  tokenPosition: number;
  layer: number;
  predictedToken: string;
  activationStrength: number;
  color: string;
  promptId: string;
  isDraggable?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  isBlended?: boolean;
  blendColor?: string;
  animationDelay?: number;
  highlightRef?: (ref: HTMLDivElement | null) => void;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({
  tokenPosition,
  layer,
  predictedToken,
  activationStrength,
  color,
  promptId,
  isDraggable = false,
  isSelected = false,
  isHighlighted = false,
  onClick,
  isBlended = false,
  blendColor,
  animationDelay = 0,
  highlightRef,
}) => {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'HEATMAP_CELL',
      item: { tokenPosition, layer, promptId, sourceColor: color },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      canDrag: isDraggable,
    }),
    [tokenPosition, layer, promptId, isDraggable, color]
  );

  // Combine drag ref and highlight ref
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (isDraggable) {
        drag(node);
      }
      if (isHighlighted && highlightRef) {
        highlightRef(node);
      }
    },
    [drag, isDraggable, isHighlighted, highlightRef]
  );

  // Border color represents the residual stream
  const borderColor = color;
  const borderWidth = 4;

  // Create a lighter version of the border color for the inner glow
  const getLighterColor = (hexColor: string) => {
    // Simple lighter version by adding transparency
    return `${hexColor}40`; // 25% opacity
  };

  return (
    <div ref={setRefs}>
      <motion.div
        onClick={onClick}
        className={`
          relative rounded-xl overflow-hidden
          ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
          ${isDragging ? 'opacity-40' : ''}
          ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
          ${isHighlighted ? 'ring-4 ring-green-400 ring-offset-2 shadow-lg shadow-green-400/50' : ''}
        `}
        style={{
          width: '90px',
          height: '70px',
          backgroundColor: borderColor,
          padding: `${borderWidth}px`,
          boxShadow: isBlended 
            ? `0 6px 20px -3px ${borderColor}80, 0 0 0 1px ${borderColor}40`
            : `0 3px 12px -2px ${borderColor}60`,
        }}
        initial={isBlended ? { scale: 0.85, opacity: 0, rotateY: -15 } : false}
        animate={isBlended ? { scale: 1, opacity: 1, rotateY: 0 } : {}}
        transition={{
          delay: animationDelay,
          duration: 0.5,
          ease: [0.34, 1.56, 0.64, 1], // Spring easing
        }}
        whileHover={isDraggable ? { 
          scale: 1.08,
          boxShadow: `0 10px 30px -3px ${borderColor}90, 0 0 0 2px ${borderColor}`,
        } : {}}
      >
        {/* Inner glow */}
        <div 
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: `inset 0 0 16px ${getLighterColor(borderColor)}`,
          }}
        />
        
        {/* Inner cyan card with gradient */}
        <div
          className="relative w-full h-full rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white"
        >
          {/* Subtle texture overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />
          
          {/* Token text with shadow for depth */}
          <span 
            className="relative text-xl font-bold text-gray-900 tracking-tight"
            style={{
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            {predictedToken}
          </span>
          
          {/* Probability bar at bottom */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-lg"
            style={{
              width: `${activationStrength * 100}%`,
              backgroundColor: borderColor,
              boxShadow: `0 0 4px ${borderColor}80`,
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};