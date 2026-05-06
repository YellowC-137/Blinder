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
    target_platforms: '대상 플랫폼: {names}',

    // iOS Bridge
    ios_bridge_script_gen: 'iOS 연동 스크립트가 생성되었습니다: blinder-ios-setup.sh',
    ios_bridge_setup_failed: 'iOS 브릿지 설정 실패: {msg}',
    ios_bridge_manual_req: '⚠️ 중요: 수동 Xcode 설정 필요',
    ios_bridge_no_podfile: 'Podfile을 찾을 수 없습니다. Xcode에서 환경변수를 불러오도록 수동으로 설정해야 합니다.',
    ios_bridge_steps_title: '\n연동을 완료하려면 다음 단계를 따르세요 (Xcode 15+ 필수):',
    ios_bridge_step1: '1. Xcode에서 프로젝트를 엽니다.',
    ios_bridge_step2: '2. Target -> Build Phases -> + -> New Run Script Phase 를 선택합니다.',
    ios_bridge_step3: '3. 이름을 "Blinder Env Loader"로 지정하고 가장 맨 아래로 이동시킵니다.',
    ios_bridge_step4: '4. 🚨 중요: "Based on dependency analysis" 체크를 해제합니다.',
    ios_bridge_step5: '5. 🚨 중요 (Xcode 15+): Build Settings 로 가서 "Sandboxing"을 검색한 뒤 "User Script Sandboxing"을 "NO"로 설정합니다.',
    ios_bridge_step6: '6. 위에서 출력된 코드(또는 blinder-ios-setup.sh) 내용을 붙여넣습니다.\n',
    ios_bridge_pod_success: 'Podfile에 Blinder 훅을 성공적으로 주입했습니다.',
    ios_bridge_pod_install: '🚨 중요: Xcode에 변경 사항을 적용하려면 iOS 디렉토리에서 "pod install"을 실행하세요.',
    ios_bridge_pod_note: '   참고: 빌드 중 "Permission Denied" 오류가 발생하면 Xcode 빌드 설정에서 "User Script Sandboxing"이 "NO"로 설정되어 있는지 확인하세요.',
    ios_setup_script_success: '✅ 설정 스크립트가 생성되었습니다. 위 안내에 따라 마무리하세요.',

    // Bridge command
    bridge_header: 'Blinder - 브릿지 설정',
    bridge_no_platforms: '브릿지를 설정할 플랫폼이 감지되지 않았습니다.',
    bridge_tethering: '다음 플랫폼에 .env 연동 중: {names}',
    bridge_failed: '{name} 브릿지 설정 실패: {msg}',
    bridge_complete: '브릿지 설정 프로세스가 완료되었습니다.',

    // Rollback command
    rollback_header: 'Blinder - 롤백',
    rollback_success: '소스 코드 복원됨: {count}개의 변경 사항이 적용되었습니다.',
    rollback_skipped: '{count}개 건너뜀{detail}.',
    rollback_bridge_success: '{name}의 브릿지가 제거되었습니다',
    rollback_bridge_failed: '{name} 브릿지 제거 실패: {error}',
    rollback_files_title: '\n📋 정리할 파일 목록:',
    rollback_prompt_delete: '이 파일들을 삭제하여 완전히 롤백하시겠습니까?',
    rollback_deleted: '삭제됨: {label}',
    rollback_gitignore: '복원됨: .gitignore (Blinder 섹션 제거됨)',
    rollback_nothing: '정리할 것이 없습니다. 프로젝트가 이미 원래 상태입니다.',
    rollback_complete: '롤백 완료',

    // Restore command
    restore_no_map: '매핑 파일 (.blinder_map.json)을 어떤 디렉토리에서도 찾을 수 없습니다.',
    restore_run_mask_first: '먼저 "blinder mask"를 실행하거나 -o 옵션으로 디렉토리를 지정하세요.',
    restore_no_map_in_dir: '매핑 파일 (.blinder_map.json)을 찾을 수 없음: {dir}',
    restore_header: 'Blinder - AI 변경 사항 복원',
    restore_source: '원본 폴더: {dir}',
    restore_masked_at: '마스킹 시간: {date}',
    restore_target_paths: '대상 경로: {paths}',
    restore_analyzing: '변경 사항 분석 중...',
    restore_summary_title: '📋 AI 에이전트 작업 요약:',
    restore_modified: '  ✏️  수정됨: {file}',
    restore_added: '  ➕ 추가됨:    {file}',
    restore_deleted_count: '  🗑️  삭제됨:  {count}개 파일',
    restore_total_stats: '  📊 총계: {mod} 수정 / {add} 추가 / {del} 삭제 ({unchanged} 변경 없음)',
    restore_missing_tags_title: '\n⚠️  누락된 마스킹 태그 발견 ({count}개):',
    restore_missing_tags_desc: '이 태그들은 이전에 있었지만 AI가 수정하거나 삭제했습니다.',
    restore_prompt_proceed: '그래도 복원을 진행하시겠습니까?',
    restore_integrity_check_ok: '\n✔ 태그 무결성 검사: 모든 BLINDER 태그가 존재합니다.',
    restore_auto_repaired: '  🔧 자동 수정: {count}개의 누락된 import문 복구 ({file})',
    restore_nothing: '복원할 파일이 없거나 요청한 경로에 변경 사항이 없습니다.',
    restore_prompt_apply: '이 변경 사항을 루트 프로젝트에 적용하시겠습니까?',
    restore_restored_file: '✔ 복원됨: {file}',
    restore_restore_failed: '{file} 파일 복원 실패: {msg}',
    restore_added_file: '✔ 추가됨: {file}',
    restore_add_failed: '{file} 파일 추가 실패: {msg}',
    restore_prompt_delete: '마스킹된 환경에서 "{file}" 파일이 삭제되었습니다. 원본 프로젝트에서도 삭제하시겠습니까?',
    restore_deleted_file: '✔ 삭제됨: {file}',
    restore_delete_failed: '{file} 파일 삭제 실패: {msg}',
    restore_complete: '복원 완료',
    restore_prompt_cleanup: '임시 마스킹 디렉토리를 정리하시겠습니까?',
    restore_cleanup_success: '마스킹된 폴더를 정리했습니다.',
    restore_cleanup_partial: '일부 정리됨: {errCode}: {errMsg}. 필요 시 {dir} 디렉토리를 수동으로 삭제하세요.',
    restore_diff_preview: '변경 사항 미리보기',

    // Protect command
    protect_no_secrets: '보호할 시크릿이 발견되지 않았습니다!',
    protect_no_fixable: '수정 가능한 시크릿이 없습니다. 보고서만 생성합니다.',
    protect_header: 'Blinder - 시크릿 보호',
    protect_processing_prod: '{count}개의 프로덕션 시크릿을 처리 중입니다...',
    protect_env_updated: '.env 및 .env.example 파일이 업데이트되었습니다!',
    protect_plan_autofix: '계획: 소스 코드에 Auto-fix를 적용합니다...',
    protect_apply_autofix: '소스 코드에 Auto-fix를 적용하는 중...',
    protect_metadata_saved: '롤백 메타데이터가 .blinder_protect.json에 저장되었습니다',
    protect_no_selection: '마이그레이션할 시크릿이 선택되지 않았습니다.',
    protect_prompt_migrate: '{label} {file}:{line} 에서 시크릿 "{secret}" 발견. {env} 변수로 마이그레이션할까요?',
    protect_auto_migrating: '{label} 자동 마이그레이션 중: "{secret}" ({file}:{line})',
    protect_manual_req: '수동 작업 필요',
    protect_manual_desc: '마이그레이션을 완료하려면, 소스 코드의 하드코딩된 시크릿을 환경 변수 호출로 대체하세요:',
    protect_manual_examples: '구현 예시:',
    protect_manual_success: '.env 파일에 시크릿이 업데이트되었습니다. 이제 해당 변수들을 사용할 수 있습니다.',

    // Gitignore command
    gitignore_already_contains: '.gitignore 파일에 이미 {name} 섹션이 있습니다. 건너뜁니다.',
    gitignore_added_section: '.gitignore에 {name} 섹션을 추가했습니다',
    gitignore_updated_success: '.gitignore 파일이 성공적으로 업데이트되었습니다!',

    // Add Platform command
    add_platform_header: 'Blinder - 플랫폼 플러그인 추가',
    add_platform_start: '새로운 플랫폼 플러그인을 생성합니다.\n',
    add_platform_prompt_id: 'Platform ID (소문자, 영문. 예: ruby, django):',
    add_platform_err_id_req: 'ID는 필수입니다.',
    add_platform_err_id_fmt: '소문자, 숫자, _만 사용하세요 (첫 글자는 영문).',
    add_platform_prompt_name: 'Platform 이름 (사용자 표시용. 예: Ruby on Rails):',
    add_platform_err_name_req: '이름은 필수입니다.',
    add_platform_prompt_cat: 'Category를 선택하세요:',
    add_platform_cat_backend: '1. Backend',
    add_platform_cat_frontend: '2. Frontend',
    add_platform_cat_mobile: '3. Mobile',
    add_platform_cat_custom: '4. Custom',
    add_platform_prompt_custom_cat: '커스텀 Category 이름을 입력하세요 (소문자 영문, 예: infrastructure):',
    add_platform_err_cat_req: 'Category 이름은 필수입니다.',
    add_platform_err_cat_fmt: '소문자, 숫자, _만 사용하세요 (첫 글자는 영문).',
    add_platform_prompt_ext: '스캔할 파일 확장자 (콤마 구분. 예: .rb,.yml):',
    add_platform_err_ext_req: '최소 하나의 확장자가 필요합니다.',
    add_platform_prompt_detect: '프로젝트 감지 파일 (예: Gemfile, pom.xml):',
    add_platform_err_detect_req: '감지 파일은 필수입니다.',
    add_platform_created: '플러그인 파일 생성: {path}',
    add_platform_registered: '레지스트리 등록: platforms/index.js',
    add_platform_already_reg: '이미 index.js에 등록되어 있거나 파일을 찾을 수 없습니다.',
    add_platform_success: '플러그인이 생성되었습니다!',
    add_platform_file_path: '📁 파일: src/platforms/{cat}/{id}.js',
    add_platform_next_steps: '🚀 다음 단계:',
    add_platform_step1: '  1. 생성된 파일의 detect() 로직을 프로젝트에 맞게 수정하세요.',
    add_platform_step2: '  2. getAutoFixReplacement()의 치환 코드를 확인하세요.',
    add_platform_step3: '  3. 테스트: blinder scan --path /your/project --dry-run',

    // AST Provider
    ast_engine_disabled: 'AST 엔진 비활성화: Node.js v24.8.0 Turboshaft 크래시 버그로 인해 WebAssembly가 우회되었습니다. 정규식 전용 모드로 대체합니다.',

    // Flutter Bridge
    flutter_vscode_updated: 'VS Code launch.json 파일이 --dart-define-from-file 로 업데이트되었습니다',
    flutter_vscode_update_failed: 'VS Code launch.json 자동 업데이트에 실패했습니다.',
    flutter_no_ide_configs: 'Flutter .env 로딩을 자동화할 IDE 설정을 찾을 수 없습니다.',
    flutter_ide_applied: 'Flutter .env 자동화가 IDE 설정에 적용되었습니다.',
    flutter_cli_wrapper_gen: 'Flutter CLI 래퍼가 생성되었습니다: f.sh',
    flutter_cli_wrapper_failed: 'f.sh 래퍼 생성에 실패했습니다.',
    flutter_manual_tip: '수동 팁: 터미널에서 .env가 로드되도록 하려면 "./f.sh run"을 사용하세요.',

    // Android Bridge
    android_no_gradle: 'Android 앱 build.gradle을 찾을 수 없습니다. 안드로이드 브릿지를 건너뜁니다.',
    android_proguard_note: '   참고: Proguard/R8을 사용하는 경우, 리플렉션을 통해 읽으려면 BuildConfig가 난독화되지 않았는지 확인하세요.',

    // iOS Bridge (Additional)
    ios_hook_injected_existing: '  [+] 기존 post_install 블록에 훅을 주입했습니다.',
    ios_hook_injected_new: '  [+] blinder 훅이 포함된 새 post_install 블록을 생성했습니다.',

    // React Platform
    react_unknown_build_tool: '[react] 알 수 없는 빌드 도구 — CRA 스타일의 REACT_APP_* 접두사로 대체합니다. 명시적 감지를 위해 react-scripts, vite 또는 next를 의존성에 추가하세요.',

    // Config
    config_loaded: '.blinderSettings에서 구성을 로드했습니다',

    // CLI Main
    error_unexpected: '예기치 않은 오류가 발생했습니다:',
    report_generated: '자동 보고서가 생성되었습니다: blinder_reports/{file}',
    ci_secrets_found: 'CI 모드에서 시크릿이 발견되었습니다. 상태 코드 1로 종료합니다.'
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
    target_platforms: 'Target Platforms: {names}',

    // iOS Bridge
    ios_bridge_script_gen: 'iOS integration script generated: blinder-ios-setup.sh',
    ios_bridge_setup_failed: 'iOS bridge setup failed: {msg}',
    ios_bridge_manual_req: '⚠️ IMPORTANT: Manual Xcode Setup Required',
    ios_bridge_no_podfile: 'No Podfile found. You MUST manually configure Xcode to load environment variables.',
    ios_bridge_steps_title: '\nFollow these steps to finalize integration (Essential for Xcode 15+):',
    ios_bridge_step1: '1. Open your project in Xcode.',
    ios_bridge_step2: '2. Go to Target -> Build Phases -> + -> New Run Script Phase.',
    ios_bridge_step3: '3. Name it "Blinder Env Loader" and move it to the VERY BOTTOM.',
    ios_bridge_step4: '4. 🚨 CRUCIAL: Uncheck "Based on dependency analysis".',
    ios_bridge_step5: '5. 🚨 CRUCIAL (Xcode 15+): Go to Build Settings -> Search "Sandboxing" -> Set "User Script Sandboxing" to "NO".',
    ios_bridge_step6: '6. The code to paste was displayed above (or find it in blinder-ios-setup.sh).\n',
    ios_bridge_pod_success: 'Successfully injected Blinder hooks into Podfile.',
    ios_bridge_pod_install: '🚨 IMPORTANT: Run "pod install" in your iOS directory to apply changes to Xcode.',
    ios_bridge_pod_note: '   Note: If you encounter "Permission Denied" errors during build, ensure "User Script Sandboxing" is set to "NO" in Xcode Build Settings.',
    ios_setup_script_success: '✅ Setup script generated. Follow the instructions above to finalize.',

    // Bridge command
    bridge_header: 'Blinder - Bridge Configuration',
    bridge_no_platforms: 'No platforms detected for bridging.',
    bridge_tethering: 'Tethering .env to: {names}',
    bridge_failed: 'Failed to setup bridge for {name}: {msg}',
    bridge_complete: 'Bridge configuration process complete.',

    // Rollback command
    rollback_header: 'Blinder - Rollback',
    rollback_success: 'Source code restored: {count} changes applied.',
    rollback_skipped: '{count} skipped{detail}.',
    rollback_bridge_success: 'Removed bridge for {name}',
    rollback_bridge_failed: 'Failed to teardown bridge for {name}: {error}',
    rollback_files_title: '\n📋 Files to clean up:',
    rollback_prompt_delete: 'Delete these files to fully rollback?',
    rollback_deleted: 'Deleted: {label}',
    rollback_gitignore: 'Restored: .gitignore (Removed Blinder sections)',
    rollback_nothing: 'Nothing to clean up. Project is already in original state.',
    rollback_complete: 'Rollback Complete',

    // Restore command
    restore_no_map: 'Mapping file (.blinder_map.json) not found in any directory.',
    restore_run_mask_first: 'Please run "blinder mask" first, or specify the directory with -o.',
    restore_no_map_in_dir: 'Mapping file (.blinder_map.json) not found in: {dir}',
    restore_header: 'Blinder - Restore AI Changes',
    restore_source: 'Source: {dir}',
    restore_masked_at: 'Masked at: {date}',
    restore_target_paths: 'Target Paths: {paths}',
    restore_analyzing: 'Analyzing changes...',
    restore_summary_title: '📋 AI-Agent Work Summary:',
    restore_modified: '  ✏️  Modified: {file}',
    restore_added: '  ➕ Added:    {file}',
    restore_deleted_count: '  🗑️  Deleted:  {count} files',
    restore_total_stats: '  📊 Total: {mod} modified / {add} added / {del} deleted ({unchanged} unchanged)',
    restore_missing_tags_title: '\n⚠️  Missing Redaction Tags Detected ({count} instances):',
    restore_missing_tags_desc: 'These tags were present before, but AI has modified or removed them.',
    restore_prompt_proceed: 'Proceed with restoration anyway?',
    restore_integrity_check_ok: '\n✔ Tag Integrity Check: All BLINDER tags are present.',
    restore_auto_repaired: '  🔧 Auto-repaired {count} missing import(s) in: {file}',
    restore_nothing: 'No files to restore or all requested paths are unchanged.',
    restore_prompt_apply: 'Apply these changes to your root project?',
    restore_restored_file: '✔ Restored: {file}',
    restore_restore_failed: 'Failed to restore file {file}: {msg}',
    restore_added_file: '✔ Added: {file}',
    restore_add_failed: 'Failed to add file {file}: {msg}',
    restore_prompt_delete: 'File "{file}" was deleted in the masked environment. Delete from original project?',
    restore_deleted_file: '✔ Deleted: {file}',
    restore_delete_failed: 'Failed to delete file {file}: {msg}',
    restore_complete: 'Restore Complete',
    restore_prompt_cleanup: 'Clean up the temporary masked directory?',
    restore_cleanup_success: 'Cleaned up masked folder.',
    restore_cleanup_partial: 'Cleanup partial: {errCode}: {errMsg}. Remove {dir} manually if needed.',
    restore_diff_preview: 'Diff Preview',

    // Protect command
    protect_no_secrets: 'No secrets found to protect!',
    protect_no_fixable: 'No fixable secrets found. Generating reports only.',
    protect_header: 'Blinder - Secret Protection',
    protect_processing_prod: 'Processing {count} production-ready secrets...',
    protect_env_updated: '.env and .env.example updated!',
    protect_plan_autofix: 'Plan: Applying Auto-fix to source code...',
    protect_apply_autofix: 'Applying Auto-fix to source code...',
    protect_metadata_saved: 'Rollback metadata saved to .blinder_protect.json',
    protect_no_selection: 'No secrets selected for migration.',
    protect_prompt_migrate: '{label} Found secret "{secret}" in {file}:{line}. Migrate to {env}?',
    protect_auto_migrating: '{label} Automatically migrating "{secret}" from {file}:{line}',
    protect_manual_req: 'Manual Action Required',
    protect_manual_desc: 'To complete the migration, please replace the hardcoded secrets in your source code with environment variable lookups:',
    protect_manual_examples: 'Implementation Examples:',
    protect_manual_success: 'The .env file has been updated with your secrets. You can now use these variables.',

    // Gitignore command
    gitignore_already_contains: '.gitignore already contains {name} section. Skipping.',
    gitignore_added_section: 'Added {name} section to .gitignore',
    gitignore_updated_success: '.gitignore updated successfully!',

    // Add Platform command
    add_platform_header: 'Blinder - Add Platform Plugin',
    add_platform_start: 'Creating a new platform plugin.\n',
    add_platform_prompt_id: 'Platform ID (lowercase, alphanumeric. e.g.: ruby, django):',
    add_platform_err_id_req: 'ID is required.',
    add_platform_err_id_fmt: 'Use only lowercase, numbers, and _ (must start with letter).',
    add_platform_prompt_name: 'Platform Name (for display. e.g.: Ruby on Rails):',
    add_platform_err_name_req: 'Name is required.',
    add_platform_prompt_cat: 'Choose Category:',
    add_platform_cat_backend: '1. Backend',
    add_platform_cat_frontend: '2. Frontend',
    add_platform_cat_mobile: '3. Mobile',
    add_platform_cat_custom: '4. Custom',
    add_platform_prompt_custom_cat: 'Enter custom Category name (lowercase, e.g.: infrastructure):',
    add_platform_err_cat_req: 'Category name is required.',
    add_platform_err_cat_fmt: 'Use only lowercase, numbers, and _ (must start with letter).',
    add_platform_prompt_ext: 'File extensions to scan (comma-separated. e.g.: .rb,.yml):',
    add_platform_err_ext_req: 'At least one extension is required.',
    add_platform_prompt_detect: 'Project detection file (e.g.: Gemfile, pom.xml):',
    add_platform_err_detect_req: 'Detection file is required.',
    add_platform_created: 'Plugin file created: {path}',
    add_platform_registered: 'Registry updated: platforms/index.js',
    add_platform_already_reg: 'Already registered in index.js or file not found.',
    add_platform_success: 'Plugin successfully created!',
    add_platform_file_path: '📁 File: src/platforms/{cat}/{id}.js',
    add_platform_next_steps: '🚀 Next Steps:',
    add_platform_step1: '  1. Modify the detect() logic in the generated file to match your project.',
    add_platform_step2: '  2. Verify the replacement code in getAutoFixReplacement().',
    add_platform_step3: '  3. Test: blinder scan --path /your/project --dry-run',

    // AST Provider
    ast_engine_disabled: 'AST Engine disabled: WebAssembly is bypassed due to Node.js v24.8.0 Turboshaft crash bug. Falling back to regex-only mode.',

    // Flutter Bridge
    flutter_vscode_updated: 'VS Code launch.json updated with --dart-define-from-file',
    flutter_vscode_update_failed: 'Failed to update VS Code launch.json automatically.',
    flutter_no_ide_configs: 'No IDE configurations found to automate Flutter .env loading.',
    flutter_ide_applied: 'Flutter .env automation applied to IDE configurations.',
    flutter_cli_wrapper_gen: 'Flutter CLI wrapper generated: f.sh',
    flutter_cli_wrapper_failed: 'Failed to create f.sh wrapper.',
    flutter_manual_tip: 'Manual Tip: Use "./f.sh run" to ensure .env is loaded in terminal.',

    // Android Bridge
    android_no_gradle: 'No Android app build.gradle found. Skipping Android bridge.',
    android_proguard_note: '   Note: If using Proguard/R8, ensure BuildConfig is not obfuscated if you read it via reflection.',

    // iOS Bridge (Additional)
    ios_hook_injected_existing: '  [+] Injected hook into existing post_install block.',
    ios_hook_injected_new: '  [+] Created new post_install block with blinder hook.',

    // React Platform
    react_unknown_build_tool: '[react] Unknown build tool — falling back to CRA-style REACT_APP_* prefix. Add react-scripts, vite, or next to deps for explicit detection.',

    // Config
    config_loaded: 'Loaded configuration from .blinderSettings',

    // CLI Main
    error_unexpected: 'An unexpected error occurred:',
    report_generated: 'Automatic report generated: blinder_reports/{file}',
    ci_secrets_found: 'Secrets found in CI mode. Terminating with status 1.'
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
