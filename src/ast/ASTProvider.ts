import path from 'path';
// web-tree-sitter 0.25+: default export 제거, named export (Parser/Language) 사용
import { Parser, Language } from 'web-tree-sitter';
import fs from 'fs';
import { createRequire } from 'module';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';

const require = createRequire(import.meta.url);

interface ValidateMatchOptions {
  allowComments?: boolean;
}

/**
 * ASTProvider - web-tree-sitter를 활용한 다국어 AST 분석 엔진
 * (보안지침 §4: AST 기반 정밀 검증 로직)
 */
class ASTProvider {
  private parser: Parser | null;
  private languages: Map<string, Language>;
  private initialized: boolean;
  private wasmDir: string;
  private disabled: boolean;
  private _warnedNoWasm: boolean;

  constructor() {
    this.parser = null;
    this.languages = new Map();
    this.initialized = false;
    this.disabled = false;
    this._warnedNoWasm = false;
    const wasmsDir = path.dirname(require.resolve('tree-sitter-wasms/package.json'));
    this.wasmDir = path.join(wasmsDir, 'out');
  }

  /**
   * 트리시터 초기화 및 언어 로드
   *
   * WebAssembly가 비활성화된 환경(--jitless 등)에서는
   * 에러 스팸 없이 조용히 disabled 상태로 전환한다.
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;

    // Node v24.x 에서는 WASM 관련 Turboshaft 컴파일러 버그로 SIGSEGV가 간헐적으로 발생함.
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
    const forceAst = process.env.BLINDER_FORCE_AST === '1';

    if (nodeVersion >= 24 && !forceAst) {
      if (!this._warnedNoWasm) {
        this._warnedNoWasm = true;
        logger.debug(t('ast_engine_disabled'));
      }
      this.disabled = true;
      return false;
    }

    try {
      // 런타임 wasm 파일명: ≤0.25 는 tree-sitter.wasm, 0.26+ 는 web-tree-sitter.wasm
      let selfWasmPath: string;
      try {
        selfWasmPath = require.resolve('web-tree-sitter/tree-sitter.wasm');
      } catch {
        selfWasmPath = require.resolve('web-tree-sitter/web-tree-sitter.wasm');
      }
      await Parser.init({
        locateFile(): string { return selfWasmPath; }
      });
      this.parser = new Parser();
      this.initialized = true;
      return true;
    } catch (err) {
      logger.error(t('ast_init_failed', { msg: (err as Error).stack || (err as Error).message }));
      this.disabled = true;
      return false;
    }
  }

  /**
   * 언어별 WASM 로드
   */
  async loadLanguage(langId: string): Promise<Language> {
    if (this.languages.has(langId)) return this.languages.get(langId)!;

    const wasmPath = path.join(this.wasmDir, `tree-sitter-${langId}.wasm`);
    logger.debug(t('ast_wasm_loading', { path: wasmPath }));
    if (!fs.existsSync(wasmPath)) {
      throw new Error(t('ast_wasm_not_found', { lang: langId, path: wasmPath }));
    }

    try {
      const lang = await Language.load(wasmPath);
      this.languages.set(langId, lang);
      return lang;
    } catch (err) {
      try {
        const wasmBuffer = fs.readFileSync(wasmPath);
        const lang = await Language.load(wasmBuffer);
        this.languages.set(langId, lang);
        return lang;
      } catch (innerErr) {
        logger.debug(t('ast_load_err', { lang: langId, msg: (innerErr as Error).stack || (innerErr as Error).message }));
        throw new Error(t('ast_load_failed', { lang: langId, msg: (innerErr as Error).message || 'Unknown error' }));
      }
    }
  }

  /**
   * 시크릿 후보가 실제 문자열 리터럴 내부인지 검증
   *
   * AST 엔진이 비활성화(disabled)된 경우 정규식 결과를 그대로 신뢰한다.
   */
  async validateMatch(
    filePath: string,
    langId: string,
    matchValue: string,
    startOffset: number,
    opts: ValidateMatchOptions = {}
  ): Promise<boolean> {
    // WASM 비활성화 상태면 즉시 regex fallback
    if (this.disabled) return true;
    if (!this.initialized && !(await this.init())) return true; // Fallback to Regex

    try {
      const lang = await this.loadLanguage(langId);
      this.parser!.setLanguage(lang);

      const sourceCode = fs.readFileSync(filePath, 'utf8');
      // 0.25+ 에서 parse() 가 null 반환 가능 (취소/타임아웃)
      const tree = this.parser!.parse(sourceCode);
      if (!tree) return true; // Fallback to Regex

      // 해당 오프셋에 있는 노드 찾기
      const node = tree.rootNode.descendantForIndex(startOffset);

      if (!node) return false;

      // 노드 타입 검사 (언어별로 다를 수 있음)
      const type = node.type.toLowerCase();
      const isString = type.includes('string') || type.includes('literal') || type.includes('text');
      const isComment = type.includes('comment');

      // 주석 내부에 있으면 기본은 거부. 단, 사용자가 명시적으로 주석 스캔을 옵트인한 경우(opts.allowComments)에는
      // 정규식이 이미 시크릿 형태를 확정했으므로 매치를 통과시킨다.
      if (isComment) return opts.allowComments === true;

      // 문자열 리터럴 내부인지 확인
      return isString;
    } catch (err) {
      // AST 실패 시 디버그 로그만 남기고 조용히 Regex 결과로 대체
      logger.debug(t('ast_skipped', { file: path.basename(filePath), msg: (err as Error).message }));
      return true; // 에러 시 안전하게 정규식 결과 신뢰 (Fallback)
    }
  }

  /**
   * 언어 식별자 매핑
   */
  getLangId(ext: string): string | undefined {
    const mapping: Record<string, string> = {
      '.swift': 'swift',
      '.m': 'objc',
      '.h': 'objc',
      '.mm': 'objc',
      '.kt': 'kotlin',
      '.java': 'java',
      '.dart': 'dart',
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'tsx'
    };
    return mapping[ext];
  }
}

export default new ASTProvider();
