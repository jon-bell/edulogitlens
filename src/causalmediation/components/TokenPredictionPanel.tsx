import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { SelectedCell } from '../types';

interface TokenPredictionPanelProps {
  selectedCell: SelectedCell | null;
  onClose: () => void;
  // Color of the prompt that owns the selected cell — used to colour the
  // small legend swatches so they match what is drawn on the heatmap.
  highlightColor?: string;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export const TokenPredictionPanel: React.FC<TokenPredictionPanelProps> = ({
  selectedCell,
  onClose,
  highlightColor = '#8844ff',
}) => {
  const [legendOpen, setLegendOpen] = useState(true);
  const hl = parseHex(highlightColor);
  const crosshairRgba = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.35)`;
  const coneRgba = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.18)`;
  return (
    <AnimatePresence>
      {selectedCell && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25 }}
          drag
          dragMomentum={false}
          dragElastic={0}
          // Default position is over the controls/prompt panel on the LEFT —
          // floating over the heatmap covered part of the data the user just
          // clicked. Still draggable: the user can move it anywhere.
          className="fixed left-8 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 z-50"
          style={{ top: '15vh' }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            {/* Header doubles as a visual drag affordance; the whole panel is
                draggable so it can be moved anywhere over the window. */}
            <div className="cursor-move active:cursor-grabbing">
              <h3 className="text-lg font-bold text-gray-900">Selected Position</h3>
              <p className="text-sm text-gray-600">
                Token: <span className="font-mono font-semibold">{selectedCell.tokenPosition}</span> |
                Layer: <span className="font-mono font-semibold">{selectedCell.layer}</span>
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Top {selectedCell.topTokens.length} Tokens
              </h4>
              <div className="space-y-2">
                {selectedCell.topTokens.map((t, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 w-4">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-sm">{t.token}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${t.prob * 100}%` }}
                          transition={{ delay: 0.2 + idx * 0.05, duration: 0.4 }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-600 w-12 text-right">
                        {(t.prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Collapsible legend explaining the on-grid highlights. */}
            <div className="border-t border-gray-200 pt-3">
              <button
                onClick={() => setLegendOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-800"
              >
                {legendOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>About this view</span>
              </button>
              {legendOpen && (
                <div className="mt-2 space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-0.5 shrink-0 w-4 h-3 rounded-sm"
                      style={{ backgroundColor: crosshairRgba }}
                      aria-hidden
                    />
                    <p>
                      <span className="font-semibold text-gray-800">Column</span>: everything this
                      layer predicted at once — a layer produces values at every token position in
                      a single parallel forward pass.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-0.5 shrink-0 w-4 h-3 rounded-sm"
                      style={{ backgroundColor: crosshairRgba }}
                      aria-hidden
                    />
                    <p>
                      <span className="font-semibold text-gray-800">Row</span>: this token&apos;s
                      prediction trajectory through depth — how the model&apos;s top guess at this
                      position evolves layer by layer.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-0.5 shrink-0 w-4 h-3 rounded-sm border border-gray-200"
                      style={{ backgroundColor: coneRgba }}
                      aria-hidden
                    />
                    <p>
                      <span className="font-semibold text-gray-800">Cone</span>: cells whose outputs
                      were actually available to compute this cell — strictly earlier layers, at the
                      same or earlier positions (causal mask).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
