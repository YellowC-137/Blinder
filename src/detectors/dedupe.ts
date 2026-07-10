/**
 * 스캔 결과 후처리 — 중복 패턴 매치 병합 + envVarName 인덱스 재정렬.
 * scanner.ts 의 스캔 엔진과 독립적인 순수 함수.
 */
import type { ScanResult, SecretPattern } from '../types/index.js';

/**
 * dedupeResults
 *
 * The same secret value on the same line can match multiple patterns — the
 * specific one (e.g. "AWS Access Key ID") and the catch-all (e.g. "Generic
 * API Key"). Both findings inflate the report and produce duplicate .env
 * entries. This collapses (file, line, matchValue) groups, keeping the
 * most-specific pattern.
 *
 * Specificity = position in `allPatterns` (lower index = more specific, by
 * convention of patterns.js ordering). Structured-file and sensitive-file
 * findings have no entry in allPatterns; they are always kept (line=0 for
 * sensitive files makes them unlikely to collide anyway).
 */
export function dedupeResults(results: ScanResult[], allPatterns: SecretPattern[]): ScanResult[] {
  const patternRank = new Map<string, number>();
  allPatterns.forEach((p, i) => patternRank.set(p.name, i));
  const rankOf = (r: ScanResult): number => patternRank.has(r.patternName) ? patternRank.get(r.patternName)! : Infinity;

  const candidates: ScanResult[] = [];
  const standalone: ScanResult[] = [];

  for (const r of results) {
    if (r.isSensitiveFile || !patternRank.has(r.patternName)) {
      standalone.push(r);
    } else {
      candidates.push(r);
    }
  }

  // Group by (file, line) — overlapping matches always sit on the same line.
  const byLine = new Map<string, ScanResult[]>();
  for (const r of candidates) {
    const key = `${r.file}|${r.line}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key)!.push(r);
  }

  const kept: ScanResult[] = [];
  for (const group of byLine.values()) {
    // Sort by specificity (most-specific first); ties broken by longer match
    // length so substring losers come after the superset winner.
    group.sort((a, b) => {
      const ra = rankOf(a), rb = rankOf(b);
      if (ra !== rb) return ra - rb;
      return b.match.length - a.match.length;
    });

    const accepted: ScanResult[] = [];
    for (const r of group) {
      const subsumed = accepted.some(a =>
        a.match === r.match || a.match.includes(r.match) || r.match.includes(a.match)
      );
      if (!subsumed) accepted.push(r);
    }
    kept.push(...accepted);
  }

  return reindexEnvVarNames([...standalone, ...kept]);
}

/**
 * reindexEnvVarNames
 *
 * After dedup, envVarNames may contain non-sequential indexes (e.g.
 * `ENDPOINT_URL_321`) because the scanner's per-pattern counter advanced
 * for matches that were later subsumed or filtered. Re-walk the kept
 * results in stable order and reassign indexes per (baseName, value) so
 * users see `_1, _2, _3, ...` instead of `_5, _28, _321`.
 *
 * Same value across multiple findings keeps the same index — only
 * distinct values consume new indexes.
 */
function reindexEnvVarNames(results: ScanResult[]): ScanResult[] {
  const baseCounters = new Map<string, number>(); // baseName → next index
  const valueIndex = new Map<string, string>();   // baseName|value → assigned name
  const stripIndex = (name: string): string => name.replace(/_\d+$/, '');

  for (const r of results) {
    if (r.isSensitiveFile || !('envVarName' in r) || !r.envVarName) continue;
    const base = stripIndex(r.envVarName);
    const key = `${base}|${r.match}`;
    if (valueIndex.has(key)) {
      r.envVarName = valueIndex.get(key)!;
      continue;
    }
    const next = baseCounters.get(base) || 0;
    const newName = next === 0 ? base : `${base}_${next}`;
    valueIndex.set(key, newName);
    baseCounters.set(base, next + 1);
    r.envVarName = newName;
  }
  return results;
}
