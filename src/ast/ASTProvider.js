import path from 'path';
import { Parser, Language } from 'web-tree-sitter';
import fs from 'fs';
import logger from '../utils/logger.js';

/**
 * ASTProvider - web-tree-sitter를 활용한 다국어 AST 분석 엔진
 * (보안지침 §4: AST 기반 정밀 검증 로직)
 */
class ASTProvider {
  constructor() {
    this.parser = null;
    this.languages = new Map();
    this.initialized = false;
    this.wasmDir = path.resolve(path.dirname(import.meta.url.replace('file://', '')), 'grammars');
  }

  /**
   * 트리시터 초기화 및 언어 로드
   */
  async init() {
    if (this.initialized) return true;
    try {
      const selfWasmPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../../node_modules/web-tree-sitter/web-tree-sitter.wasm');
      await Parser.init({
        locateFile() { return selfWasmPath; }
      });
      this.parser = new Parser();
      this.initialized = true;
      return true;
    } catch (err) {
      logger.error(`AST Engine initialization failed: ${err.stack || err.message}`);
      return false;
    }
  }

  /**
   * 언어별 WASM 로드
   */
  async loadLanguage(langId) {
    if (this.languages.has(langId)) return this.languages.get(langId);

    const wasmPath = path.join(this.wasmDir, `tree-sitter-${langId}.wasm`);
    logger.debug(`Loading WASM from: ${wasmPath}`);
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM grammar for ${langId} not found at ${wasmPath}`);
    }

    try {
      const wasmBuffer = fs.readFileSync(wasmPath);
      const lang = await Language.load(wasmBuffer);
      this.languages.set(langId, lang);
      return lang;
    } catch (err) {
      logger.error(`Language.load error for ${langId}: ${err.stack || err.message}`);
      throw new Error(`Failed to load ${langId} grammar: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * 시크릿 후보가 실제 문자열 리터럴 내부인지 검증
   */
  async validateMatch(filePath, langId, matchValue, startOffset) {
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

      // 주석 내부에 있으면 시크릿으로 간주하지 않음 (선택 사항, 보안 정책에 따라 다름)
      if (isComment) return false;

      // 문자열 리터럴 내부인지 확인
      return isString;
    } catch (err) {
      logger.warn(`AST validation skipped for ${path.basename(filePath)}: ${err.message}`);
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
      '.dart': 'dart'
    };
    return mapping[ext];
  }
}

export default new ASTProvider();
