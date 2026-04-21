import React, { useState, useRef, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { motion } from 'motion/react';
import { PromptData, SelectedCell } from '../types';
import { HeatmapCell } from './HeatmapCell';
import { FlowArrow } from './FlowArrow';
import { VerticalFlowArrow } from './VerticalFlowArrow';
import { HeatmapToolbar } from './HeatmapToolbar';

interface HeatmapGridProps {
  prompt: PromptData;
  isDropTarget?: boolean;
  onDrop?: (item: any, targetTokenPos: number, targetLayer: number) => void;
  highlightCell?: { tokenPosition: number; layer: number };
  selectedCell?: SelectedCell | null;
  onCellClick?: (tokenPosition: number, layer: number) => void;
  isResult?: boolean;
  blendColor?: string;
  interventionCell?: { tokenPosition: number; layer: number; sourceColor: string };
  onHighlightRefChange?: (ref: HTMLElement | null) => void;
  showSidebar?: boolean;
  sidebarContent?: React.ReactNode;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({
  prompt,
  isDropTarget = false,
  onDrop,
  highlightCell,
  selectedCell,
  onCellClick,
  isResult = false,
  blendColor,
  interventionCell,
  onHighlightRefChange,
  showSidebar = false,
  sidebarContent,
}) => {
  const [layerStart, setLayerStart] = useState(0);
  const [tokenStart, setTokenStart] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [tokenStep, setTokenStep] = useState(1);
  const [layerStep, setLayerStep] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Show all layers and tokens by default
  const visibleLayerCount = Infinity;
  const visibleTokenCount = Infinity;
  
  // Extract layer numbers from LayerState objects and apply stepping
  const allLayerNumbers = prompt.layers.map(l => l.layer);
  
  // Apply layer stepping: take every nth layer based on layerStep
  const steppedLayers = allLayerNumbers.filter((_, idx) => idx % layerStep === 0);
  const displayLayers = steppedLayers.slice(layerStart, layerStart === 0 && visibleLayerCount === Infinity ? undefined : layerStart + visibleLayerCount);
  
  // Apply token stepping: take every nth token based on tokenStep
  const steppedTokens = prompt.heatmapData.filter((_, idx) => idx % tokenStep === 0);
  const displayTokens = steppedTokens.slice(tokenStart, tokenStart === 0 && visibleTokenCount === Infinity ? undefined : tokenStart + visibleTokenCount);

  // Mouse wheel handler for scrolling and zooming
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // If holding Ctrl/Cmd, zoom instead of scroll
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -5 : 5; // Use whole number increments
        setZoom(prev => Math.max(50, Math.min(200, prev + zoomDelta)));
      }
      // Otherwise, let native scrolling handle both directions
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Check if this is the exact intervention cell
  const isInterventionCell = (tokenPos: number, layer: number): boolean => {
    if (!isResult || !interventionCell) return false;
    return tokenPos === interventionCell.tokenPosition && layer === interventionCell.layer;
  };

  // Helper to determine if a cell is affected by intervention (downstream from intervention)
  const isCellAffected = (tokenPosition: number, layer: number): boolean => {
    if (!interventionCell || !isResult) return false;
    const { tokenPosition: intTokenPos, layer: intLayer } = interventionCell;
    // Cell is affected if it's to the right OR below the intervention point (but NOT the intervention itself)
    return (
      (tokenPosition === intTokenPos && layer > intLayer) || // Same token, later layer
      (tokenPosition > intTokenPos && layer >= intLayer)      // Later token, same or later layer
    );
  };

  // Get the color for a specific cell
  const getCellColor = (tokenPosition: number, layer: number): string => {
    if (isInterventionCell(tokenPosition, layer)) {
      // Intervention cell gets source color
      return interventionCell?.sourceColor || prompt.color;
    }
    if (isCellAffected(tokenPosition, layer)) {
      // Affected cells get blended color
      return blendColor || prompt.color;
    }
    // Unaffected cells keep original color
    return prompt.color;
  };

  // Calculate animation delay for cascade effect
  const getAnimationDelay = (tokenPos: number, layer: number): number => {
    if (!interventionCell) return 0;
    
    const layerIdx = displayLayers.indexOf(layer);
    const interventionLayerIdx = displayLayers.indexOf(interventionCell.layer);
    
    const layerDistance = Math.max(0, layerIdx - interventionLayerIdx);
    const tokenDistance = Math.max(0, tokenPos - interventionCell.tokenPosition);
    
    // Delay based on distance from intervention point
    return (layerDistance + tokenDistance) * 0.1;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className={showSidebar ? "flex" : ""}>
        {/* Main Grid Area */}
        <div className={showSidebar ? "flex-1 min-w-0" : ""}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <h3 className="text-lg font-bold">{prompt.name}</h3>
              <p className="text-sm text-gray-600 italic">"{prompt.text}"</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full border-2"
                style={{ backgroundColor: prompt.color, borderColor: prompt.color }}
              />
            </div>
          </div>

          {/* Toolbar */}
          <HeatmapToolbar
            zoom={zoom}
            onZoomChange={setZoom}
            tokenStep={tokenStep}
            onTokenStepChange={setTokenStep}
            layerStep={layerStep}
            onLayerStepChange={setLayerStep}
            visibleTokenCount={displayTokens.length}
            visibleLayerCount={displayLayers.length}
          />

          {/* Grid */}
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto px-6 pb-6" 
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          >
            <div className="inline-block min-w-full pt-4">
              {/* Rows (tokens) */}
              {displayTokens.map((row, displayIdx) => {
                const tokenPos = tokenStart + displayIdx;
                return (
                <div key={tokenPos}>
                  <div className="flex items-center mb-2">
                    {/* Row label (input token) */}
                    <div className="w-20 shrink-0 pr-3 text-right text-lg font-medium text-gray-700">
                      {prompt.inputTokens[tokenPos]}
                    </div>

                    {/* Cells with horizontal arrows */}
                    {displayLayers.map((layer, layerIdx) => {
                      const cell = row.find(c => c.layer === layer);
                      if (!cell) return null;
                      
                      const isSelected = 
                        selectedCell?.promptId === prompt.id &&
                        selectedCell?.tokenPosition === cell.tokenPosition &&
                        selectedCell?.layer === cell.layer;

                      const isHighlight =
                        highlightCell?.tokenPosition === cell.tokenPosition &&
                        highlightCell?.layer === cell.layer;

                      const cellColor = getCellColor(cell.tokenPosition, cell.layer);
                      const isIntervention = isInterventionCell(cell.tokenPosition, cell.layer);
                      const isAffected = isCellAffected(cell.tokenPosition, cell.layer);
                      const animationDelay = getAnimationDelay(cell.tokenPosition, cell.layer);

                      // Horizontal arrow uses the color of the CURRENT cell (where it's coming from)
                      // Don't show arrow if NEXT cell is the intervention point (arrows don't flow INTO intervention)
                      const nextLayer = layerIdx < displayLayers.length - 1 ? displayLayers[layerIdx + 1] : null;
                      const nextIsIntervention = nextLayer ? isInterventionCell(cell.tokenPosition, nextLayer) : false;
                      
                      // If we're AT the intervention cell, arrow going out should be source color (not blended)
                      const horizontalArrowColor = cellColor;
                      const useBlendedHorizontalArrow = isAffected && !isIntervention; // Don't blend if AT intervention
                      
                      return (
                        <div key={`${cell.tokenPosition}-${cell.layer}`} className="flex items-center">
                          {isDropTarget ? (
                            <DropTargetCell
                              cell={cell}
                              color={prompt.color}
                              promptId={prompt.id}
                              onDrop={onDrop}
                              isHighlighted={isHighlight}
                              onCellClick={onCellClick}
                              isBlended={false}
                              blendColor={blendColor}
                              animationDelay={0}
                              onHighlightRefChange={onHighlightRefChange}
                            />
                          ) : (
                            <HeatmapCell
                              tokenPosition={cell.tokenPosition}
                              layer={cell.layer}
                              predictedToken={cell.predictedToken}
                              activationStrength={cell.activationStrength}
                              color={cellColor}
                              promptId={prompt.id}
                              isDraggable={!isDropTarget && !isResult}
                              isSelected={isSelected}
                              isHighlighted={isHighlight}
                              isBlended={isIntervention || isAffected}
                              blendColor={cellColor}
                              onClick={() => onCellClick?.(cell.tokenPosition, cell.layer)}
                              animationDelay={animationDelay}
                              highlightRef={isHighlight ? onHighlightRefChange : undefined}
                            />
                          )}

                          {/* Horizontal flow arrow between cells - REMOVED if next cell is intervention point */}
                          {layerIdx < displayLayers.length - 1 && !nextIsIntervention && (
                            <FlowArrow
                              color={horizontalArrowColor}
                              opacity={0.9}
                              isBlended={useBlendedHorizontalArrow}
                              blendColor={horizontalArrowColor}
                            />
                          )}
                          
                          {/* Spacer where arrow would be if we removed it */}
                          {layerIdx < displayLayers.length - 1 && nextIsIntervention && (
                            <div style={{ width: '36px' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Vertical flow arrows between token rows */}
                  {displayIdx < displayTokens.length - 1 && (
                    <div className="flex items-center">
                      <div className="w-20 shrink-0" />
                      {displayLayers.map((layer, layerIdx) => {
                        const currentCellColor = getCellColor(tokenPos, layer);
                        const nextTokenCellColor = getCellColor(tokenPos + 1, layer);
                        
                        // Don't show arrow if NEXT token position (below) is intervention cell
                        const nextTokenIsIntervention = isInterventionCell(tokenPos + 1, layer);
                        
                        // Check if current cell IS the intervention cell
                        const currentIsIntervention = isInterventionCell(tokenPos, layer);
                        
                        // Arrow uses current cell color when flowing out
                        // If AT intervention cell, don't blend - use source color directly
                        const useBlendedArrow = !nextTokenIsIntervention && !currentIsIntervention && currentCellColor !== prompt.color;
                        
                        return (
                          <div key={`v-arrow-${tokenPos}-${layer}`} className="flex items-center">
                            {!nextTokenIsIntervention ? (
                              <VerticalFlowArrow
                                color={currentCellColor}
                                opacity={0.9}
                                isBlended={useBlendedArrow}
                                blendColor={currentCellColor}
                              />
                            ) : (
                              <div style={{ width: '90px' }} />
                            )}
                            {layerIdx < displayLayers.length - 1 && (
                              <div style={{ width: '36px' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )})}

              {/* Layer indices at bottom */}
              <div className="mt-6">
                <div className="flex items-center">
                  <div className="w-20 shrink-0" />
                  <div className="flex items-center">
                    {displayLayers.map((layer, idx) => (
                      <div key={layer} className="flex items-center">
                        <div className="text-center text-base font-bold text-gray-800" style={{ width: '90px' }}>
                          {layer}
                        </div>
                        {idx < displayLayers.length - 1 && (
                          <div style={{ width: '36px' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Layer label below the numbers */}
                <div className="flex items-center mt-2">
                  <div className="w-20 shrink-0" />
                  <div className="text-center" style={{ width: '90px' }}>
                    <span className="text-sm font-semibold text-gray-600">Layer</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="bg-gray-100 p-4">
            {sidebarContent}
          </div>
        )}
      </div>
    </div>
  );
};

// Drop target wrapper for cells
interface DropTargetCellProps {
  cell: any;
  color: string;
  promptId: string;
  onDrop?: (item: any, targetTokenPos: number, targetLayer: number) => void;
  isHighlighted?: boolean;
  onCellClick?: (tokenPosition: number, layer: number) => void;
  isBlended?: boolean;
  blendColor?: string;
  animationDelay?: number;
  onHighlightRefChange?: (ref: HTMLElement | null) => void;
}

const DropTargetCell: React.FC<DropTargetCellProps> = ({
  cell,
  color,
  promptId,
  onDrop,
  isHighlighted,
  onCellClick,
  isBlended,
  blendColor,
  animationDelay,
  onHighlightRefChange,
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: 'HEATMAP_CELL',
      drop: (item: any) => {
        if (onDrop) {
          onDrop(item, cell.tokenPosition, cell.layer);
        }
        return undefined;
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [cell, onDrop]
  );

  return (
    <div ref={drop}>
      <motion.div
        className={`
          relative
          ${isOver && canDrop ? 'ring-4 ring-green-500 ring-inset z-20' : ''}
          ${canDrop && !isOver ? 'ring-2 ring-blue-400 ring-dashed ring-inset' : ''}
        `}
        animate={isOver && canDrop ? { scale: 1.1 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <HeatmapCell
          tokenPosition={cell.tokenPosition}
          layer={cell.layer}
          predictedToken={cell.predictedToken}
          activationStrength={cell.activationStrength}
          color={color}
          promptId={promptId}
          isDraggable={false}
          isHighlighted={isHighlighted}
          onClick={() => onCellClick?.(cell.tokenPosition, cell.layer)}
          isBlended={isBlended}
          blendColor={blendColor}
          animationDelay={animationDelay}
          highlightRef={isHighlighted ? onHighlightRefChange : undefined}
        />
      </motion.div>
    </div>
  );
};