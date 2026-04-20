import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export async function generateGitignore(repoPath, platforms) {
  const gitignorePath = path.join(repoPath, '.gitignore');
  let currentContent = '';

  if (fs.existsSync(gitignorePath)) {
    currentContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  let newContent = currentContent;

  for (const platform of platforms) {
    if (!platform.getGitignoreTemplate) continue;
    
    const template = platform.getGitignoreTemplate();
    if (!template) continue;

    const section = platform.id;
    const marker = `# --- BLINDER ${section.toUpperCase()} ---`;
    if (newContent.includes(marker)) {
      logger.info(`.gitignore already contains ${section} section. Skipping.`);
      continue;
    }

    newContent += `\n${marker}\n${template}\n`;
    logger.success(`Added ${section} section to .gitignore`);
  }

  fs.writeFileSync(gitignorePath, newContent);
  logger.success('.gitignore updated successfully!');
}
