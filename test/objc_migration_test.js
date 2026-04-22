import { scanProject } from '../src/detectors/scanner.js';
import { protectSecrets } from '../src/commands/protect.js';
import { rollbackSecrets } from '../src/commands/rollback.js';
import fs from 'fs';
import path from 'path';

/**
 * Test script to verify Objective-C Public vs Private constant handling.
 */
async function runTests() {
  console.log('Running Objective-C Dual-Strategy Migration Tests...\n');

  const testDir = path.resolve('./test_objc_workspace');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

  const hFile = path.join(testDir, 'Config.h');
  const mFile = path.join(testDir, 'Config.m');

  const hContent = `
#import <Foundation/Foundation.h>
extern NSString *const PUBLIC_SERVER;
// PRIVATE_KEY is NOT declared here
@interface Config : NSObject
@end
`;

  const mContent = `
#import "Config.h"
@implementation Config
NSString *const PUBLIC_SERVER = @"https://api.public.com";
NSString *const STR_KEY_APPVER = @"app_version";
NSString *const PRIVATE_KEY = @"LOCAL_SECRET_123";
@end
`;

  fs.writeFileSync(hFile, hContent);
  fs.writeFileSync(mFile, mContent);

  // 1. Scan
  const results = await scanProject(testDir, ['ios']);
  console.log(`Found ${results.length} secrets in Obj-C project.`);

  // 1.5 Simulate .gitignore update
  const gitignoreFile = path.join(testDir, '.gitignore');
  fs.writeFileSync(gitignoreFile, 'node_modules/\n# --- BLINDER COMMON ---\n.env\n.blinder_protect.json\n');

  // 2. Protect (Auto-fix mode)
  await protectSecrets(testDir, results, { mode: 'auto', dryRun: false });

  // 3. Verify Files
  const updatedM = fs.readFileSync(mFile, 'utf8');
  const updatedH = fs.readFileSync(hFile, 'utf8');
  const updatedGitignore = fs.readFileSync(gitignoreFile, 'utf8');

  console.log('--- Updated .m Content ---');
  console.log(updatedM);
  console.log('--- Updated .h Content ---');
  console.log(updatedH);
  console.log('--- Updated .gitignore ---');
  console.log(updatedGitignore);

  const isPublicMCleaned = updatedM.includes('// Protected by Blinder: PUBLIC_SERVER');
  const isPublicHMacroed = updatedH.includes('#define PUBLIC_SERVER ((NSString *)[[NSBundle mainBundle]');
  const isPrivateMMacroed = updatedM.includes('#define PRIVATE_KEY ((NSString *)[[NSBundle mainBundle]');
  const isKeyIgnored = updatedM.includes('NSString *const STR_KEY_APPVER = @"app_version";');

  if (isPublicMCleaned && isPublicHMacroed) {
    console.log('✅ Public constant: Synchronized correctly (Header macro + Implementation comment)');
  } else {
    console.error('❌ Public constant: Sync logic failed!');
  }

  if (isPrivateMMacroed && !updatedM.includes('// Protected by Blinder: PRIVATE_KEY')) {
    console.log('✅ Private constant: Fallback correctly (Direct macro replacement in .m)');
  } else {
    console.error('❌ Private constant: Fallback logic failed!');
  }

  if (isKeyIgnored) {
    console.log('✅ Key/Param constant (STR_KEY_APPVER): Correctly ignored (Heuristic match)');
  } else {
    console.error('❌ Key/Param constant was unexpectedly converted!');
  }

  // 4. Test Rollback
  console.log('\nTesting Rollback...');
  await rollbackSecrets(testDir, { yes: true, dryRun: false });

  const restoredM = fs.readFileSync(mFile, 'utf8');
  const restoredH = fs.readFileSync(hFile, 'utf8');
  const restoredGitignore = fs.readFileSync(gitignoreFile, 'utf8');

  if (restoredM.trim() === mContent.trim()) console.log('✅ .m file: Rollback restored successfully');
  else console.error('❌ .m file: Rollback failed!');

  if (restoredH.trim() === hContent.trim()) console.log('✅ .h file: Rollback restored successfully');
  else console.error('❌ .h file: Rollback failed!');

  if (restoredGitignore.trim() === 'node_modules/') console.log('✅ .gitignore: Blinder sections removed successfully');
  else {
    console.error('❌ .gitignore: Rollback failed!');
    console.log('Got:', restoredGitignore);
  }

  // Cleanup workspace
  [hFile, mFile].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  if (fs.existsSync(path.join(testDir, '.env'))) fs.unlinkSync(path.join(testDir, '.env'));
  if (fs.existsSync(path.join(testDir, '.env.example'))) fs.unlinkSync(path.join(testDir, '.env.example'));
  if (fs.existsSync(path.join(testDir, '.blinder_protect.json'))) fs.unlinkSync(path.join(testDir, '.blinder_protect.json'));
  if (fs.existsSync(path.join(testDir, '.gitignore'))) fs.unlinkSync(path.join(testDir, '.gitignore'));
  fs.rmdirSync(testDir);

  console.log('\nResult: OBJ-C DUAL-STRATEGY TESTS COMPLETE! 🎉');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
