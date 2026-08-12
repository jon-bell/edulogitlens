import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';

const LAYER_STEP_TOOLTIP =
  'Layer stride: show every Nth layer so wide models fit on screen. Set to 1 to show all layers; higher values hide columns (marked by the amber bands).';

// A native `title` tooltip on the info icon proved unreliable (no visible
// tooltip, no click response), and this repo has no Radix. The popover is
// rendered in a portal with fixed positioning so it escapes the toolbar's
// `overflow-hidden` wrapper and the sibling heatmap grid's stacking context
// (otherwise it renders clipped / behind the heatmaps).
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
  };
  const hide = () => setPos(null);

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        aria-label={text}
        // Open on hover/focus/click, close on leave/blur — no toggle, so a
        // hover-then-click (what a mouse does) doesn't cancel itself.
        onClick={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Info size={14} />
      </button>
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-50%)',
              zIndex: 9999,
              maxWidth: 240,
            }}
            className="rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
};

interface HeatmapToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  layerStep: number;
  onLayerStepChange: (step: number) => void;
  summary?: string;
  syncScroll?: boolean;
  onSyncScrollChange?: (value: boolean) => void;
}

export const HeatmapToolbar: React.FC<HeatmapToolbarProps> = ({
  zoom,
  onZoomChange,
  layerStep,
  onLayerStepChange,
  summary,
  syncScroll,
  onSyncScrollChange,
}) => {
  const handleZoomIn = () => {
    onZoomChange(Math.min(200, zoom + 10));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(50, zoom - 10));
  };

  const handleZoomReset = () => {
    onZoomChange(100);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
      {/* Left side: Zoom and Step controls */}
      <div className="flex items-center gap-6">
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Zoom:</span>
          <button
            onClick={handleZoomOut}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} className="text-gray-600" />
          </button>
          <div className="min-w-[50px] text-center text-sm font-medium text-gray-700">
            {zoom}%
          </div>
          <button
            onClick={handleZoomIn}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} className="text-gray-600" />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Layer Step controls (token rows are always shown, so there is no
            token-step control — only layers get downsampled for wide models). */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Layer Step:</span>
          <input
            type="number"
            min="1"
            max="10"
            value={layerStep}
            onChange={(e) => onLayerStepChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center text-sm py-1 px-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
          />
          <InfoTooltip text={LAYER_STEP_TOOLTIP} />
        </div>

        {/* Sync scroll toggle */}
        {onSyncScrollChange && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!syncScroll}
              onChange={(e) => onSyncScrollChange(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">Sync scroll</span>
          </label>
        )}
      </div>

      {/* Right side: Info display */}
      {summary && (
        <div className="text-sm text-gray-600">{summary}</div>
      )}
    </div>
  );
};