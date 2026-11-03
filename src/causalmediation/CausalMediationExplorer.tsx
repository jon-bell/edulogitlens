import { useState, useEffect, useMemo, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HeatmapGrid } from './components/HeatmapGrid';
import { HeatmapToolbar } from './components/HeatmapToolbar';
import { TokenPredictionPanel } from './components/TokenPredictionPanel';
import { CurvedPatchArrow } from './components/CurvedPatchArrow';
import { PatchControls } from './components/PatchControls';
import { PromptInput, Intervention, SelectedCell, CausalMediationEvent } from './types';
import { useSpotlight } from './SpotlightContext';
import type { LogitLensData } from '../LogitLensGrid';
import { createMockLogitLensData, generateInterventionResult } from './utils/mockData';

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
  // last-position, final-layer output of the patched run — whenever a patch
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
  const [showPatched, setShowPatched] = useState(true);
  const [sourceHighlightRef, setSourceHighlightRef] = useState<HTMLElement | null>(null);
  const [targetHighlightRef, setTargetHighlightRef] = useState<HTMLElement | null>(null);

  // Guided-tutorial "Show me" spotlight (opt-in via SpotlightProvider). Resolve
  // the requested {grid, layer, position} cells against a grid's data, turning
  // `'last'` into concrete indices; keeps only the cells addressed to that grid,
  // so each HeatmapGrid rings its own. Several cells can be lit at once — a
  // patching hint lights both ends of the drag.
  // A spotlight with no `position` names a layer only: the column is forced into
  // view but no cell is ringed, so `tokenPosition` is null downstream.
  const { targets: spotlights } = useSpotlight();
  const resolveSpotlights = (
    grid: 'source' | 'target' | 'result',
    data: LogitLensData,
  ): { tokenPosition: number | null; layer: number }[] => {
    if (!data.tokens.length || !data.layers.length) return [];
    const lastLayer = data.layers[data.layers.length - 1];
    const lastPos = data.tokens.length - 1;
    return spotlights
      .filter((s) => s.grid === grid)
      .map((s) => ({
        tokenPosition:
          s.position == null ? null : s.position === 'last' ? lastPos : s.position,
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
  // While a drag's patch computes, that drag's spec wins: a controlling parent
  // still holds the previous patch until the new one is persisted.
  const isInterventionControlled = controlledIntervention !== undefined;
  const intervention =
    isInterventionPending && internalIntervention
      ? internalIntervention
      : isInterventionControlled
        ? controlledIntervention
        : internalIntervention;

  // The patched run is drawn on the target grid in place of the original one.
  // Held back while a patch computes: `resultData` may still be the last patch's.
  const patchedData = intervention && resultData && !isInterventionPending ? resultData : null;
  const isShowingPatched = !!patchedData && showPatched;
  const targetView = useMemo<PromptInput>(
    () =>
      isShowingPatched && patchedData
        ? { ...targetPrompt, name: 'Target Prompt (patched)', data: patchedData }
        : targetPrompt,
    [isShowingPatched, patchedData, targetPrompt],
  );

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

  // How many columns/rows a grid actually renders at a given step. Mirrors
  // HeatmapGrid's display filter: every step'th index, plus the last one always.
  // Declared before auto-fit because auto-fit now budgets in rendered columns.
  const countVisible = (total: number, step: number) => {
    let n = 0;
    for (let i = 0; i < total; i++) {
      if (i % step === 0 || i === total - 1) n++;
    }
    return n;
  };

  // Layer INDICES each grid is forced to render because a spotlight names them.
  // Auto-fit has to know about these before it picks a step: HeatmapGrid renders
  // a spotlit layer on TOP of the downsampled set, so a step chosen as if the
  // spotlight didn't exist overflows the scroll container by exactly the forced
  // columns — and a forced-but-clipped column is worse than no column at all,
  // since the tutorial then points at something off screen.
  const spotlitLayerIndicesPerGrid = useMemo(() => {
    const idxsFor = (grid: 'source' | 'target' | 'result', data: LogitLensData) =>
      resolveSpotlights(grid, data)
        .map((s) => data.layers.indexOf(s.layer))
        .filter((i) => i >= 0);
    return [
      idxsFor('source', sourcePrompt.data),
      isSinglePromptMode
        ? []
        : [
            ...idxsFor('target', targetView.data),
            ...(isShowingPatched ? idxsFor('result', targetView.data) : []),
          ],
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlights, sourcePrompt.data, targetView.data, isShowingPatched, isSinglePromptMode]);

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
    //   bottom: pb-4 (16)
    //   legend: ~30 (below the scroll container, inside the card)
    // The old code folded all of this into `padding = 40`, badly undercounting
    // it — so auto-fit thought more rows fit than the 82vh container could show
    // and clipped the final row (bug B1). Rounded up slightly for slack so the
    // last row never clips at the cost of occasionally one fewer row.
    const vChrome = 130;

    // In single-prompt mode only ONE grid renders, so it gets the full wrapper
    // width — don't halve it. Halving here was the bug that capped a lone grid
    // at ~4 layers when ~11 would fit (the two-grid split was applied even with
    // no target grid present).
    const perGridWidth = isSinglePromptMode
      ? gridsSize.width
      : (gridsSize.width - interGridGap) / 2;
    const colsThatFit = Math.max(
      1,
      Math.floor((perGridWidth - tokenColWidth - padding) / colFootprint),
    );

    // Budget in RENDERED columns, not in sampled ones. The two differ: the last
    // layer is always drawn on top of the sampled set, so the un-spotlit grid has
    // always rendered colsThatFit + 1 columns and the layout is tuned to that.
    // Taking the un-spotlit column count as the budget keeps the no-spotlight
    // case byte-identical while giving the spotlight a ceiling to respect.
    const columnBudget = countVisible(numLayers, Math.max(1, Math.ceil(numLayers / colsThatFit)));

    // Distinct spotlit columns a step does NOT already render, worst grid first:
    // layerStep is shared, so the pair stays aligned only if it is chosen for
    // whichever grid pays the most for its spotlights.
    const forcedColumns = (step: number) =>
      Math.max(
        0,
        ...spotlitLayerIndicesPerGrid.map(
          (idxs) => new Set(idxs.filter((i) => i % step !== 0 && i !== numLayers - 1)).size,
        ),
      );

    // Spend the budget on the densest step whose FULL column set — sampled plus
    // forced — still fits. Walked from dense to coarse rather than solved
    // directly, because the cost of a spotlight isn't monotonic in the step: a
    // coarser step can pull a forced column back into the sampled set for free
    // (layer 20 costs nothing at step 10, one column at step 16). Falls through
    // to 1 when nothing fits, which is not a failure — at a tutorial-dock width
    // the budget is a single column and first + forced + last genuinely cannot
    // fit. HeatmapGrid scrolls the forced column into view for that case.
    let layersThatFit = 1;
    for (let b = colsThatFit; b >= 1; b--) {
      const step = Math.max(1, Math.ceil(numLayers / b));
      if (countVisible(numLayers, step) + forcedColumns(step) <= columnBudget) {
        layersThatFit = b;
        break;
      }
    }
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
    spotlitLayerIndicesPerGrid,
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
  }, [promptsKey]);

  // Every new patch opens on its patched view.
  const interventionKey = JSON.stringify(intervention ?? null);
  useEffect(() => {
    setShowPatched(true);
  }, [interventionKey]);

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
    const data =
      promptId === sourcePrompt.id
        ? sourcePrompt.data
        : promptId === targetPrompt.id
          ? targetView.data
          : null;
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
    onEvent?.(
      promptId === targetPrompt.id && isShowingPatched
        ? { type: 'result_cell_click', tokenPosition, layer }
        : { type: 'cell_click', promptId, tokenPosition, layer },
    );
  };

  // A target selection follows the patched/original switch, so its top-k list
  // always matches the run the target grid is showing.
  const shownSelectedCell = useMemo<SelectedCell | null>(() => {
    if (!selectedCell || selectedCell.promptId !== targetPrompt.id) return selectedCell;
    const data = targetView.data;
    const cell = data.data[selectedCell.tokenPosition]?.[data.layers.indexOf(selectedCell.layer)];
    if (!cell) return null;
    return {
      ...selectedCell,
      topTokens: cell.topTokens,
      ...finalTokensFor(data, selectedCell.tokenPosition),
    };
  }, [selectedCell, targetPrompt.id, targetView.data]);

  // Report the post-patch output token to a host scoring an activity against
  // the patch. Emit on every distinct grid-final token (last position, final
  // layer) — covers the null->result transition and a re-patch that changes the
  // outcome without an intervening reset; skips duplicate emits for the same
  // token, and clears the memo on reset so an identical token re-emits later.
  // Tracks the patch, not the switch: viewing the original run keeps the patch.
  const lastEmittedResultTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!patchedData) {
      // Report the disappearance, not just the arrival. A host that announces the
      // patch outcome ("the target now predicts X") has no other way to learn the
      // patch is gone — e.g. it was discarded, or a fresh lens run replaced the
      // patched run as the active one — and would keep describing a stale result.
      if (lastEmittedResultTokenRef.current !== null) onInterventionResult?.(null);
      lastEmittedResultTokenRef.current = null;
      return;
    }
    const lastTokenIdx = patchedData.data.length - 1;
    const lastLayerIdx = patchedData.layers.length - 1;
    const token = patchedData.data[lastTokenIdx]?.[lastLayerIdx]?.token ?? null;
    if (token !== lastEmittedResultTokenRef.current) {
      lastEmittedResultTokenRef.current = token;
      onInterventionResult?.(token);
    }
  }, [patchedData, onInterventionResult]);

  const targetSpotlights = isSinglePromptMode
    ? []
    : [
        ...resolveSpotlights('target', targetView.data),
        ...(isShowingPatched ? resolveSpotlights('result', targetView.data) : []),
      ];

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
              syncScroll={syncScroll}
              onSyncScrollChange={setSyncScroll}
            >
              <PatchControls
                isSinglePromptMode={isSinglePromptMode}
                intervention={intervention}
                sourceToken={
                  intervention
                    ? sourcePrompt.data.tokens[intervention.sourceTokenPosition] ?? ''
                    : ''
                }
                targetToken={
                  intervention
                    ? targetPrompt.data.tokens[intervention.targetTokenPosition] ?? ''
                    : ''
                }
                sourceColor={sourcePrompt.color}
                targetColor={targetPrompt.color}
                blendColor={THEME.blendColor}
                isPending={isInterventionPending && !!intervention}
                hasResult={!!patchedData}
                showPatched={showPatched}
                onShowPatchedChange={setShowPatched}
                onDiscard={handleReset}
              />
            </HeatmapToolbar>
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
                selectedCell={shownSelectedCell}
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
                prompt={targetView}
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
                isResult={isShowingPatched}
                blendColor={THEME.blendColor}
                interventionCell={
                  isShowingPatched && intervention
                    ? {
                        tokenPosition: intervention.targetTokenPosition,
                        layer: intervention.targetLayer,
                        sourceColor: sourcePrompt.color,
                      }
                    : undefined
                }
                spotlightCells={targetSpotlights}
                selectedCell={shownSelectedCell}
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
        </div>

        <TokenPredictionPanel
          selectedCell={shownSelectedCell}
          onClose={() => setSelectedCell(null)}
          highlightColor={
            shownSelectedCell?.promptId === targetPrompt.id
              ? targetPrompt.color
              : sourcePrompt.color
          }
        />
      </div>
    </DndProvider>
  );
}
