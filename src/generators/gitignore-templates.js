export const templates = {
  common: `
# Blinder
.env
.env.example
blinder_reports/
maskedProject_*/
.blinder_protect.json
*.pem
*.key
*.p12
*.keystore
*.jks
secrets/
credentials/
`,
  ios: `
# iOS / Xcode
build/
DerivedData/
*.moved-aside
*.pbxuser
*.perspectivev3
xcuserdata/
*.xccheckout
*.xcscmblueprint
*.mode1v3
*.mode2v3
*.perspectivev3
!default.pbxuser
!default.mode1v3
!default.mode2v3
!default.perspectivev3
Pods/
*.ipa
*.dSYM.zip
*.dSYM

# iOS Sensitive Files (보안지침 §2)
GoogleService-Info.plist
*.xcconfig
`,
  android: `
# Android
.gradle/
build/
local.properties
gradle.properties
*.apk
*.aab
*.keystore
*.jks
captures/
.externalNativeBuild
.cxx

# Android Sensitive Files (보안지침 §2)
google-services.json
`,
  flutter: `
# Flutter
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
/build/

# Flutter Generated (보안지침 §2)
**/generated_plugin_registrant.dart
`
};
