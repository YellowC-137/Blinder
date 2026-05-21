// ─── Severity ───
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// ─── Secret Pattern ───
export interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: Severity;
  multiline?: boolean;
  isFixable?: boolean;
  postFilter?(matchValue: string): boolean;
}

// ─── Scan Result ───
export type ScanResult = SensitiveFileWarning | CodeSecretMatch;

interface ScanResultBase {
  file: string;
  line: number;
  match: string;
  fullMatch: string;
  patternName: string;
  severity: Severity;
  isTestKey: boolean;
  isLikelyExample: boolean;
  content: string;
}

export interface SensitiveFileWarning extends ScanResultBase {
  isSensitiveFile: true;
  isComment: false;
  isFixable: false;
}

export interface CodeSecretMatch extends ScanResultBase {
  isSensitiveFile: false;
  envVarName: string;
  isFixable: boolean;
  isComment: boolean;
  isMultiline: boolean;
  structuredKey?: string;
  classifierReason?: string;
}

// ─── Migration ───
export interface Migration {
  file: string;
  envVarName: string;
  accessor: string;
  injectedText: string;
  replacedText: string;
  line?: number;
}

// ─── Protection Metadata ───
export interface ProtectionMetadata {
  migrations: Migration[];
  createdAt: string;
  version: string;
}

// ─── Masking Map ───
export interface MaskingMap {
  version: string;
  createdAt: string;
  projectRoot: string;
  mappings: Record<string, {
    originalValue: string;
    redactedTag: string;
    files: string[];
  }>;
  fileHashes: Record<string, string>;
  allFiles: string[];
}

// ─── Rollback Report ───
export interface RollbackReport {
  codeRestored: boolean;
  restoreCount: number;
  skipCount: number;
  skipReasons: {
    alreadyRestored: number;
    fileNotFound: number;
    secretMissing: number;
    accessorNotFound: number;
  };
  bridgeResults: Array<{ name: string; success: boolean; error?: string }>;
  skippedFiles: Array<{ file: string; reason: string }>;
}

// ─── Config ───
export interface BlinderConfig {
  customPatterns: SecretPattern[];
  ignorePaths: string[];
  maskOutput: string;
}

// ─── Project Detection ───
export interface ProjectDetection {
  platforms: import('../platforms/types.js').Platform[];
  root: string;
}

// ─── Sensitive File ───
export interface SensitiveFile {
  glob: string;
  severity: Severity;
  reason: string;
}

// ─── Test Case ───
export interface PlatformTestCase {
  input: string;
  expected: string;
  ext: string;
  envVarName: string;
}
