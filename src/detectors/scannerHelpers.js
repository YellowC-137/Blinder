/**
 * scannerHelpers
 *
 * scanner.js 가 661 LOC 단일 파일이라 가독성/테스트가 어려웠음.
 * 외부 부수효과 없는 순수 헬퍼 함수만 모아 분리한다:
 *   - false-positive 휴리스틱
 *   - 코멘트/플레이스홀더 감지
 *   - 엔트로피 계산
 *   - XML 코멘트 범위 수집
 *   - 라인 번호 / env 이름 정규화
 *   - 매치 상세 추출 (Objective-C 등 언어 특수 처리)
 */

/**
 * 매치가 false-positive 가능성이 큰지 판단.
 * 파일 경로 또는 라인에 example/sample/placeholder 등 키워드가 있으면 true.
 */
export function isFalsePositive(line, filePath) {
  const lowerLine = line.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  const ignoreKeywords = ['example', 'sample', 'placeholder', 'demo', 'mock', 'dummy'];
  return ignoreKeywords.some(kw => lowerPath.includes(kw) || lowerLine.includes(kw));
}

/**
 * 테스트 키 여부 판정 — severity 를 LOW 로 강등하기 위한 시그널.
 */
export function isTestKey(line, filePath, matchValue) {
  const lowerLine = line.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  const lowerMatch = matchValue.toLowerCase();
  return lowerPath.includes('test') || lowerLine.includes('test') || lowerMatch.includes('test');
}

/**
 * 라인이 단일행 코멘트인지 — 플랫폼별 commentRegex 사용.
 */
export function isCommentLine(line, platforms) {
  return platforms.some(p => p.commentRegex && p.commentRegex.test(line));
}

/**
 * Shannon entropy (bits/char). 무작위/암호화 시크릿은 보통 ≥ 3.5,
 * 더미/반복 문자열(예: "xxxxx", "password")은 훨씬 낮음.
 */
export function shannonEntropy(s) {
  if (!s) return 0;
  const counts = new Map();
  for (const c of s) counts.set(c, (counts.get(c) || 0) + 1);
  let entropy = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * 흔한 더미/플레이스홀더 문자열 (대소문자 무시).
 */
export function isPlaceholderValue(value) {
  const v = value.trim().toLowerCase();
  const literals = new Set([
    'password', 'passwd', 'changeme', 'change-me', 'changethis',
    'your_secret_here', 'your-secret-here', 'your_api_key', 'your-api-key',
    'placeholder', 'example', 'sample', 'todo', 'tbd',
    'secret', 'token', 'apikey', 'api_key', 'api-key',
    'string', 'value', 'replace_me', 'replace-me'
  ]);
  if (literals.has(v)) return true;
  if (/^x{4,}$/i.test(v)) return true;
  if (/^\*{4,}$/.test(v)) return true;
  if (/^[._\-]{3,}$/.test(v)) return true;
  return false;
}

/**
 * 매치를 false-positive 로 강등할지 판정.
 * 변수명 블랙리스트(예: STATUS_CODE) + 플레이스홀더 + 길이/엔트로피 게이트.
 */
export function isLowConfidenceMatch(matchValue, patternName, varName = '') {
  if (varName) {
    const blacklist = /(?:CMD|RSP|MSG|COLOR|ERR_CODE|RSP_CODE|STATUS_CODE|TYPE|ID|FLAG|NAME|TITLE|DESC|TEXT|STR_KEY|PARAM_|FIELD_|ATTR_|PROP_|VAL_)/i;
    if (blacklist.test(varName)) return true;
  }

  if (isPlaceholderValue(matchValue)) return true;

  if (patternName.includes('Config String') || patternName.includes('Macro String') || patternName.includes('Generic')) {
    if (matchValue.length < 8) return true;
    if (/^\d+$/.test(matchValue)) return true;
    // catch-all 패턴은 더 엄격한 엔트로피 게이트 필요 — "your_secret_here_yes" 같은
    // 20자 반복 플레이스홀더가 그렇지 않으면 통과함.
    if (matchValue.length >= 16 && shannonEntropy(matchValue) < 3.0) return true;
  }

  return false;
}

/**
 * XML/HTML 메타데이터 블록의 [start,end) 바이트 오프셋 수집.
 *   - <!-- ... --> 코멘트
 *   - <!DOCTYPE ... >, <!ENTITY ... > 같은 선언
 * pom.xml 코멘트 / checkstyle DOCTYPE URL 같은 곳의 오탐 방지용.
 */
export function collectXmlCommentRanges(content) {
  const ranges = [];
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf('<!', i);
    if (open === -1) break;
    if (content.startsWith('<!--', open)) {
      const close = content.indexOf('-->', open + 4);
      if (close === -1) { ranges.push([open, content.length]); break; }
      ranges.push([open, close + 3]);
      i = close + 3;
    } else {
      const close = content.indexOf('>', open + 2);
      if (close === -1) { ranges.push([open, content.length]); break; }
      ranges.push([open, close + 1]);
      i = close + 1;
    }
  }
  return ranges;
}

/**
 * 환경변수 이름 정규화 — POSIX 호환 [A-Z0-9_] 만 허용.
 */
export function sanitizeEnvName(raw) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * 매치 결과에서 (matchValue, varName) 추출.
 * Objective-C 패턴은 capture group 구조가 달라 분기 처리.
 */
export function extractMatchDetails(pattern, match, content, ext) {
  let matchValue = match[0];
  let varName = '';

  if (pattern.name === 'Objective-C Config String' && match[1]) {
    varName = match[1];
    matchValue = match[2];
  } else if (pattern.name === 'Objective-C Macro String' && match[1]) {
    varName = match[1];
    matchValue = match[2];
  } else {
    for (let g = match.length - 1; g >= 1; g--) {
      if (match[g] !== undefined) {
        matchValue = match[g];
        break;
      }
    }
  }

  // Objective-C 헤더 .h/.m/.mm 에서 변수명을 lookback 으로 보강
  if (!varName && (ext === '.m' || ext === '.h' || ext === '.mm')) {
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const preMatch = content.substring(lineStart, match.index);
    const lookbackRegex = /(?:NSString\s*\*\s*const|const\s+NSString\s*\*|#define)\s+([a-zA-Z0-9_]+)\s*(?:=|)\s*@?\s*["']?$/i;
    const varMatch = preMatch.trim().match(lookbackRegex);
    if (varMatch) varName = varMatch[1];
  }

  return { matchValue, varName };
}

/**
 * 환경변수 이름 결정 + 충돌 회피. 동일 base 가 다른 값으로 이미 점유되면
 * `_1, _2, ...` 인덱스 부여. 이후 reindexEnvVarNames 가 dedup 후 재정렬.
 */
export function getEnvVarName(pattern, varName, match2, usedEnvNames, matchValue) {
  let baseEnvName = sanitizeEnvName(pattern.name);
  if ((pattern.name === 'Objective-C Config String' || pattern.name === 'Objective-C Macro String') && varName) {
    baseEnvName = sanitizeEnvName(varName);
  } else if (pattern.name === 'Objective-C Config Number' && match2) {
    baseEnvName = sanitizeEnvName(match2);
  }
  if (!baseEnvName) baseEnvName = 'SECRET';

  let envVarName = baseEnvName;
  const existingValue = usedEnvNames.get(envVarName);
  if (existingValue && existingValue !== matchValue) {
    let counter = 1;
    while (usedEnvNames.has(`${baseEnvName}_${counter}`) && usedEnvNames.get(`${baseEnvName}_${counter}`) !== matchValue) {
      counter++;
    }
    envVarName = `${baseEnvName}_${counter}`;
  }
  usedEnvNames.set(envVarName, matchValue);
  return envVarName;
}

/**
 * 바이트 오프셋 → 1-base 라인 번호.
 */
export function getLineNumber(content, index) {
  const prefix = content.substring(0, index);
  return prefix.split('\n').length;
}
