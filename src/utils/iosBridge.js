import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import logger from './logger.js';
import { t } from './i18n.js';

const IOS_SETUP_SCRIPT = `#!/bin/bash
# Blinder iOS Setup Script

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found. Please run 'blinder blind' first."
    exit 1
fi

echo "🛡️ Blinder - Integrating .env with Xcode Info.plist"

if ! command -v /usr/libexec/PlistBuddy &> /dev/null; then
    echo "❌ PlistBuddy not found. This script requires macOS."
    exit 1
fi

echo ""
echo "${t('ios_bridge_steps_title')}"
echo "${t('ios_bridge_step1')}"
echo "${t('ios_bridge_step2')}"
echo "${t('ios_bridge_step3')}"
echo "${t('ios_bridge_step4')}"
echo "${t('ios_bridge_step5')}"
echo "${t('ios_bridge_step6')}"
echo ""
echo "----------------------------------------------------------------"
cat << 'EOF'
# --- Blinder Run Script Start ---
# Support both Native iOS and Flutter project structures
if [ -f "\${SRCROOT}/.env" ]; then
    ENV_FILE="\${SRCROOT}/.env"
elif [ -f "\${SRCROOT}/../.env" ]; then
    ENV_FILE="\${SRCROOT}/../.env"
else
    echo "⚠️ Blinder: .env file not found. Skipping injection."
    exit 0
fi

PLIST_PATH="\${BUILT_PRODUCTS_DIR}/\${INFOPLIST_PATH}"

echo "🛡️ Blinder: Loading .env from \$ENV_FILE"
while read -r line || [[ -n "\$line" ]]; do
    if [[ ! "\$line" =~ ^# ]] && [[ "\$line" =~ = ]]; then
        # 안전 trim + URL의 &, ? 보존 위해 xargs 대신 sed 사용
        key=\$(echo "\${line%%=*}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        value=\$(echo "\${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"\$//' -e "s/^'//" -e "s/'\$//")

        # 키 형식 검증: 영숫자 + 언더스코어만 허용 (PlistBuddy 명령 인젝션 방지)
        if [[ ! "\$key" =~ ^[A-Za-z_][A-Za-z0-9_]*\$ ]]; then
            echo "⚠️ Blinder: Skipping invalid key '\$key' (only [A-Za-z_][A-Za-z0-9_]* allowed)"
            continue
        fi

        # 값 내부의 \\, ", $, \` 를 escape — PlistBuddy -c 인자 파싱 및 쉘 인젝션 방지
        esc_value=\$(printf '%s' "\$value" | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\\\"/g' -e 's/\\$/\\\\\\$/g' -e 's/\`/\\\\\`/g')

        if [ -n "\$key" ]; then
            /usr/libexec/PlistBuddy -c "Set :\$key \\"\$esc_value\\"" "\$PLIST_PATH" 2>/dev/null || \\
            /usr/libexec/PlistBuddy -c "Add :\$key string \\"\$esc_value\\"" "\$PLIST_PATH"
        fi
    fi
done < "\$ENV_FILE"
echo "✅ Blinder: Info.plist updated successfully."
# --- Blinder Run Script End ---
EOF
echo "----------------------------------------------------------------"
echo ""
echo "${t('ios_setup_script_success')}"
`;

const BLINDER_RUBY_HOOK = `
# --- Blinder Hook Start ---
def blinder_post_install(installer)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end

  project = installer.aggregate_targets.first.user_project
  project.targets.each do |target|
    next unless target.product_type == 'com.apple.product-type.application'
    
    phase_name = 'Blinder Env Loader'
    if target.shell_script_build_phases.none? { |p| p.name == phase_name }
      puts "  [Blinder] Adding Run Script to #{target.name}"
      phase = target.new_shell_script_build_phase(phase_name)
      phase.shell_script = <<~'SCRIPT'
# --- Blinder Run Script Start ---
if [ -f "\${SRCROOT}/.env" ]; then
    ENV_FILE="\${SRCROOT}/.env"
elif [ -f "\${SRCROOT}/../.env" ]; then
    ENV_FILE="\${SRCROOT}/../.env"
else
    echo "⚠️ Blinder: .env file not found. Skipping injection."
    exit 0
fi

PLIST_PATH="\${BUILT_PRODUCTS_DIR}/\${INFOPLIST_PATH}"

echo "🛡️ Blinder: Loading .env from $ENV_FILE"
while read -r line || [[ -n "$line" ]]; do
    if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
        key=$(echo "\${line%%=*}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        value=$(echo "\${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

        # 키 형식 검증: 영숫자 + 언더스코어만 (인젝션 방지)
        if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            echo "⚠️ Blinder: Skipping invalid key '$key'"
            continue
        fi

        # 값 내부 \\, ", $, \` escape — PlistBuddy 인자 파싱 및 쉘 인젝션 방지
        esc_value=$(printf '%s' "$value" | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\\\"/g' -e 's/\$/\\\\\$/g' -e 's/\`/\\\\\`/g')

        if [ -n "$key" ]; then
            /usr/libexec/PlistBuddy -c "Set :$key \\"$esc_value\\"" "$PLIST_PATH" 2>/dev/null || \\
            /usr/libexec/PlistBuddy -c "Add :$key string \\"$esc_value\\"" "$PLIST_PATH"
        fi
    fi
done < "$ENV_FILE"
echo "✅ Blinder: Info.plist updated successfully."
# --- Blinder Run Script End ---
SCRIPT
    end

    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
  project.save
end
# --- Blinder Hook End ---
`;

/**
 * Robustly injects Blinder hooks into Podfile.
 * Handles existing post_install blocks to avoid "Multiple post_install hooks" error.
 */
async function injectToPodfile(repoPath) {
  const podfilePaths = await (await import('fast-glob')).default('**/Podfile', {
    cwd: repoPath,
    ignore: ['**/Pods/**', '**/node_modules/**', '**/build/**'],
    absolute: true
  });

  if (podfilePaths.length === 0) {
    return false;
  }

  const podfilePath = podfilePaths[0];
  logger.info(t('ios_bridge_applying', { path: path.relative(repoPath, podfilePath) }));

  let content = fs.readFileSync(podfilePath, 'utf8');

  // 1. Add the helper function definition at the end if not present
  if (!content.includes('def blinder_post_install')) {
    content = content.trim() + '\n' + BLINDER_RUBY_HOOK;
  }

  // 2. Inject the function call into post_install block
  // Use a more specific check to see if the call (not definition) is present
  const hasHookCall = /^\s*blinder_post_install\(installer\)/m.test(content);

  if (content.includes('post_install do |installer|')) {
    if (!hasHookCall) {
      // Inject at the beginning of the existing block
      content = content.replace(
        /(post_install\s+do\s+\|installer\|)/,
        `$1\n  blinder_post_install(installer)`
      );
      logger.info(t('ios_hook_injected_existing'));
    }
  } else {
    // Create a new post_install block
    content += `\npost_install do |installer|\n  blinder_post_install(installer)\nend\n`;
    logger.info(t('ios_hook_injected_new'));
  }

  fs.writeFileSync(podfilePath, content);
  return true;
}

export async function setupIosBridge(repoPath) {
  const scriptPath = path.join(repoPath, 'blinder-ios-setup.sh');
  fs.writeFileSync(scriptPath, IOS_SETUP_SCRIPT, { mode: 0o755 });

  logger.success(t('ios_bridge_script_gen'));

  // Try Podfile-based automated injection
  const autoInjected = await injectToPodfile(repoPath);

  if (!autoInjected) {
    try {
      execFileSync('sh', [scriptPath], { stdio: 'inherit', cwd: repoPath });
    } catch (err) {
      logger.error(t('ios_bridge_setup_failed', { msg: err.message }));
    }

    logger.header(t('ios_bridge_manual_req'));
    logger.warn(t('ios_bridge_no_podfile'));
    logger.info(t('ios_bridge_steps_title'));
    logger.info(t('ios_bridge_step1'));
    logger.info(t('ios_bridge_step2'));
    logger.info(t('ios_bridge_step3'));
    logger.error(t('ios_bridge_step4'));
    logger.error(t('ios_bridge_step5'));
    logger.info(t('ios_bridge_step6'));
  } else {
    logger.success(t('ios_bridge_pod_success'));
    logger.info(t('ios_bridge_pod_install'));
    logger.info(t('ios_bridge_pod_note'));
  }
}
