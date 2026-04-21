import { PromptData, Token, LayerState, CellData } from '../types';

// Vocabulary for predictions
const sourceVocab = ['The', 'Tower', 'Eiffel', 'Paris', 'France', 'built', 'tall', 'is', 'in', 'of'];
const originalVocab = ['The', 'Tower', 'London', 'Big', 'England', 'Ben', 'built', 'is', 'in', 'clock'];

// Generate mock top tokens for a specific cell
const generateCellTopTokens = (
  tokenPos: number, 
  layer: number, 
  vocab: string[]
): Token[] => {
  const seed = tokenPos * 100 + layer;
  const predictions: Token[] = [];
  
  // Use different predictions based on position and layer
  const baseIdx = (seed % vocab.length);
  
  for (let i = 0; i < 5; i++) {
    const idx = (baseIdx + i) % vocab.length;
    const prob = Math.max(0.01, (0.9 - i * 0.15) * (1 - layer * 0.02));
    predictions.push({
      text: vocab[idx],
      probability: prob,
    });
  }
  
  // Normalize probabilities
  const total = predictions.reduce((sum, t) => sum + t.probability, 0);
  return predictions.map(t => ({
    ...t,
    probability: t.probability / total,
  }));
};

// Generate predicted token for a cell
const getPredictedToken = (
  tokenPos: number,
  layer: number,
  inputTokens: string[],
  vocab: string[]
): string => {
  // Early layers predict current token
  if (layer < 6) {
    return inputTokens[tokenPos] || vocab[0];
  }
  
  // Later layers predict next token or variations
  if (tokenPos < inputTokens.length - 1) {
    return inputTokens[tokenPos + 1];
  }
  
  // Final position predicts from vocab
  return vocab[(tokenPos + layer) % vocab.length];
};

// Generate activation strength
const getActivationStrength = (tokenPos: number, layer: number): number => {
  const base = 0.3 + Math.sin((tokenPos + layer) / 3) * 0.3;
  const layerBoost = layer / 40;
  return Math.min(1, Math.max(0.1, base + layerBoost + Math.random() * 0.2));
};

export const createMockPromptData = (
  id: string,
  name: string,
  text: string,
  color: string,
  variant: 'source' | 'original'
): PromptData => {
  const inputTokens = text.split(' ');
  const vocab = variant === 'source' ? sourceVocab : originalVocab;
  const displayLayers = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 31];
  
  // Generate heatmap data
  const heatmapData: CellData[][] = [];
  
  for (let tokenPos = 0; tokenPos < inputTokens.length; tokenPos++) {
    const row: CellData[] = [];
    
    for (const layer of displayLayers) {
      const topTokens = generateCellTopTokens(tokenPos, layer, vocab);
      const cell: CellData = {
        tokenPosition: tokenPos,
        layer,
        predictedToken: getPredictedToken(tokenPos, layer, inputTokens, vocab),
        activationStrength: getActivationStrength(tokenPos, layer),
        topTokens,
      };
      row.push(cell);
    }
    
    heatmapData.push(row);
  }
  
  // Generate layer summaries for backward compatibility
  const layers: LayerState[] = displayLayers.map(layer => ({
    layer,
    topTokens: generateCellTopTokens(0, layer, vocab),
    activationStrength: getActivationStrength(0, layer),
  }));

  return {
    id,
    name,
    text,
    inputTokens,
    color,
    layers,
    heatmapData,
  };
};

// Generate blended result after intervention
export const generateInterventionResult = (
  originalPrompt: PromptData,
  sourceTokenPos: number,
  sourceLayer: number,
  targetTokenPos: number,
  targetLayer: number
): PromptData => {
  const heatmapData: CellData[][] = JSON.parse(JSON.stringify(originalPrompt.heatmapData));
  
  // Apply intervention to target cell and downstream
  for (let tokenPos = 0; tokenPos < heatmapData.length; tokenPos++) {
    for (let layerIdx = 0; layerIdx < heatmapData[tokenPos].length; layerIdx++) {
      const cell = heatmapData[tokenPos][layerIdx];
      
      // Direct intervention at target
      if (tokenPos === targetTokenPos && cell.layer === targetLayer) {
        cell.activationStrength = Math.min(1, cell.activationStrength * 1.5);
        cell.topTokens = [
          { text: 'Paris', probability: 0.65 },
          { text: 'London', probability: 0.20 },
          { text: 'France', probability: 0.10 },
          { text: 'Tower', probability: 0.03 },
          { text: 'built', probability: 0.02 },
        ];
        cell.predictedToken = 'Paris';
      }
      
      // Cascade effects downstream (later layers or tokens)
      const isDownstream = 
        (tokenPos === targetTokenPos && cell.layer > targetLayer) ||
        (tokenPos > targetTokenPos);
        
      if (isDownstream) {
        const distance = Math.abs(cell.layer - targetLayer) + Math.abs(tokenPos - targetTokenPos);
        const influence = Math.max(0, 1 - distance * 0.1);
        
        if (influence > 0) {
          cell.activationStrength = Math.min(1, cell.activationStrength * (1 + influence * 0.3));
        }
      }
    }
  }
  
  return {
    ...originalPrompt,
    id: 'result',
    name: 'Result (Intervened)',
    // Keep the original color - blending will be handled by the grid component
    heatmapData,
  };
};

// Mock top tokens for demonstration
const mockTopTokens: Token[] = [
  { text: 'The', probability: 0.95 },
  { text: 'big', probability: 0.80 },
  { text: 'cat', probability: 0.75 },
  { text: 'dog', probability: 0.60 },
  { text: 'small', probability: 0.50 },
];

export const sourcePrompt: PromptData = {
  id: 'source',
  name: 'Source Prompt',
  text: 'The big cat',
  inputTokens: ['The', 'big', 'cat'],
  color: '#FF0000', // Red for source
  layers: [],
  heatmapData: [
    [
      { tokenPosition: 0, layer: 0, predictedToken: 'The', activationStrength: 0.95, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 3, predictedToken: 'The', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 6, predictedToken: 'A', activationStrength: 0.85, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 9, predictedToken: 'The', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 12, predictedToken: 'The', activationStrength: 0.92, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 15, predictedToken: 'The', activationStrength: 0.91, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 18, predictedToken: 'The', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 21, predictedToken: 'The', activationStrength: 0.93, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 24, predictedToken: 'The', activationStrength: 0.94, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 27, predictedToken: 'The', activationStrength: 0.95, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 30, predictedToken: 'The', activationStrength: 0.96, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 31, predictedToken: 'The', activationStrength: 0.97, topTokens: mockTopTokens },
    ],
    [
      { tokenPosition: 1, layer: 0, predictedToken: 'big', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 3, predictedToken: 'large', activationStrength: 0.82, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 6, predictedToken: 'big', activationStrength: 0.87, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 9, predictedToken: 'massive', activationStrength: 0.75, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 12, predictedToken: 'big', activationStrength: 0.89, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 15, predictedToken: 'huge', activationStrength: 0.84, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 18, predictedToken: 'big', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 21, predictedToken: 'large', activationStrength: 0.86, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 24, predictedToken: 'big', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 27, predictedToken: 'big', activationStrength: 0.91, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 30, predictedToken: 'big', activationStrength: 0.92, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 31, predictedToken: 'big', activationStrength: 0.93, topTokens: mockTopTokens },
    ],
    [
      { tokenPosition: 2, layer: 0, predictedToken: 'dog', activationStrength: 0.65, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 3, predictedToken: 'cat', activationStrength: 0.78, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 6, predictedToken: 'dog', activationStrength: 0.70, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 9, predictedToken: 'cat', activationStrength: 0.82, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 12, predictedToken: 'cat', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 15, predictedToken: 'feline', activationStrength: 0.80, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 18, predictedToken: 'cat', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 21, predictedToken: 'cat', activationStrength: 0.92, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 24, predictedToken: 'cat', activationStrength: 0.94, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 27, predictedToken: 'cat', activationStrength: 0.95, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 30, predictedToken: 'cat', activationStrength: 0.96, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 31, predictedToken: 'cat', activationStrength: 0.97, topTokens: mockTopTokens },
    ],
  ],
};

export const originalPrompt: PromptData = {
  id: 'original',
  name: 'Original Prompt',
  text: 'The small dog',
  inputTokens: ['The', 'small', 'dog'],
  color: '#0077FF', // Dark blue for original
  layers: [],
  heatmapData: [
    [
      { tokenPosition: 0, layer: 0, predictedToken: 'The', activationStrength: 0.95, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 3, predictedToken: 'The', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 6, predictedToken: 'A', activationStrength: 0.85, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 9, predictedToken: 'The', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 12, predictedToken: 'The', activationStrength: 0.92, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 15, predictedToken: 'The', activationStrength: 0.91, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 18, predictedToken: 'The', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 21, predictedToken: 'The', activationStrength: 0.93, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 24, predictedToken: 'The', activationStrength: 0.94, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 27, predictedToken: 'The', activationStrength: 0.95, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 30, predictedToken: 'The', activationStrength: 0.96, topTokens: mockTopTokens },
      { tokenPosition: 0, layer: 31, predictedToken: 'The', activationStrength: 0.97, topTokens: mockTopTokens },
    ],
    [
      { tokenPosition: 1, layer: 0, predictedToken: 'small', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 3, predictedToken: 'tiny', activationStrength: 0.80, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 6, predictedToken: 'small', activationStrength: 0.85, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 9, predictedToken: 'little', activationStrength: 0.78, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 12, predictedToken: 'small', activationStrength: 0.87, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 15, predictedToken: 'petite', activationStrength: 0.82, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 18, predictedToken: 'small', activationStrength: 0.86, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 21, predictedToken: 'tiny', activationStrength: 0.84, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 24, predictedToken: 'small', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 27, predictedToken: 'small', activationStrength: 0.89, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 30, predictedToken: 'small', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 1, layer: 31, predictedToken: 'small', activationStrength: 0.91, topTokens: mockTopTokens },
    ],
    [
      { tokenPosition: 2, layer: 0, predictedToken: 'cat', activationStrength: 0.60, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 3, predictedToken: 'dog', activationStrength: 0.75, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 6, predictedToken: 'puppy', activationStrength: 0.68, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 9, predictedToken: 'dog', activationStrength: 0.80, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 12, predictedToken: 'dog', activationStrength: 0.86, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 15, predictedToken: 'canine', activationStrength: 0.78, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 18, predictedToken: 'dog', activationStrength: 0.88, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 21, predictedToken: 'dog', activationStrength: 0.90, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 24, predictedToken: 'dog', activationStrength: 0.92, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 27, predictedToken: 'dog', activationStrength: 0.93, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 30, predictedToken: 'dog', activationStrength: 0.94, topTokens: mockTopTokens },
      { tokenPosition: 2, layer: 31, predictedToken: 'dog', activationStrength: 0.95, topTokens: mockTopTokens },
    ],
  ],
};