import React from 'react';
import { Loader2, X } from 'lucide-react';
import { Intervention } from '../types';
import { formatTokenDisplay } from '../utils/formatToken';

interface PatchControlsProps {
  isSinglePromptMode: boolean;
  intervention: Intervention | null;
  sourceToken: string;
  targetToken: string;
  sourceColor: string;
  targetColor: string;
  blendColor: string;
  isPending: boolean;
  hasResult: boolean;
  showPatched: boolean;
  onShowPatchedChange: (show: boolean) => void;
  onDiscard: () => void;
}

/**
 * The toolbar's patch section: a hint on how to make a patch, then the applied
 * patch as a removable pill plus the switch that flips the target heatmap
 * between the patched and original runs.
 *
 * The pill's remove button is hidden while a patch computes: the request in
 * flight would re-apply the patch when it lands. The duration cue is there
 * because a patch is a second forward pass, and without it the wait reads as a
 * hang and the drag gets retried on top of the request already in flight.
 */
export const PatchControls: React.FC<PatchControlsProps> = ({
  isSinglePromptMode,
  intervention,
  sourceToken,
  targetToken,
  sourceColor,
  targetColor,
  blendColor,
  isPending,
  hasResult,
  showPatched,
  onShowPatchedChange,
  onDiscard,
}) => {
  if (isSinglePromptMode) {
    return <span className="text-sm text-gray-500">Add a target prompt to patch</span>;
  }
  if (!intervention) {
    return (
      <span className="text-sm text-gray-500">
        Drag a <strong style={{ color: sourceColor }}>Source</strong> cell onto a{' '}
        <strong style={{ color: targetColor }}>Target</strong> cell to patch
      </span>
    );
  }

  return (
    <div data-testid="patch-controls" className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-0.5 pl-1 pr-1">
        <PatchChip color={sourceColor} token={sourceToken} layer={intervention.sourceLayer} />
        <span style={{ fontSize: 14, color: '#6b7280' }}>&rarr;</span>
        <PatchChip color={targetColor} token={targetToken} layer={intervention.targetLayer} />
        {!isPending && (
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Discard patch"
            title="Discard patch"
            className="inline-flex items-center justify-center rounded-full p-1 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isPending ? (
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm whitespace-nowrap">Patching&hellip;</span>
          <span className="text-xs text-gray-400 whitespace-nowrap">30&ndash;40 s</span>
        </div>
      ) : (
        hasResult && (
          <PatchSwitch checked={showPatched} onChange={onShowPatchedChange} color={blendColor} />
        )
      )}
    </div>
  );
};

const PatchChip: React.FC<{ color: string; token: string; layer: number }> = ({
  color,
  token,
  layer,
}) => (
  <span
    title={`Layer ${layer}`}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 8px',
      borderRadius: '9999px',
      backgroundColor: color,
      color: '#ffffff',
      fontSize: '12px',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}
  >
    {formatTokenDisplay(token)} &middot; L{layer}
  </span>
);

const PatchSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  color: string;
}> = ({ checked, onChange, color }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-2 cursor-pointer select-none"
  >
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 32,
        height: 18,
        borderRadius: 9999,
        backgroundColor: checked ? color : '#d1d5db',
        transition: 'background-color 150ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          transition: 'left 150ms',
        }}
      />
    </span>
    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Show patch</span>
  </button>
);
