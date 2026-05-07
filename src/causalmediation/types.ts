import type { LogitCell, LogitLensData } from '../LogitLensGrid';

export type { LogitCell, LogitLensData };

export interface PromptInput {
  id: string;
  name: string;
  color: string;
  data: LogitLensData;
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
  topTokens: { token: string; prob: number }[];
  promptId: string;
}
