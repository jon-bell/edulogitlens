import React from 'react';
import { motion } from 'motion/react';
import { SelectedCell } from '../types';
import { formatTokenDisplay } from '../utils/formatToken';
import {
  ROW_FINAL_COLOR,
  GRID_FINAL_COLOR,
  ROW_FINAL_LABEL,
  GRID_FINAL_LABEL,
} from '../utils/finalMarkers';

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
      className="w-full min-w-0 space-y-4"
    >
      <div>
        <h3 className="text-lg font-bold text-gray-900">Selected Position</h3>
        <p className="text-sm text-gray-600">
          {/* Raw 0-based position, matching TokenPredictionPanel. */}
          Token: <span className="font-mono font-semibold">{selectedCell.tokenPosition}</span> |
          Layer: <span className="font-mono font-semibold">{selectedCell.layer}</span>
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Top {selectedCell.topTokens.length} Tokens
        </h4>
        <div className="space-y-2">
          {selectedCell.topTokens.map((t, idx) => {
            // Labeled borders: mark the row that is this position's
            // final-layer prediction and/or the model's final output.
            const isRowFinal =
              !!selectedCell.rowFinalToken && t.token === selectedCell.rowFinalToken;
            const isGridFinal =
              !!selectedCell.gridFinalToken && t.token === selectedCell.gridFinalToken;
            return (
              <motion.div
                key={idx}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + idx * 0.05 }}
                className="bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm"
                style={
                  isRowFinal || isGridFinal
                    ? {
                        border: `2px solid ${isRowFinal ? ROW_FINAL_COLOR : GRID_FINAL_COLOR}`,
                        ...(isRowFinal && isGridFinal
                          ? {
                              outline: `2px solid ${GRID_FINAL_COLOR}`,
                              outlineOffset: 1,
                            }
                          : {}),
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 w-4">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-sm" title={t.token}>
                      {formatTokenDisplay(t.token)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-purple-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${t.prob * 100}%` }}
                        transition={{ delay: 0.5 + idx * 0.05, duration: 0.4 }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-600 w-12 text-right">
                      {(t.prob * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {(isRowFinal || isGridFinal) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {isRowFinal && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: 1,
                          color: '#ffffff',
                          backgroundColor: ROW_FINAL_COLOR,
                          borderRadius: 9999,
                          padding: '2px 6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ROW_FINAL_LABEL}
                      </span>
                    )}
                    {isGridFinal && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: 1,
                          color: '#ffffff',
                          backgroundColor: GRID_FINAL_COLOR,
                          borderRadius: 9999,
                          padding: '2px 6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {GRID_FINAL_LABEL}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};