import React from 'react';
import { motion } from 'motion/react';
import svgPaths from '../imports/svg-g21dxpwmvs';

interface FlowArrowProps {
  color: string;
  opacity?: number;
  isBlended?: boolean;
  blendColor?: string;
}

export const FlowArrow: React.FC<FlowArrowProps> = ({
  color,
  opacity = 0.8,
  isBlended = false,
  blendColor,
}) => {
  const arrowColor = isBlended && blendColor ? blendColor : color;
  const gradientId = `arrow-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <motion.div
      className="flex items-center justify-center"
      style={{ width: '36px', height: '32px' }}
      initial={isBlended ? { scale: 0, opacity: 0, x: -10 } : false}
      animate={isBlended ? { scale: 1, opacity: 1, x: 0 } : {}}
      transition={{ 
        duration: 0.4,
        ease: [0.34, 1.56, 0.64, 1],
      }}
    >
      <svg
        width="20"
        height="16"
        viewBox="0 0 88 73.6396"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
          d={svgPaths.p262c0ef0} 
          fill={`url(#${gradientId})`}
        />
      </svg>
    </motion.div>
  );
};