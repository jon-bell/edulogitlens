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
    // Clip rects in SVG-local coords (i.e., relative to startX/startY).
    // We render one <rect> per plot so the SVG clipPath composes as their
    // union — anything outside both plots is hidden, which is what stops the
    // arrow from extending past the heatmap when the user scrolls.
    clipRects: { x: number; y: number; width: number; height: number }[];
  } | null>(null);

  useEffect(() => {
    if (!sourceRef || !targetRef) {
      setArrowPath(null);
      return;
    }

    // Walk up to the nearest scrollable ancestor — that's the heatmap's
    // overflow:auto container, whose viewport rect is what we want to clip to.
    const getScrollableAncestor = (el: HTMLElement): HTMLElement | null => {
      let node: HTMLElement | null = el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflow = style.overflow + style.overflowX + style.overflowY;
        if (/(auto|scroll|hidden)/.test(overflow)) return node;
        node = node.parentElement;
      }
      return null;
    };

    const updateArrowPath = () => {
      const sourceRect = sourceRef.getBoundingClientRect();
      const targetRect = targetRef.getBoundingClientRect();
      const sourcePlot = getScrollableAncestor(sourceRef);
      const targetPlot = getScrollableAncestor(targetRef);

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

      // Compute clip rects in SVG-local coords. The wrapper div is fixed at
      // (minX - padding, minY - padding); SVG-local origin is the same point.
      const wrapperLeft = minX - padding;
      const wrapperTop = minY - padding;
      const toLocalRect = (r: DOMRect) => ({
        x: r.left - wrapperLeft,
        y: r.top - wrapperTop,
        width: r.width,
        height: r.height,
      });
      const fallback = {
        x: -wrapperLeft,
        y: -wrapperTop,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const clipRects: { x: number; y: number; width: number; height: number }[] = [];
      const sourcePlotRect = sourcePlot?.getBoundingClientRect();
      const targetPlotRect = targetPlot?.getBoundingClientRect();
      if (sourcePlotRect) clipRects.push(toLocalRect(sourcePlotRect));
      if (targetPlotRect) clipRects.push(toLocalRect(targetPlotRect));

      // Bridge rect over the gutter between the two plots, so the arrow stays
      // visible as it crosses the blank space. Side-by-side plots get a
      // horizontal bridge (vertical extent = overlap of the two plots);
      // stacked plots get a vertical bridge. If the plots overlap on both
      // axes, no bridge is needed.
      if (sourcePlotRect && targetPlotRect) {
        const a = sourcePlotRect;
        const b = targetPlotRect;
        const horizGapLeft = Math.min(a.right, b.right);
        const horizGapRight = Math.max(a.left, b.left);
        const vertGapTop = Math.min(a.bottom, b.bottom);
        const vertGapBottom = Math.max(a.top, b.top);

        if (horizGapLeft < horizGapRight) {
          const top = Math.max(a.top, b.top);
          const bottom = Math.min(a.bottom, b.bottom);
          if (top < bottom) {
            clipRects.push(
              toLocalRect(
                new DOMRect(horizGapLeft, top, horizGapRight - horizGapLeft, bottom - top),
              ),
            );
          }
        } else if (vertGapTop < vertGapBottom) {
          const left = Math.max(a.left, b.left);
          const right = Math.min(a.right, b.right);
          if (left < right) {
            clipRects.push(
              toLocalRect(
                new DOMRect(left, vertGapTop, right - left, vertGapBottom - vertGapTop),
              ),
            );
          }
        }
      }

      if (clipRects.length === 0) clipRects.push(fallback);

      setArrowPath({
        d,
        startX: wrapperLeft,
        startY: wrapperTop,
        endX: targetCenterX,
        endY: targetCenterY,
        width,
        height,
        clipRects,
      });
    };

    updateArrowPath();

    // Update on scroll (capture so inner-plot scrolls fire too) or resize.
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
          {/* Clip to the union of the two heatmap scroll containers so the
              arrow can't extend past either plot when the user scrolls. */}
          <clipPath id="plotClip">
            {arrowPath.clipRects.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
              />
            ))}
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
          clipPath="url(#plotClip)"
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
          clipPath="url(#plotClip)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
};