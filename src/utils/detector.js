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

  // Check for Android
  const hasAndroidDir = fs.existsSync(path.join(repoPath, 'android'));
  const hasBuildGradle = fs.existsSync(path.join(repoPath, 'build.gradle')) || 
                        fs.existsSync(path.join(repoPath, 'app/build.gradle'));
  
  if (hasAndroidDir || hasBuildGradle) {
    result.platforms.push('android');
  }

  // Check for iOS
  const hasIosDir = fs.existsSync(path.join(repoPath, 'ios'));
  const xcodeProjects = await glob(['**/*.xcodeproj', '**/*.xcworkspace'], { 
    cwd: repoPath, 
    deep: 5,
    ignore: ['**/node_modules/**', '**/Pods/**', '**/Carthage/**', '**/DerivedData/**']
  });

  // Fallback: check for common iOS source files if no project file is found
  const hasIosFiles = (await glob(['**/*.{swift,m,h,mm,plist}'], {
    cwd: repoPath,
    deep: 3,
    ignore: ['**/node_modules/**', '**/Pods/**']
  })).length > 0;

  if (hasIosDir || xcodeProjects.length > 0 || hasIosFiles) {
    result.platforms.push('ios');
  }

  // Remove duplicates
  result.platforms = [...new Set(result.platforms)];

  return result;
}
