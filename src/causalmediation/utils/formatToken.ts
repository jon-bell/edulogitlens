/**
 * Render a token for display with its whitespace made visible: every space
 * character becomes "␣" (U+2423 OPEN BOX), so " Paris" reads as "␣Paris" and
 * a whitespace-only token like " " reads as "␣" instead of vanishing.
 * Newlines and tabs get their own glyphs so tokens like "\n" stay visible.
 * Keep the RAW token in `title` tooltips wherever this is applied.
 */
export function formatTokenDisplay(token: string): string {
  return token.replace(/ /g, '␣').replace(/\n/g, '↵').replace(/\t/g, '⇥');
}
