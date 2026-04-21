export interface Token {
  text: string;
  probability: number;
}

export interface CellData {
  tokenPosition: number;
  layer: number;
  predictedToken: string;
  activationStrength: number;
  topTokens: Token[];
}

export interface LayerState {
  layer: number;
  topTokens: Token[];
  activationStrength: number;
}

export interface PromptData {
  id: string;
  name: string;
  text: string;
  inputTokens: string[];
  color: string;
  layers: LayerState[];
  heatmapData: CellData[][];
}

export interface Intervention {
  sourcePromptId: string;
  targetPromptId: string;
  sourceLayer: number;
  sourceTokenPosition: number;
  targetLayer: number;
  targetTokenPosition: number;
}

export interface SelectedCell {
  tokenPosition: number;
  layer: number;
  topTokens: Token[];
  promptId: string;
}