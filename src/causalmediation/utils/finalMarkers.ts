/**
 * Shared treatment for marking rows in the top-k lists that correspond to a
 * "final" prediction. Two distinct markers:
 *  - ROW final: the top-1 prediction at the FINAL layer of the selected token
 *    position — where this position's trajectory ends up.
 *  - GRID final: the top-1 prediction at the final layer of the LAST token
 *    position — the model's actual next-token output for the prompt.
 * Colors are chosen to stay clear of the explorer palette (cyan source, pink
 * target, purple blend, amber collapsed-gaps, yellow selection outline).
 */
export const ROW_FINAL_COLOR = '#059669'; // emerald-600
export const GRID_FINAL_COLOR = '#ea580c'; // orange-600
export const ROW_FINAL_LABEL = 'Final prediction (this position)';
export const GRID_FINAL_LABEL = "Model's final output";
