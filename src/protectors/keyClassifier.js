/**
 * keyClassifier
 *
 * Centralized whitelist/blacklist for auto-fix decisions.
 * - whitelist: SDK/secret 키 이름 → auto-fix 안전
 * - blacklist: 시스템/예약 키 prefix → auto-fix 금지 (빌드 깨짐 위험)
 *
 * Used by parsers (plist, properties, manifest) and platform applyAdvancedFix
 * hooks. Detection 단계는 영향 없음 — auto-fix gating에만 사용.
 */

// ──────────────────────────────────────────────────────────────
// iOS Info.plist
// ──────────────────────────────────────────────────────────────
const IOS_PLIST_WHITELIST = [
  /^KAKAO[_A-Z0-9]*$/i,
  /^NAVER[_A-Z0-9]*$/i,
  /^NMF[_A-Z0-9]*Client(Id|Secret)?$/i,
  /^GOOGLE[_A-Z0-9]*API[_A-Z0-9]*KEY$/i,
  /^GIDClientID$/,
  /^FIREBASE[_A-Z0-9]*$/i,
  /^FacebookAppID$/,
  /^FacebookClientToken$/,
  /^GMSApiKey$/,
  /^GADApplicationIdentifier$/,
  /^MixpanelToken$/i,
  /^SentryDSN$/i,
  /^AmplitudeApiKey$/i,
  /^[A-Z][A-Z0-9_]*_API_KEY$/,
  /^[A-Z][A-Z0-9_]*_APP_KEY$/,
  /^[A-Z][A-Z0-9_]*_CLIENT_ID$/,
  /^[A-Z][A-Z0-9_]*_CLIENT_SECRET$/,
  /^[A-Z][A-Z0-9_]*_TOKEN$/
];

const IOS_PLIST_BLACKLIST_PREFIX = [
  'CF', 'NS', 'UI', 'LS', 'MK', 'SK', 'CK', 'AV', 'CL'
];

const IOS_PLIST_BLACKLIST_EXACT = new Set([
  'CFBundleIdentifier', 'CFBundleVersion', 'CFBundleShortVersionString',
  'CFBundleName', 'CFBundleDisplayName', 'CFBundleExecutable',
  'CFBundleInfoDictionaryVersion', 'CFBundlePackageType', 'CFBundleSignature',
  'CFBundleDevelopmentRegion', 'CFBundleSupportedPlatforms',
  'CFBundleURLSchemes', 'CFBundleURLTypes', 'CFBundleURLName',
  'LSRequiresIPhoneOS', 'LSApplicationCategoryType', 'LSMinimumSystemVersion',
  'UILaunchStoryboardName', 'UIMainStoryboardFile', 'UIRequiredDeviceCapabilities',
  'UIDeviceFamily', 'UISupportedInterfaceOrientations', 'UIBackgroundModes',
  'UIStatusBarStyle', 'UIStatusBarHidden', 'UIViewControllerBasedStatusBarAppearance',
  'NSAppTransportSecurity', 'NSAllowsArbitraryLoads',
  'MinimumOSVersion', 'DTPlatformVersion', 'DTSDKName', 'BuildMachineOSBuild'
]);

// ──────────────────────────────────────────────────────────────
// iOS xcconfig
// ──────────────────────────────────────────────────────────────
const IOS_XCCONFIG_BLACKLIST_PREFIX = [
  'OTHER_', 'GCC_', 'LD_', 'SWIFT_', 'IPHONEOS_', 'MACOSX_', 'TVOS_', 'WATCHOS_',
  'BUILD_', 'CODE_SIGN_', 'PROVISIONING_', 'PRODUCT_', 'TARGETED_', 'CLANG_',
  'WARNING_', 'ENABLE_', 'DEBUG_', 'RELEASE_', 'ASSETCATALOG_', 'APPLICATION_'
];

const IOS_XCCONFIG_BLACKLIST_EXACT = new Set([
  'ARCHS', 'SDKROOT', 'VALID_ARCHS', 'EXCLUDED_ARCHS', 'ONLY_ACTIVE_ARCH',
  'DEVELOPMENT_TEAM', 'CODE_SIGN_IDENTITY', 'CODE_SIGN_STYLE', 'PROVISIONING_PROFILE',
  'INFOPLIST_FILE', 'PRODUCT_BUNDLE_IDENTIFIER', 'PRODUCT_NAME', 'EXECUTABLE_NAME',
  'TARGETED_DEVICE_FAMILY', 'IPHONEOS_DEPLOYMENT_TARGET', 'MACOSX_DEPLOYMENT_TARGET',
  'SWIFT_VERSION', 'SWIFT_OPTIMIZATION_LEVEL', 'GCC_OPTIMIZATION_LEVEL',
  'FRAMEWORK_SEARCH_PATHS', 'LIBRARY_SEARCH_PATHS', 'HEADER_SEARCH_PATHS',
  'USER_HEADER_SEARCH_PATHS', 'SYSTEM_HEADER_SEARCH_PATHS'
]);

// ──────────────────────────────────────────────────────────────
// AndroidManifest.xml meta-data
// ──────────────────────────────────────────────────────────────
const ANDROID_META_WHITELIST = [
  /^com\.kakao\.sdk\./,
  /^com\.naver\./,
  /^com\.google\.android\.geo\.API_KEY$/,
  /^com\.google\.android\.gms\.ads\.APPLICATION_ID$/,
  /^com\.facebook\.sdk\./,
  /^io\.fabric\.ApiKey$/,
  /^firebase_/,
  /^FIREBASE_/,
  /^[A-Z][A-Z0-9_]*_API_KEY$/,
  /^[A-Z][A-Z0-9_]*_APP_KEY$/,
  /^[A-Z][A-Z0-9_]*_CLIENT_ID$/
];

const ANDROID_META_BLACKLIST_PREFIX = [
  'android.support.', 'androidx.',
  'com.google.android.gms.version',
  'com.google.android.gms.car.application',
  'com.google.firebase.messaging.default_notification_',
  'com.google.firebase.crashlytics.unity_version'
];

const ANDROID_META_BLACKLIST_EXACT = new Set([
  'android.support.VERSION',
  'com.google.android.gms.version',
  'com.google.firebase.messaging.default_notification_icon',
  'com.google.firebase.messaging.default_notification_color'
]);

// ──────────────────────────────────────────────────────────────
// Android properties
// ──────────────────────────────────────────────────────────────
const ANDROID_PROPS_BLACKLIST_PREFIX = [
  'org.gradle.', 'android.', 'kotlin.', 'systemProp.', 'kapt.', 'ksp.',
  'sdk.dir', 'ndk.dir', 'cmake.dir',
  'android.useAndroidX', 'android.enableJetifier'
];

const ANDROID_PROPS_WHITELIST_KEY_HINT = [
  /API[_-]?KEY/i, /APP[_-]?KEY/i, /CLIENT[_-]?ID/i, /CLIENT[_-]?SECRET/i,
  /TOKEN/i, /SECRET/i, /PASSWORD/i, /PASSWD/i, /KEYSTORE[_-]?PASSWORD/i,
  /KEY[_-]?ALIAS/i, /STORE[_-]?PASSWORD/i, /SIGNING[_-]?KEY/i
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function matchesAny(patterns, value) {
  return patterns.some(p => (p instanceof RegExp ? p.test(value) : value.startsWith(p) || value === p));
}

function startsWithAny(prefixes, value) {
  return prefixes.some(p => value.startsWith(p));
}

/**
 * iOS Info.plist 키가 auto-fix 안전한지 판정.
 * @returns {{ allowed: boolean, reason: string }}
 */
export function classifyPlistKey(key) {
  if (!key || typeof key !== 'string') return { allowed: false, reason: 'invalid key' };
  if (IOS_PLIST_BLACKLIST_EXACT.has(key)) return { allowed: false, reason: 'system key (exact match)' };
  if (startsWithAny(IOS_PLIST_BLACKLIST_PREFIX, key)) return { allowed: false, reason: 'system key prefix' };
  if (matchesAny(IOS_PLIST_WHITELIST, key)) return { allowed: true, reason: 'SDK/secret pattern' };
  return { allowed: false, reason: 'not in whitelist (default deny)' };
}

/**
 * iOS xcconfig 키 — 자체참조 위험으로 영구 detection-only.
 */
export function classifyXcconfigKey(key) {
  if (!key || typeof key !== 'string') return { allowed: false, reason: 'invalid key' };
  if (IOS_XCCONFIG_BLACKLIST_EXACT.has(key)) return { allowed: false, reason: 'system build setting' };
  if (startsWithAny(IOS_XCCONFIG_BLACKLIST_PREFIX, key)) return { allowed: false, reason: 'system build setting prefix' };
  return { allowed: false, reason: 'xcconfig auto-fix permanently disabled (self-reference risk)' };
}

/**
 * AndroidManifest meta-data 키 판정.
 */
export function classifyManifestMetaKey(key) {
  if (!key || typeof key !== 'string') return { allowed: false, reason: 'invalid key' };
  if (ANDROID_META_BLACKLIST_EXACT.has(key)) return { allowed: false, reason: 'system meta-data (exact match)' };
  if (startsWithAny(ANDROID_META_BLACKLIST_PREFIX, key)) return { allowed: false, reason: 'system meta-data prefix' };
  if (matchesAny(ANDROID_META_WHITELIST, key)) return { allowed: true, reason: 'SDK meta-data pattern' };
  return { allowed: false, reason: 'not in whitelist (default deny)' };
}

/**
 * Android properties 키 — local.properties 영구 차단, gradle.properties는
 * 시스템 prefix 차단 + key 이름 힌트 매칭 시 detection 가능 (auto-fix는 별도 결정).
 */
export function classifyPropertiesKey(key, filename) {
  if (!key || typeof key !== 'string') return { allowed: false, reason: 'invalid key' };
  if (filename && filename.endsWith('local.properties')) {
    return { allowed: false, reason: 'local.properties 자동치환 영구 차단 (gitignore 대상)' };
  }
  if (startsWithAny(ANDROID_PROPS_BLACKLIST_PREFIX, key)) return { allowed: false, reason: 'gradle/android 시스템 키' };
  if (matchesAny(ANDROID_PROPS_WHITELIST_KEY_HINT, key)) return { allowed: true, reason: 'secret 키 명명 힌트' };
  return { allowed: false, reason: 'not in whitelist (default deny)' };
}

/**
 * Aggregator: 파일타입 + 키 → 판정
 */
export function classifyKey({ fileType, key, filename }) {
  switch (fileType) {
    case 'plist':       return classifyPlistKey(key);
    case 'xcconfig':    return classifyXcconfigKey(key);
    case 'manifest':    return classifyManifestMetaKey(key);
    case 'properties':  return classifyPropertiesKey(key, filename);
    default:            return { allowed: false, reason: `unknown fileType: ${fileType}` };
  }
}

export const _internal = {
  IOS_PLIST_WHITELIST, IOS_PLIST_BLACKLIST_PREFIX, IOS_PLIST_BLACKLIST_EXACT,
  IOS_XCCONFIG_BLACKLIST_PREFIX, IOS_XCCONFIG_BLACKLIST_EXACT,
  ANDROID_META_WHITELIST, ANDROID_META_BLACKLIST_PREFIX, ANDROID_META_BLACKLIST_EXACT,
  ANDROID_PROPS_BLACKLIST_PREFIX, ANDROID_PROPS_WHITELIST_KEY_HINT
};
