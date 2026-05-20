import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronRight } from 'lucide-react';

export interface LogitCell {
  token: string;
  probability: number;
  topTokens: { token: string; prob: number }[];
}

export interface LogitLensData {
  tokens: string[];
  layers: number[];
  data: LogitCell[][];
}

/**
 * Central color theme — change colors here to update the entire component.
 */
const THEME = {
  // Heatmap base color (nnsightful default)
  heatmapBase: { r: 0x88, g: 0x44, b: 0xff, hex: '#8844ff' },
  heatmapBaseHover: '#7733ee',

  // Primary accent (buttons, progress bars, active elements)
  primary: '#8844ff',
  primaryHover: '#7733ee',
  primaryLight: '#bfdbfe',

  // Text
  textDark: '#1e3a8a',
  textBody: '#374151',
  textMuted: '#6b7280',
  textOnDark: '#fff',
  textOnLight: '#333',

  // Rank change indicators
  rankUp: '#16a34a',
  rankDown: '#dc2626',
  rankNew: '#8844ff',

  // Greyed-out cells
  greyedBg: '#9ca3af',
  greyedOpacity: 0.4,

  // UI chrome
  borderLight: '#e5e7eb',
  borderMedium: '#d1d5db',
  disabledBg: '#d1d5db',
  surfaceWhite: '#fff',
  surfacePanel: '#f8faff',
  overlayBg: 'rgba(0, 0, 0, 0.4)',
  modalShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  buttonShadow: (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `0 2px 4px rgba(${r}, ${g}, ${b}, ${opacity})`;
  },

  // Token card in generation view — derived from heatmap base
  tokenCardBg: (prob: number) => `rgba(136, 68, 255, ${0.15 + prob * 0.45})`,
  tokenCardBorder: 'rgba(136, 68, 255, 0.35)',

  // Sidebar probability text
  probText: '#4b5563',
} as const;

export type LogitLensVariant = "default" | "compact";

interface LogitLensGridProps {
  data: LogitLensData;
  variant?: LogitLensVariant;
}

export function LogitLensGrid({ data, variant = "default" }: LogitLensGridProps) {
  const isCompact = variant === "compact";
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [showGeneration, setShowGeneration] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);
  const [tokenStep, setTokenStep] = useState(1);
  const [layerStep, setLayerStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start at zoom=1 and let the grid scroll horizontally if it doesn't fit.
  const computeFitZoom = useCallback(() => {
    return 1;
  }, []);

  // Set initial zoom on mount / when data changes
  useEffect(() => {
    setZoomLevel(computeFitZoom());
  }, [computeFitZoom]);

  // If zoom hasn't been computed yet, render nothing until we can measure
  const effectiveZoom = zoomLevel ?? 1;

  const handleCellClick = (row: number, col: number) => {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      setSelectedCell(null);
      setShowGeneration(false);
    } else {
      setSelectedCell({ row, col });
      setShowGeneration(false);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min((prev ?? 1) + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max((prev ?? 1) - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(computeFitZoom());
    setTokenStep(1);
    setLayerStep(1);
  };

  const handleTokenStepChange = (value: number) => {
    setTokenStep(value);
    setSelectedCell(null); // Clear selection when step changes
  };

  const handleLayerStepChange = (value: number) => {
    setLayerStep(value);
    setSelectedCell(null); // Clear selection when step changes
  };

  // Filter data based on step sizes, always including the last element
  const filteredTokenIndices = data.tokens
    .map((_, idx) => idx)
    .filter((idx) => idx % tokenStep === 0 || idx === data.tokens.length - 1);
  const filteredTokens = filteredTokenIndices.map(idx => data.tokens[idx]);
  
  const filteredLayerIndices = data.layers
    .map((_, idx) => idx)
    .filter((idx) => idx % layerStep === 0 || idx === data.layers.length - 1);
  const filteredLayers = filteredLayerIndices.map(idx => data.layers[idx]);
  
  const filteredData = filteredTokenIndices.map(tokenIdx => 
    filteredLayerIndices.map(layerIdx => data.data[tokenIdx][layerIdx])
  );

  // Validate selected cell is within bounds
  const isValidSelection = selectedCell && 
    selectedCell.row < filteredTokens.length && 
    selectedCell.col < filteredLayers.length &&
    selectedCell.row >= 0 &&
    selectedCell.col >= 0;

  const baseCellSize = isCompact ? 48 : 64;
  const cellSize = baseCellSize * effectiveZoom;
  const labelColWidth = Math.max(80, 80 * effectiveZoom);
  const headerRowHeight = isCompact ? 22 : 28;
  const cellFontSize = isCompact
    ? Math.max(10, 10 * effectiveZoom)
    : Math.max(12, 12 * effectiveZoom);

  const getBackgroundColor = (prob: number) => {
    const { r, g, b } = THEME.heatmapBase;
    const rv = Math.round(255 - (255 - r) * prob);
    const gv = Math.round(255 - (255 - g) * prob);
    const bv = Math.round(255 - (255 - b) * prob);
    return `rgb(${rv},${gv},${bv})`;
  };

  const isInHighlightRect = (row: number, col: number, targetRow: number, targetCol: number) => {
    return row <= targetRow && col <= targetCol;
  };

  const shouldShowRedBox = (row: number, col: number) => {
    if (!hoveredCell || selectedCell) return false;
    return isInHighlightRect(row, col, hoveredCell.row, hoveredCell.col);
  };

  const shouldShowSelectedBox = (row: number, col: number) => {
    if (!selectedCell) return false;
    return isInHighlightRect(row, col, selectedCell.row, selectedCell.col);
  };

  const shouldBeGreyed = () => {
    return selectedCell !== null;
  };

  const getTextColor = (prob: number) => {
    return prob < 0.5 ? THEME.textOnLight : THEME.textOnDark;
  };

  const getCellStyle = (row: number, col: number, prob: number) => {
    const isGreyed = shouldBeGreyed() && !(selectedCell && isInHighlightRect(row, col, selectedCell.row, selectedCell.col));

    if (isGreyed) {
      return {
        backgroundColor: THEME.greyedBg,
        opacity: THEME.greyedOpacity,
      };
    }

    if (shouldShowRedBox(row, col)) {
      // Blend cell color with red tint for hover highlight
      const { r: br, g: bg, b: bb } = THEME.heatmapBase;
      const r = Math.round(255 - (255 - br) * prob);
      const g = Math.round(255 - (255 - bg) * prob);
      const b = Math.round(255 - (255 - bb) * prob);
      // Mix 30% red into the cell color
      const tr = Math.min(255, Math.round(r * 0.7 + 255 * 0.3));
      const tg = Math.round(g * 0.7);
      const tb = Math.round(b * 0.7);
      return {
        backgroundColor: `rgb(${tr},${tg},${tb})`,
      };
    }

    return {
      backgroundColor: getBackgroundColor(prob),
    };
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden', position: 'relative' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb', flexShrink: 0, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Zoom:</span>
            <button onClick={handleZoomOut} style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: 'none', cursor: 'pointer' }} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, minWidth: '3rem', textAlign: 'center' }}>{Math.round(effectiveZoom * 100)}%</span>
            <button onClick={handleZoomIn} style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: 'none', cursor: 'pointer' }} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <button onClick={handleResetZoom} style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: 'none', cursor: 'pointer' }} title="Reset">
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Token step control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <label htmlFor="token-step" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
              Token Step:
            </label>
            <input
              id="token-step"
              type="number"
              min="1"
              max="10"
              value={tokenStep}
              onChange={(e) => handleTokenStepChange(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem' }}
            />
          </div>

          {/* Layer step control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <label htmlFor="layer-step" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
              Layer Step:
            </label>
            <input
              id="layer-step"
              type="number"
              min="1"
              max="10"
              value={layerStep}
              onChange={(e) => handleLayerStepChange(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.25rem', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        <div style={{ fontSize: '0.875rem', color: '#4b5563', flexShrink: 0, whiteSpace: 'nowrap' }}>
          Showing {filteredTokens.length} tokens × {filteredLayers.length} layers
        </div>
      </div>

      {/* Main content area with heatmap box and side panel */}
      <div style={{ flex: '1 1 0px', display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Heatmap box — scrolls independently, never affects siblings */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: '16rem', overflow: 'auto', padding: '1.5rem', scrollBehavior: 'smooth', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          {/* Horizontal color scale legend — above the heatmap */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: THEME.textBody }}>Probability</span>
            <span style={{ fontSize: 10, color: THEME.textMuted }}>0.0</span>
            <div
              style={{
                width: 150,
                height: 12,
                background: `linear-gradient(to right, rgb(255,255,255) 0%, ${THEME.heatmapBase.hex} 100%)`,
                borderRadius: 2,
                border: `1px solid ${THEME.borderLight}`,
              }}
            />
            <span style={{ fontSize: 10, color: THEME.textMuted }}>1.0</span>
          </div>

          <div style={{ display: 'inline-block', position: 'relative' }}>
            {/* Y-axis "Input Tokens" label - separate from grid */}
            <div className="absolute text-sm font-medium whitespace-nowrap" style={{ left: -16, top: '50%', transform: 'translateX(-50%) translateY(-50%) rotate(-90deg)' }}>
              Input Tokens
            </div>

            {/* Layout: axes separate from heatmap so cells align exactly; margin from widget.css */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* X-axis "Layer" label - centered above cells */}
              <div
                className="text-center text-sm font-medium mb-1"
                style={{
                  marginLeft: labelColWidth + 12,
                  width: filteredLayers.length * cellSize,
                }}
              >
                Layer
              </div>

              {/* X-axis: layer numbers row only (same column widths as heatmap) */}
              <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 8 }}>
                <div style={{ width: labelColWidth, flexShrink: 0 }} />
                <div style={{ display: 'flex' }}>
                  {filteredLayers.map((layer) => (
                    <div
                      key={layer}
                      style={{
                        width: cellSize,
                        height: headerRowHeight,
                        fontSize: Math.max(10, 10 * effectiveZoom),
                        textAlign: 'center',
                        flexShrink: 0,
                        fontWeight: 500,
                      }}
                    >
                      {layer}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main row: token labels column + heatmap grid only */}
              <div style={{ display: 'flex' }}>
                {/* Y-axis: token labels column only (same row heights as heatmap) */}
                <div
                  style={{
                    width: labelColWidth,
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    paddingRight: 12,
                    textAlign: 'right',
                    fontSize: cellFontSize,
                    fontWeight: 500,
                  }}
                >
                  {filteredTokens.map((token, displayRowIdx) => {
                    const actualRowIdx = filteredTokenIndices[displayRowIdx];
                    return (
                      <div
                        key={actualRowIdx}
                        style={{
                          height: cellSize,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={token}
                      >
                        {token}
                      </div>
                    );
                  })}
                </div>

                {/* Heatmap: cells only, no axes */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${filteredLayers.length}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${filteredTokens.length}, ${cellSize}px)`,
                  }}
                >
                  {filteredTokens.map((_, displayRowIdx) =>
                    filteredLayers.map((_, displayColIdx) => {
                      const actualColIdx = filteredLayerIndices[displayColIdx];
                      const cellData = filteredData[displayRowIdx][displayColIdx];
                      const hasRedBox = shouldShowRedBox(displayRowIdx, displayColIdx);
                      const hasSelectedBox = shouldShowSelectedBox(displayRowIdx, displayColIdx);
                      const isSelected = selectedCell?.row === displayRowIdx && selectedCell?.col === displayColIdx;

                      return (
                        <div
                          key={`${displayRowIdx}-${actualColIdx}`}
                          className="logitlens-heatmap-cell relative cursor-pointer transition-all"
                          style={{
                            width: cellSize,
                            height: cellSize,
                            ...getCellStyle(displayRowIdx, displayColIdx, cellData.probability),
                          }}
                          onMouseEnter={() => setHoveredCell({ row: displayRowIdx, col: displayColIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => handleCellClick(displayRowIdx, displayColIdx)}
                        >
                          <div
                            className="logitlens-heatmap-cell-token absolute inset-0 flex items-center justify-center font-medium"
                            style={{ fontSize: cellFontSize, color: getTextColor(cellData.probability) }}
                          >
                            {cellData.token}
                          </div>
                          {isCompact && displayColIdx < filteredLayers.length - 1 && (
                            <ChevronRight
                              size={Math.max(10, 10 * effectiveZoom)}
                              className="logitlens-heatmap-cell-chevron pointer-events-none"
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                color: getTextColor(cellData.probability),
                                opacity: 0.55,
                              }}
                            />
                          )}
                          {hasRedBox && (
                            <div
                              className="logitlens-heatmap-overlay logitlens-heatmap-overlay-red absolute inset-0 border-red-500 pointer-events-none"
                              style={{ borderWidth: Math.max(2, 2 * effectiveZoom) }}
                            />
                          )}
                          {hasSelectedBox && (
                            <div
                              className="logitlens-heatmap-overlay logitlens-heatmap-overlay-blue absolute inset-0 border-blue-400 pointer-events-none"
                              style={{ borderWidth: Math.max(2, 2 * effectiveZoom) }}
                            />
                          )}
                          {isSelected && (
                            <div
                              className="logitlens-heatmap-overlay logitlens-heatmap-overlay-yellow absolute inset-0 border-yellow-400 pointer-events-none"
                              style={{ borderWidth: Math.max(4, 4 * effectiveZoom) }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* X-axis: layer numbers row below heatmap (mirrors top row) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 8 }}>
                <div style={{ width: labelColWidth, flexShrink: 0 }} />
                <div style={{ display: 'flex' }}>
                  {filteredLayers.map((layer) => (
                    <div
                      key={`bottom-${layer}`}
                      style={{
                        width: cellSize,
                        height: headerRowHeight,
                        fontSize: Math.max(10, 10 * effectiveZoom),
                        textAlign: 'center',
                        flexShrink: 0,
                        fontWeight: 500,
                      }}
                    >
                      {layer}
                    </div>
                  ))}
                </div>
              </div>

              {/* X-axis "Layer" label - centered under cells */}
              <div
                className="text-center text-sm font-medium mt-1"
                style={{
                  marginLeft: labelColWidth + 12,
                  width: filteredLayers.length * cellSize,
                }}
              >
                Layer
              </div>
            </div>


          </div>
        </div>

        {/* Side panel for selection - always visible, updates on hover */}
        <div className="bg-white border-l border-gray-200 flex flex-col overflow-hidden" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '16rem', padding: '1rem' }}>
          {(selectedCell || hoveredCell) ? (
            <>
              <div className="mb-4 flex-shrink-0">
                <h3 className="font-semibold text-lg">
                  {selectedCell ? 'Selected Position' : 'Hovered Position'}
                </h3>
                <p className="text-sm text-gray-600 truncate" title={`Token: ${selectedCell ? filteredTokens[selectedCell.row] : filteredTokens[hoveredCell!.row]} | Layer: ${selectedCell ? filteredLayers[selectedCell.col] : filteredLayers[hoveredCell!.col]}`}>
                  Token: {selectedCell ? filteredTokens[selectedCell.row] : filteredTokens[hoveredCell!.row]} | Layer: {selectedCell ? filteredLayers[selectedCell.col] : filteredLayers[hoveredCell!.col]}
                </p>
              </div>

              <div className="mb-4 flex-1 min-h-0 flex flex-col">
                <h4 className="font-medium mb-2 flex-shrink-0">Top 15 Tokens</h4>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {(selectedCell
                    ? filteredData[selectedCell.row][selectedCell.col].topTokens
                    : filteredData[hoveredCell!.row][hoveredCell!.col].topTokens
                  ).slice(0, 15).map((item, idx) => (
                    <div
                      key={idx}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: 14, padding: '4px 8px' }}
                      className="hover:bg-gray-50 rounded"
                    >
                      <span className="font-mono truncate" style={{ minWidth: 0, flex: 1 }} title={item.token}>{item.token}</span>
                      <span style={{ color: THEME.probText, flexShrink: 0 }}>{(item.prob * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCell && (<div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowGeneration(true)}
                  className="w-full py-2.5 px-4 rounded-lg font-medium flex-shrink-0 transition-all cursor-pointer"
                  style={{
                    backgroundColor: THEME.primary,
                    color: THEME.textOnDark,
                    border: `2px solid ${THEME.primaryHover}`,
                    boxShadow: THEME.buttonShadow(THEME.primary, 0.3),
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = THEME.primaryHover;
                    e.currentTarget.style.boxShadow = THEME.buttonShadow(THEME.primary, 0.4);
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = THEME.primary;
                    e.currentTarget.style.boxShadow = THEME.buttonShadow(THEME.primary, 0.3);
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  View Token Generation
                </button>
                <button
                  onClick={() => { setSelectedCell(null); setShowGeneration(false); }}
                  className="w-full py-2 px-4 rounded-lg font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor: THEME.surfaceWhite,
                    color: THEME.textMuted,
                    border: `1px solid ${THEME.borderMedium}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = THEME.textBody;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = THEME.surfaceWhite;
                    e.currentTarget.style.color = THEME.textMuted;
                  }}
                >
                  Clear Selection
                </button>
              </div>)}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-center">Hover over a cell to see<br />top token predictions</p>
            </div>
          )}
        </div>

      </div>

      {/* Token Generation overlay - covers entire component */}
      <AnimatePresence>
        {(() => {
          // #region agent log
          if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7244/ingest/fc915240-872e-4c1a-aef6-bf81d338a109',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LogitLensGrid.tsx:gen-panel',message:'Generation panel visibility',data:{showGeneration,isValidSelection:!!isValidSelection,selectedCell:selectedCell??null,filteredLayerAtCol:selectedCell!=null?filteredLayerIndices[selectedCell.col]:null,filteredTokenAtRow:selectedCell!=null?filteredTokenIndices[selectedCell.row]:null},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{}); }
          // #endregion
          return showGeneration && isValidSelection && selectedCell;
        })() && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="logitlens-generation-panel"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              backgroundColor: THEME.overlayBg,
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => setShowGeneration(false)}
          >
            <div
              className="logitlens-generation-panel-inner"
              style={{
                backgroundColor: THEME.surfacePanel,
                maxWidth: '720px',
                width: '90%',
                maxHeight: '90%',
                overflow: 'hidden',
                boxShadow: THEME.modalShadow,
                borderRadius: '1rem',
                border: `2px solid ${THEME.primaryLight}`,
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column' as const,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: THEME.textDark }}>Token Generation Process</h2>
                  <p style={{ color: THEME.textBody, marginTop: '0.125rem', fontSize: '0.8rem' }}>
                    Watch how token predictions evolve through each layer
                  </p>
                </div>
                <button
                  onClick={() => setShowGeneration(false)}
                  style={{ color: THEME.textMuted, cursor: 'pointer', background: 'none', border: 'none' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: THEME.textMuted, marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span><span style={{ color: THEME.rankUp }}>&#9650;</span> moved up from previous layer</span>
                <span><span style={{ color: THEME.rankDown }}>&#9660;</span> moved down from previous layer</span>
                <span><span style={{ color: THEME.rankNew }}>NEW</span> not in previous layer's top 15</span>
              </div>

              <AnimatedTokenList
                data={data}
                selectedCell={selectedCell!}
                filteredTokenIndices={filteredTokenIndices}
                filteredLayerIndices={filteredLayerIndices}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnimatedTokenListProps {
  data: LogitLensData;
  selectedCell: { row: number; col: number };
  filteredTokenIndices: number[];
  filteredLayerIndices: number[];
}

/**
 * Compute rank-change labels for each token at `layerIdx` by comparing
 * against the previous layer's top-k list.
 *
 * Returns an array (one entry per token in the current layer's top-k) of:
 *   { isNew: boolean, rankChange: number | null }
 *
 * - Layer 0 has no previous layer → all entries have isNew=false, rankChange=null
 * - A token not present in the previous layer's top-k → isNew=true
 * - rankChange > 0 means the token moved UP (e.g. was #5, now #2 → +3)
 * - rankChange < 0 means the token moved DOWN
 * - rankChange === 0 means unchanged
 */
function computeRankLabels(
  data: LogitLensData,
  tokenRowIdx: number,
  layerIdx: number,
  topK: number = 15,
): { isNew: boolean; rankChange: number | null }[] {
  const currentTopTokens = [...(data.data[tokenRowIdx]?.[layerIdx]?.topTokens ?? [])].sort((a, b) => b.prob - a.prob).slice(0, topK);

  if (layerIdx === 0) {
    return currentTopTokens.map(() => ({ isNew: false, rankChange: null }));
  }

  const prevTopTokens = [...(data.data[tokenRowIdx]?.[layerIdx - 1]?.topTokens ?? [])].sort((a, b) => b.prob - a.prob).slice(0, topK);
  const prevRanks = new Map<string, number>();
  prevTopTokens.forEach((t, i) => {
    if (!prevRanks.has(t.token)) prevRanks.set(t.token, i);
  });

  return currentTopTokens.map((t, idx) => {
    const prevRank = prevRanks.get(t.token);
    if (prevRank === undefined) {
      return { isNew: true, rankChange: null };
    }
    return { isNew: false, rankChange: prevRank - idx };
  });
}

function AnimatedTokenList({ data, selectedCell, filteredTokenIndices, filteredLayerIndices }: AnimatedTokenListProps) {
  const [currentLayerIdx, setCurrentLayerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const maxLayerIdx = data.layers.length > 0 ? data.layers[data.layers.length - 1] : 0;
  const tokenRowIdx = filteredTokenIndices[selectedCell.row];
  const cellData = data.data[tokenRowIdx]?.[currentLayerIdx];
  const currentTokens = [...(cellData?.topTokens ?? [])].sort((a, b) => b.prob - a.prob).slice(0, 15);
  const rankLabels = computeRankLabels(data, tokenRowIdx, currentLayerIdx, 15);

  // Auto-play through layers
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentLayerIdx < maxLayerIdx) {
      interval = setInterval(() => {
        setCurrentLayerIdx(prev => {
          if (prev >= maxLayerIdx) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentLayerIdx, maxLayerIdx]);

  const handlePlayPause = () => {
    if (currentLayerIdx >= maxLayerIdx) {
      setCurrentLayerIdx(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setCurrentLayerIdx(0);
    setIsPlaying(false);
  };

  const handleNext = () => {
    setCurrentLayerIdx(prev => Math.min(prev + 1, maxLayerIdx));
    setIsPlaying(false);
  };

  const handlePrev = () => {
    setCurrentLayerIdx(prev => Math.max(prev - 1, 0));
    setIsPlaying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      {/* Layer indicator */}
      <div style={{ marginBottom: '0.5rem', textAlign: 'center', width: '100%' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: THEME.textDark, marginBottom: '0.25rem' }}>Layer {currentLayerIdx}/{maxLayerIdx}</h3>
        <div style={{ width: '100%', maxWidth: '20rem', height: '0.375rem', backgroundColor: THEME.primaryLight, borderRadius: '9999px', overflow: 'hidden', margin: '0 auto' }}>
          <motion.div
            style={{ height: '100%', backgroundColor: THEME.primary }}
            initial={{ width: 0 }}
            animate={{ width: `${(currentLayerIdx / maxLayerIdx) * 100}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
          />
        </div>
      </div>

      {/* Animated token list */}
      <div style={{ width: '100%', maxWidth: '36rem', marginBottom: '1rem', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div className="logitlens-generation-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
          <AnimatePresence mode="popLayout">
            {currentTokens.map((item, idx) => {
              const { isNew, rankChange } = rankLabels[idx] ?? { isNew: false, rankChange: null };
              return (
                <motion.div
                  key={`${idx}-${item.token}`}
                  layout
                  initial={isNew ? { opacity: 0, y: 50, scale: 0.95 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    layout: { type: "spring", damping: 30, stiffness: 60 },
                    opacity: { duration: 0.3 },
                    y: { type: "spring", damping: 30, stiffness: 60 },
                    scale: { duration: 0.2 }
                  }}
                  className="logitlens-token-card"
                  style={{
                    backgroundColor: THEME.tokenCardBg(item.prob),
                    borderRadius: '0.375rem',
                    padding: '0.25rem 0.75rem',
                    border: `1px solid ${THEME.tokenCardBorder}`,
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <motion.span
                        key={`rank-${idx}`}
                        layout
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: THEME.textDark, width: '1.75rem' }}
                      >
                        #{idx + 1}
                      </motion.span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500, color: THEME.textDark }}>
                        {item.token}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '0.25rem' }}>
                        {isNew ? (
                          <span style={{ color: THEME.rankNew }}>NEW</span>
                        ) : rankChange !== null && rankChange > 0 ? (
                          <span style={{ color: THEME.rankUp }}>&#9650;{rankChange}</span>
                        ) : rankChange !== null && rankChange < 0 ? (
                          <span style={{ color: THEME.rankDown }}>&#9660;{Math.abs(rankChange)}</span>
                        ) : null}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: THEME.textDark, flexShrink: 0 }}>
                      {(item.prob * 100).toFixed(1)}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, paddingTop: '0.5rem' }}>
        <button
          onClick={handleReset}
          style={{ backgroundColor: THEME.textMuted, color: THEME.textOnDark, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 500, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
        >
          Reset
        </button>
        <button
          onClick={handlePrev}
          disabled={currentLayerIdx === 0}
          style={{ backgroundColor: currentLayerIdx === 0 ? THEME.disabledBg : THEME.primary, color: THEME.textOnDark, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 500, fontSize: '0.8rem', border: 'none', cursor: currentLayerIdx === 0 ? 'not-allowed' : 'pointer' }}
        >
          Previous
        </button>
        <button
          onClick={handlePlayPause}
          style={{ backgroundColor: THEME.primary, color: THEME.textOnDark, padding: '0.4rem 1.25rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
        >
          {isPlaying ? 'Pause' : currentLayerIdx >= maxLayerIdx ? 'Replay' : 'Play'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentLayerIdx >= maxLayerIdx}
          style={{ backgroundColor: currentLayerIdx >= maxLayerIdx ? THEME.disabledBg : THEME.primary, color: THEME.textOnDark, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 500, fontSize: '0.8rem', border: 'none', cursor: currentLayerIdx >= maxLayerIdx ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

interface GenerationViewProps {
  data: LogitLensData;
  selectedCell: { row: number; col: number };
  filteredTokenIndices: number[];
  filteredLayerIndices: number[];
}

function GenerationView({ data, selectedCell, filteredTokenIndices, filteredLayerIndices }: GenerationViewProps) {
  const [currentLayerIdx, setCurrentLayerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const maxLayerIdx = filteredLayerIndices[selectedCell.col];
  const tokenRowIdx = filteredTokenIndices[selectedCell.row];
  
  // Get current layer's top tokens
  const currentTokens = data.data[tokenRowIdx][currentLayerIdx].topTokens.slice(0, 15);

  // Auto-play through layers
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentLayerIdx < maxLayerIdx) {
      interval = setInterval(() => {
        setCurrentLayerIdx(prev => {
          if (prev >= maxLayerIdx) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500); // 2.5 seconds per layer
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentLayerIdx, maxLayerIdx]);

  const handlePlayPause = () => {
    if (currentLayerIdx >= maxLayerIdx) {
      setCurrentLayerIdx(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setCurrentLayerIdx(0);
    setIsPlaying(false);
  };

  const handleNext = () => {
    setCurrentLayerIdx(prev => Math.min(prev + 1, maxLayerIdx));
    setIsPlaying(false);
  };

  const handlePrev = () => {
    setCurrentLayerIdx(prev => Math.max(prev - 1, 0));
    setIsPlaying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      {/* Layer indicator */}
      <div style={{ marginBottom: '0.5rem', textAlign: 'center', width: '100%' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: THEME.textDark, marginBottom: '0.25rem' }}>Layer {currentLayerIdx}/{maxLayerIdx}</h3>
        <div style={{ width: '100%', maxWidth: '20rem', height: '0.375rem', backgroundColor: THEME.primaryLight, borderRadius: '9999px', overflow: 'hidden', margin: '0 auto' }}>
          <motion.div
            style={{ height: '100%', backgroundColor: THEME.primary }}
            initial={{ width: 0 }}
            animate={{ width: `${(currentLayerIdx / maxLayerIdx) * 100}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
          />
        </div>
      </div>

      {/* Animated token list */}
      <div style={{ width: '100%', maxWidth: '36rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {currentTokens.map((item, idx) => (
            <motion.div
              key={`${idx}-${item.token}`}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{
                layout: { type: "spring", damping: 30, stiffness: 60 },
                opacity: { duration: 0.4 }
              }}
              style={{
                backgroundColor: THEME.tokenCardBg(item.prob),
                borderRadius: '0.375rem',
                padding: '0.25rem 0.75rem',
                border: `1px solid ${THEME.tokenCardBorder}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: THEME.textDark, width: '1.75rem' }}>#{idx + 1}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500, color: THEME.textDark }}>{item.token}</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: THEME.textDark }}>
                  {(item.prob * 100).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={handleReset}
          style={{ backgroundColor: THEME.textMuted, color: THEME.textOnDark, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 500, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
        >
          Reset
        </button>
        <button
          onClick={handlePrev}
          disabled={currentLayerIdx === 0}
          style={{ backgroundColor: currentLayerIdx === 0 ? THEME.disabledBg : THEME.primary, color: THEME.textOnDark, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 500, fontSize: '0.8rem', border: 'none', cursor: currentLayerIdx === 0 ? 'not-allowed' : 'pointer' }}
        >
          Previous
        </button>
        <button
          onClick={handlePlayPause}
          style={{ backgroundColor: THEME.primary, color: THEME.textOnDark, padding: '0.4rem 1.25rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
        >
          {isPlaying ? 'Pause' : currentLayerIdx >= maxLayerIdx ? 'Replay' : 'Play'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentLayerIdx >= maxLayerIdx}
          style={{ backgroundColor: currentLayerIdx >= maxLayerIdx ? THEME.disabledBg : THEME.primary, color: THEME.textOnDark, padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontWeight: 500, fontSize: '0.8rem', border: 'none', cursor: currentLayerIdx >= maxLayerIdx ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}