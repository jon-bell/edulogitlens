import { useState, useEffect, useMemo, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HeatmapGrid } from './components/HeatmapGrid';
import { HeatmapToolbar } from './components/HeatmapToolbar';
import { TokenPredictionPanel } from './components/TokenPredictionPanel';
import { ResultSidebar } from './components/ResultSidebar';
import { CurvedPatchArrow } from './components/CurvedPatchArrow';
import { PromptInput, Intervention, SelectedCell } from './types';
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
  isInterventionPending?: boolean;
}

export function CausalMediationExplorer({
  sourcePromptText = 'The Eiffel Tower is in France',
  targetPromptText = 'The Big Ben is in England',
  sourceData,
  targetData,
  onIntervention,
  resultData: controlledResultData,
  isInterventionPending = false,
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

  const targetPrompt = useMemo<PromptInput>(
    () => ({
      id: 'target',
      name: 'Target Prompt',
      color: THEME.targetColor,
      data: targetData ?? createMockLogitLensData(targetPromptText, 'target'),
    }),
    [targetData, targetPromptText],
  );

  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [internalResultData, setInternalResultData] = useState<LogitLensData | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [resultSelectedCell, setResultSelectedCell] = useState<SelectedCell | null>(null);
  const [sourceHighlightRef, setSourceHighlightRef] = useState<HTMLElement | null>(null);
  const [targetHighlightRef, setTargetHighlightRef] = useState<HTMLElement | null>(null);

  // When the parent passes `resultData` (controlled), it is the source of truth.
  //   - non-null LogitLensData: render it
  //   - null:                   render nothing (parent explicitly cleared)
  //   - undefined:              fall back to internal state (uncontrolled)
  const isResultControlled = controlledResultData !== undefined;
  const resultData: LogitLensData | null = isResultControlled
    ? controlledResultData ?? null
    : internalResultData;

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
    const rowFootprint = 48 + 16; // BASE_CELL_HEIGHT + BASE_VERT_ARROW_HEIGHT
    const tokenColWidth = 80; // BASE_TOKEN_COL_WIDTH
    const interGridGap = 24; // gap-1.5rem between the two grids
    const padding = 40; // card padding + axis/legend rows

    const perGridWidth = (gridsSize.width - interGridGap) / 2;
    const layersThatFit = Math.max(
      1,
      Math.floor((perGridWidth - tokenColWidth - padding) / colFootprint),
    );
    const tokensThatFit = Math.max(
      1,
      Math.floor((gridsSize.height - padding) / rowFootprint),
    );

    return {
      layerStep: Math.max(1, Math.ceil(numLayers / layersThatFit)),
      tokenStep: Math.max(1, Math.ceil(numTokens / tokensThatFit)),
    };
  }, [
    gridsSize,
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

  const handleTokenStepChange = (step: number) => {
    setAutoFit(false);
    setTokenStep(step);
  };
  const handleLayerStepChange = (step: number) => {
    setAutoFit(false);
    setLayerStep(step);
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
    setIntervention(null);
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

    setIntervention(newIntervention);

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
    setIntervention(null);
    // Reset is UI-only: just clear internal state. Parent-controlled `resultData`
    // is not touched here (parent can observe intervention via onIntervention if needed).
    setInternalResultData(null);
    setSelectedCell(null);
    setResultSelectedCell(null);
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
    });
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
    });
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
      });
    }
  }, [resultData]);

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
              tokenStep={tokenStep}
              onTokenStepChange={handleTokenStepChange}
              layerStep={layerStep}
              onLayerStepChange={handleLayerStepChange}
              summary={toolbarSummary}
              syncScroll={syncScroll}
              onSyncScrollChange={setSyncScroll}
            />
          </div>

          {/* Side-by-side prompts */}
          <div
            ref={gridsRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
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
                selectedCell={selectedCell}
                onCellClick={(tokenPos, layer) =>
                  handleCellClick(sourcePrompt.id, tokenPos, layer)
                }
                onHighlightRefChange={setSourceHighlightRef}
                onScroll={syncScroll ? setScrollState : undefined}
                scrollState={syncScroll ? scrollState : undefined}
              />
            </div>

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
                selectedCell={selectedCell}
                onCellClick={(tokenPos, layer) =>
                  handleCellClick(targetPrompt.id, tokenPos, layer)
                }
                onHighlightRefChange={setTargetHighlightRef}
                onScroll={syncScroll ? setScrollState : undefined}
                scrollState={syncScroll ? scrollState : undefined}
              />
            </div>
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
                      [{sourcePrompt.data.tokens[intervention.sourceTokenPosition]}, Layer {intervention.sourceLayer}]
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
                      [{targetPrompt.data.tokens[intervention.targetTokenPosition]}, Layer {intervention.targetLayer}]
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

          {!resultPromptInput && !(isInterventionPending && intervention) && (
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
        </div>

        <TokenPredictionPanel
          selectedCell={selectedCell}
          onClose={() => setSelectedCell(null)}
        />
      </div>
    </DndProvider>
  );
}
