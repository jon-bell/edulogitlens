import React from 'react';
import { useDrop } from 'react-dnd';
import { motion } from 'motion/react';
import { PromptInput, SelectedCell } from '../types';
import { HeatmapCell } from './HeatmapCell';
import { FlowArrow } from './FlowArrow';
import { VerticalFlowArrow } from './VerticalFlowArrow';

const BASE_CELL_WIDTH = 72;
const BASE_CELL_HEIGHT = 48;
// Tighter than the original arrow gutters (28 / 16): keep a little negative
// space between cells for the chevron, but pack the grid noticeably denser.
const BASE_HORIZ_ARROW_WIDTH = 12;
const BASE_VERT_ARROW_HEIGHT = 6;
const BASE_TOKEN_COL_WIDTH = 80;
const BASE_LABEL_FONT = 14;
const BASE_CELL_FONT = 12;

interface HeatmapGridProps {
  prompt: PromptInput;
  zoom: number;
  tokenStep: number;
  layerStep: number;
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
  // Synced scrolling: when scrollState is provided the grid follows it
  // (controlled); the grid also reports its own scroll via onScroll.
  onScroll?: (state: { scrollLeft: number; scrollTop: number }) => void;
  scrollState?: { scrollLeft: number; scrollTop: number } | null;
  // When false, cells in this grid cannot be dragged (useful when single-prompt
  // mode hides the target and there is nothing to drop on).
  isSourceDraggable?: boolean;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({
  prompt,
  zoom,
  tokenStep,
  layerStep,
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
  onScroll,
  scrollState,
  isSourceDraggable = true,
}) => {
  const scale = zoom / 100;
  const cellWidth = BASE_CELL_WIDTH * scale;
  const cellHeight = BASE_CELL_HEIGHT * scale;
  const horizArrowWidth = BASE_HORIZ_ARROW_WIDTH * scale;
  const vertArrowHeight = BASE_VERT_ARROW_HEIGHT * scale;
  const tokenColWidth = BASE_TOKEN_COL_WIDTH * scale;
  const labelFontSize = Math.max(10, BASE_LABEL_FONT * scale);
  const cellFontSize = Math.max(9, BASE_CELL_FONT * scale);
  const axisTitleFontSize = Math.max(11, labelFontSize * 0.9);

  const [scrolledX, setScrolledX] = React.useState(false);
  const [scrolledY, setScrolledY] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // Suppress re-emitting onScroll when we apply a controlled scrollState.
  const ignoreNextScrollRef = React.useRef(false);
  const isScrollControlled = scrollState !== undefined && scrollState !== null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    setScrolledY(scrollTop > 0);
    setScrolledX(scrollLeft > 0);
    if (ignoreNextScrollRef.current) {
      ignoreNextScrollRef.current = false;
      return;
    }
    onScroll?.({ scrollLeft, scrollTop });
  };

  React.useEffect(() => {
    if (!isScrollControlled || !scrollState) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft === scrollState.scrollLeft && el.scrollTop === scrollState.scrollTop)
      return;
    ignoreNextScrollRef.current = true;
    el.scrollLeft = scrollState.scrollLeft;
    el.scrollTop = scrollState.scrollTop;
  }, [isScrollControlled, scrollState?.scrollLeft, scrollState?.scrollTop, scrollState]);

  const scrolledBg = 'rgba(255,255,255,0.9)';
  // Solid neutral color for the continuous left-axis bar behind token labels.
  const leftBarColor = '#f9fafb';

  const stickyTopShadow: React.CSSProperties = {
    borderBottom: '1px solid #d1d5db',
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
    ...(scrolledY ? { backgroundColor: scrolledBg } : {}),
  };
  // Sticky-left elements that sit ON the continuous left bar. They all share
  // the same solid bar bg color, and a box-shadow below paints the row-gap
  // area so the bar reads as one continuous vertical sweep rather than N
  // stacked boxes. The original drop-shadow (2px 0 4px ...) is preserved as
  // a second shadow layer. When the grid is scrolled horizontally, the rgba
  // overlay replaces the base color so existing scroll-dim behavior works.
  const leftBarFill = scrolledX ? scrolledBg : leftBarColor;
  const stickyLeftShadow: React.CSSProperties = {
    borderRight: '1px solid #d1d5db',
    // Downward solid-color shadow (10px) fills vertical row-gaps so the bar
    // is unbroken; followed by the usual 2px 0 4px drop-shadow on the right.
    boxShadow: `0 10px 0 0 ${leftBarFill}, 2px 0 4px rgba(0,0,0,0.06)`,
    backgroundColor: leftBarFill,
  };
  // The corner cell's downward shadow should match the bar below it (which
  // only dims on horizontal scroll), so the below-color tracks leftBarFill
  // (scrolledX), while its own background dims on either axis scroll.
  const stickyCornerShadow: React.CSSProperties = {
    borderBottom: '1px solid #d1d5db',
    borderRight: '1px solid #d1d5db',
    boxShadow: `0 10px 0 0 ${leftBarFill}, 2px 2px 4px rgba(0,0,0,0.06)`,
    backgroundColor: scrolledX || scrolledY ? scrolledBg : leftBarColor,
  };

  const allLayers = prompt.data.layers;
  const allTokens = prompt.data.tokens;

  // Auto-fit downsamples rows/cols by tokenStep/layerStep to fit the viewport.
  // Hidden tokens/layers between two shown ones are revealed by clicking the
  // "⋯N" expander rendered in the chevron gutter between them; the indices a
  // user expands are kept here and always rendered.
  const [expandedTokens, setExpandedTokens] = React.useState<Set<number>>(new Set());
  const [expandedLayers, setExpandedLayers] = React.useState<Set<number>>(new Set());

  const expandTokenGap = (loIdx: number, hiIdx: number) =>
    setExpandedTokens((prev) => {
      const next = new Set(prev);
      for (let i = loIdx + 1; i < hiIdx; i++) next.add(i);
      return next;
    });
  const expandLayerGap = (loIdx: number, hiIdx: number) =>
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      for (let i = loIdx + 1; i < hiIdx; i++) next.add(i);
      return next;
    });

  // When the step changes — via the toolbar or auto-fit recomputing — discard
  // any manually-expanded gaps so the grid re-collapses to the new density.
  // Each expansion set is tied to its own step so changing one doesn't reset
  // the other.
  React.useEffect(() => {
    setExpandedTokens(new Set());
  }, [tokenStep]);
  React.useEffect(() => {
    setExpandedLayers(new Set());
  }, [layerStep]);

  // Show all input tokens — including any leading BOS marker
  // (<|begin_of_text|> / <s> / [CLS]) — so the CM heatmap's rows match the
  // standard logit-lens widget (LogitLensGrid / nnsightful LogitLensWidget),
  // which render the full input. displayTokenIndices keeps absolute indices so
  // the tokenPosition handed to drag/drop interventions stays correct. The
  // last token/layer is ALWAYS shown (the model's final prediction / output
  // layer), plus anything the user has expanded.
  const displayLayerIndices = allLayers
    .map((_, idx) => idx)
    .filter(
      (idx) => idx % layerStep === 0 || idx === allLayers.length - 1 || expandedLayers.has(idx),
    );
  const displayLayers = displayLayerIndices.map((i) => allLayers[i]);

  const displayTokenIndices = allTokens
    .map((_, idx) => idx)
    .filter(
      (idx) => idx % tokenStep === 0 || idx === allTokens.length - 1 || expandedTokens.has(idx),
    );
  const displayTokens = displayTokenIndices.map((i) => allTokens[i]);

  const isInterventionCell = (tokenPos: number, layerIdx: number): boolean => {
    if (!isResult || !interventionCell) return false;
    return (
      tokenPos === interventionCell.tokenPosition &&
      allLayers[layerIdx] === interventionCell.layer
    );
  };

  const isCellAffected = (tokenPos: number, layerIdx: number): boolean => {
    if (!interventionCell || !isResult) return false;
    const intLayerIdx = allLayers.indexOf(interventionCell.layer);
    const intTokenPos = interventionCell.tokenPosition;
    return (
      (tokenPos === intTokenPos && layerIdx > intLayerIdx) ||
      (tokenPos > intTokenPos && layerIdx >= intLayerIdx)
    );
  };

  // The model's final next-token prediction = top-1 token at the last position,
  // final layer. Cells anywhere in the grid whose own top-1 equals it are tinted
  // orange (ramped by probability) instead of the base color, so you can see
  // where in the network the final answer emerges — mirrors the nnsightful
  // LogitLensWidget.
  const FINAL_PRED_HEX = '#cc6622';
  const finalPredToken =
    prompt.data.data[prompt.data.tokens.length - 1]?.[prompt.data.layers.length - 1]?.token ?? '';

  const getBaseColor = (tokenPos: number, layerIdx: number): string => {
    if (isInterventionCell(tokenPos, layerIdx)) {
      return interventionCell?.sourceColor || prompt.color;
    }
    if (isCellAffected(tokenPos, layerIdx)) {
      return blendColor || prompt.color;
    }
    if (finalPredToken !== '' && prompt.data.data[tokenPos]?.[layerIdx]?.token === finalPredToken) {
      return FINAL_PRED_HEX;
    }
    return prompt.color;
  };

  const getAnimationDelay = (tokenPos: number, layerIdx: number): number => {
    if (!interventionCell) return 0;
    const intLayerIdx = allLayers.indexOf(interventionCell.layer);
    const layerDistance = Math.max(0, layerIdx - intLayerIdx);
    const tokenDistance = Math.max(0, tokenPos - interventionCell.tokenPosition);
    return (layerDistance + tokenDistance) * 0.08;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-w-0 w-full">
      <div className={showSidebar ? 'flex min-w-0 w-full' : 'w-full min-w-0'}>
        <div className={showSidebar ? 'flex-1 min-w-0' : 'w-full min-w-0'}>
          {/* Compact label strip */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">{prompt.name}</h3>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: prompt.color }}
            />
          </div>

          <div
            ref={scrollRef}
            className="overflow-auto px-4 pb-4 w-full"
            style={{
              // Bumped from 60vh so autofit can pick more rows when fitting
              // a large heatmap to the viewport; below this autofit kicks in
              // and downsamples token/layer step.
              maxHeight: '82vh',
              position: 'relative',
              scrollBehavior: isScrollControlled ? 'auto' : undefined,
            }}
            onScroll={handleScroll}
          >
            <div
              className="inline-block min-w-full pt-4"
              // `isolation: isolate` creates a new stacking context so the
              // z-index:-1 overlay children below stay BEHIND the cells but
              // do not escape upward through the white card background.
              style={{ position: 'relative', isolation: 'isolate' }}
            >
              {(() => {
                // Grid-level highlight overlays. Painted BEHIND the cells so
                // they only show through the gutters/empty space around them
                // — the cells' opaque probability backgrounds cover the tint
                // where they sit. Layered in order: cone (largest), then
                // column and row bands. Cells must have z-index >= 1 (set on
                // their wrapper below) to sit above these.
                const selHere =
                  selectedCell?.promptId === prompt.id ? selectedCell : null;
                if (!selHere) return null;
                const selRowDispIdx = displayTokenIndices.indexOf(selHere.tokenPosition);
                const selColDispIdx = displayLayerIndices.indexOf(allLayers.indexOf(selHere.layer));
                if (selRowDispIdx < 0 || selColDispIdx < 0) return null;

                // Geometry of the inline-block content. pt-4 (= 16px) is the
                // top padding; axis title row + sticky layer-number row sit
                // above the cells.
                const axisTitleH = axisTitleFontSize * 1.2 + 4; // text + mb-1
                const stickyHeaderH = Math.max(24, cellHeight * 0.6) + 8; // + mb-2
                const preRowsH = 16 + axisTitleH + stickyHeaderH;
                const rowBlockH = cellHeight + 8 + vertArrowHeight + 8;
                const halfGutter = (8 + vertArrowHeight + 8) / 2;

                // Cell-row top for display index d.
                const cellRowTop = (d: number) => preRowsH + d * rowBlockH;
                // Cell-column left for display index j.
                const cellColLeft = (j: number) =>
                  tokenColWidth + j * (cellWidth + horizArrowWidth);

                // Cone rectangle: top-left of grid down to bottom-right of
                // selected cell.
                const coneLeft = tokenColWidth;
                const coneTop = preRowsH;
                const coneWidth =
                  (selColDispIdx + 1) * (cellWidth + horizArrowWidth) - horizArrowWidth;
                const coneHeight = cellRowTop(selRowDispIdx) + cellHeight - preRowsH;

                // Column band spans every row at the selected column.
                const colLeft = cellColLeft(selColDispIdx);
                const colTop = preRowsH;
                const totalRowsH =
                  (displayTokens.length - 1) * rowBlockH + cellHeight; // no trailing gutter on last row
                const colHeight = totalRowsH;

                // Row band spans every column at the selected row, with the
                // vertical-arrow gutters above/below split 50/50 between
                // adjacent rows.
                const rowTop = cellRowTop(selRowDispIdx) - (selRowDispIdx > 0 ? halfGutter : 0);
                const rowHeight =
                  cellHeight +
                  (selRowDispIdx > 0 ? halfGutter : 0) +
                  (selRowDispIdx < displayTokens.length - 1 ? halfGutter : 0);
                const rowLeft = tokenColWidth;
                const totalColsW =
                  displayLayers.length * cellWidth + (displayLayers.length - 1) * horizArrowWidth;

                const hl = (() => {
                  const c = prompt.color.replace('#', '');
                  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
                  return {
                    r: parseInt(full.slice(0, 2), 16),
                    g: parseInt(full.slice(2, 4), 16),
                    b: parseInt(full.slice(4, 6), 16),
                  };
                })();
                const tintWeak = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.18)`;    // cone
                const tintColumn = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.35)`;  // column band
                const tintRow = `rgba(${hl.r}, ${hl.g}, ${hl.b}, 0.35)`;     // row band

                const overlayBase: React.CSSProperties = {
                  position: 'absolute',
                  pointerEvents: 'none',
                  // z-index -1 keeps the overlays below the parent's static-
                  // flow children (cells, gutters, chevrons) while still being
                  // visible because the parent has no background fill.
                  zIndex: -1,
                };

                return (
                  <>
                    {/* Cone underlay (cyan, debug). */}
                    <div
                      style={{
                        ...overlayBase,
                        left: coneLeft,
                        top: coneTop,
                        width: coneWidth,
                        height: coneHeight,
                        backgroundColor: tintWeak,
                      }}
                    />
                    {/* Column band (magenta, debug). */}
                    <div
                      style={{
                        ...overlayBase,
                        left: colLeft,
                        top: colTop,
                        width: cellWidth,
                        height: colHeight,
                        backgroundColor: tintColumn,
                      }}
                    />
                    {/* Row band (yellow, debug). */}
                    <div
                      style={{
                        ...overlayBase,
                        left: rowLeft,
                        top: rowTop,
                        width: totalColsW,
                        height: rowHeight,
                        backgroundColor: tintRow,
                      }}
                    />
                  </>
                );
              })()}
              {/* X-axis title (top) — scrolls with content, not sticky */}
              <div className="flex items-center mb-1">
                <div className="shrink-0" style={{ width: tokenColWidth }} />
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: axisTitleFontSize,
                    fontWeight: 600,
                    color: '#4b5563',
                  }}
                >
                  Layer
                </div>
              </div>
              {/* Sticky layer-number row at top */}
              <div
                className="flex items-center mb-2"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  ...(scrolledY ? { backgroundColor: scrolledBg } : {}),
                }}
              >
                {/* Top-left corner cell: sticky on both axes */}
                <div
                  className="shrink-0"
                  style={{
                    width: tokenColWidth,
                    height: Math.max(24, cellHeight * 0.6),
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 3,
                    ...stickyCornerShadow,
                  }}
                />
                {displayLayers.map((layerValue, idx) => (
                  <div
                    key={`top-${layerValue}`}
                    className="flex items-center"
                    style={stickyTopShadow}
                  >
                    <div
                      className="text-center font-bold text-gray-800"
                      style={{
                        width: cellWidth,
                        height: Math.max(24, cellHeight * 0.6),
                        fontSize: labelFontSize,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {layerValue}
                    </div>
                    {idx < displayLayers.length - 1 && (
                      <div style={{ width: horizArrowWidth, height: Math.max(24, cellHeight * 0.6) }} />
                    )}
                  </div>
                ))}
              </div>

              {displayTokens.map((tokenText, displayRowIdx) => {
                const tokenPos = displayTokenIndices[displayRowIdx];
                const isLastDisplayRow = displayRowIdx === displayTokens.length - 1;
                const nextTokenPos = !isLastDisplayRow
                  ? displayTokenIndices[displayRowIdx + 1]
                  : null;
                // Hidden token rows collapsed between this row and the next.
                const hiddenRows =
                  nextTokenPos != null ? nextTokenPos - tokenPos - 1 : 0;
                return (
                  <div key={tokenPos}>
                    <div className="flex items-center mb-2">
                      <div
                        className="shrink-0 pr-3 text-right font-medium text-gray-700 truncate"
                        style={{
                          width: tokenColWidth,
                          fontSize: labelFontSize,
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          ...stickyLeftShadow,
                        }}
                        title={tokenText}
                      >
                        {tokenText.trim() === '' ? (
                          // Whitespace-only tokens (e.g. a trailing " ") would
                          // render invisibly, making the row look unlabeled /
                          // "missing". Show a muted middle-dot per whitespace
                          // char so the row is clearly visible. Raw token stays
                          // in the title for hover.
                          <span className="text-gray-400">
                            {'·'.repeat(tokenText.length || 1)}
                          </span>
                        ) : (
                          tokenText
                        )}
                      </div>

                      {displayLayers.map((layerValue, displayColIdx) => {
                        const layerIdx = displayLayerIndices[displayColIdx];
                        const cell = prompt.data.data[tokenPos]?.[layerIdx];
                        if (!cell) return null;

                        const isSelected =
                          selectedCell?.promptId === prompt.id &&
                          selectedCell?.tokenPosition === tokenPos &&
                          selectedCell?.layer === layerValue;

                        const isHighlight =
                          highlightCell?.tokenPosition === tokenPos &&
                          highlightCell?.layer === layerValue;

                        const baseColor = getBaseColor(tokenPos, layerIdx);
                        const isIntervention = isInterventionCell(tokenPos, layerIdx);
                        const animationDelay = getAnimationDelay(tokenPos, layerIdx);

                        // Crosshair + causal cone (only for the grid that
                        // owns the selected cell):
                        //   * column = this layer's parallel output
                        //   * row    = this token's depth trajectory
                        //   * cone   = strictly earlier layers, equal-or-
                        //              earlier positions: the cells whose
                        //              outputs were actually available to
                        //              compute the selected cell under the
                        //              causal mask.
                        // Cells outside ALL three get dimmed.
                        const selHere =
                          selectedCell?.promptId === prompt.id ? selectedCell : null;
                        const inColumn = !!selHere && layerValue === selHere.layer;
                        const inRow = !!selHere && tokenPos === selHere.tokenPosition;
                        const inCone =
                          !!selHere &&
                          layerValue < selHere.layer &&
                          tokenPos <= selHere.tokenPosition;
                        const isOutsideCrosshair =
                          !!selHere && !inColumn && !inRow && !inCone;

                        const nextLayerIdx =
                          displayColIdx < displayLayers.length - 1
                            ? displayLayerIndices[displayColIdx + 1]
                            : null;
                        const nextIsIntervention =
                          nextLayerIdx != null && isInterventionCell(tokenPos, nextLayerIdx);

                        return (
                          <div
                            key={`${tokenPos}-${layerValue}`}
                            className="flex items-center"
                            style={{ flexShrink: 0 }}
                          >
                            <div
                              style={{
                                width: cellWidth,
                                height: cellHeight,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isDropTarget ? (
                                <DropTargetCell
                                  tokenPosition={tokenPos}
                                  layer={layerValue}
                                  predictedToken={cell.token}
                                  probability={cell.probability}
                                  baseColor={prompt.color}
                                  promptId={prompt.id}
                                  onDrop={onDrop}
                                  isHighlighted={isHighlight}
                                  isSelected={isSelected}
                                  onCellClick={onCellClick}
                                  animationDelay={0}
                                  onHighlightRefChange={onHighlightRefChange}
                                  width={cellWidth}
                                  height={cellHeight}
                                  fontSize={cellFontSize}
                                  isOutsideCrosshair={isOutsideCrosshair}
                                />
                              ) : (
                                <HeatmapCell
                                  tokenPosition={tokenPos}
                                  layer={layerValue}
                                  predictedToken={cell.token}
                                  probability={cell.probability}
                                  baseColor={baseColor}
                                  promptId={prompt.id}
                                  isDraggable={!isDropTarget && !isResult && isSourceDraggable}
                                  isSelected={isSelected}
                                  isHighlighted={isHighlight}
                                  isIntervention={isIntervention}
                                  onClick={() => onCellClick?.(tokenPos, layerValue)}
                                  animationDelay={animationDelay}
                                  highlightRef={isHighlight ? onHighlightRefChange : undefined}
                                  width={cellWidth}
                                  height={cellHeight}
                                  fontSize={cellFontSize}
                                  isOutsideCrosshair={isOutsideCrosshair}
                                />
                              )}
                            </div>

                            {(() => {
                              if (displayColIdx >= displayLayers.length - 1) return null;
                              const hiddenLayers =
                                displayLayerIndices[displayColIdx + 1] - layerIdx - 1;
                              // Collapsed-cols expander: clickable "⋮" in the
                              // gutter when auto-fit hid layers between this col
                              // and the next. Clicking reveals those layers.
                              if (hiddenLayers > 0) {
                                // Keep the flow chevron, but draw a vertical
                                // dashed break-line behind it to signal the
                                // collapsed layers. The whole gutter stays
                                // clickable to reveal them.
                                return (
                                  <button
                                    type="button"
                                    data-testid="layer-gap-expander"
                                    title={`${hiddenLayers} hidden layer${hiddenLayers > 1 ? 's' : ''} — click to expand`}
                                    onClick={() =>
                                      expandLayerGap(layerIdx, displayLayerIndices[displayColIdx + 1])
                                    }
                                    className="shrink-0 flex items-center justify-center hover:bg-gray-100/60 transition-colors"
                                    style={{
                                      width: horizArrowWidth,
                                      height: cellHeight,
                                      position: 'relative',
                                      cursor: 'pointer',
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                    }}
                                  >
                                    <div
                                      aria-hidden="true"
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        bottom: 0,
                                        left: '50%',
                                        borderLeft: '1px dashed #cbd5e1',
                                        pointerEvents: 'none',
                                      }}
                                    />
                                    <FlowArrow color={baseColor} opacity={0.9} />
                                  </button>
                                );
                              }
                              if (nextIsIntervention) {
                                return <div style={{ width: horizArrowWidth, flexShrink: 0 }} />;
                              }
                              return (
                                <div
                                  style={{
                                    width: horizArrowWidth,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <FlowArrow color={baseColor} opacity={0.9} />
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>

                    {/* Vertical arrow gutter row between adjacent token rows.
                        Structure mirrors the token row: sticky-left column of
                        tokenColWidth, then one cellWidth-wide arrow container per
                        layer, with horizArrowWidth spacers between. The chevrons
                        ALWAYS render. When auto-fit hid token rows in this gap
                        (hiddenRows > 0) we additionally draw a dashed break-line
                        behind the chevrons and put a clickable "... N (hidden)"
                        label in the sticky-left column to reveal them. */}
                    {!isLastDisplayRow && nextTokenPos != null && (
                      <div
                        className="flex items-center"
                        style={{
                          marginBottom: 8,
                          position: 'relative',
                          // Arrows are decorative; only the count button (when
                          // collapsed) is interactive — it re-enables pointers.
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Dashed break-line behind the chevrons, only when this
                            gap hides rows. Spans from the token column to the end. */}
                        {hiddenRows > 0 && (
                          <div
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              left: tokenColWidth,
                              right: 0,
                              top: '50%',
                              borderTop: '1px dashed #cbd5e1',
                              pointerEvents: 'none',
                              zIndex: 0,
                            }}
                          />
                        )}
                        {/* Sticky-left column: a clickable count label when this
                            gap is collapsed, otherwise an empty spacer. */}
                        <div
                          className="shrink-0 flex items-center"
                          style={{
                            width: tokenColWidth,
                            height: vertArrowHeight,
                            position: 'sticky',
                            left: 0,
                            zIndex: 2,
                            ...stickyLeftShadow,
                          }}
                        >
                          {hiddenRows > 0 && (
                            <button
                              type="button"
                              data-testid="token-gap-expander"
                              title={`${hiddenRows} hidden token${hiddenRows > 1 ? 's' : ''} — click to expand`}
                              onClick={() => expandTokenGap(tokenPos, nextTokenPos as number)}
                              className="text-gray-400 hover:text-gray-700 rounded transition-colors"
                              style={{
                                fontSize: 9,
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                paddingLeft: 4,
                                paddingRight: 4,
                                cursor: 'pointer',
                                background: 'none',
                                border: 'none',
                                pointerEvents: 'auto',
                              }}
                            >
                              {`... ${hiddenRows} (hidden)`}
                            </button>
                          )}
                        </div>
                        {displayLayers.map((layerValue, displayColIdx) => {
                          const layerIdx = displayLayerIndices[displayColIdx];
                          const suppressIncomingVertical =
                            isResult &&
                            interventionCell != null &&
                            nextTokenPos === interventionCell.tokenPosition &&
                            layerValue === interventionCell.layer;
                          // Color by origin cell, mirroring the horizontal arrow.
                          // Coloring by destination made arrows from unaffected
                          // (pink) cells into mixed (purple) cells render purple.
                          // getBaseColor at the intervention cell already returns
                          // sourceColor (cyan), so no explicit outgoing override.
                          const vertArrowColor = getBaseColor(tokenPos, layerIdx);
                          return (
                            <div
                              key={`varrow-${tokenPos}-${layerValue}`}
                              className="flex items-center"
                              // Sit above the dashed break-line (zIndex 0) so the
                              // chevrons render over it, not under it.
                              style={{ position: 'relative', zIndex: 1 }}
                            >
                              <div
                                style={{
                                  width: cellWidth,
                                  height: vertArrowHeight,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {suppressIncomingVertical ? (
                                  <div
                                    style={{
                                      width: cellWidth,
                                      height: vertArrowHeight,
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <VerticalFlowArrow
                                    color={vertArrowColor}
                                  />
                                )}
                              </div>
                              {displayColIdx < displayLayers.length - 1 && (
                                <div
                                  style={{
                                    width: horizArrowWidth,
                                    height: vertArrowHeight,
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}

              {/* Bottom (non-sticky) layer-number row */}
              <div
                className="flex items-center mt-2"
                style={{ borderTop: '1px solid #e5e7eb' }}
              >
                {/* Bottom-left corner spacer: sticky-left to match column */}
                <div
                  className="shrink-0"
                  style={{
                    width: tokenColWidth,
                    height: Math.max(24, cellHeight * 0.6),
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    ...stickyLeftShadow,
                  }}
                />
                {displayLayers.map((layerValue, idx) => (
                  <div key={`bottom-${layerValue}`} className="flex items-center">
                    <div
                      className="text-center font-bold text-gray-800"
                      style={{
                        width: cellWidth,
                        height: Math.max(24, cellHeight * 0.6),
                        fontSize: labelFontSize,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {layerValue}
                    </div>
                    {idx < displayLayers.length - 1 && (
                      <div style={{ width: horizArrowWidth, height: Math.max(24, cellHeight * 0.6) }} />
                    )}
                  </div>
                ))}
              </div>
              {/* X-axis title (bottom) */}
              <div className="flex items-center mt-1">
                <div className="shrink-0" style={{ width: tokenColWidth }} />
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: axisTitleFontSize,
                    fontWeight: 600,
                    color: '#4b5563',
                  }}
                >
                  Layer
                </div>
              </div>

            </div>
          </div>

          {/* Probability color-scale legend — below the scroll container,
              inside the card. Mirrors the legend pattern from
              LogitLensGrid.tsx: horizontal gradient from white to the
              prompt's color, with 0.0 / 1.0 labels flanking it and a
              "Probability" label on the left. Inline styles are used for
              the gradient so the workbench's Tailwind JIT doesn't drop it. */}
          <div
            className="flex items-center px-4 pb-3 pt-1"
            style={{ gap: 8 }}
          >
            <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>
              Probability
            </span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>0.0</span>
            <div
              style={{
                width: 140,
                height: 10,
                background: `linear-gradient(to right, #ffffff 0%, ${prompt.color} 100%)`,
                borderRadius: 2,
                border: '1px solid #e5e7eb',
              }}
            />
            <span style={{ fontSize: 10, color: '#6b7280' }}>1.0</span>
          </div>
        </div>

        {showSidebar && (
          <div className="bg-gray-100 p-4 flex-shrink-0 w-80">{sidebarContent}</div>
        )}
      </div>
    </div>
  );
};

interface DropTargetCellProps {
  tokenPosition: number;
  layer: number;
  predictedToken: string;
  probability: number;
  baseColor: string;
  promptId: string;
  onDrop?: (item: any, targetTokenPos: number, targetLayer: number) => void;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onCellClick?: (tokenPosition: number, layer: number) => void;
  animationDelay?: number;
  onHighlightRefChange?: (ref: HTMLElement | null) => void;
  width: number;
  height: number;
  fontSize: number;
  isOutsideCrosshair?: boolean;
}

const DropTargetCell: React.FC<DropTargetCellProps> = ({
  tokenPosition,
  layer,
  predictedToken,
  probability,
  baseColor,
  promptId,
  onDrop,
  isHighlighted,
  isSelected,
  onCellClick,
  animationDelay,
  onHighlightRefChange,
  width,
  height,
  fontSize,
  isOutsideCrosshair,
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: 'HEATMAP_CELL',
      drop: (item: any) => {
        if (onDrop) onDrop(item, tokenPosition, layer);
        return undefined;
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [tokenPosition, layer, onDrop],
  );

  return (
    <div ref={drop}>
      <motion.div
        className={`
          relative
          ${isOver && canDrop ? 'ring-4 ring-green-500 ring-inset z-20' : ''}
          ${canDrop && !isOver ? 'ring-2 ring-blue-400 ring-dashed ring-inset' : ''}
        `}
        animate={isOver && canDrop ? { scale: 1.08 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <HeatmapCell
          tokenPosition={tokenPosition}
          layer={layer}
          predictedToken={predictedToken}
          probability={probability}
          baseColor={baseColor}
          promptId={promptId}
          isDraggable={false}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          onClick={() => onCellClick?.(tokenPosition, layer)}
          animationDelay={animationDelay}
          highlightRef={isHighlighted ? onHighlightRefChange : undefined}
          width={width}
          height={height}
          fontSize={fontSize}
          isOutsideCrosshair={isOutsideCrosshair}
        />
      </motion.div>
    </div>
  );
};
