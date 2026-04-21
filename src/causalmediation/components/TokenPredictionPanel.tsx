import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { SelectedCell } from '../types';

interface TokenPredictionPanelProps {
  selectedCell: SelectedCell | null;
  onClose: () => void;
}

export const TokenPredictionPanel: React.FC<TokenPredictionPanelProps> = ({
  selectedCell,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {selectedCell && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          className="fixed right-8 top-1/2 -translate-y-1/2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 z-50"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-4">
            <div>
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
                {selectedCell.topTokens.map((token, idx) => (
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
                      <span className="font-semibold text-sm">{token.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${token.probability * 100}%` }}
                          transition={{ delay: 0.2 + idx * 0.05, duration: 0.4 }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-600 w-12 text-right">
                        {(token.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
