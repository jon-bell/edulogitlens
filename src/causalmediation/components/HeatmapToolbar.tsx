import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';

const STEP_TOOLTIP =
  'Downsampling stride: show every Nth token/layer so large models fit on screen. Set to 1 to show all; higher values hide rows/columns (marked by the amber bands).';

// A native `title` tooltip on the info icon proved unreliable (no visible
// tooltip, no click response), and this repo has no Radix. This shows a small
// popover on hover/focus and toggles on click, so it works everywhere.
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={text}
        // Open on hover/focus/click, close on leave/blur — no toggle, so a
        // hover-then-click (which is what a mouse does) doesn't cancel itself.
        onClick={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1 w-60 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
};

interface HeatmapToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  tokenStep: number;
  onTokenStepChange: (step: number) => void;
  layerStep: number;
  onLayerStepChange: (step: number) => void;
  summary?: string;
  syncScroll?: boolean;
  onSyncScrollChange?: (value: boolean) => void;
}

export const HeatmapToolbar: React.FC<HeatmapToolbarProps> = ({
  zoom,
  onZoomChange,
  tokenStep,
  onTokenStepChange,
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

        {/* Token Step controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Token Step:</span>
          <input
            type="number"
            min="1"
            max="10"
            value={tokenStep}
            onChange={(e) => onTokenStepChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center text-sm py-1 px-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
          />
          <InfoTooltip text={STEP_TOOLTIP} />
        </div>

        {/* Layer Step controls */}
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
          <InfoTooltip text={STEP_TOOLTIP} />
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