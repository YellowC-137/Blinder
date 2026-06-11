/**
 * regexGuard
 *
 * ReDoS guard for user-provided regex patterns (.blinderSettings.customPatterns).
 * Prevents the security tool itself from being DoS'd by catastrophic backtracking.
 *
 * Validation checks:
 *   1) Compilable (SyntaxError prevention)
 *   2) Nested quantifier — `(a+)+`, `(.*)+`, `(.+)*` patterns
 *   3) Consecutive unbounded wildcards — `.*.*`, `.+.+`
 *   4) Runtime self-test — rejects if >50ms on 32-char worst-case input
 *
 * Heuristic-based; not 100% guaranteed, but catches obvious dangers.
 */
import { t } from './i18n.js';
import type { SecretPattern, Severity } from '../types/index.js';

const NESTED_QUANTIFIER = /\([^()]*[+*]\s*[?+]?\s*\)\s*[+*]/;

interface RawPattern {
  name?: string;
  regex?: string | RegExp;
  severity?: Severity;
  multiline?: boolean;
  isFixable?: boolean;
}

type ValidationSuccess = { ok: true; pattern: SecretPattern };
type ValidationFailure = { ok: false; reason: string };
type ValidationResult = ValidationSuccess | ValidationFailure;

interface MinimalLogger {
  warn(msg: string): void;
}

/**
 * 단일 패턴 객체 검증.
 * 형식: { name: string, regex: string|RegExp, severity: string, multiline?, isFixable? }
 * 반환: { ok: true, pattern: 정상화된객체 } | { ok: false, reason: string }
 */
export function validateCustomPattern(p: unknown): ValidationResult {
  if (!p || typeof p !== 'object') {
    return { ok: false, reason: '패턴은 객체여야 합니다' };
  }
  const pat = p as RawPattern;
  if (typeof pat.name !== 'string' || !pat.name.trim()) {
    return { ok: false, reason: '"name" 은 비어있지 않은 문자열이어야 합니다' };
  }

  let regex: RegExp;
  let source: string;
  if (pat.regex instanceof RegExp) {
    // g 플래그 강제: scanner 는 matchAll 사용 — non-global RegExp 는
    // TypeError 를 던져 해당 파일 스캔이 통째로 스킵됨
    regex = pat.regex.global ? pat.regex : new RegExp(pat.regex.source, pat.regex.flags + 'g');
    source = regex.source;
  } else if (typeof pat.regex === 'string') {
    source = pat.regex;
    try {
      // 사용자 패턴은 항상 g 플래그로 통일 (scanner 가 matchAll 사용)
      regex = new RegExp(source, 'g');
    } catch (err) {
      return { ok: false, reason: `정규식 컴파일 실패: ${(err as Error).message}` };
    }
  } else {
    return { ok: false, reason: '"regex" 는 문자열 또는 RegExp 여야 합니다' };
  }

  // 정적 분석: nested quantifier
  if (NESTED_QUANTIFIER.test(source)) {
    return { ok: false, reason: 'nested quantifier 감지 — ReDoS 위험 (예: `(a+)+`)' };
  }

  // 정적 분석: 같은 문자 그룹의 인접 unbounded 반복
  // 너무 보수적이면 정상 패턴 막으니 단순 휴리스틱만.
  if (/(?:\.\*){2,}|(?:\.\+){2,}/.test(source)) {
    return { ok: false, reason: '연속된 `.*` / `.+` 감지 — ReDoS 위험' };
  }

  // 동적 self-test: worst-case 입력으로 매칭 타임아웃 검사
  const probe = 'a'.repeat(32) + '!';
  const start = Date.now();
  try {
    regex.lastIndex = 0;
    regex.exec(probe);
  } catch (err) {
    return { ok: false, reason: `런타임 매칭 실패: ${(err as Error).message}` };
  }
  const elapsed = Date.now() - start;
  if (elapsed > 50) {
    return { ok: false, reason: `worst-case 매칭 ${elapsed}ms — ReDoS 의심` };
  }

  return {
    ok: true,
    pattern: {
      name: pat.name,
      regex,
      severity: pat.severity || 'MEDIUM',
      multiline: pat.multiline === true,
      isFixable: pat.isFixable !== false
    }
  };
}

/**
 * customPatterns 배열 전체 검증.
 * 거부된 항목은 logger 경고로 알리고 통과한 것만 반환.
 */
export function sanitizeCustomPatterns(rawPatterns: unknown[], logger?: MinimalLogger): SecretPattern[] {
  if (!Array.isArray(rawPatterns)) return [];
  const safe: SecretPattern[] = [];
  rawPatterns.forEach((p: unknown, i: number) => {
    const result = validateCustomPattern(p);
    if (result.ok) {
      safe.push(result.pattern);
    } else if (logger) {
      logger.warn(t('regex_guard_rejected', { i, name: (p as RawPattern)?.name || t('regex_anonymous'), reason: result.reason }));
    }
  });
  return safe;
}
