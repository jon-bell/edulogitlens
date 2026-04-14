import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

interface LogitLensGridProps {
  data: LogitLensData;
}

export function LogitLensGrid({ data }: LogitLensGridProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [showGeneration, setShowGeneration] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [tokenStep, setTokenStep] = useState(1);
  const [layerStep, setLayerStep] = useState(1);

  const handleCellClick = (row: number, col: number) => {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      setSelectedCell(null);
      setShowGeneration(false);
    } else {
      setSelectedCell({ row, col });
      setShowGeneration(false);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
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

  const cellSize = 64 * zoomLevel;
  const labelColWidth = Math.max(80, 80 * zoomLevel);
  const headerRowHeight = 28;

  const getBackgroundColor = (prob: number) => {
    const opacity = prob;
    return `rgba(30, 64, 175, ${opacity})`;
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

  const getCellStyle = (row: number, col: number, prob: number) => {
    const isGreyed = shouldBeGreyed() && !(selectedCell && isInHighlightRect(row, col, selectedCell.row, selectedCell.col));
    
    if (isGreyed) {
      return {
        backgroundColor: '#9ca3af',
        opacity: 0.4,
      };
    }
    
    return {
      backgroundColor: getBackgroundColor(prob),
    };
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Zoom:</span>
            <button
              onClick={handleZoomOut}
              className="p-2 rounded hover:bg-gray-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-sm font-medium min-w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded hover:bg-gray-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 rounded hover:bg-gray-200 transition-colors"
              title="Reset"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Token step control */}
          <div className="flex items-center gap-2">
            <label htmlFor="token-step" className="text-sm font-medium text-gray-700">
              Token Step:
            </label>
            <input
              id="token-step"
              type="number"
              min="1"
              max="10"
              value={tokenStep}
              onChange={(e) => handleTokenStepChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Layer step control */}
          <div className="flex items-center gap-2">
            <label htmlFor="layer-step" className="text-sm font-medium text-gray-700">
              Layer Step:
            </label>
            <input
              id="layer-step"
              type="number"
              min="1"
              max="10"
              value={layerStep}
              onChange={(e) => handleLayerStepChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {filteredTokens.length} tokens × {filteredLayers.length} layers
        </div>
      </div>

      {/* Main content area with grid and side panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Grid with smooth scrolling */}
        <div className="flex-1 overflow-auto p-6 min-h-0" style={{ scrollBehavior: 'smooth' }}>
          <div className="relative inline-block min-w-full">
            {/* Y-axis "Tokens" label - separate from grid */}
            <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium whitespace-nowrap">
              Tokens
            </div>

            {/* Layout: axes separate from heatmap so cells align exactly; margin from widget.css */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                        fontSize: Math.max(10, 10 * zoomLevel),
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
                    fontSize: Math.max(12, 12 * zoomLevel),
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
                            className="logitlens-heatmap-cell-token absolute inset-0 flex items-center justify-center font-medium text-white"
                            style={{ fontSize: Math.max(12, 12 * zoomLevel) }}
                          >
                            {cellData.token}
                          </div>
                          {hasRedBox && (
                            <div
                              className="logitlens-heatmap-overlay logitlens-heatmap-overlay-red absolute inset-0 border-red-500 pointer-events-none"
                              style={{ borderWidth: Math.max(2, 2 * zoomLevel) }}
                            />
                          )}
                          {hasSelectedBox && (
                            <div
                              className="logitlens-heatmap-overlay logitlens-heatmap-overlay-blue absolute inset-0 border-blue-400 pointer-events-none"
                              style={{ borderWidth: Math.max(2, 2 * zoomLevel) }}
                            />
                          )}
                          {isSelected && (
                            <div
                              className="logitlens-heatmap-overlay logitlens-heatmap-overlay-yellow absolute inset-0 border-yellow-400 pointer-events-none"
                              style={{ borderWidth: Math.max(4, 4 * zoomLevel) }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* X-axis "Layer" label - separate row below heatmap, centered under cells */}
              <div
                className="text-center text-sm font-medium mt-3"
                style={{
                  marginLeft: labelColWidth + 12,
                  width: filteredLayers.length * cellSize,
                }}
              >
                Layer
              </div>
            </div>

            {/* Token Generation View Below Grid */}
            <AnimatePresence>
              {(() => {
                // #region agent log
                if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7244/ingest/fc915240-872e-4c1a-aef6-bf81d338a109',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LogitLensGrid.tsx:gen-panel',message:'Generation panel visibility',data:{showGeneration,isValidSelection:!!isValidSelection,selectedCell:selectedCell??null,filteredLayerAtCol:selectedCell!=null?filteredLayerIndices[selectedCell.col]:null,filteredTokenAtRow:selectedCell!=null?filteredTokenIndices[selectedCell.row]:null},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{}); }
                // #endregion
                return showGeneration && isValidSelection && selectedCell;
              })() && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="logitlens-generation-panel mt-8 overflow-hidden"
                >
                  <div className="logitlens-generation-panel-inner bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-blue-900">Token Generation Process</h2>
                        <p className="text-gray-700 mt-1">
                          Watch how token predictions evolve through each layer
                        </p>
                      </div>
                      <button
                        onClick={() => setShowGeneration(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X size={24} />
                      </button>
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
        </div>

        {/* Color scale legend - separate column so it never overlaps the heatmap */}
        <div
          style={{
            flexShrink: 0,
            width: 56,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 16,
            paddingRight: 8,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            }}
          >
            probability
          </div>
          <div
            style={{
              height: 256,
              width: 24,
              background: 'linear-gradient(to top, rgba(30, 64, 175, 0) 0%, rgba(30, 64, 175, 1) 100%)',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', right: -28, top: 0, fontSize: 12 }}>1.00</div>
            <div style={{ position: 'absolute', right: -28, bottom: 0, fontSize: 12 }}>0.00</div>
          </div>
        </div>

        {/* Side panel for selection - always visible, updates on hover */}
        <div className="w-96 flex-shrink-0 bg-white border-l border-gray-200 p-6 flex flex-col">
          {(selectedCell || hoveredCell) ? (
            <>
              <div className="mb-4 flex-shrink-0">
                <h3 className="font-semibold text-lg">
                  {selectedCell ? 'Selected Position' : 'Hovered Position'}
                </h3>
                <p className="text-sm text-gray-600">
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
                      style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: 14, padding: '4px 8px' }}
                      className="hover:bg-gray-50 rounded"
                    >
                      <span className="font-mono">{item.token}</span>
                      <span style={{ color: '#4b5563', marginLeft: 'auto' }}>{(item.prob * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCell && (
                <button
                  onClick={() => setShowGeneration(true)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex-shrink-0"
                >
                  View Token Generation
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-center">Hover over a cell to see<br />top token predictions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AnimatedTokenListProps {
  data: LogitLensData;
  selectedCell: { row: number; col: number };
  filteredTokenIndices: number[];
  filteredLayerIndices: number[];
}

function AnimatedTokenList({ data, selectedCell, filteredTokenIndices, filteredLayerIndices }: AnimatedTokenListProps) {
  const [currentLayerIdx, setCurrentLayerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prevTokens, setPrevTokens] = useState<Set<string>>(new Set());
  
  // Use full layer range so progress shows "0 / N" for all layers (matches screenshot), not just up to selected column
  const maxLayerIdx = data.layers.length > 0 ? data.layers[data.layers.length - 1] : 0;
  const tokenRowIdx = filteredTokenIndices[selectedCell.row];
  const cellData = data.data[tokenRowIdx]?.[currentLayerIdx];
  const currentTokens = cellData?.topTokens?.slice(0, 15) ?? [];
  // #region agent log
  if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7244/ingest/fc915240-872e-4c1a-aef6-bf81d338a109',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LogitLensGrid.tsx:AnimatedTokenList',message:'AnimatedTokenList render',data:{currentLayerIdx,maxLayerIdx,tokenRowIdx,selectedCell,col:selectedCell.col,row:selectedCell.row,currentTokensLength:currentTokens.length,hasCellData:!!cellData,progressDenom:maxLayerIdx},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{}); }
  // #endregion
  
  // Update previous tokens when layer changes
  useEffect(() => {
    setPrevTokens(new Set(currentTokens.map(t => t.token)));
  }, [currentLayerIdx]);

  // Auto-play through layers
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentLayerIdx < maxLayerIdx) {
      interval = setInterval(() => {
        setCurrentLayerIdx(prev => {
          const next = prev >= maxLayerIdx ? prev : prev + 1;
          // #region agent log
          if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7244/ingest/fc915240-872e-4c1a-aef6-bf81d338a109',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LogitLensGrid.tsx:interval',message:'Layer step tick',data:{prev,next,maxLayerIdx},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{}); }
          // #endregion
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
    // #region agent log
    if (typeof fetch !== 'undefined') { fetch('http://127.0.0.1:7244/ingest/fc915240-872e-4c1a-aef6-bf81d338a109',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'LogitLensGrid.tsx:handlePlayPause',message:'Play/Pause clicked',data:{currentLayerIdx,maxLayerIdx,willReplay:currentLayerIdx>=maxLayerIdx},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{}); }
    // #endregion
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
    <div className="flex flex-col items-center">
      {/* Layer indicator */}
      <div className="mb-6 text-center">
        <h3 className="text-4xl font-bold text-blue-900 mb-2">Layer {currentLayerIdx}</h3>
        <div className="w-full max-w-md h-2 bg-blue-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${(currentLayerIdx / maxLayerIdx) * 100}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {currentLayerIdx} / {maxLayerIdx}
        </p>
      </div>

      {/* Animated token list - card shape matches buttons (class + inline for widget bundle without Tailwind) */}
      <div className="w-full max-w-2xl mb-6">
        <div className="logitlens-generation-cards flex flex-col items-center gap-4 relative">
          <AnimatePresence mode="popLayout">
            {currentTokens.map((item, idx) => {
              const isNew = !prevTokens.has(item.token);
              return (
                <motion.div
                  key={item.token}
                  layout
                  initial={isNew ? { opacity: 0, y: 100, scale: 0.8 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    layout: { type: "spring", damping: 30, stiffness: 60 },
                    opacity: { duration: 0.4 },
                    y: { type: "spring", damping: 30, stiffness: 60 },
                    scale: { duration: 0.3 }
                  }}
                  className="logitlens-token-card rounded-lg border-2 border-blue-300 px-6 py-3 shadow-md w-full"
                  style={{
                    backgroundColor: `rgba(147, 197, 253, ${0.2 + item.prob * 0.6})`,
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1.5rem",
                    border: "2px solid rgb(147 197 253)",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    width: "100%",
                    minWidth: "20rem",
                  }}
                >
                  <div className="flex justify-between items-center gap-6">
                    <div className="flex items-center gap-6 shrink-0">
                      <motion.span
                        key={`rank-${idx}`}
                        layout
                        className="text-lg font-bold text-blue-900"
                      >
                        #{idx + 1}
                      </motion.span>
                      <span className="font-mono text-base font-medium text-blue-900">
                        {item.token}
                      </span>
                    </div>
                    <span className="text-base font-bold text-blue-900 shrink-0 text-right">
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
      <div className="flex items-center gap-4">
        <button
          onClick={handleReset}
          className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Reset
        </button>
        <button
          onClick={handlePrev}
          disabled={currentLayerIdx === 0}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={handlePlayPause}
          className="bg-blue-600 text-white py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg"
        >
          {isPlaying ? 'Pause' : currentLayerIdx >= maxLayerIdx ? 'Replay' : 'Play'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentLayerIdx >= maxLayerIdx}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
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
    <div className="flex flex-col items-center">
      {/* Layer indicator */}
      <div className="mb-6 text-center">
        <h3 className="text-4xl font-bold text-blue-900 mb-2">Layer {currentLayerIdx}</h3>
        <div className="w-full max-w-md h-2 bg-blue-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${(currentLayerIdx / maxLayerIdx) * 100}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {currentLayerIdx} / {maxLayerIdx}
        </p>
      </div>

      {/* Animated token list */}
      <div className="w-full max-w-2xl mb-6">
        <div className="space-y-2">
          {currentTokens.map((item, idx) => (
            <motion.div
              key={item.token}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{
                layout: { type: "spring", damping: 30, stiffness: 60 },
                opacity: { duration: 0.4 }
              }}
              className="bg-white rounded-lg px-6 py-4 shadow-md border-2 border-blue-300"
              style={{
                backgroundColor: `rgba(59, 130, 246, ${0.1 + item.prob * 0.3})`,
              }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-blue-900 w-8">#{idx + 1}</span>
                  <span className="font-mono text-xl font-medium">{item.token}</span>
                </div>
                <span className="text-lg font-bold text-blue-900">
                  {(item.prob * 100).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleReset}
          className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Reset
        </button>
        <button
          onClick={handlePrev}
          disabled={currentLayerIdx === 0}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={handlePlayPause}
          className="bg-blue-600 text-white py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg"
        >
          {isPlaying ? 'Pause' : currentLayerIdx >= maxLayerIdx ? 'Replay' : 'Play'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentLayerIdx >= maxLayerIdx}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}