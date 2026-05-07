import React from 'react';
import { motion } from 'motion/react';
import svgPaths from '../imports/svg-g21dxpwmvs';

interface VerticalFlowArrowProps {
  color: string;
  opacity?: number;
  isBlended?: boolean;
  blendColor?: string;
}

export const VerticalFlowArrow: React.FC<VerticalFlowArrowProps> = ({
  color,
  opacity = 0.6,
  isBlended = false,
  blendColor,
}) => {
  const arrowColor = isBlended && blendColor ? blendColor : color;
  const gradientId = `v-arrow-gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Fixed glyph dimensions matching FlowArrow: 20 x 16 pre-rotation.
  // After the 90deg rotation the arrow occupies 16 wide x 20 tall on screen.
  const SVG_WIDTH = 20;
  const SVG_HEIGHT = 16;

  return (
    <motion.div
      className="flex items-center justify-center"
      initial={isBlended ? { scale: 0, opacity: 0, y: -10 } : false}
      animate={isBlended ? { scale: 1, opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.4,
        ease: [0.34, 1.56, 0.64, 1],
      }}
    >
      <div style={{ transform: 'rotate(90deg)', display: 'flex' }}>
        <svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox="0 0 89 73.6396"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          style={{
            filter: `drop-shadow(0 1px 2px ${arrowColor}20)`,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={arrowColor} stopOpacity={opacity * 0.7} />
              <stop offset="100%" stopColor={arrowColor} stopOpacity={opacity} />
            </linearGradient>
          </defs>
          <path
            d={svgPaths.p19d90780}
            fill={`url(#${gradientId})`}
          />
        </svg>
      </div>
    </motion.div>
  );
};
