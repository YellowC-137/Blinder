import type { Severity, SensitiveFile, PlatformTestCase, ScanResult, Migration, SecretPattern } from '../types/index.js';

// ─── Platform Hook Contexts ───
export interface PreFixContext {
  repoPath: string;
  relPath: string;
  absPath: string;
  fileSecrets: ScanResult[];
  options: ProtectionOptions;
}

export interface PostFixContext extends PreFixContext {
  ext: string;
  envVarName: string;
}

export interface AdvancedFixContext {
  lineContent: string;
  prevLine: string;
  nextLine: string;
  match: string;
  fullMatch: string;
  envVarName: string;
  ext: string;
  repoPath: string;
  relPath: string;
  options: ProtectionOptions;
  migrations: Migration[];
  logger?: Logger;
}

export interface AdvancedFixResult {
  handled: boolean;
  lineContent?: string;
  injectedText?: string;
  replacedText?: string;
}

// ─── Platform Configuration ───
export interface PlatformConfig {
  id: string;
  name: string;
  category: 'backend' | 'frontend' | 'mobile' | 'core';
  astLanguage?: string;

  detect(repoPath: string): Promise<boolean>;
  commonExtensions: string[];

  sensitiveFiles?: SensitiveFile[];
  commentRegex?: RegExp;
  ignorePaths?: string[];
  testCases?: PlatformTestCase[];

  getAutoFixReplacement?(match: string, envVarName: string, ext: string, options?: Record<string, unknown>): string;
  getGitignoreTemplate?(): string;
  applyAdvancedFix?(context: AdvancedFixContext): Promise<AdvancedFixResult>;
  setupBridge?(repoPath: string): Promise<void>;
  teardownBridge?(repoPath: string): Promise<void>;
  preFix?(context: PreFixContext): Promise<void>;
  postFix?(context: PostFixContext): Promise<void>;
}

// ─── Platform Instance ───
export interface Platform extends PlatformConfig {}

// ─── Options ───
export interface ProtectionOptions {
  dryRun?: boolean;
  mode?: 'auto' | 'manual';
  platforms?: Platform[];
  yes?: boolean;
}

export interface ScannerOptions {
  includeExamples?: boolean;
  customPatterns?: SecretPattern[];
  ignore?: string[];
  scanComments?: boolean;
  skipAST?: boolean;
}

export interface RollbackOptions {
  dryRun?: boolean;
  yes?: boolean;
  platforms?: Platform[];
}

export interface MaskOptions {
  maskOutput?: string;
  path?: string;
  yes?: boolean;
  dryRun?: boolean;
  ignorePaths?: string[];
  customPatterns?: SecretPattern[];
}

// ─── Logger Interface ───
export interface Logger {
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  divider(): void;
  maskSecret(secret: string): string;
  header(msg: string): void;
  finding(opts: FindingOptions): void;
}

export interface FindingOptions {
  severity?: string;
  file: string;
  line?: number;
  patternName: string;
  match?: string;
  masked?: boolean;
}

