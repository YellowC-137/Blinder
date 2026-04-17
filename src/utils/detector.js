import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;

/**
 * Detects the project type (iOS, Android, Flutter) in the given directory.
 */
export async function detectProjectType(repoPath) {
  const result = {
    platforms: [],
    root: repoPath
  };

  // 1. Check for Flutter
  if (fs.existsSync(path.join(repoPath, 'pubspec.yaml'))) {
    result.platforms.push('flutter');
  }

  // 2. Check for Android
  const hasAndroidDir = fs.existsSync(path.join(repoPath, 'android'));
  const hasBuildGradle = fs.existsSync(path.join(repoPath, 'build.gradle')) || 
                        fs.existsSync(path.join(repoPath, 'app/build.gradle'));
  
  if (hasAndroidDir || hasBuildGradle) {
    if (!result.platforms.includes('flutter')) {
      result.platforms.push('android');
    }
  }

  // 3. Check for iOS
  const hasIosDir = fs.existsSync(path.join(repoPath, 'ios'));
  const xcodeProjects = await glob(['**/*.xcodeproj', '**/*.xcworkspace'], { 
    cwd: repoPath, 
    deep: 3,
    ignore: ['**/node_modules/**', '**/Pods/**']
  });

  if (hasIosDir || xcodeProjects.length > 0) {
    if (!result.platforms.includes('flutter')) {
      result.platforms.push('ios');
    }
  }

  return result;
}
