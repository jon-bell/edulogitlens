import type { LogitCell, LogitLensData } from '../../LogitLensGrid';

const SOURCE_VOCAB = ['The', 'Eiffel', 'Tower', 'is', 'in', 'France', 'Paris', 'built', 'tall', 'of'];
const TARGET_VOCAB = ['The', 'Big', 'Ben', 'is', 'in', 'England', 'London', 'clock', 'built', 'of'];
const NUM_LAYERS = 32;

function hashSeed(tokenPos: number, layer: number, promptSeed: number): number {
  const h = Math.sin(tokenPos * 37.1 + layer * 11.3 + promptSeed * 91.7) * 43758.5453;
  return h - Math.floor(h);
}

function buildTopTokens(
  tokenPos: number,
  layer: number,
  inputTokens: string[],
  vocab: string[],
  promptSeed: number,
): LogitCell['topTokens'] {
  // Probability ramps up with layer depth
  const depth = layer / (NUM_LAYERS - 1);
  const peakProb = 0.25 + depth * 0.65; // 0.25 → 0.9

  // Pick predicted token — shallow layers echo input, deep layers predict next
  const prefer =
    depth < 0.25
      ? inputTokens[tokenPos] ?? vocab[0]
      : depth < 0.6
        ? inputTokens[Math.min(tokenPos, inputTokens.length - 1)] ?? vocab[0]
        : inputTokens[tokenPos + 1] ?? vocab[(tokenPos + layer) % vocab.length];

  const noise = hashSeed(tokenPos, layer, promptSeed);
  const topProb = Math.min(0.98, Math.max(0.05, peakProb + (noise - 0.5) * 0.15));

  const picks: { token: string; prob: number }[] = [{ token: prefer, prob: topProb }];
  const used = new Set([prefer]);
  let remaining = 1 - topProb;

  for (let i = 1; i < 15; i++) {
    let candidate = vocab[(tokenPos + layer + i) % vocab.length];
    let guard = 0;
    while (used.has(candidate) && guard < vocab.length) {
      candidate = vocab[(tokenPos + layer + i + guard) % vocab.length];
      guard++;
    }
    used.add(candidate);

    const share = remaining * (1 / Math.pow(1.6, i));
    picks.push({ token: candidate, prob: Math.max(0.001, share) });
    remaining = Math.max(0, remaining - share);
  }

  return picks;
}

export function createMockLogitLensData(
  text: string,
  variant: 'source' | 'target',
): LogitLensData {
  const inputTokens = text.split(' ');
  const vocab = variant === 'source' ? SOURCE_VOCAB : TARGET_VOCAB;
  const promptSeed = variant === 'source' ? 1 : 2;

  const layers = Array.from({ length: NUM_LAYERS }, (_, i) => i);

  const data: LogitCell[][] = inputTokens.map((_, tokenPos) =>
    layers.map((layer) => {
      const topTokens = buildTopTokens(tokenPos, layer, inputTokens, vocab, promptSeed);
      return {
        token: topTokens[0].token,
        probability: topTokens[0].prob,
        topTokens,
      };
    }),
  );

  return {
    tokens: inputTokens,
    layers,
    data,
  };
}

/**
 * Produce a synthetic intervention result: clone the target's LogitLensData,
 * then rewrite the intervention cell's predictions to match the source's cell,
 * and cascade that influence to downstream cells (later layers on the same
 * token, or later tokens at equal/later layers).
 */
export function generateInterventionResult(
  sourceData: LogitLensData,
  targetData: LogitLensData,
  sourceTokenPos: number,
  sourceLayer: number,
  targetTokenPos: number,
  targetLayer: number,
): LogitLensData {
  const cloned: LogitCell[][] = targetData.data.map((row) =>
    row.map((cell) => ({
      token: cell.token,
      probability: cell.probability,
      topTokens: cell.topTokens.map((t) => ({ ...t })),
    })),
  );

  const sourceLayerIdx = sourceData.layers.indexOf(sourceLayer);
  const targetLayerIdx = targetData.layers.indexOf(targetLayer);

  const srcRow = sourceData.data[sourceTokenPos];
  const srcCell = srcRow ? srcRow[sourceLayerIdx] : null;

  for (let tokenPos = 0; tokenPos < cloned.length; tokenPos++) {
    for (let layerIdx = 0; layerIdx < cloned[tokenPos].length; layerIdx++) {
      const isIntervention = tokenPos === targetTokenPos && layerIdx === targetLayerIdx;
      const isDownstream =
        (tokenPos === targetTokenPos && layerIdx > targetLayerIdx) ||
        (tokenPos > targetTokenPos && layerIdx >= targetLayerIdx);

      if (isIntervention && srcCell) {
        cloned[tokenPos][layerIdx] = {
          token: srcCell.token,
          probability: srcCell.probability,
          topTokens: srcCell.topTokens.map((t) => ({ ...t })),
        };
      } else if (isDownstream && srcCell) {
        const layerDist = Math.abs(layerIdx - targetLayerIdx);
        const tokenDist = Math.abs(tokenPos - targetTokenPos);
        const influence = Math.max(0, 1 - (layerDist + tokenDist) * 0.12);
        if (influence > 0) {
          const blended = cloned[tokenPos][layerIdx].topTokens.map((t) => ({ ...t }));
          // Mix the source's top token into this cell's predictions
          const srcTop = srcCell.topTokens[0];
          const existing = blended.findIndex((t) => t.token === srcTop.token);
          if (existing >= 0) {
            blended[existing].prob = Math.min(
              0.98,
              blended[existing].prob + srcTop.prob * influence * 0.5,
            );
          } else {
            blended.unshift({ token: srcTop.token, prob: srcTop.prob * influence * 0.6 });
            blended.pop();
          }
          blended.sort((a, b) => b.prob - a.prob);
          cloned[tokenPos][layerIdx] = {
            token: blended[0].token,
            probability: blended[0].prob,
            topTokens: blended,
          };
        }
      }
    }
  }

  return {
    tokens: [...targetData.tokens],
    layers: [...targetData.layers],
    data: cloned,
  };
}
