import common from './common.js';
import ios from './mobile/ios.js';
import android from './mobile/android.js';
import flutter from './mobile/flutter.js';
import ruby from './backend/ruby.js';
import react from './frontend/react.js';
import node from './backend/node.js';
import springboot from './backend/springboot.js';
import java from './backend/java.js';

// Detection order matters: specific platforms before generic ones.
// common    — always included (cross-platform .env/.json)
// mobile    — ios, android, flutter (distinct project markers)
// backend   — ruby, react, node (framework-specific before generic)
// java tier — springboot before java (springboot is a Java superset)
export const platforms = [
  common,
  ios,
  android,
  flutter,
  ruby,
  react,
  node,
  springboot,
  java
];

export default platforms;
