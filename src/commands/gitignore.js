import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';

/**
 * Generates platform-specific .gitignore content using platform plugins.
 * (보안지침 §2: 플랫폼별 민감 파일 무시 설정)
 */
export async function generateGitignore(repoPath, platforms) {
  const gitignorePath = path.join(repoPath, '.gitignore');
  let currentContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    currentContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  let newContent = currentContent;
  
  for (const platform of platforms) {
    if (platform.getGitignoreTemplate) {
      const template = platform.getGitignoreTemplate();
      const section = platform.id;
      const marker = `# --- BLINDER ${section.toUpperCase()} ---`;
      
      if (newContent.includes(marker)) {
        logger.info(t('gitignore_already_contains', { name: platform.name }));
        continue;
      }

      newContent += `\n${marker}\n${template}\n`;
      logger.success(t('gitignore_added_section', { name: platform.name }));
    }
  }

  fs.writeFileSync(gitignorePath, newContent);
  logger.success(t('gitignore_updated_success'));
}
