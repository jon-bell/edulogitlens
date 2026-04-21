import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface CurvedPatchArrowProps {
  sourceRef: HTMLElement | null;
  targetRef: HTMLElement | null;
  sourceColor: string;
  targetColor: string;
  blendedColor?: string;
}

export const CurvedPatchArrow: React.FC<CurvedPatchArrowProps> = ({
  sourceRef,
  targetRef,
  sourceColor,
  targetColor,
  blendedColor,
}) => {
  const [arrowPath, setArrowPath] = useState<{
    d: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!sourceRef || !targetRef) {
      setArrowPath(null);
      return;
    }

    const updateArrowPath = () => {
      const sourceRect = sourceRef.getBoundingClientRect();
      const targetRect = targetRef.getBoundingClientRect();

      // Get the center points of both elements
      const sourceCenterX = sourceRect.left + sourceRect.width / 2;
      const sourceCenterY = sourceRect.top + sourceRect.height / 2;
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;

      // Calculate the bounding box for the SVG
      const minX = Math.min(sourceCenterX, targetCenterX);
      const minY = Math.min(sourceCenterY, targetCenterY);
      const maxX = Math.max(sourceCenterX, targetCenterX);
      const maxY = Math.max(sourceCenterY, targetCenterY);

      const padding = 50;
      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;

      // Calculate relative coordinates within the SVG
      const startX = sourceCenterX - minX + padding;
      const startY = sourceCenterY - minY + padding;
      const endX = targetCenterX - minX + padding;
      const endY = targetCenterY - minY + padding;

      // Create a curved path
      // Control points for the bezier curve
      const midY = (startY + endY) / 2;
      const curveOffset = Math.abs(endX - startX) * 0.3;
      
      const controlPoint1X = startX + curveOffset;
      const controlPoint1Y = midY - 50;
      const controlPoint2X = endX - curveOffset;
      const controlPoint2Y = midY - 50;

      const d = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;

      setArrowPath({
        d,
        startX: minX - padding,
        startY: minY - padding,
        endX: targetCenterX,
        endY: targetCenterY,
        width,
        height,
      });
    };

    updateArrowPath();

    // Update on scroll or resize
    window.addEventListener('scroll', updateArrowPath, true);
    window.addEventListener('resize', updateArrowPath);

    return () => {
      window.removeEventListener('scroll', updateArrowPath, true);
      window.removeEventListener('resize', updateArrowPath);
    };
  }, [sourceRef, targetRef]);

  if (!arrowPath) return null;

  // Use blended color if provided, otherwise fall back to purple
  const arrowColor = blendedColor || '#9333ea';

  return (
    <div
      style={{
        position: 'fixed',
        left: arrowPath.startX,
        top: arrowPath.startY,
        width: arrowPath.width,
        height: arrowPath.height,
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      <svg
        width={arrowPath.width}
        height={arrowPath.height}
        style={{ 
          overflow: 'hidden',
          clipPath: 'inset(0)',
        }}
      >
        <defs>
          {/* Clip to viewport */}
          <clipPath id="viewportClip">
            <rect 
              x={Math.max(0, -arrowPath.startX)} 
              y={Math.max(0, -arrowPath.startY)} 
              width={window.innerWidth} 
              height={window.innerHeight} 
            />
          </clipPath>

          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill={arrowColor}
            />
          </marker>

          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glow effect */}
        <motion.path
          d={arrowPath.d}
          stroke={arrowColor}
          strokeWidth="6"
          fill="none"
          opacity="0.3"
          filter="url(#glow)"
          clipPath="url(#viewportClip)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />

        {/* Main arrow */}
        <motion.path
          d={arrowPath.d}
          stroke={arrowColor}
          strokeWidth="3"
          fill="none"
          strokeDasharray="8 4"
          markerEnd="url(#arrowhead)"
          clipPath="url(#viewportClip)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
};