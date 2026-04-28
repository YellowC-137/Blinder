import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import logger from '../utils/logger.js';
import ASTProvider from '../ast/ASTProvider.js';
import readline from 'readline';
import { patterns } from './patterns.js';
import { parsePlist, isInfoPlist } from './parsers/plistParser.js';
import { parseProperties } from './parsers/propertiesParser.js';
import { parseManifestMetaData, isAndroidManifest } from './parsers/manifestParser.js';
import { classifyKey } from '../protectors/keyClassifier.js';

/**
 * Heuristic to detect if a match is likely a false positive.
 */
function isFalsePositive(line, filePath) {
  const lowerLine = line.toLowerCase();
  const lowerPath = filePath.toLowerCase();

  const ignoreKeywords = ['example', 'sample', 'placeholder', 'demo', 'mock', 'dummy'];
  return ignoreKeywords.some(kw => lowerPath.includes(kw) || lowerLine.includes(kw));
}

/**
 * Specifically detects if a match is a 'Test' key.
 */
function isTestKey(line, filePath, matchValue) {
  const lowerLine = line.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  const lowerMatch = matchValue.toLowerCase();

  return lowerPath.includes('test') || lowerLine.includes('test') || lowerMatch.includes('test');
}

/**
 * Heuristic to detect if a line is a comment using platform specific regex.
 */
function isCommentLine(line, platforms) {
  return platforms.some(p => p.commentRegex && p.commentRegex.test(line));
}

/**
 * Scans for sensitive files that should never be committed.
 */
async function scanSensitiveFiles(repoPath, platforms) {
  const warnings = [];
  const sensitiveFiles = platforms.flatMap(p => p.sensitiveFiles || []);

  for (const sf of sensitiveFiles) {
    const found = await glob(sf.glob, {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/Pods/**', '**/.git/**'],
      absolute: true
    });

    for (const filePath of found) {
      warnings.push({
        file: path.relative(repoPath, filePath),
        line: 0,
        match: path.basename(filePath),
        fullMatch: path.basename(filePath),
        patternName: `Sensitive File: ${path.basename(filePath)}`,
        severity: sf.severity,
        isTestKey: false,
        isSensitiveFile: true,
        content: sf.reason,
        isLikelyExample: false
      });
    }
  }

  return warnings;
}

/**
 * Structured-format scanner: dispatches to dedicated parsers for Info.plist,
 * AndroidManifest.xml, .properties, .xcconfig. Detection-only — emits findings
 * with classifier-determined isFixable so downstream auto-fix gates safely.
 */
function scanStructuredFile(filePath, repoPath, content, results, usedEnvNames) {
  const relPath = path.relative(repoPath, filePath);
  const base = path.basename(filePath);
  const ext = path.extname(filePath);

  let entries = [];
  let fileType = null;

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

  for (const { key, value, line } of entries) {
    if (!value || typeof value !== 'string') continue;
    if (value.length < 8) continue;
    if (/^\$[\(\{]|\$\{|@\{|<inherit/.test(value)) continue;
    if (/^[\d.\-+\s]+$/.test(value)) continue;
    if (/^(true|false|yes|no|null|none)$/i.test(value.trim())) continue;
    const looksSecret = /^[A-Za-z0-9_\-./+=:]{8,}$/.test(value) && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
    const keyHint = /(api|app|client|secret|token|key|password|passwd|auth|credential)/i.test(key);
    if (!looksSecret && !keyHint) continue;

    const verdict = classifyKey({ fileType, key, filename: base });
    const sanitized = key.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

/**
 * collectXmlCommentRanges
 *
 * Returns [start, end) byte offsets of every XML/HTML metadata block — both
 * comments (`<!-- ... -->`) and declarations (`<!DOCTYPE ... >`,
 * `<!ENTITY ... >`). Used to skip URL/secret matches that sit inside
 * documentation references or schema declarations (pom.xml comments,
 * checkstyle DOCTYPE URLs are common cases).
 */
function collectXmlCommentRanges(content) {
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
 * shannonEntropy
 *
 * Bits-per-char of the input string. Random/cryptographic secrets typically
 * score >= 3.5; placeholder/dummy strings (xxxxx, password, changeme) score
 * much lower because they're either short, repeating, or natural-language.
 */
function shannonEntropy(s) {
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
 * isPlaceholderValue
 *
 * Common dummy / placeholder strings that pattern matchers occasionally hit.
 * Matched case-insensitively against the trimmed value; near-uniform repeats
 * (xxxxx, *****) caught separately by the entropy gate.
 */
function isPlaceholderValue(value) {
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
 * Detects if a match is likely a false positive based on length, content, and variable name.
 */
function isLowConfidenceMatch(matchValue, patternName, varName = '') {
  if (varName) {
    const blacklist = /(?:CMD|RSP|MSG|COLOR|ERR_CODE|RSP_CODE|STATUS_CODE|TYPE|ID|FLAG|NAME|TITLE|DESC|TEXT|STR_KEY|PARAM_|FIELD_|ATTR_|PROP_|VAL_)/i;
    if (blacklist.test(varName)) return true;
  }

  if (isPlaceholderValue(matchValue)) return true;

  if (patternName.includes('Config String') || patternName.includes('Macro String') || patternName.includes('Generic')) {
    if (matchValue.length < 8) return true;
    if (/^\d+$/.test(matchValue)) return true;
    // Generic catch-all patterns need stronger entropy gating — a 20-char
    // repeating placeholder (e.g. "your_secret_here_yes") otherwise sneaks in.
    if (matchValue.length >= 16 && shannonEntropy(matchValue) < 3.0) return true;
  }

  return false;
}

async function scanSmallFile(filePath, repoPath, allPatterns, platforms, results, usedEnvNames, options) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    logger.warn(`Could not read file ${filePath}: ${err.message}`);
    return;
  }
  const lines = content.split('\n');
  const ext = path.extname(filePath);
  const astLang = ASTProvider.getLangId(ext);

  if (content.length > 100000 && !content.includes('\n')) return;

  const firstTenLines = lines.slice(0, 10).join('\n').toLowerCase();
  if (firstTenLines.includes('auto-generated') || firstTenLines.includes('generated by')) return;

  // XML/HTML/Maven comment ranges span multiple lines; line-based comment
  // detection misses them. Pre-compute byte ranges for `<!-- -->` blocks
  // (XML, HTML, pom.xml, .yml) so URL/secret matches inside reference docs
  // can be skipped (#4.7).
  const xmlCommentRanges = (ext === '.xml' || ext === '.html' || ext === '.htm' || ext === '.svg' || ext === '.yml' || ext === '.yaml')
    ? collectXmlCommentRanges(content)
    : [];
  const inXmlComment = (offset) => xmlCommentRanges.some(([s, e]) => offset >= s && offset < e);

  for (const pattern of allPatterns) {
    pattern.regex.lastIndex = 0;
    let match;

    while ((match = pattern.regex.exec(content)) !== null) {
      let { matchValue, varName } = extractMatchDetails(pattern, match, content, ext);

      if (astLang && !options.skipAST) {
        // Use offset of the captured value (not match[0]) so AST validation hits the string literal,
        // not surrounding identifiers (e.g., `apiKey` in `apiKey = "..."`).
        const valueOffsetInMatch = match[0].indexOf(matchValue);
        const valueOffset = match.index + (valueOffsetInMatch >= 0 ? valueOffsetInMatch : 0);
        const isValid = await ASTProvider.validateMatch(filePath, astLang, matchValue, valueOffset);
        if (!isValid) continue;
      }

      if (inXmlComment(match.index)) continue;

      const startLine = getLineNumber(content, match.index);
      const currentLineText = lines[startLine - 1] || '';
      const isComment = isCommentLine(currentLineText, platforms);

      if (isLowConfidenceMatch(matchValue, pattern.name, varName)) continue;

      const envVarName = getEnvVarName(pattern, varName, match[2], usedEnvNames, matchValue);
      const isTest = isTestKey(currentLineText, filePath, matchValue);

      results.push({
        file: path.relative(repoPath, filePath),
        line: startLine,
        match: matchValue,
        fullMatch: match[0],
        patternName: pattern.name,
        envVarName,
        severity: isTest ? 'LOW' : pattern.severity,
        isFixable: pattern.isFixable !== false,
        isTestKey: isTest,
        isSensitiveFile: false,
        isComment,
        isMultiline: pattern.multiline || match[0].includes('\n'),
        content: currentLineText.trim(),
        isLikelyExample: isFalsePositive(currentLineText, filePath)
      });
    }
  }

  scanStructuredFile(filePath, repoPath, content, results, usedEnvNames);
}

async function scanLargeFile(filePath, repoPath, allPatterns, platforms, results, usedEnvNames, options) {
  let fileStream;
  try {
    fileStream = fs.createReadStream(filePath);
  } catch (err) {
    logger.warn(`Could not create read stream for ${filePath}: ${err.message}`);
    return;
  }
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const ext = path.extname(filePath);
  const astLang = ASTProvider.getLangId(ext);

  let lineNumber = 0;
  let byteOffset = 0;

  for await (const line of rl) {
    lineNumber++;
    for (const pattern of allPatterns) {
      if (pattern.multiline) continue;
      
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        let matchValue = match[0];
        if (pattern.name.includes('Objective-C') && match[1]) matchValue = match[2];
        else {
           for (let g = match.length - 1; g >= 1; g--) {
             if (match[g] !== undefined) { matchValue = match[g]; break; }
           }
        }

        if (astLang && !options.skipAST) {
           const valueOffsetInMatch = match[0].indexOf(matchValue);
           const valueOffset = byteOffset + match.index + (valueOffsetInMatch >= 0 ? valueOffsetInMatch : 0);
           const isValid = await ASTProvider.validateMatch(filePath, astLang, matchValue, valueOffset);
           if (!isValid) continue;
        }

        if (isLowConfidenceMatch(matchValue, pattern.name)) continue;

        const isTest = isTestKey(line, filePath, matchValue);
        const envVarName = getEnvVarName(pattern, '', '', usedEnvNames, matchValue);

        results.push({
          file: path.relative(repoPath, filePath),
          line: lineNumber,
          match: matchValue,
          fullMatch: match[0],
          patternName: pattern.name,
          envVarName,
          severity: isTest ? 'LOW' : pattern.severity,
          isFixable: pattern.isFixable !== false,
          isTestKey: isTest,
          isSensitiveFile: false,
          isComment: isCommentLine(line, platforms),
          isMultiline: false,
          content: line.trim(),
          isLikelyExample: isFalsePositive(line, filePath)
        });
      }
    }
    byteOffset += Buffer.byteLength(line, 'utf8') + 1;
  }
}

function extractMatchDetails(pattern, match, content, ext) {
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

  if (!varName && (ext === '.m' || ext === '.h' || ext === '.mm')) {
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const preMatch = content.substring(lineStart, match.index);
    const lookbackRegex = /(?:NSString\s*\*\s*const|const\s+NSString\s*\*|#define)\s+([a-zA-Z0-9_]+)\s*(?:=|)\s*@?\s*["']?$/i;
    const varMatch = preMatch.trim().match(lookbackRegex);
    if (varMatch) varName = varMatch[1];
  }

  return { matchValue, varName };
}

function sanitizeEnvName(raw) {
  // POSIX-compatible env var name: only [A-Z0-9_]. Replace any non-alphanumeric
  // (including / from "Network Host / Domain", spaces, dashes) with _.
  // Collapse consecutive _ and strip leading/trailing _.
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getEnvVarName(pattern, varName, match2, usedEnvNames, matchValue) {
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

export async function scanProject(repoPath, platforms, options = {}) {
  const results = [];
  const extensions = new Set();
  const usedEnvNames = new Map();

  platforms.forEach(p => {
    (p.commonExtensions || []).forEach(ext => extensions.add(ext));
  });

  if (extensions.size === 0) {
    ['.swift', '.kt', '.dart', '.xml', '.plist', '.json', '.env', '.properties', '.gradle'].forEach(ext => extensions.add(ext));
  }

  const platformIgnores = platforms.flatMap(p => p.ignorePaths || []);
  const ignorePatterns = [
    '**/node_modules/**', '**/Pods/**', '**/Carthage/**', '**/vendor/**', '**/third_party/**',
    '**/build/**', '**/dist/**', '**/.git/**', '**/.env',
    // 1. 키, 인증서 및 보안 파일
    '**/id_rsa', '**/id_rsa.pub', '**/*.ppk', '**/known_hosts',
    '**/*.pem', '**/*.cer', '**/*.crt', '**/*.p12', '**/*.keystore', '**/*.jks', '**/*.certSigningRequest',
    '**/.aws/credentials', '**/gcp-sa-key.json', '**/*.ovpn', '**/*.mobileprovision',
    // 2. 메모리 덤프 및 런타임 로그
    '**/*.hprof', '**/*.dump', '**/core.*',
    '**/*.log', '**/*.crash', '**/*.out',
    '**/*.sqlite', '**/*.db', '**/*.realm',
    // 3. 인프라 배포 및 환경 설정 스크립트
    '**/*.sh', '**/*.bat', '**/*.command',
    '**/*.tfstate', '**/terraform.tfvars',
    '**/Fastfile', '**/Appfile', '**/Matchfile',
    // 4. 로컬 빌드 환경 변수
    '**/local.properties', '**/.npmrc', '**/.yarnrc',
    // 5. 모바일 빌드 산출물 / Xcode-IDE 캐시
    '**/*.dSYM/**', '**/*.ipa', '**/*.app/**', '**/*.xcarchive/**',
    '**/xcuserdata/**', '**/*.xcuserstate',
    '**/*.apk', '**/*.aab', '**/*.iml', '**/*.bks',
    '**/lint-results-*.xml', '**/lint-baseline.xml',
    // 6. Flutter 자동생성 / 데스크톱 플랫폼
    '**/.flutter-plugins', '**/.flutter-plugins-dependencies',
    '**/Generated.xcconfig', '**/flutter_export_environment.sh',
    '**/.metadata', '**/.last_build_id',
    // 7. 패키지 매니저 인증 / IDE 워크스페이스
    '**/.netrc', '**/_netrc',
    '**/.docker/config.json', '**/.dockercfg',
    '**/.kube/config', '**/*.kubeconfig', '**/.htpasswd',
    '**/auth.json', '**/.composer/auth.json',
    '**/.bundle/config', '**/.gem/credentials',
    '**/.pypirc', '**/.cargo/credentials', '**/.cargo/credentials.toml',
    '**/.idea/workspace.xml', '**/.idea/dataSources.xml', '**/.idea/dataSources/**',
    '**/.vscode/sftp.json',
    // 8. 환경변수 변형 / Rails 시크릿 / 일반 시크릿 컨벤션
    '**/.env.local', '**/.env.*.local',
    '**/.env.development', '**/.env.production', '**/.env.staging', '**/.env.test',
    '**/.env.vault',
    '**/secrets.yml', '**/secrets.yaml', '**/secrets.json', '**/*.secrets',
    '**/*.kdbx', '**/*.kdb',
    '**/master.key', '**/.master.key',
    '**/config/master.key', '**/config/credentials/*.yml.enc',
    '**/service-account*.json', '**/*-credentials.json', '**/credentials.json',
    '**/.firebaserc', '**/firebase-debug.log',
    // 9. 추가 인증/암호화 자산
    '**/*.pfx', '**/*.gpg', '**/*.asc', '**/*.enc',
    // 10. 백업 / 임시 / OS 메타
    '**/*.swp', '**/*.swo', '**/*.bak', '**/*.backup', '**/*~',
    '**/.DS_Store', '**/Thumbs.db',
    // 11. 컴파일 산출물 / 네이티브 라이브러리 / 압축
    '**/*.class', '**/*.jar', '**/*.aar', '**/*.war', '**/*.ear',
    '**/*.so', '**/*.a', '**/*.dll', '**/*.dylib', '**/*.lib',
    '**/*.pyc', '**/__pycache__/**',
    '**/*.zip', '**/*.tar', '**/*.tar.gz', '**/*.tgz', '**/*.7z', '**/*.rar',
    '**/*.dmg', '**/*.pkg',
    // 12. DB 데이터 덤프 추가
    '**/*.sql', '**/*.sql.gz', '**/dump.sql',
    '**/*.bson', '**/*.mdb', '**/*.accdb', '**/*.dbf',
    ...platformIgnores, ...(options.ignore || [])
  ];

  const rcPath = path.join(repoPath, '.blinderSettings');
  if (fs.existsSync(rcPath)) {
    try {
      const rcContent = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      if (Array.isArray(rcContent.ignorePaths)) ignorePatterns.push(...rcContent.ignorePaths);
    } catch (err) {}
  }

  const extList = Array.from(extensions);
  const globPattern = extList.length > 1 
    ? `**/*.{${extList.map(e => e.replace(/^\./, '')).join(',')}}`
    : `**/*.${extList[0].replace(/^\./, '')}`;

  const files = await glob(globPattern, { cwd: repoPath, ignore: ignorePatterns, absolute: true });
  const allPatterns = [...patterns, ...(options.customPatterns || [])];

  for (const filePath of files) {
    try {
      const ext = path.extname(filePath);
      const stat = fs.statSync(filePath);
      if (stat.size > 2 * 1024 * 1024) continue;

      const isLargeFile = stat.size > 500 * 1024;
      if (isLargeFile) {
        await scanLargeFile(filePath, repoPath, allPatterns, platforms, results, usedEnvNames, options);
      } else {
        await scanSmallFile(filePath, repoPath, allPatterns, platforms, results, usedEnvNames, options);
      }
    } catch (err) {
      logger.warn(`Scan failed for ${filePath}: ${err.message}`);
    }
  }

  const fileWarnings = await scanSensitiveFiles(repoPath, platforms);
  results.push(...fileWarnings);
  return dedupeResults(results, allPatterns);
}

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
function dedupeResults(results, allPatterns) {
  const patternRank = new Map();
  allPatterns.forEach((p, i) => patternRank.set(p.name, i));
  const rankOf = r => patternRank.has(r.patternName) ? patternRank.get(r.patternName) : Infinity;

  const candidates = [];
  const standalone = [];

  for (const r of results) {
    if (r.isSensitiveFile || !patternRank.has(r.patternName)) {
      standalone.push(r);
    } else {
      candidates.push(r);
    }
  }

  // Group by (file, line) — overlapping matches always sit on the same line.
  const byLine = new Map();
  for (const r of candidates) {
    const key = `${r.file}|${r.line}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push(r);
  }

  const kept = [];
  for (const group of byLine.values()) {
    // Sort by specificity (most-specific first); ties broken by longer match
    // length so substring losers come after the superset winner.
    group.sort((a, b) => {
      const ra = rankOf(a), rb = rankOf(b);
      if (ra !== rb) return ra - rb;
      return b.match.length - a.match.length;
    });

    const accepted = [];
    for (const r of group) {
      const subsumed = accepted.some(a =>
        a.match === r.match || a.match.includes(r.match) || r.match.includes(a.match)
      );
      if (!subsumed) accepted.push(r);
    }
    kept.push(...accepted);
  }

  return [...standalone, ...kept];
}

function getLineNumber(content, index) {
  const prefix = content.substring(0, index);
  return prefix.split('\n').length;
}
