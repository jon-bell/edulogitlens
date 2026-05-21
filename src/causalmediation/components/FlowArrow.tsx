import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

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
      <ChevronRight
        size={22}
        strokeWidth={2.25}
        color={arrowColor}
        style={{ opacity }}
      />
    </motion.div>
  );
};
