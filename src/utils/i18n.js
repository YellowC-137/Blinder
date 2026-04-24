import { getGlobalConfig } from './globalConfig.js';

const translations = {
  ko: {
    // CLI descriptions
    cli_desc: 'Blinder - 플러그인 아키텍처 기반 AI 에이전트 보안 및 시크릿 보호 도구',
    scan_desc: '프로젝트 내 민감 정보 스캔',
    blind_desc: '전체 설정 수행 (스캔 + 보호 + gitignore)',
    bridge_desc: '네이티브 빌드 시스템과 .env 통합 자동화',
    rollback_desc: '모든 보호 조치 되돌리기',
    mask_desc: 'AI 에이전트 전송용 시크릿 마스킹',
    restore_desc: 'AI 작업물을 원본 프로젝트로 복원',
    gitignore_desc: '플랫폼별 .gitignore 생성',
    add_platform_desc: '새로운 플랫폼 플러그인 스캐폴딩 추가',
    set_language_desc: 'CLI 표시 언어 설정 (ko/en)',

    // Messages
    detecting_project: '프로젝트 유형 감지 중...',
    project_root: '프로젝트 루트:',
    detected_platforms: '감지된 플랫폼:',
    scanning_secrets: '시크릿 스캔 중...',
    scan_complete: '스캔 완료. {count}개의 잠재적 시크릿 발견.',
    no_secrets: '시크릿을 찾지 못했습니다!',
    header_results: '스캔 결과',
    tips: '💡 팁: 프로젝트 루트에 ".blinderSettings" 파일을 두어 특정 폴더를 무시할 수 있습니다.',
    process_finished: '프로세스 종료!',
    protection_active: 'Blinder 보호가 활성화되었습니다.',
    
    // Commands
    lang_changed: '언어가 {lang}(으)로 변경되었습니다.'
  },
  en: {
    // CLI descriptions
    cli_desc: 'Blinder - AI-Agent Security & Secret Protection with Plugin Architecture',
    scan_desc: 'Scan project for sensitive information',
    blind_desc: 'Complete setup (Scan + Protect + Gitignore)',
    bridge_desc: 'Automate .env integration with native build systems',
    rollback_desc: 'Rollback all protection changes',
    mask_desc: 'Mask secrets for AI-agent work',
    restore_desc: 'Restore AI changes to original project',
    gitignore_desc: 'Generate platform-specific .gitignore',
    add_platform_desc: 'Add a new platform plugin scaffolding',
    set_language_desc: 'Set CLI language (ko/en)',

    // Messages
    detecting_project: 'Detecting project type...',
    project_root: 'Project root:',
    detected_platforms: 'Detected platforms:',
    scanning_secrets: 'Scanning for secrets...',
    scan_complete: 'Scan complete. Found {count} potential secrets.',
    no_secrets: 'No secrets found!',
    header_results: 'Scan Results',
    tips: '💡 TIP: Use a ".blinderSettings" file in your project root to ignore specific folders.',
    process_finished: 'Process Finished!',
    protection_active: 'Blinder protection is now active.',

    // Commands
    lang_changed: 'Language changed to {lang}.'
  }
};

export function t(key, params = {}) {
  const config = getGlobalConfig();
  const lang = config.language || 'ko';
  
  let message = translations[lang]?.[key] || translations['ko'][key] || key;
  
  Object.keys(params).forEach(p => {
    message = message.replace(`{${p}}`, params[p]);
  });
  
  return message;
}
