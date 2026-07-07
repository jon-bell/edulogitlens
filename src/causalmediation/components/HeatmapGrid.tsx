import React from 'react';
import { useDrop } from 'react-dnd';
import { motion } from 'motion/react';
import { PromptInput, SelectedCell } from '../types';
import { HeatmapCell } from './HeatmapCell';
import { formatTokenDisplay } from '../utils/formatToken';
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

// Measured positions (px, relative to the inline-block content div) of every
// rendered cell row and cell column. The highlight bands and the patched-cell
// exclusion are painted from these MEASURED rects rather than arithmetic:
// fractional cell sizes at non-100% zoom made index-multiplied math drift
// further down the grid, so bands stopped sitting pixel-exact on their rows.
interface OverlayGeom {
  rowTops: number[];
  rowHeights: number[];
  colLefts: number[];
  colWidths: number[];
}

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

  // Measure the real rendered position of each cell row / cell column after
  // layout. getBoundingClientRect is used (not offsetTop/offsetLeft) for
  // sub-pixel accuracy; positions are taken relative to the content div, which
  // makes them scroll-invariant. The equality guard stops the every-render
  // layout effect from looping; the ResizeObserver catches layout shifts that
  // happen without a React render (e.g. web-font load resizing the headers).
  const contentRef = React.useRef<HTMLDivElement>(null);
  const rowElsRef = React.useRef(new Map<number, HTMLElement>());
  const colElsRef = React.useRef(new Map<number, HTMLElement>());
  const [overlayGeom, setOverlayGeom] = React.useState<OverlayGeom | null>(null);

  const measureOverlayGeom = React.useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const base = content.getBoundingClientRect();
    const rowTops: number[] = [];
    const rowHeights: number[] = [];
    for (let d = 0; d < rowElsRef.current.size; d++) {
      const el = rowElsRef.current.get(d);
      if (!el) return;
      const r = el.getBoundingClientRect();
      rowTops.push(r.top - base.top);
      rowHeights.push(r.height);
    }
    const colLefts: number[] = [];
    const colWidths: number[] = [];
    for (let j = 0; j < colElsRef.current.size; j++) {
      const el = colElsRef.current.get(j);
      if (!el) return;
      const r = el.getBoundingClientRect();
      colLefts.push(r.left - base.left);
      colWidths.push(r.width);
    }
    setOverlayGeom((prev) => {
      const next = { rowTops, rowHeights, colLefts, colWidths };
      return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, []);

  React.useLayoutEffect(() => {
    measureOverlayGeom();
  });

  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(() => measureOverlayGeom());
    ro.observe(content);
    return () => ro.disconnect();
  }, [measureOverlayGeom]);

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
    // A patch at layer L only shows up at layer L+1 and deeper: at the patch
    // token (carried forward through the residual stream) and at later tokens
    // (read in via attention at the next layer). Cells in the SAME layer L are
    // computed independently of the patch, so they keep their base color.
    return (
      (tokenPos === intTokenPos && layerIdx > intLayerIdx) ||
      (tokenPos > intTokenPos && layerIdx > intLayerIdx)
    );
  };

  const getBaseColor = (tokenPos: number, layerIdx: number): string => {
    if (isInterventionCell(tokenPos, layerIdx)) {
      return interventionCell?.sourceColor || prompt.color;
    }
    if (isCellAffected(tokenPos, layerIdx)) {
      return blendColor || prompt.color;
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

          <div className="flex min-w-0 w-full">
          {/* Y-axis title — OUTSIDE the scroll container so it stays visible
              regardless of scroll, mirroring the "Layer" x-axis titles. Reads
              bottom-to-top per the usual y-axis convention. */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: Math.max(20, axisTitleFontSize * 1.6),
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              textAlign: 'center',
              fontSize: axisTitleFontSize,
              fontWeight: 600,
              color: '#4b5563',
            }}
          >
            Tokens (Step: {tokenStep})
          </div>
          <div
            ref={scrollRef}
            className="overflow-auto pr-4 pb-4 w-full min-w-0"
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
              ref={contentRef}
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
                if (!selHere || !overlayGeom) return null;
                const selRowDispIdx = displayTokenIndices.indexOf(selHere.tokenPosition);
                const selColDispIdx = displayLayerIndices.indexOf(allLayers.indexOf(selHere.layer));
                if (selRowDispIdx < 0 || selColDispIdx < 0) return null;

                // All geometry is MEASURED off the rendered rows/columns (see
                // measureOverlayGeom) — bail for a frame if the measurement
                // hasn't caught up with the current row/column set yet.
                const { rowTops, rowHeights, colLefts, colWidths } = overlayGeom;
                if (
                  rowTops.length !== displayTokens.length ||
                  colLefts.length !== displayLayers.length
                ) {
                  return null;
                }

                const gridTop = rowTops[0];
                const gridLeft = colLefts[0];
                const lastRowBottom =
                  rowTops[rowTops.length - 1] + rowHeights[rowHeights.length - 1];
                const lastColRight =
                  colLefts[colLefts.length - 1] + colWidths[colWidths.length - 1];

                // Half the measured gutter between a row/column and each
                // neighbor — bands extend halfway into the arrow gutters.
                const gapAbove = (d: number) =>
                  d > 0 ? (rowTops[d] - (rowTops[d - 1] + rowHeights[d - 1])) / 2 : 0;
                const gapBelow = (d: number) =>
                  d < rowTops.length - 1
                    ? (rowTops[d + 1] - (rowTops[d] + rowHeights[d])) / 2
                    : 0;
                const gapLeft = (j: number) =>
                  j > 0 ? (colLefts[j] - (colLefts[j - 1] + colWidths[j - 1])) / 2 : 0;
                const gapRight = (j: number) =>
                  j < colLefts.length - 1
                    ? (colLefts[j + 1] - (colLefts[j] + colWidths[j])) / 2
                    : 0;

                // Cone rectangle: top-left of grid down to bottom-right of
                // selected cell.
                const coneLeft = gridLeft;
                const coneTop = gridTop;
                const coneWidth =
                  colLefts[selColDispIdx] + colWidths[selColDispIdx] - gridLeft;
                const coneHeight =
                  rowTops[selRowDispIdx] + rowHeights[selRowDispIdx] - gridTop;

                // Column band spans every row at the selected column.
                const colLeft = colLefts[selColDispIdx];
                const colTop = gridTop;
                const colHeight = lastRowBottom - gridTop;

                // Row band spans every column at the selected row, with the
                // vertical-arrow gutters above/below split 50/50 between
                // adjacent rows.
                const rowTop = rowTops[selRowDispIdx] - gapAbove(selRowDispIdx);
                const rowHeight =
                  rowHeights[selRowDispIdx] +
                  gapAbove(selRowDispIdx) +
                  gapBelow(selRowDispIdx);
                const rowLeft = gridLeft;
                const totalColsW = lastColRight - gridLeft;

                const toRgb = (hex: string) => {
                  const c = hex.replace('#', '');
                  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
                  return {
                    r: parseInt(full.slice(0, 2), 16),
                    g: parseInt(full.slice(2, 4), 16),
                    b: parseInt(full.slice(4, 6), 16),
                  };
                };
                const pink = toRgb(prompt.color);
                const purple = toRgb(blendColor || '#9333ea');
                const rgba = (
                  { r, g, b }: { r: number; g: number; b: number },
                  a: number,
                ) => `rgba(${r}, ${g}, ${b}, ${a})`;

                // Affected-region anchor: cells strictly to the right of and
                // at/below the intervention are "tainted" (the same rule as
                // isCellAffected / the cell shading). On the result grid the
                // highlight bands turn purple over that region and stay pink
                // elsewhere; off the result grid affX/affY stay Infinity so the
                // whole highlight is pink, unchanged.
                let affX = Infinity;
                let affY = Infinity;
                if (isResult && interventionCell) {
                  const intLayerIdx = allLayers.indexOf(interventionCell.layer);
                  const jStar = displayLayerIndices.findIndex((li) => li > intLayerIdx);
                  const dStar = displayTokenIndices.findIndex(
                    (ti) => ti >= interventionCell.tokenPosition,
                  );
                  if (jStar >= 0) affX = colLefts[jStar];
                  if (dStar >= 0) affY = rowTops[dStar];
                }

                const overlayBase: React.CSSProperties = {
                  position: 'absolute',
                  pointerEvents: 'none',
                  // z-index -1 keeps the overlays below the parent's static-
                  // flow children (cells, gutters, chevrons) while still being
                  // visible because the parent has no background fill.
                  zIndex: -1,
                };

                // Split a highlight band into a purple part (the affected
                // bottom-right quadrant beyond affX/affY) and pink parts (the
                // rest), so each band is purple exactly where its cells are.
                const splitBand = (
                  left: number,
                  top: number,
                  width: number,
                  height: number,
                  alpha: number,
                ) => {
                  const right = left + width;
                  const bottom = top + height;
                  const cutX = Math.min(Math.max(affX, left), right);
                  const cutY = Math.min(Math.max(affY, top), bottom);
                  const parts: {
                    left: number;
                    top: number;
                    width: number;
                    height: number;
                    color: string;
                  }[] = [];
                  if (right > cutX && bottom > cutY) {
                    parts.push({ left: cutX, top: cutY, width: right - cutX, height: bottom - cutY, color: rgba(purple, alpha) });
                  }
                  if (cutX > left) {
                    parts.push({ left, top, width: cutX - left, height, color: rgba(pink, alpha) });
                  }
                  if (right > cutX && cutY > top) {
                    parts.push({ left: cutX, top, width: right - cutX, height: cutY - top, color: rgba(pink, alpha) });
                  }
                  return parts;
                };

                // This tint (z-index -1) now sits ABOVE the amber gap bands
                // (z-index -2) and below the cells, so the blue/pink paints over
                // the amber for clear definition. Opacities are strong so the
                // highlight reads distinctly over the amber.
                const bands = [
                  ...splitBand(coneLeft, coneTop, coneWidth, coneHeight, 0.32),
                  ...splitBand(colLeft, colTop, colWidths[selColDispIdx], colHeight, 0.6),
                  ...splitBand(rowLeft, rowTop, totalColsW, rowHeight, 0.6),
                ];

                // "No background around the patched cell": paint an opaque
                // white rect over the bands covering the intervention cell
                // plus a half-gutter ring around it, so the patched cell
                // floats on the plain card background instead of sitting
                // inside the pink/purple tint. Same z-index -1 layer, painted
                // AFTER the bands so it wins where they overlap (the card
                // background is white, so it reads as "no background").
                let exclusion: {
                  left: number;
                  top: number;
                  width: number;
                  height: number;
                } | null = null;
                if (isResult && interventionCell) {
                  const intRow = displayTokenIndices.indexOf(interventionCell.tokenPosition);
                  const intCol = displayLayerIndices.indexOf(
                    allLayers.indexOf(interventionCell.layer),
                  );
                  if (intRow >= 0 && intCol >= 0) {
                    // At grid edges (no neighbor on one side) mirror the
                    // opposite gap so the ring stays visually even.
                    const ringAbove = gapAbove(intRow) || gapBelow(intRow);
                    const ringBelow = gapBelow(intRow) || gapAbove(intRow);
                    const ringLeft = gapLeft(intCol) || gapRight(intCol);
                    const ringRight = gapRight(intCol) || gapLeft(intCol);
                    exclusion = {
                      left: colLefts[intCol] - ringLeft,
                      top: rowTops[intRow] - ringAbove,
                      width: colWidths[intCol] + ringLeft + ringRight,
                      height: rowHeights[intRow] + ringAbove + ringBelow,
                    };
                  }
                }

                return (
                  <>
                    {bands.map((b, i) => (
                      <div
                        key={i}
                        style={{
                          ...overlayBase,
                          left: b.left,
                          top: b.top,
                          width: b.width,
                          height: b.height,
                          backgroundColor: b.color,
                        }}
                      />
                    ))}
                    {exclusion && (
                      <div
                        style={{
                          ...overlayBase,
                          left: exclusion.left,
                          top: exclusion.top,
                          width: exclusion.width,
                          height: exclusion.height,
                          backgroundColor: '#ffffff',
                        }}
                      />
                    )}
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
                  Layer (Step: {layerStep})
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
                    <div
                      className="flex items-center mb-2"
                      ref={(el) => {
                        if (el) rowElsRef.current.set(displayRowIdx, el);
                        else rowElsRef.current.delete(displayRowIdx);
                      }}
                    >
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
                          // "missing". Muted so the marker reads as "space",
                          // not as literal text. Raw token stays in the title.
                          <span className="text-gray-400">
                            {formatTokenDisplay(tokenText || ' ')}
                          </span>
                        ) : (
                          formatTokenDisplay(tokenText)
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
                        // Downstream of the patch: gets a purple border so a
                        // near-white low-probability cell is still marked tainted.
                        const isTainted = isCellAffected(tokenPos, layerIdx);
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
                              // Column geometry is measured off the first
                              // rendered row's cell wrappers.
                              ref={
                                displayRowIdx === 0
                                  ? (el) => {
                                      if (el) colElsRef.current.set(displayColIdx, el);
                                      else colElsRef.current.delete(displayColIdx);
                                    }
                                  : undefined
                              }
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
                                  baseColor={baseColor}
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
                                  isTainted={isTainted}
                                  taintColor={blendColor}
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
                                // Amber break-band: collapsed layers need a
                                // loud cue, not a faint dashed line. The whole
                                // gutter is an amber, clickable column with a
                                // vertical "⋯N" count label; clicking reveals
                                // the hidden layers.
                                return (
                                  <button
                                    type="button"
                                    data-testid="layer-gap-expander"
                                    title={`${hiddenLayers} hidden layer${hiddenLayers > 1 ? 's' : ''} — click to expand`}
                                    onClick={() =>
                                      expandLayerGap(layerIdx, displayLayerIndices[displayColIdx + 1])
                                    }
                                    className="shrink-0 flex items-center justify-center bg-amber-300/40 hover:bg-amber-300/60 transition-colors"
                                    style={{
                                      width: horizArrowWidth,
                                      height: cellHeight,
                                      position: 'relative',
                                      cursor: 'pointer',
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
                                        borderLeft: '1px dashed #d97706',
                                        pointerEvents: 'none',
                                      }}
                                    />
                                    <span
                                      style={{
                                        position: 'relative',
                                        writingMode: 'vertical-rl',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        lineHeight: 1,
                                        color: '#78350f',
                                        backgroundColor: 'inherit',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {`⋯${hiddenLayers}`}
                                    </span>
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
                        {/* Amber break-band behind the chevrons, only when this
                            gap hides rows. Spans from the token column to the
                            end, and extends ~5px into the row margins above and
                            below (visual overflow only — layout heights stay
                            uniform so the two grids' rows keep aligning). The
                            whole band is clickable to expand the hidden rows. */}
                        {hiddenRows > 0 && (
                          <button
                            type="button"
                            aria-hidden="true"
                            tabIndex={-1}
                            title={`${hiddenRows} hidden token${hiddenRows > 1 ? 's' : ''} — click to expand`}
                            onClick={() => expandTokenGap(tokenPos, nextTokenPos as number)}
                            className="bg-amber-300/40 hover:bg-amber-300/60 transition-colors"
                            style={{
                              position: 'absolute',
                              left: tokenColWidth,
                              right: 0,
                              top: -5,
                              bottom: -5,
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              pointerEvents: 'auto',
                              // Below the crosshair/cone highlight (z-index -1) so
                              // the blue paints OVER the amber where they cross,
                              // giving the highlight clear definition. Still above
                              // the card background, and clickable (the highlight
                              // overlays are pointer-events: none).
                              zIndex: -2,
                            }}
                          >
                            <div
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: '50%',
                                borderTop: '1px dashed #d97706',
                                pointerEvents: 'none',
                              }}
                            />
                          </button>
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
                              className="bg-amber-300/40 hover:bg-amber-300/60 text-amber-900 transition-colors"
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: -5,
                                bottom: -5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                fontSize: 10,
                                fontWeight: 600,
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                paddingLeft: 4,
                                paddingRight: 8,
                                cursor: 'pointer',
                                border: 'none',
                                pointerEvents: 'auto',
                              }}
                            >
                              {`⋯ ${hiddenRows} hidden`}
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
                          // Also drop the chevron LEAVING the patch target
                          // downward: a patch doesn't propagate to the next
                          // token within the same layer (that happens one layer
                          // deeper), so a same-layer down arrow is misleading.
                          const suppressOutgoingVertical =
                            isResult &&
                            interventionCell != null &&
                            tokenPos === interventionCell.tokenPosition &&
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
                                {suppressIncomingVertical || suppressOutgoingVertical ? (
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
                                  // Continue the amber collapsed-layers column
                                  // through this gutter row so the break-band
                                  // reads as one continuous vertical sweep.
                                  className={
                                    displayLayerIndices[displayColIdx + 1] - layerIdx - 1 > 0
                                      ? 'bg-amber-300/40'
                                      : undefined
                                  }
                                  style={{
                                    width: horizArrowWidth,
                                    height: vertArrowHeight,
                                    position: 'relative',
                                  }}
                                >
                                  {displayLayerIndices[displayColIdx + 1] - layerIdx - 1 > 0 && (
                                    <div
                                      aria-hidden="true"
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        bottom: 0,
                                        left: '50%',
                                        borderLeft: '1px dashed #d97706',
                                      }}
                                    />
                                  )}
                                </div>
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
                  Layer (Step: {layerStep})
                </div>
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
