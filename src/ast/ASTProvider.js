import path from 'path';
// import Parser from 'web-tree-sitter';
import fs from 'fs';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';

/**
 * ASTProvider - web-tree-sitter를 활용한 다국어 AST 분석 엔진
 * (보안지침 §4: AST 기반 정밀 검증 로직)
 */
class ASTProvider {
  constructor() {
    this.parser = null;
    this.languages = new Map();
    this.initialized = false;
    this.wasmDir = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../../node_modules/tree-sitter-wasms/out');
  }

  /**
   * 트리시터 초기화 및 언어 로드
   *
   * WebAssembly가 비활성화된 환경(--jitless 등)에서는
   * 에러 스팸 없이 조용히 disabled 상태로 전환한다.
   */
  async init() {
    if (this.initialized) return true;

    // Node v24.8.0 에서는 WASM 관련 Turboshaft 컴파일러 버그로 SIGSEGV가 간헐적으로 발생함.
    // 안전을 위해 완전히 비활성화 (disabled = true) 하고 regex fallback을 타게 함.
    if (!this._warnedNoWasm) {
      this._warnedNoWasm = true;
      logger.debug(t('ast_engine_disabled'));
    }
    this.disabled = true;
    return false;

    try {
      const selfWasmPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../../node_modules/web-tree-sitter/tree-sitter.wasm');
      await Parser.init({
        locateFile() { return selfWasmPath; }
      });
      this.parser = new Parser();
      this.initialized = true;
      return true;
    } catch (err) {
      logger.error(t('ast_init_failed', { msg: err.stack || err.message }));
      this.disabled = true;
      return false;
    }
  }

  /**
   * 언어별 WASM 로드
   */
  async loadLanguage(langId) {
    if (this.languages.has(langId)) return this.languages.get(langId);

    const wasmPath = path.join(this.wasmDir, `tree-sitter-${langId}.wasm`);
    logger.debug(t('ast_wasm_loading', { path: wasmPath }));
    if (!fs.existsSync(wasmPath)) {
      throw new Error(t('ast_wasm_not_found', { lang: langId, path: wasmPath }));
    }

    try {
      const lang = await Parser.Language.load(wasmPath);
      this.languages.set(langId, lang);
      return lang;
    } catch (err) {
      try {
        const wasmBuffer = fs.readFileSync(wasmPath);
        const lang = await Parser.Language.load(wasmBuffer);
        this.languages.set(langId, lang);
        return lang;
      } catch (innerErr) {
        logger.debug(t('ast_load_err', { lang: langId, msg: innerErr.stack || innerErr.message }));
        throw new Error(t('ast_load_failed', { lang: langId, msg: innerErr.message || 'Unknown error' }));
      }
    }
  }

  /**
   * 시크릿 후보가 실제 문자열 리터럴 내부인지 검증
   *
   * AST 엔진이 비활성화(disabled)된 경우 정규식 결과를 그대로 신뢰한다.
   */
  async validateMatch(filePath, langId, matchValue, startOffset, opts = {}) {
    // WASM 비활성화 상태면 즉시 regex fallback
    if (this.disabled) return true;
    if (!this.initialized && !(await this.init())) return true; // Fallback to Regex

    try {
      const lang = await this.loadLanguage(langId);
      this.parser.setLanguage(lang);

      const sourceCode = fs.readFileSync(filePath, 'utf8');
      const tree = this.parser.parse(sourceCode);

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
      logger.debug(t('ast_skipped', { file: path.basename(filePath), msg: err.message }));
      return true; // 에러 시 안전하게 정규식 결과 신뢰 (Fallback)
    }
  }

  /**
   * 언어 식별자 매핑
   */
  getLangId(ext) {
    const mapping = {
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
