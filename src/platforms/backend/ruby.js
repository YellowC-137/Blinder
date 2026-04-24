import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'ruby',
  name: 'ruby',
  category: 'backend',

  // 프로젝트 감지: gemgile가 있으면 ruby 프로젝트로 인식
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'gemgile'));
  },

  // 스캔 대상 확장자
  commonExtensions: [".rb"],

  // 환경 변수 접근자 코드 생성
  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return `ENV["${envVarName}"]`;
  }
});
