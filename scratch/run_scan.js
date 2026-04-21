import { scanProject } from '../src/detectors/scanner.js';
import path from 'path';

async function run() {
  const repoPath = path.resolve('./scratch');
  const results = await scanProject(repoPath, ['ios'], { ignore: [] });
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
