import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import type { Platform } from '../platforms/types.js';

/**
 * Generates platform-specific .gitignore content using platform plugins.
 * (보안지침 §2: 플랫폼별 민감 파일 무시 설정)
 */
export async function generateGitignore(repoPath: string, platforms: Platform[]): Promise<void> {
  const gitignorePath: string = path.join(repoPath, '.gitignore');
  let currentContent: string = '';
  
  if (fs.existsSync(gitignorePath)) {
    currentContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  let newContent: string = currentContent;
  
  for (const platform of platforms) {
    if (platform.getGitignoreTemplate) {
      const template: string = platform.getGitignoreTemplate();
      const section: string = platform.id;
      const marker: string = `# --- BLINDER ${section.toUpperCase()} ---`;
      const endMarker: string = `# --- BLINDER ${section.toUpperCase()} END ---`;

      if (newContent.includes(marker)) {
        logger.info(t('gitignore_already_contains', { name: platform.name }));
        continue;
      }

      // END marker bounds the block so cleanGitignore can remove it without
      // touching user lines appended after it.
      newContent += `\n${marker}\n${template}\n${endMarker}\n`;
      logger.success(t('gitignore_added_section', { name: platform.name }));
    }
  }

  fs.writeFileSync(gitignorePath, newContent);
  logger.success(t('gitignore_updated_success'));
}
