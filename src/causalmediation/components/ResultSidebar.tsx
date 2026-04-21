import React from 'react';
import { motion } from 'motion/react';
import { SelectedCell } from '../types';

interface ResultSidebarProps {
  selectedCell: SelectedCell | null;
}

export const ResultSidebar: React.FC<ResultSidebarProps> = ({ selectedCell }) => {
  if (!selectedCell) return null;

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="w-80 space-y-4"
    >
      <div>
        <h3 className="text-lg font-bold text-gray-900">Selected Position</h3>
        <p className="text-sm text-gray-600">
          Token: <span className="font-mono font-semibold">{selectedCell.tokenPosition + 1}</span> | 
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
              transition={{ delay: 0.4 + idx * 0.05 }}
              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm"
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
                    className="h-full bg-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${token.probability * 100}%` }}
                    transition={{ delay: 0.5 + idx * 0.05, duration: 0.4 }}
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
    </motion.div>
  );
};