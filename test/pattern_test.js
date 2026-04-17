import { scanProject } from '../src/detectors/scanner.js';
import fs from 'fs';
import path from 'path';

/**
 * Basic test script to verify scanning logic.
 */
async function runTests() {
  console.log('Running Blinder Pattern Tests...\n');

  const testDir = path.resolve('./test_workspace');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

  const testFile = path.join(testDir, 'test.swift');
  fs.writeFileSync(testFile, `
    // This is a comment with a secret: AIzaSyB-EXAMPLE-KEY-123456
    let apiKey = "AIzaSyB-REAL-KEY-789012"
    let team = "DEVELOPMENT_TEAM = ABCDE12345"
    let falseTeam = "ABCDE12345" // Should be ignored now
  `);

  const results = await scanProject(testDir, ['ios']);

  const foundSecret = results.find(r => r.match === 'AIzaSyB-REAL-KEY-789012');
  const foundComment = results.find(r => r.match === 'AIzaSyB-EXAMPLE-KEY-123456');
  const foundTeam = results.find(r => r.match === 'ABCDE12345' && r.patternName === 'Apple Team ID');
  const foundFalseTeam = results.filter(r => r.match === 'ABCDE12345' && r.patternName !== 'Apple Team ID');

  console.log(`Found Secrets: ${results.length}`);
  
  if (foundSecret) console.log('✅ Real secret detected');
  else console.error('❌ Real secret NOT detected');

  if (!foundComment) console.log('✅ Secret in comment ignored');
  else console.error('❌ Secret in comment was NOT ignored');

  if (foundTeam) console.log('✅ Context-aware Apple Team ID detected');
  else console.error('❌ Context-aware Apple Team ID NOT detected');

  // Cleanup
  fs.unlinkSync(testFile);
  fs.rmdirSync(testDir);

  if (foundSecret && !foundComment && foundTeam) {
    console.log('\nResult: ALL TESTS PASSED! 🎉');
  } else {
    console.log('\nResult: SOME TESTS FAILED. ❌');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
