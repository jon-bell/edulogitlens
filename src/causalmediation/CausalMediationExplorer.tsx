import { useState, useEffect, useMemo, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HeatmapGrid } from './components/HeatmapGrid';
import { HeatmapToolbar } from './components/HeatmapToolbar';
import { TokenPredictionPanel } from './components/TokenPredictionPanel';
import { ResultSidebar } from './components/ResultSidebar';
import { CurvedPatchArrow } from './components/CurvedPatchArrow';
import { PromptInput, Intervention, SelectedCell, CausalMediationEvent } from './types';
import { formatTokenDisplay } from './utils/formatToken';
import { useSpotlight } from './SpotlightContext';
import type { LogitLensData } from '../LogitLensGrid';
import { createMockLogitLensData, generateInterventionResult } from './utils/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Loader2 } from 'lucide-react';

/**
 * Central color theme — change colors here to update the entire explorer.
 */
const THEME = {
  sourceColor: '#06b6d4',
  targetColor: '#ec4899',
  blendColor: '#9333ea',
} as const;

interface CausalMediationExplorerProps {
  sourcePromptText?: string;
  targetPromptText?: string;
  sourceData?: LogitLensData;
  targetData?: LogitLensData;
  onIntervention?: (i: Intervention) => Promise<LogitLensData | null> | void;
  resultData?: LogitLensData | null;
  // Controlled intervention: when provided, the parent owns the patch spec
  // (e.g. a persisted/restored patch), so the cone + arrow + result grid redraw
  // without a live drag. undefined = uncontrolled (the internal drag state drives).
  intervention?: Intervention | null;
  // Called when the user clicks "Reset Intervention". Lets a controlling parent
  // drop its persisted spec; without it a controlled intervention would re-supply.
  onResetIntervention?: () => void;
  isInterventionPending?: boolean;
  // Optional analytics hook: fired on discrete in-chart interactions (cell
  // expand, result-cell expand, token/layer step changes). Coordinates only,
  // no token text. Purely observational — does not affect widget behavior.
  onEvent?: (event: CausalMediationEvent) => void;
  // Optional: reports the target's post-patch top predicted token — the
  // last-position, final-layer output shown in the result grid — whenever a
  // result becomes available (live drop or restored/controlled resultData), and
  // again if a re-patch changes it. Deliberately separate from `onEvent`: this
  // carries the model's predicted token (never participant text), for a host
  // that scores an activity against the patch outcome (e.g. a guided tutorial
  // asking "what did the target produce after the patch?"). Purely observational.
  onInterventionResult?: (finalToken: string | null) => void;
}

export function CausalMediationExplorer({
  sourcePromptText = 'The Eiffel Tower is in France',
  targetPromptText = 'The Big Ben is in England',
  sourceData,
  targetData,
  onIntervention,
  resultData: controlledResultData,
  intervention: controlledIntervention,
  onResetIntervention,
  isInterventionPending = false,
  onEvent,
  onInterventionResult,
}: CausalMediationExplorerProps = {}) {
  const sourcePrompt = useMemo<PromptInput>(
    () => ({
      id: 'source',
      name: 'Source Prompt',
      color: THEME.sourceColor,
      data: sourceData ?? createMockLogitLensData(sourcePromptText, 'source'),
    }),
    [sourceData, sourcePromptText],
  );

  // Single-prompt mode: when the target text is blank, hide the target grid
  // and the entire intervention flow (drag/drop, curved arrow, result panel).
  // CM Intro degrades gracefully into a lens viewer for just the source.
  const isSinglePromptMode = !targetPromptText || targetPromptText.trim().length === 0;

  const targetPrompt = useMemo<PromptInput>(
    () => ({
      id: 'target',
      name: 'Target Prompt',
      color: THEME.targetColor,
      data: targetData ?? createMockLogitLensData(targetPromptText, 'target'),
    }),
    [targetData, targetPromptText],
  );

  const [internalIntervention, setInternalIntervention] = useState<Intervention | null>(null);
  const [internalResultData, setInternalResultData] = useState<LogitLensData | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [resultSelectedCell, setResultSelectedCell] = useState<SelectedCell | null>(null);
  const [sourceHighlightRef, setSourceHighlightRef] = useState<HTMLElement | null>(null);
  const [targetHighlightRef, setTargetHighlightRef] = useState<HTMLElement | null>(null);

  // Guided-tutorial "Show me" spotlight (opt-in via SpotlightProvider). Resolve
  // the requested {grid, layer, position} cells against a grid's data, turning
  // `'last'` into concrete indices; keeps only the cells addressed to that grid,
  // so each HeatmapGrid rings its own. Several cells can be lit at once — a
  // patching hint lights both ends of the drag.
  const { targets: spotlights } = useSpotlight();
  const resolveSpotlights = (
    grid: 'source' | 'target' | 'result',
    data: LogitLensData,
  ): { tokenPosition: number; layer: number }[] => {
    if (!data.tokens.length || !data.layers.length) return [];
    const lastLayer = data.layers[data.layers.length - 1];
    const lastPos = data.tokens.length - 1;
    return spotlights
      .filter((s) => s.grid === grid)
      .map((s) => ({
        tokenPosition: s.position === 'last' ? lastPos : s.position,
        layer: s.layer === 'last' ? lastLayer : s.layer,
      }));
  };

  // When the parent passes `resultData` (controlled), it is the source of truth.
  //   - non-null LogitLensData: render it
  //   - null:                   render nothing (parent explicitly cleared)
  //   - undefined:              fall back to internal state (uncontrolled)
  const isResultControlled = controlledResultData !== undefined;
  const resultData: LogitLensData | null = isResultControlled
    ? controlledResultData ?? null
    : internalResultData;

  // Same controlled pattern for the intervention: a non-undefined prop is the
  // source of truth (restored/revisited patch); undefined falls back to the
  // internal drag state. A live drag sets the internal state first (instant),
  // then the parent persists + re-supplies the identical spec via the prop.
  const isInterventionControlled = controlledIntervention !== undefined;
  const intervention = isInterventionControlled ? controlledIntervention : internalIntervention;

  // Shared toolbar state — both grids share zoom, tokenStep, layerStep.
  const [zoom, setZoom] = useState(100);
  const [tokenStep, setTokenStep] = useState(1);
  const [layerStep, setLayerStep] = useState(1);

  // Synced scrolling between the two heatmaps (default on). Both grids report
  // their scroll into this shared state and follow it.
  const [syncScroll, setSyncScroll] = useState(true);
  const [scrollState, setScrollState] = useState<{ scrollLeft: number; scrollTop: number } | null>(
    null,
  );

  // Auto-fit: when on (default), measure the wrapper holding the two grids and
  // derive shared token/layer steps so both grids fit without scrolling. The
  // toolbar's step inputs disable it (manual override).
  const [autoFit, setAutoFit] = useState(true);
  const [gridsSize, setGridsSize] = useState<{ width: number; height: number } | null>(null);
  const gridsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridsRef.current;
    if (!el) return;
    const update = () => setGridsSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cell footprint constants mirror HeatmapGrid's BASE_* values. The two grids
  // sit side by side, so each gets ~half the wrapper width (minus the inter-grid
  // gap). Compute from the LARGER of the two prompts so both stay aligned.
  const autoStep = useMemo(() => {
    if (!gridsSize) return { tokenStep: 1, layerStep: 1 };
    const numTokens = Math.max(
      sourcePrompt.data.tokens.length,
      targetPrompt.data.tokens.length,
    );
    const numLayers = Math.max(
      sourcePrompt.data.layers.length,
      targetPrompt.data.layers.length,
    );
    if (numTokens === 0 || numLayers === 0) return { tokenStep: 1, layerStep: 1 };

    const colFootprint = 72 + 28; // BASE_CELL_WIDTH + BASE_HORIZ_ARROW_WIDTH
    // Per-row block matches HeatmapGrid's `rowBlockH` at zoom 100:
    // BASE_CELL_HEIGHT(48) + top gap(8) + BASE_VERT_ARROW_HEIGHT(6) + bottom
    // gap(8). The old value (48 + 16) undercounted each row by 6px, which
    // accumulated into the final row overflowing the scroll container.
    const rowFootprint = 48 + 8 + 6 + 8;
    const tokenColWidth = 80; // BASE_TOKEN_COL_WIDTH
    const interGridGap = 24; // gap-1.5rem between the two grids
    // Horizontal reserve: token-col gutter + card padding + the ~20px rotated
    // "Tokens" y-axis title strip that sits left of the scroll container.
    const padding = 48;

    // Vertical chrome inside gridsSize.height that is NOT cell rows, so the
    // token-fit budget excludes it. gridsSize.height (gridsRef.clientHeight)
    // spans each grid's scroll container (capped at 82vh) PLUS the probability
    // legend, which sits inside gridsRef. The non-row chrome is, at zoom 100:
    //   top:    pt-4 (16) + X-axis title (~19) + sticky layer header (~37) ≈ 72
    //   bottom: layer-number row (~29) + bottom axis title (~23) + pb-4 (16) ≈ 68
    //   legend: ~30 (below the scroll container, inside the card)
    // The old code folded all of this into `padding = 40`, badly undercounting
    // it — so auto-fit thought more rows fit than the 82vh container could show
    // and clipped the final row (bug B1). Rounded up slightly for slack so the
    // last row never clips at the cost of occasionally one fewer row.
    const vChrome = 180;

    // In single-prompt mode only ONE grid renders, so it gets the full wrapper
    // width — don't halve it. Halving here was the bug that capped a lone grid
    // at ~4 layers when ~11 would fit (the two-grid split was applied even with
    // no target grid present).
    const perGridWidth = isSinglePromptMode
      ? gridsSize.width
      : (gridsSize.width - interGridGap) / 2;
    const layersThatFit = Math.max(
      1,
      Math.floor((perGridWidth - tokenColWidth - padding) / colFootprint),
    );
    const tokensThatFit = Math.max(
      1,
      Math.floor((gridsSize.height - vChrome) / rowFootprint),
    );

    return {
      layerStep: Math.max(1, Math.ceil(numLayers / layersThatFit)),
      // Token rows are never downsampled: with compact rows we always show every
      // token (rows scroll if they overflow). Token-step downsampling read as a
      // confusing extra concept, so it's fixed at 1 (tokensThatFit is unused now
      // but kept for the layer-fit vertical-budget reasoning above).
      tokenStep: 1,
    };
  }, [
    gridsSize,
    isSinglePromptMode,
    sourcePrompt.data.tokens.length,
    sourcePrompt.data.layers.length,
    targetPrompt.data.tokens.length,
    targetPrompt.data.layers.length,
  ]);

  // While auto-fit is on, drive the shared steps from the computed values.
  useEffect(() => {
    if (!autoFit) return;
    setTokenStep(autoStep.tokenStep);
    setLayerStep(autoStep.layerStep);
  }, [autoFit, autoStep.tokenStep, autoStep.layerStep]);

  const handleLayerStepChange = (step: number) => {
    setAutoFit(false);
    setLayerStep(step);
    onEvent?.({ type: 'layer_step_change', step });
  };

  const countVisible = (total: number, step: number) => {
    let n = 0;
    for (let i = 0; i < total; i++) {
      if (i % step === 0 || i === total - 1) n++;
    }
    return n;
  };

  const sourceVisibleTokens = countVisible(sourcePrompt.data.tokens.length, tokenStep);
  const sourceVisibleLayers = countVisible(sourcePrompt.data.layers.length, layerStep);
  const targetVisibleTokens = countVisible(targetPrompt.data.tokens.length, tokenStep);
  const targetVisibleLayers = countVisible(targetPrompt.data.layers.length, layerStep);
  const toolbarSummary = `Source: ${sourceVisibleTokens} tok × ${sourceVisibleLayers} layers | Target: ${targetVisibleTokens} tok × ${targetVisibleLayers} layers`;

  // Reset intervention/selection state only when the *content* of the prompts
  // actually changes (user edited the prompt text). Keying on the object
  // identity of `sourcePrompt`/`targetPrompt` would make this effect fire on
  // every parent re-reference — e.g. when a downstream query refetch hands
  // back a new `sourceData` reference with identical tokens — which would
  // clobber an in-flight intervention right after it resolved.
  const promptsKey = JSON.stringify([
    sourcePrompt.data.tokens,
    targetPrompt.data.tokens,
  ]);

  useEffect(() => {
    setInternalIntervention(null);
    setInternalResultData(null);
    setSelectedCell(null);
    setResultSelectedCell(null);
  }, [promptsKey]);

  const handleDrop = (item: any, targetTokenPos: number, targetLayer: number) => {
    const newIntervention: Intervention = {
      sourcePromptId: item.promptId,
      targetPromptId: targetPrompt.id,
      sourceLayer: item.layer,
      sourceTokenPosition: item.tokenPosition,
      targetLayer,
      targetTokenPosition: targetTokenPos,
    };

    setInternalIntervention(newIntervention);

    if (onIntervention) {
      // Controlled path: parent owns the real result.
      const maybePromise = onIntervention(newIntervention);
      if (maybePromise && typeof (maybePromise as Promise<LogitLensData | null>).then === 'function') {
        (maybePromise as Promise<LogitLensData | null>).then((resolved) => {
          // If parent resolves with real data, populate internal state.
          // If null/undefined, parent is driving via the `resultData` prop — no-op.
          if (resolved) {
            setInternalResultData(resolved);
          }
        });
      }
      return;
    }

    // Uncontrolled path: use the built-in mock result generator.
    const result = generateInterventionResult(
      sourcePrompt.data,
      targetPrompt.data,
      item.tokenPosition,
      item.layer,
      targetTokenPos,
      targetLayer,
    );
    setInternalResultData(result);
  };

  const handleReset = () => {
    setInternalIntervention(null);
    // Ask a controlling parent to drop its persisted spec too; otherwise the
    // `intervention` prop would immediately re-supply the patch we just cleared.
    onResetIntervention?.();
    setInternalResultData(null);
    setSelectedCell(null);
    setResultSelectedCell(null);
  };

  // Reference tokens for the top-k lists' "final prediction" markers: the
  // top-1 at the final layer of the clicked row, and the top-1 at the final
  // layer of the last position (the model's actual output).
  const finalTokensFor = (data: LogitLensData, tokenPosition: number) => {
    const lastLayerIdx = data.layers.length - 1;
    return {
      rowFinalToken: data.data[tokenPosition]?.[lastLayerIdx]?.token,
      gridFinalToken: data.data[data.data.length - 1]?.[lastLayerIdx]?.token,
    };
  };

  const handleCellClick = (promptId: string, tokenPosition: number, layer: number) => {
    let data: LogitLensData | null = null;

    if (promptId === sourcePrompt.id) {
      data = sourcePrompt.data;
    } else if (promptId === targetPrompt.id) {
      data = targetPrompt.data;
    } else if (promptId === 'result' && resultData) {
      data = resultData;
    }

    if (!data) return;
    const layerIdx = data.layers.indexOf(layer);
    const cell = data.data[tokenPosition]?.[layerIdx];
    if (!cell) return;

    setSelectedCell({
      tokenPosition,
      layer,
      topTokens: cell.topTokens,
      promptId,
      ...finalTokensFor(data, tokenPosition),
    });
    onEvent?.({ type: 'cell_click', promptId, tokenPosition, layer });
  };

  const handleResultCellClick = (tokenPosition: number, layer: number) => {
    if (!resultData) return;
    const layerIdx = resultData.layers.indexOf(layer);
    const cell = resultData.data[tokenPosition]?.[layerIdx];
    if (!cell) return;

    setResultSelectedCell({
      tokenPosition,
      layer,
      topTokens: cell.topTokens,
      promptId: 'result',
      ...finalTokensFor(resultData, tokenPosition),
    });
    onEvent?.({ type: 'result_cell_click', tokenPosition, layer });
  };

  // Auto-select last token / last layer of the result prompt
  useEffect(() => {
    if (!resultData) return;
    const lastTokenIdx = resultData.data.length - 1;
    const lastLayer = resultData.layers[resultData.layers.length - 1];
    const lastLayerIdx = resultData.layers.length - 1;
    const lastCell = resultData.data[lastTokenIdx]?.[lastLayerIdx];
    if (lastCell) {
      setResultSelectedCell({
        tokenPosition: lastTokenIdx,
        layer: lastLayer,
        topTokens: lastCell.topTokens,
        promptId: 'result',
        rowFinalToken: lastCell.token,
        gridFinalToken: lastCell.token,
      });
    }
  }, [resultData]);

  // Report the post-patch output token to a host scoring an activity against
  // the patch. Emit on every distinct grid-final token (last position, final
  // layer) — covers the null->result transition and a re-patch that changes the
  // outcome without an intervening reset; skips duplicate emits for the same
  // token, and clears the memo on reset so an identical token re-emits later.
  const lastEmittedResultTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resultData) {
      lastEmittedResultTokenRef.current = null;
      return;
    }
    const lastTokenIdx = resultData.data.length - 1;
    const lastLayerIdx = resultData.layers.length - 1;
    const token = resultData.data[lastTokenIdx]?.[lastLayerIdx]?.token ?? null;
    if (token !== lastEmittedResultTokenRef.current) {
      lastEmittedResultTokenRef.current = token;
      onInterventionResult?.(token);
    }
  }, [resultData, onInterventionResult]);

  // Once the intervention result is ready, bring it into view — it mounts
  // below the two source/target grids, past the fold, and pilot users didn't
  // notice it appear. Only queued on the null -> data transition so manual
  // scrolling afterwards isn't hijacked by refetches.
  const resultContainerRef = useRef<HTMLDivElement>(null);
  const pendingResultScrollRef = useRef(false);
  const hadResultRef = useRef(false);
  useEffect(() => {
    const hasResult = !!resultData;
    if (hasResult && !hadResultRef.current) pendingResultScrollRef.current = true;
    hadResultRef.current = hasResult;
  }, [resultData]);

  // Fire the queued scroll only after layout has settled. On a restored patch
  // the result exists at MOUNT, when auto-fit hasn't measured the wrapper or
  // applied its derived steps yet — scrolling then lands on a position that
  // the following relayout invalidates. Waiting until the applied steps match
  // the auto-fit target (or auto-fit is off) scrolls to the final geometry.
  // A live drag has settled layout already, so it scrolls immediately.
  const stepsSettled =
    !autoFit ||
    (!!gridsSize && tokenStep === autoStep.tokenStep && layerStep === autoStep.layerStep);
  useEffect(() => {
    if (!pendingResultScrollRef.current || !resultData || !stepsSettled) return;
    pendingResultScrollRef.current = false;
    requestAnimationFrame(() => {
      resultContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [resultData, stepsSettled]);

  const resultPromptInput = useMemo<PromptInput | null>(
    () =>
      resultData
        ? {
            id: 'result',
            name: 'Result (Intervened)',
            color: targetPrompt.color,
            data: resultData,
          }
        : null,
    [resultData, targetPrompt.color],
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-4">
        <div className="max-w-[1400px] mx-auto space-y-3">
          {/* Shared toolbar for both grids */}
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <HeatmapToolbar
              zoom={zoom}
              onZoomChange={setZoom}
              layerStep={layerStep}
              onLayerStepChange={handleLayerStepChange}
              summary={toolbarSummary}
              syncScroll={syncScroll}
              onSyncScrollChange={setSyncScroll}
            />
          </div>

          {/* Side-by-side prompts (single column when in single-prompt mode). */}
          <div
            ref={gridsRef}
            style={{
              display: 'grid',
              gridTemplateColumns: isSinglePromptMode
                ? 'minmax(0, 1fr)'
                : 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '1.5rem',
            }}
          >
            <div className="min-w-0 w-full">
              <HeatmapGrid
                prompt={sourcePrompt}
                zoom={zoom}
                tokenStep={tokenStep}
                layerStep={layerStep}
                highlightCell={
                  intervention
                    ? {
                        tokenPosition: intervention.sourceTokenPosition,
                        layer: intervention.sourceLayer,
                      }
                    : undefined
                }
                spotlightCells={resolveSpotlights('source', sourcePrompt.data)}
                selectedCell={selectedCell}
                onCellClick={(tokenPos, layer) =>
                  handleCellClick(sourcePrompt.id, tokenPos, layer)
                }
                onHighlightRefChange={setSourceHighlightRef}
                onScroll={syncScroll && !isSinglePromptMode ? setScrollState : undefined}
                scrollState={syncScroll && !isSinglePromptMode ? scrollState : undefined}
                isSourceDraggable={!isSinglePromptMode}
              />
            </div>

            {!isSinglePromptMode && (
            <div className="min-w-0 w-full">
              <HeatmapGrid
                prompt={targetPrompt}
                zoom={zoom}
                tokenStep={tokenStep}
                layerStep={layerStep}
                isDropTarget={true}
                onDrop={handleDrop}
                highlightCell={
                  intervention
                    ? {
                        tokenPosition: intervention.targetTokenPosition,
                        layer: intervention.targetLayer,
                      }
                    : undefined
                }
                spotlightCells={resolveSpotlights('target', targetPrompt.data)}
                selectedCell={selectedCell}
                onCellClick={(tokenPos, layer) =>
                  handleCellClick(targetPrompt.id, tokenPos, layer)
                }
                onHighlightRefChange={setTargetHighlightRef}
                onScroll={syncScroll ? setScrollState : undefined}
                scrollState={syncScroll ? scrollState : undefined}
              />
            </div>
            )}
          </div>

          {intervention && sourceHighlightRef && targetHighlightRef && (
            <CurvedPatchArrow
              sourceRef={sourceHighlightRef}
              targetRef={targetHighlightRef}
              sourceColor={sourcePrompt.color}
              targetColor={targetPrompt.color}
              blendedColor={THEME.blendColor}
            />
          )}

          <AnimatePresence>
            {resultPromptInput && intervention && (
              <motion.div
                ref={resultContainerRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="relative mt-8 min-w-0"
              >
                <div className="pt-4 flex flex-col items-center gap-3">
                  <button
                    onClick={handleReset}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#1f2937',
                      color: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background-color 150ms, box-shadow 150ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#374151';
                      e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#1f2937';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Intervention
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: sourcePrompt.color,
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                        }}
                      />
                      [{formatTokenDisplay(sourcePrompt.data.tokens[intervention.sourceTokenPosition] ?? '')}, Layer {intervention.sourceLayer}]
                    </span>
                    <span style={{ fontSize: 18, color: '#6b7280' }}>&rarr;</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: targetPrompt.color,
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                        }}
                      />
                      [{formatTokenDisplay(targetPrompt.data.tokens[intervention.targetTokenPosition] ?? '')}, Layer {intervention.targetLayer}]
                    </span>
                  </div>

                  <div className="w-full">
                    <HeatmapGrid
                      prompt={resultPromptInput}
                      zoom={zoom}
                      tokenStep={tokenStep}
                      layerStep={layerStep}
                      highlightCell={{
                        tokenPosition: intervention.targetTokenPosition,
                        layer: intervention.targetLayer,
                      }}
                      spotlightCells={resolveSpotlights('result', resultPromptInput.data)}
                      selectedCell={resultSelectedCell}
                      onCellClick={handleResultCellClick}
                      isResult={true}
                      blendColor={THEME.blendColor}
                      interventionCell={{
                        tokenPosition: intervention.targetTokenPosition,
                        layer: intervention.targetLayer,
                        sourceColor: sourcePrompt.color,
                      }}
                      showSidebar={true}
                      sidebarContent={<ResultSidebar selectedCell={resultSelectedCell} />}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading state: parent is running a backend call for the intervention. */}
          {isInterventionPending && intervention && !resultData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-8 flex items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-white/50"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Computing intervention&hellip;</p>
              </div>
            </motion.div>
          )}

          {!isSinglePromptMode && !resultPromptInput && !(isInterventionPending && intervention) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-500 py-3 border-2 border-dashed border-gray-300 rounded-xl bg-white/50"
            >
              <p className="text-sm">
                Drag a cell from the{' '}
                <strong style={{ color: sourcePrompt.color }}>Source Prompt</strong> onto a cell in the{' '}
                <strong style={{ color: targetPrompt.color }}>Target Prompt</strong>, or click any cell to view its top token predictions.
              </p>
            </motion.div>
          )}
          {isSinglePromptMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-500 py-3 border-2 border-dashed border-gray-300 rounded-xl bg-white/50"
            >
              <p className="text-sm">
                Click any cell to view its top token predictions. Add a target
                prompt above to enable drag-and-drop patching.
              </p>
            </motion.div>
          )}
        </div>

        <TokenPredictionPanel
          selectedCell={selectedCell}
          onClose={() => setSelectedCell(null)}
          highlightColor={
            selectedCell?.promptId === targetPrompt.id
              ? targetPrompt.color
              : selectedCell?.promptId === 'result'
                ? targetPrompt.color
                : sourcePrompt.color
          }
        />
      </div>
    </DndProvider>
  );
}
