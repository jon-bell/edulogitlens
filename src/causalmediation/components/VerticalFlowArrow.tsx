import React from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

interface VerticalFlowArrowProps {
  color: string;
  opacity?: number;
  isBlended?: boolean;
  blendColor?: string;
}

export const VerticalFlowArrow: React.FC<VerticalFlowArrowProps> = ({
  color,
  opacity = 0.85,
  isBlended = false,
  blendColor,
}) => {
  const arrowColor = isBlended && blendColor ? blendColor : color;

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
      <ChevronDown
        size={14}
        strokeWidth={2.25}
        color={arrowColor}
        style={{ opacity }}
      />
    </motion.div>
  );
};
