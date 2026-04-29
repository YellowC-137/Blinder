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
    lang_changed: '언어가 {lang}(으)로 변경되었습니다.',

    // First-run language selection
    first_run_welcome: '\n👋 Blinder에 오신 것을 환영합니다 / Welcome to Blinder',
    first_run_choose_lang: '사용할 언어를 선택하세요 / Choose your language',
    lang_saved: '언어 설정이 {lang}(으)로 저장되었습니다. (~/.blinder/config.json)',

    // Prompts
    prompt_target_subdir: '마스킹할 하위 디렉토리를 입력하세요 (전체 프로젝트는 Enter):',
    prompt_target_subdir_hint: ' (예: src/features/login)',
    prompt_exclude_dirs_mask: '제외할 폴더 또는 파일이 있나요? (콤마로 구분된 glob 패턴, 예: "**/ExtLib/**, **/Temp/**", 없으면 Enter):',
    prompt_exclude_dirs_blind: '제외할 폴더 또는 파일이 있나요? (콤마로 구분된 glob 패턴, 예: "**/ExtLib/**, **/Temp/**", 없으면 Enter):',
    prompt_scan_comments: '주석 처리된 코드 안의 시크릿도 스캔할까요? (테스트/상용 값을 주석으로 토글하는 설정 파일에 유용)',
    prompt_committed: '현재 변경 사항을 커밋하셨고 진행할 준비가 되셨나요?',
    prompt_choose_proceed: '시크릿 보호 진행 방식을 선택하세요:',
    prompt_run_bridge: '"blinder bridge"를 실행해 .env와 네이티브 빌드를 자동 통합할까요?',
    prompt_include_tests: '테스트 관련 키 {count}개가 발견되었습니다. 함께 처리할까요?',
    choice_auto: 'Auto-fix (권장: 시크릿을 환경변수 호출로 자동 치환)',
    choice_manual: 'Manual (.env만 생성, 코드 마이그레이션은 수동)',
    choice_exit: 'Exit (아무것도 하지 않고 종료)',
    files_for_autofix: '\n다음 파일들이 Auto-fix 대상입니다:\n{files}',
    applying_filters: '추가 필터 적용 중: {filters}...',
    rescanning: '새 필터로 재스캔 중...',
    scan_updated: '스캔 갱신. 남은 시크릿 수: {count}',
    no_remaining_after_filter: '필터 적용 후 남은 시크릿 없음. 종료합니다.',
    cancel_for_safety: '사용자가 안전을 위해 작업을 취소했습니다.',
    user_skipped: '사용자가 작업을 건너뜁니다.',
    excluding_user_patterns: '사용자 지정 제외 패턴 적용: {patterns}',

    // Commented secrets
    section_hardcoded: '\n🔍 하드코딩된 시크릿 ({count}건):',
    section_commented: '\n💬 주석 처리된 시크릿 ({count}건) — 검토 전용, auto-fix 미수행:',
    commented_recommend_delete: '   → 권장 조치: 주석 처리된 시크릿 라인을 소스에서 삭제하세요.',
    commented_protect_warn: '\n💬 {count}건의 주석 처리된 시크릿 발견 — auto-fix 건너뜀:',
    commented_protect_hint: '  → 게시 전에 위 주석 라인을 수동으로 삭제하세요.\n',

    // Build / commit warnings
    caution_build_modify: '⚠️  주의: 빌드 설정 파일이 수정될 수 있습니다',
    caution_build_detail: '   본 도구는 auto-fix 또는 환경변수 브릿지 수행 시 build.gradle, .pbxproj 등 핵심 빌드 파일을 수정할 수 있습니다.',
    caution_commit_first: '   진행 전에 모든 변경 사항을 Git에 커밋했는지 확인하세요.',

    // Mask command
    mask_tip_settings: '\n💡 팁: 마스킹 출력 경로는 ".blinderSettings" 파일에서 커스터마이징할 수 있습니다.',
    mask_indexing: '파일을 인덱싱하고 시크릿을 스캔하는 중...',
    mask_path_not_found: '경로를 찾을 수 없습니다: {path}',
    mask_into: '프로젝트를 {dir}에 마스킹하는 중...',
    mask_complete: '마스킹 완료',
    mask_safe_copy: '안전한 프로젝트 복사본 위치: {dir}',
    mask_mapping_saved: '시크릿 매핑 저장됨: {path}',
    mask_note_ai: '참고: 본 파일들은 AI 컨텍스트용입니다. 운영 환경에서는 원본 파일을 사용하세요.',

    // Sensitive files banner
    section_sensitive_files: '\n🚨 민감 파일 발견 ({count}건):',
    rerunning_blind: 'Blinder - Blind 보호',
    dryrun_warn: '드라이런 모드: 어떤 파일도 수정되지 않습니다.',
    target_platforms: '대상 플랫폼: {names}'
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
    lang_changed: 'Language changed to {lang}.',

    // First-run language selection
    first_run_welcome: '\n👋 Welcome to Blinder / Blinder에 오신 것을 환영합니다',
    first_run_choose_lang: 'Choose your language / 사용할 언어를 선택하세요',
    lang_saved: 'Language saved as {lang}. (~/.blinder/config.json)',

    // Prompts
    prompt_target_subdir: 'Enter a specific subdirectory to mask (or press Enter for the entire project):',
    prompt_target_subdir_hint: ' (e.g., src/features/login)',
    prompt_exclude_dirs_mask: 'Are there any folders or files you want to EXCLUDE from masking? (Enter glob patterns separated by comma, e.g., "**/ExtLib/**, **/Temp/**", or leave empty):',
    prompt_exclude_dirs_blind: 'Are there any folders or files you want to EXCLUDE? (Enter glob patterns separated by comma, e.g., "**/ExtLib/**, **/Temp/**", or leave empty):',
    prompt_scan_comments: 'Also scan secrets inside commented-out code? (useful when configs swap test/prod values via comments)',
    prompt_committed: 'Have you committed your current changes and are you ready to proceed?',
    prompt_choose_proceed: 'Choose how to proceed with secret protection:',
    prompt_run_bridge: 'Would you like to run "blinder bridge" now to automate .env integration with native builds?',
    prompt_include_tests: 'Found {count} test-related keys. Would you like to process them as well?',
    choice_auto: 'Auto-fix (Recommended: Automatically replace secrets with environment variable calls)',
    choice_manual: 'Manual (Generate .env but perform code migration manually)',
    choice_exit: 'Exit (Do nothing and exit)',
    files_for_autofix: '\nThe following files are targeted for Auto-fix:\n{files}',
    applying_filters: 'Applying additional filters: {filters}...',
    rescanning: 'Re-scanning with new filters...',
    scan_updated: 'Scan updated. Remaining secrets to fix: {count}',
    no_remaining_after_filter: 'No secrets remaining after filtering. Exiting.',
    cancel_for_safety: 'Operation cancelled by user for safety.',
    user_skipped: 'Operation skipped by user.',
    excluding_user_patterns: 'Excluding user-specified patterns: {patterns}',

    // Commented secrets
    section_hardcoded: '\n🔍 Hardcoded Secrets ({count}):',
    section_commented: '\n💬 Commented-out Secrets ({count}) — review only, auto-fix skipped:',
    commented_recommend_delete: '   → Recommendation: delete commented-out secret lines from source.',
    commented_protect_warn: '\n💬 Found {count} commented-out secret(s) — auto-fix skipped:',
    commented_protect_hint: '  → Delete these commented lines manually before publishing source.\n',

    // Build / commit warnings
    caution_build_modify: '⚠️  CAUTION: Build Configuration Modification',
    caution_build_detail: '   This tool may modify your project\'s core build files (build.gradle, .pbxproj, etc.) when performing auto-fixes or environment bridging.',
    caution_commit_first: '   Please ensure you have committed all changes to Git before proceeding.',

    // Mask command
    mask_tip_settings: '\n💡 TIP: You can customize masked output paths via ".blinderSettings" file.',
    mask_indexing: 'Indexing files and scanning for secrets...',
    mask_path_not_found: 'Path not found: {path}',
    mask_into: 'Masking project into {dir}...',
    mask_complete: 'Masking Complete',
    mask_safe_copy: 'Safe copy of project available in: {dir}',
    mask_mapping_saved: 'Secret mapping saved: {path}',
    mask_note_ai: 'Note: These files are for AI context. Use original files for production.',

    // Sensitive files banner
    section_sensitive_files: '\n🚨 Sensitive Files Detected ({count}):',
    rerunning_blind: 'Blinder - Blind Protection',
    dryrun_warn: 'RUNNING IN DRY-RUN MODE: No files will be modified.',
    target_platforms: 'Target Platforms: {names}'
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
