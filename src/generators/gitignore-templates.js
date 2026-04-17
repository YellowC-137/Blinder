export const templates = {
  common: `
# Secrets & Environment
.env
.env.*
!.env.example
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
`,
  android: `
# Android
.gradle/
build/
local.properties
*.apk
*.aab
*.keystore
*.jks
captures/
.externalNativeBuild
.cxx
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
`
};
