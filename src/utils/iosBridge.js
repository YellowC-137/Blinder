import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import logger from './logger.js';

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
echo "To automatically load .env into your app, follow these steps in Xcode:"
echo "1. Open your project in Xcode."
echo "2. Select your Target -> Build Phases -> + -> New Run Script Phase."
echo "3. Name it 'Blinder Env Loader' and move it to the VERY END of the Build Phases."
echo "4. 🚨 UNCHECK 'Based on dependency analysis' (Crucial for reading .env properly)."
echo "5. 🚨 Go to 'Build Settings' tab -> Search 'User Script Sandboxing' -> Set to 'NO'."
echo "6. Paste the following script into the phase:"
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
        # Safe trim and parsing using sed instead of xargs to protect URL special characters (&, ?, etc.)
        key=\$(echo "\${line%%=*}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        value=\$(echo "\${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"\$//' -e "s/^'//" -e "s/'\$//")
        
        if [ -n "\$key" ]; then
            /usr/libexec/PlistBuddy -c "Set :\$key \\"\$value\\"" "\$PLIST_PATH" 2>/dev/null || \\
            /usr/libexec/PlistBuddy -c "Add :\$key string \\"\$value\\"" "\$PLIST_PATH"
        fi
    fi
done < "\$ENV_FILE"
echo "✅ Blinder: Info.plist updated successfully."
# --- Blinder Run Script End ---
EOF
echo "----------------------------------------------------------------"
echo ""
echo "✅ Setup script generated. Follow the instructions above to finalize."
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
        
        if [ -n "$key" ]; then
            /usr/libexec/PlistBuddy -c "Set :$key \\"$value\\"" "$PLIST_PATH" 2>/dev/null || \\
            /usr/libexec/PlistBuddy -c "Add :$key string \\"$value\\"" "$PLIST_PATH"
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
  logger.info(`Applying CocoaPods injection to ${path.relative(repoPath, podfilePath)}...`);

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
      logger.info('  [+] Injected hook into existing post_install block.');
    }
  } else {
    // Create a new post_install block
    content += `\npost_install do |installer|\n  blinder_post_install(installer)\nend\n`;
    logger.info('  [+] Created new post_install block with blinder hook.');
  }

  fs.writeFileSync(podfilePath, content);
  return true;
}

export async function setupIosBridge(repoPath) {
  const scriptPath = path.join(repoPath, 'blinder-ios-setup.sh');
  fs.writeFileSync(scriptPath, IOS_SETUP_SCRIPT, { mode: 0o755 });

  logger.success('iOS integration script generated: blinder-ios-setup.sh');

  // Try Podfile-based automated injection
  const autoInjected = await injectToPodfile(repoPath);

  if (!autoInjected) {
    try {
      execSync(`sh "${scriptPath}"`, { stdio: 'inherit', cwd: repoPath });
    } catch (err) {
      // Ignore execution errors
    }

    logger.header('⚠️ IMPORTANT: Manual Xcode Setup Required');
    logger.warn('No Podfile found. You MUST manually configure Xcode to load environment variables.');
    logger.info('\nFollow these steps to finalize integration (Essential for Xcode 15+):');
    logger.info('1. Open your project in Xcode.');
    logger.info('2. Go to Target -> Build Phases -> + -> New Run Script Phase.');
    logger.info('3. Name it "Blinder Env Loader" and move it to the VERY BOTTOM.');
    logger.error('4. 🚨 CRUCIAL: Uncheck "Based on dependency analysis".');
    logger.error('5. 🚨 CRUCIAL (Xcode 15+): Go to Build Settings -> Search "Sandboxing" -> Set "User Script Sandboxing" to "NO".');
    logger.info('6. The code to paste was displayed above (or find it in blinder-ios-setup.sh).\n');
  } else {
    logger.success('Successfully injected Blinder hooks into Podfile.');
    logger.info('🚨 IMPORTANT: Run "pod install" in your iOS directory to apply changes to Xcode.');
    logger.info('   Note: If you encounter "Permission Denied" errors during build, ensure "User Script Sandboxing" is set to "NO" in Xcode Build Settings.');
  }
}
