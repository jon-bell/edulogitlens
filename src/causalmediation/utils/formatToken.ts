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

/**
 * Whether a token is a tokenizer control marker rather than text the user wrote —
 * `<|begin_of_text|>`, `<s>`, `[CLS]`, `<bos>` and friends.
 *
 * Used to hide a leading BOS row from the grid: it is a real position in the data
 * and has to stay one, because interventions are addressed against the
 * BOS-inclusive tokenization. So this only ever drives *rendering*, never indices.
 */
export function isSpecialToken(token: string | undefined): boolean {
  if (!token) return false;
  const t = token.trim();
  return (
    /^<\|.+\|>$/.test(t) ||
    /^<\/?s>$/.test(t) ||
    /^<bos>$/i.test(t) ||
    /^\[(CLS|SEP|BOS)\]$/i.test(t)
  );
}
