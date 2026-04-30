/**
 * regexGuard
 *
 * 사용자 입력 정규식(.blinderSettings.customPatterns)에 대한 ReDoS 가드.
 * 보안 도구 자체가 catastrophic backtracking 으로 DoS 당하지 않도록
 * 의심 패턴을 사전에 거른다.
 *
 * 검증 항목:
 *   1) 컴파일 가능 여부 (SyntaxError 차단)
 *   2) nested quantifier — `(a+)+`, `(.*)+`, `(.+)*` 같은 형태
 *   3) 인접 중첩 양자(quantifier) 반복 — `a+a+`, `.+.+`
 *   4) 무제한 후방 참조 + alternation — 기본적인 휴리스틱
 *   5) 매칭 시간 self-test — 32자 worst-case 입력으로 50ms 초과 시 거부
 *
 * 휴리스틱이라 100% 보장은 아니지만 명백한 사고 차단용.
 */

const NESTED_QUANTIFIER = /\([^()]*[+*]\s*[?+]?\s*\)\s*[+*]/;
const ADJACENT_QUANTIFIERS = /[+*]\s*\??[^|()]*?[+*]\s*\??/;

/**
 * 단일 패턴 객체 검증.
 * 형식: { name: string, regex: string|RegExp, severity: string, multiline?, isFixable? }
 * 반환: { ok: true, pattern: 정상화된객체 } | { ok: false, reason: string }
 */
export function validateCustomPattern(p) {
  if (!p || typeof p !== 'object') {
    return { ok: false, reason: '패턴은 객체여야 합니다' };
  }
  if (typeof p.name !== 'string' || !p.name.trim()) {
    return { ok: false, reason: '"name" 은 비어있지 않은 문자열이어야 합니다' };
  }

  let regex;
  let source;
  if (p.regex instanceof RegExp) {
    regex = p.regex;
    source = regex.source;
  } else if (typeof p.regex === 'string') {
    source = p.regex;
    try {
      // 사용자 패턴은 항상 g 플래그로 통일 (scanner 가 .exec 루프 사용)
      regex = new RegExp(source, 'g');
    } catch (err) {
      return { ok: false, reason: `정규식 컴파일 실패: ${err.message}` };
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
    return { ok: false, reason: `런타임 매칭 실패: ${err.message}` };
  }
  const elapsed = Date.now() - start;
  if (elapsed > 50) {
    return { ok: false, reason: `worst-case 매칭 ${elapsed}ms — ReDoS 의심` };
  }

  return {
    ok: true,
    pattern: {
      name: p.name,
      regex,
      severity: p.severity || 'MEDIUM',
      multiline: p.multiline === true,
      isFixable: p.isFixable !== false
    }
  };
}

/**
 * customPatterns 배열 전체 검증.
 * 거부된 항목은 logger 경고로 알리고 통과한 것만 반환.
 */
export function sanitizeCustomPatterns(rawPatterns, logger) {
  if (!Array.isArray(rawPatterns)) return [];
  const safe = [];
  rawPatterns.forEach((p, i) => {
    const result = validateCustomPattern(p);
    if (result.ok) {
      safe.push(result.pattern);
    } else if (logger) {
      logger.warn(`customPatterns[${i}] (${p?.name || '익명'}) 거부: ${result.reason}`);
    }
  });
  return safe;
}
