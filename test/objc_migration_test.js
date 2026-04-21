import { scanProject } from '../src/detectors/scanner.js';
import { protectSecrets } from '../src/commands/protect.js';
import fs from 'fs';
import path from 'path';

/**
 * Test script to verify Objective-C macro migration.
 */
async function runTests() {
  console.log('Running Objective-C Macro Migration Tests...\n');

  const testDir = path.resolve('./test_objc_workspace');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

  const testFile = path.join(testDir, 'Config.m');
  const originalContent = `
#import "Config.h"

@implementation Config

NSString *const SERVER_ADDR = @"https://api.real-api.com";
// NSString *const STAGING_SERVER = @"https://stg-api.real-api.com";
NSString *const SECRET_API_ENDPOINT = @"https://my-api.com";
NSString *const GET_CODE_GUARD = @"https://mobisr.yessign.or.kr/mSR3/CodeGuard/check.jsp";
NSString *const CMD_RSP_3100 = @"3100";
#define MSG_NET_ERR @"Connection Error"
int const ICRP_PORT = 9060;
double const TIME_OUT = 60.0;

@end
`;
  fs.writeFileSync(testFile, originalContent);

  // 1. Scan
  const results = await scanProject(testDir, ['ios']);
  console.log(`Found ${results.length} secrets in Obj-C file.`);
  results.forEach(r => console.log(`  - [${r.patternName}] ${r.file}:${r.line} Match: ${r.match}`));

  // 2. Protect (Auto-fix mode)
  await protectSecrets(testDir, results, { mode: 'auto', dryRun: false });

  // 2.5 Verify .env
  console.log('--- .env content ---');
  if (fs.existsSync(path.join(testDir, '.env'))) {
    console.log(fs.readFileSync(path.join(testDir, '.env'), 'utf8'));
  }
  console.log('--------------------');

  // 3. Verify
  const updatedContent = fs.readFileSync(testFile, 'utf8');
  console.log('--- Updated Content ---');
  console.log(updatedContent);
  console.log('-----------------------');

  const hasConstructor = updatedContent.includes('NSString * const SERVER_ADDR = nil;');
  const hasConstructorFunc = updatedContent.includes('_blinder_init_SERVER_ADDR(void)');
  const hasStrongPtr = updatedContent.includes('NSString * __strong *mutablePtr = (NSString * __strong *)&SERVER_ADDR;');
  const hasSecretEndpointConstructor = updatedContent.includes('NSString * const SECRET_API_ENDPOINT = nil;');
  const hasCodeGuardConstructor = updatedContent.includes('NSString * const GET_CODE_GUARD = nil;');
  const hasStagingServerMaskedInComment = updatedContent.includes('// NSString *const STAGING_SERVER = [[NSBundle mainBundle] objectForInfoDictionaryKey:');
  const hasCmdRspOriginal = updatedContent.includes('NSString *const CMD_RSP_3100 = @"3100";');
  const hasMsgErrMacro = updatedContent.includes('#define MSG_NET_ERR ((NSString *)[[NSBundle mainBundle]');
  const hasIntOriginal = updatedContent.includes('int const ICRP_PORT = 9060;');
  const hasDoubleOriginal = updatedContent.includes('double const TIME_OUT = 60.0;');

  if (hasConstructor && hasConstructorFunc && hasStrongPtr) console.log('✅ SERVER_ADDR converted to Constructor (Symbol & ARC Maintained)');
  else console.error('❌ SERVER_ADDR NOT converted correctly (Check ARC or (void) prototype)');

  if (hasSecretEndpointConstructor) console.log('✅ SECRET_API_ENDPOINT converted to Constructor');
  else console.error('❌ SECRET_API_ENDPOINT NOT converted correctly');

  if (hasCodeGuardConstructor) console.log('✅ GET_CODE_GUARD (now caught) converted to Constructor');
  else console.error('❌ GET_CODE_GUARD was NOT caught');

  if (hasStagingServerMaskedInComment) console.log('✅ STAGING_SERVER (commented) masked inline (Preserving comment)');
  else console.error('❌ STAGING_SERVER in comment was NOT masked');

  if (hasCmdRspOriginal) console.log('✅ CMD_RSP_3100 (short/numeric/blacklisted name) correctly ignored');
  else console.error('❌ CMD_RSP_3100 was unexpectedly converted');

  if (!hasMsgErrMacro) console.log('✅ MSG_NET_ERR (blacklisted name) correctly ignored');
  else console.error('❌ MSG_NET_ERR was unexpectedly converted');

  if (hasIntOriginal) console.log('✅ int constant kept as original (correctly ignored)');
  else console.error('❌ int constant was unexpectedly modified');

  if (hasDoubleOriginal) console.log('✅ double constant kept as original (correctly ignored)');
  else console.error('❌ double constant was unexpectedly modified');

  // Cleanup
  fs.unlinkSync(testFile);
  if (fs.existsSync(path.join(testDir, '.env'))) fs.unlinkSync(path.join(testDir, '.env'));
  if (fs.existsSync(path.join(testDir, '.env.example'))) fs.unlinkSync(path.join(testDir, '.env.example'));
  if (fs.existsSync(path.join(testDir, '.blinder_protect.json'))) fs.unlinkSync(path.join(testDir, '.blinder_protect.json'));
  if (fs.existsSync(path.join(testDir, '.gitignore'))) fs.unlinkSync(path.join(testDir, '.gitignore'));
  const reportFiles = fs.readdirSync(testDir).filter(f => f.startsWith('scan_result_'));
  // (Wait, report() might create blinder_reports dir)
  if (fs.existsSync(path.join(testDir, 'blinder_reports'))) {
      const reports = fs.readdirSync(path.join(testDir, 'blinder_reports'));
      reports.forEach(f => fs.unlinkSync(path.join(testDir, 'blinder_reports', f)));
      fs.rmdirSync(path.join(testDir, 'blinder_reports'));
  }

  fs.rmdirSync(testDir);

  console.log('\nResult: OBJ-C MIGRATION TESTS PASSED! 🎉');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
