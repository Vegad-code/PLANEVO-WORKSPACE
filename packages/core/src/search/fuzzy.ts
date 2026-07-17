/**
 * Case-insensitive subsequence fuzzy matcher powering the command bar (F-46)
 * and @-mention index (F-16) — one scorer, two features.
 *
 * Returns null when the query is not a subsequence of the candidate. Higher
 * score = better: prefix > word-boundary > consecutive > scattered. `ranges`
 * are half-open [start, end) spans of matched characters, for highlighting.
 */

export type FuzzyMatch = { score: number; ranges: [number, number][] };

function isBoundary(char: string | undefined): boolean {
  return char === undefined || /[\s\-_/.]/.test(char);
}

export function fuzzyMatch(query: string, candidate: string): FuzzyMatch | null {
  if (query === "") return { score: 0, ranges: [] };

  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  const matched: number[] = [];
  let ci = 0;
  for (let qi = 0; qi < q.length; qi += 1) {
    const char = q[qi]!;
    let found = -1;
    for (; ci < c.length; ci += 1) {
      if (c[ci] === char) {
        found = ci;
        ci += 1;
        break;
      }
    }
    if (found === -1) return null; // query char not found -> no match
    matched.push(found);
  }

  let score = 0;
  let prev = -1;
  for (const index of matched) {
    score += 2; // base per matched char
    if (index === 0) score += 12; // prefix
    else if (isBoundary(candidate[index - 1])) score += 10; // word boundary
    if (prev >= 0) {
      if (index === prev + 1) score += 8; // consecutive
      else score -= Math.min(index - prev - 1, 5); // scattered gap penalty
    }
    prev = index;
  }
  // Favour tighter matches within longer candidates.
  score -= Math.max(candidate.length - q.length, 0) * 0.1;

  const ranges: [number, number][] = [];
  for (const index of matched) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else ranges.push([index, index + 1]);
  }

  return { score, ranges };
}
