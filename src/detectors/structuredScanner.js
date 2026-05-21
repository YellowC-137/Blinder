/**
 * structuredScanner
 *
 * Info.plist / AndroidManifest.xml / .properties / .xcconfig 같은
 * 구조화된 설정 파일을 전용 파서로 읽어 키-값 페어를 시크릿으로 평가.
 * scanner.js 의 정규식 기반 매칭과 분리되어 명확한 책임 경계를 가진다.
 */

import path from 'path';
import logger from '../utils/logger.js';
import { parsePlist, isInfoPlist } from './parsers/plistParser.js';
import { parseProperties } from './parsers/propertiesParser.js';
import { parseManifestMetaData, isAndroidManifest } from './parsers/manifestParser.js';
import { classifyKey } from '../protectors/keyClassifier.js';
import { sanitizeEnvName } from './scannerHelpers.js';

/**
 * 구조화 파일 스캔. 결과는 results 배열에 push.
 *
 * @param {string} filePath  절대 경로
 * @param {string} repoPath  리포지토리 루트 (relPath 계산용)
 * @param {string} content   파일 전체 내용
 * @param {Array}  results   출력 누적 배열
 * @param {Map}    usedEnvNames  envVarName 충돌 회피용 (base → value)
 */
export function scanStructuredFile(filePath, repoPath, content, results, usedEnvNames) {
  const relPath = path.relative(repoPath, filePath);
  const base = path.basename(filePath);
  const ext = path.extname(filePath);

  let entries = [];
  let fileType = null;

  try {
    if (isInfoPlist(filePath)) {
      fileType = 'plist';
      entries = parsePlist(content).map(e => ({ key: e.key, value: e.value, line: e.line }));
    } else if (isAndroidManifest(filePath)) {
      fileType = 'manifest';
      entries = parseManifestMetaData(content)
        .filter(e => e.value !== null)
        .map(e => ({ key: e.name, value: e.value, line: e.line }));
    } else if (ext === '.properties' || base === 'gradle.properties' || base === 'local.properties') {
      fileType = 'properties';
      entries = parseProperties(content);
    } else if (ext === '.xcconfig') {
      fileType = 'xcconfig';
      entries = parseProperties(content);
    } else {
      return;
    }
  } catch (err) {
    logger.debug(`Parser failed for ${relPath}: ${err.message}`);
    return;
  }

  for (const { key, value, line } of entries) {
    if (!value || typeof value !== 'string') continue;
    if (value.length < 8) continue;
    // 빌드시스템 변수 보간 표기는 스캔 제외
    if (/^\$[\(\{]|\$\{|@\{|<inherit/.test(value)) continue;
    if (/^[\d.\-+\s]+$/.test(value)) continue;
    if (/^(true|false|yes|no|null|none)$/i.test(value.trim())) continue;
    const looksSecret = /^[A-Za-z0-9_\-./+=:]{8,}$/.test(value) && (
      (/[A-Za-z]/.test(value) && /[0-9]/.test(value)) ||
      /[A-Za-z0-9]{16,}/.test(value) // Long uniform strings are likely secrets
    );
    const keyHint = /\b(api|app|client|secret|token|key|password|passwd|auth|credential)\b/i.test(key);
    if (!looksSecret && !keyHint) continue;

    const verdict = classifyKey({ fileType, key, filename: base });
    const sanitized = sanitizeEnvName(key);
    let envVarName = sanitized || `STRUCT_${fileType.toUpperCase()}_KEY`;
    if (usedEnvNames.has(envVarName) && usedEnvNames.get(envVarName) !== value) {
      let counter = 1;
      while (usedEnvNames.has(`${envVarName}_${counter}`) && usedEnvNames.get(`${envVarName}_${counter}`) !== value) counter++;
      envVarName = `${envVarName}_${counter}`;
    }
    usedEnvNames.set(envVarName, value);

    results.push({
      file: relPath,
      line,
      match: value,
      fullMatch: `${key}=${value}`,
      patternName: `Structured ${fileType} key`,
      envVarName,
      // verdict.allowed=true → key is recognized SDK/secret, safe to auto-fix (higher severity)
      // verdict.allowed=false → unknown or system key, detection-only (medium severity)
      severity: verdict.allowed ? 'HIGH' : 'MEDIUM',
      isFixable: verdict.allowed,
      isTestKey: false,
      isSensitiveFile: false,
      isComment: false,
      isMultiline: false,
      content: `${key} = ${value.length > 60 ? value.slice(0, 57) + '...' : value}`,
      isLikelyExample: false,
      structuredKey: key,
      classifierReason: verdict.reason
    });
  }
}
