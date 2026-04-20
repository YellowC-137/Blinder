import fs from 'fs';
import path from 'path';
import { detectProjectType } from './src/utils/detector.js';
import { scanProject } from './src/detectors/scanner.js';
import { protectSecrets } from './src/commands/protect.js';

async function test() {
  const repoPath = path.resolve('./SmartCert_TEST');
  const project = await detectProjectType(repoPath);
  const results = await scanProject(repoPath, project.platforms, {});
  console.log(`Found ${results.length} secrets!`);
  
  await protectSecrets(repoPath, results, { 
    dryRun: false,
    mode: 'auto'
  });
  console.log('Protection applied.');
}
test();
