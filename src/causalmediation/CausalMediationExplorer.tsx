import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HeatmapGrid } from './components/HeatmapGrid';
import { TokenPredictionPanel } from './components/TokenPredictionPanel';
import { ResultSidebar } from './components/ResultSidebar';
import { CurvedPatchArrow } from './components/CurvedPatchArrow';
import { PromptData, Intervention, SelectedCell } from './types';
import { createMockPromptData, generateInterventionResult } from './utils/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw } from 'lucide-react';

export function CausalMediationExplorer() {
  const [sourcePrompt] = useState<PromptData>(
    createMockPromptData(
      'source',
      'Source Prompt',
      'The Eiffel Tower is in France',
      '#06b6d4',
      'source'
    )
  );

  const [originalPrompt] = useState<PromptData>(
    createMockPromptData(
      'original',
      'Original Prompt',
      'The Big Ben is in England',
      '#ec4899',
      'original'
    )
  );

  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [resultPrompt, setResultPrompt] = useState<PromptData | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [resultSelectedCell, setResultSelectedCell] = useState<SelectedCell | null>(null);
  const [sourceHighlightRef, setSourceHighlightRef] = useState<HTMLElement | null>(null);
  const [targetHighlightRef, setTargetHighlightRef] = useState<HTMLElement | null>(null);

  const handleDrop = (item: any, targetTokenPos: number, targetLayer: number) => {
    const newIntervention: Intervention = {
      sourcePromptId: item.promptId,
      targetPromptId: originalPrompt.id,
      sourceLayer: item.layer,
      sourceTokenPosition: item.tokenPosition,
      targetLayer,
      targetTokenPosition: targetTokenPos,
    };

    setIntervention(newIntervention);

    const result = generateInterventionResult(
      originalPrompt,
      item.tokenPosition,
      item.layer,
      targetTokenPos,
      targetLayer
    );

    setResultPrompt(result);
  };

  const handleReset = () => {
    setIntervention(null);
    setResultPrompt(null);
    setSelectedCell(null);
    setResultSelectedCell(null);
  };

  const handleCellClick = (promptId: string, tokenPosition: number, layer: number) => {
    let prompt: PromptData | null = null;

    if (promptId === sourcePrompt.id) {
      prompt = sourcePrompt;
    } else if (promptId === originalPrompt.id) {
      prompt = originalPrompt;
    } else if (promptId === 'result' && resultPrompt) {
      prompt = resultPrompt;
    }

    if (prompt) {
      const cell = prompt.heatmapData[tokenPosition]?.find(c => c.layer === layer);
      if (cell) {
        setSelectedCell({
          tokenPosition,
          layer,
          topTokens: cell.topTokens,
          promptId,
        });
      }
    }
  };

  const handleResultCellClick = (tokenPosition: number, layer: number) => {
    if (resultPrompt) {
      const cell = resultPrompt.heatmapData[tokenPosition]?.find(c => c.layer === layer);
      if (cell) {
        setResultSelectedCell({
          tokenPosition,
          layer,
          topTokens: cell.topTokens,
          promptId: 'result',
        });
      }
    }
  };

  useEffect(() => {
    if (resultPrompt) {
      const lastTokenIdx = resultPrompt.heatmapData.length - 1;
      const lastTokenRow = resultPrompt.heatmapData[lastTokenIdx];
      const lastLayer = resultPrompt.layers[resultPrompt.layers.length - 1].layer;
      const lastCell = lastTokenRow.find(c => c.layer === lastLayer);

      if (lastCell) {
        setResultSelectedCell({
          tokenPosition: lastTokenIdx,
          layer: lastLayer,
          topTokens: lastCell.topTokens,
          promptId: 'result',
        });
      }
    }
  }, [resultPrompt]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-8">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">
              Causal Mediation Explorer
            </h1>
            <p className="text-lg text-gray-600">
              Interactive heatmap visualization of mechanistic interpretability
            </p>
          </div>

          {/* Side-by-side prompts */}
          <div className="grid grid-cols-2 gap-6">
            <HeatmapGrid
              prompt={sourcePrompt}
              highlightCell={
                intervention
                  ? { tokenPosition: intervention.sourceTokenPosition, layer: intervention.sourceLayer }
                  : undefined
              }
              selectedCell={selectedCell}
              onCellClick={(tokenPos, layer) => handleCellClick(sourcePrompt.id, tokenPos, layer)}
              onHighlightRefChange={setSourceHighlightRef}
            />

            <HeatmapGrid
              prompt={originalPrompt}
              isDropTarget={true}
              onDrop={handleDrop}
              highlightCell={
                intervention
                  ? { tokenPosition: intervention.targetTokenPosition, layer: intervention.targetLayer }
                  : undefined
              }
              selectedCell={selectedCell}
              onCellClick={(tokenPos, layer) => handleCellClick(originalPrompt.id, tokenPos, layer)}
              onHighlightRefChange={setTargetHighlightRef}
            />
          </div>

          {/* Curved Patch Arrow */}
          {intervention && sourceHighlightRef && targetHighlightRef && (
            <CurvedPatchArrow
              sourceRef={sourceHighlightRef}
              targetRef={targetHighlightRef}
              sourceColor={sourcePrompt.color}
              targetColor={originalPrompt.color}
              blendedColor="#9333ea"
            />
          )}

          {/* Result Diagram */}
          <AnimatePresence>
            {resultPrompt && intervention && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="relative mt-8"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Intervention
                  </button>
                </div>

                <div className="pt-8">
                  <div className="mb-4 text-center">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold shadow-lg">
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-300" />
                        [{intervention.sourceTokenPosition}, L{intervention.sourceLayer}]
                      </span>
                      <span className="text-2xl">&rarr;</span>
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-pink-300" />
                        [{intervention.targetTokenPosition}, L{intervention.targetLayer}]
                      </span>
                      <span className="text-2xl">=</span>
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-purple-300" />
                        Blended
                      </span>
                    </div>
                  </div>

                  <HeatmapGrid
                    prompt={resultPrompt}
                    highlightCell={{
                      tokenPosition: intervention.targetTokenPosition,
                      layer: intervention.targetLayer,
                    }}
                    selectedCell={resultSelectedCell}
                    onCellClick={handleResultCellClick}
                    isResult={true}
                    blendColor="#9333ea"
                    interventionCell={{
                      tokenPosition: intervention.targetTokenPosition,
                      layer: intervention.targetLayer,
                      sourceColor: sourcePrompt.color,
                    }}
                    showSidebar={true}
                    sidebarContent={<ResultSidebar selectedCell={resultSelectedCell} />}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instructions */}
          {!resultPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-xl bg-white/50"
            >
              <p className="text-lg">
                Drag a cell from the <strong className="text-cyan-600">Source Prompt</strong> heatmap
                and drop it onto a cell in the <strong className="text-pink-600">Original Prompt</strong>
              </p>
              <p className="mt-2">
                Click any cell to view its top token predictions
              </p>
            </motion.div>
          )}
        </div>

        {/* Token Prediction Panel */}
        <TokenPredictionPanel
          selectedCell={selectedCell}
          onClose={() => setSelectedCell(null)}
        />
      </div>
    </DndProvider>
  );
}
