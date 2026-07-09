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
  // Top-1 prediction at the FINAL layer of this token position's row — used
  // by the top-k lists to mark where this position's trajectory ends up.
  rowFinalToken?: string;
  // Top-1 prediction at the final layer of the LAST token position — the
  // model's actual next-token output for the prompt.
  gridFinalToken?: string;
}

// Discrete, high-level interactions the explorer surfaces to an embedding host
// (e.g. workbench product analytics). Emitted via the optional `onEvent` prop;
// carries only cell/step coordinates, never token text.
export type CausalMediationEvent =
  | { type: 'cell_click'; promptId: string; tokenPosition: number; layer: number }
  | { type: 'result_cell_click'; tokenPosition: number; layer: number }
  | { type: 'token_step_change'; step: number }
  | { type: 'layer_step_change'; step: number };
