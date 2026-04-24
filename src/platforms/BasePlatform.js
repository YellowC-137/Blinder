import logger from '../utils/logger.js';

/**
 * BasePlatform - 플러그인 인터페이스 강제화를 위한 기반 클래스
 * (보안지침 §4: 플랫폼별 플러그인 아키텍처 및 인터페이스 정의)
 */
export class BasePlatform {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.category = config.category || 'custom';
    this.commonExtensions = config.commonExtensions || [];
    this.sensitiveFiles = config.sensitiveFiles || [];
    this.ignorePaths = config.ignorePaths || [];
    this.commentRegex = config.commentRegex || /^\s*(\/\/|\/\*|\*|#)/;
    this.testCases = config.testCases || [];
    
    // Optional Hooks
    this._preFix = config.preFix;
    this._postFix = config.postFix;
    this._applyAdvancedFix = config.applyAdvancedFix;
    this._setupBridge = config.setupBridge;
    this._teardownBridge = config.teardownBridge;
    this._getAutoFixReplacement = config.getAutoFixReplacement;
    this._getGitignoreTemplate = config.getGitignoreTemplate;
    this._detect = config.detect;
  }

  /**
   * 프로젝트 감지 로직 (필수 구현)
   */
  async detect(repoPath) {
    if (this._detect) return await this._detect(repoPath);
    throw new Error(`[${this.name}] detect() method not implemented.`);
  }

  /**
   * 환경 변수 접근자 코드 생성 (필수 구현)
   */
  getAutoFixReplacement(match, envVarName, ext, options) {
    if (this._getAutoFixReplacement) {
      return this._getAutoFixReplacement(match, envVarName, ext, options);
    }
    // Default fallback
    return `process.env.${envVarName}`;
  }

  /**
   * .gitignore 템플릿 반환
   */
  getGitignoreTemplate() {
    if (this._getGitignoreTemplate) return this._getGitignoreTemplate();
    return '';
  }

  /**
   * 고급 치환 로직 (Stage 1)
   */
  async applyAdvancedFix(context) {
    if (this._applyAdvancedFix) return await this._applyAdvancedFix(context);
    return { handled: false };
  }

  /**
   * 브리지 설정
   */
  async setupBridge(repoPath) {
    if (this._setupBridge) await this._setupBridge(repoPath);
  }

  /**
   * 브리지 제거
   */
  async teardownBridge(repoPath) {
    if (this._teardownBridge) await this._teardownBridge(repoPath);
  }

  // Lifecycle Hooks
  async preFix(context) { if (this._preFix) await this._preFix(context); }
  async postFix(context) { if (this._postFix) await this._postFix(context); }
}
