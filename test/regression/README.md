# Build Regression Tests

빌드 회귀 테스트 — auto-fix 확장 단계마다 실행해서 실제 모바일 앱 빌드가 깨지지 않는지 검증.

## 목적

`blind` 워크플로(secret 자동치환 + bridge 설치)가 실제 iOS/Android/Flutter 프로젝트 빌드를 깨뜨리지 않는지 보증.

Phase 1 (현재): 인프라 + 검증 스크립트만 준비.
Phase 2: 사용자가 샘플 프로젝트 추가하면 회귀 통과 후 auto-fix 단계 확장.

## 디렉토리 구조

```
test/regression/
├── ios/
│   ├── run.sh              # 실행 스크립트
│   ├── sample-app/         # (사용자 추가) Swift+ObjC 최소 Xcode 프로젝트
│   └── expected-secrets.json  # 사전 박은 secret 위치 + 기대 envVarName
├── android/
│   ├── run.sh
│   ├── sample-app/         # (사용자 추가) Kotlin+Java gradle 프로젝트
│   └── expected-secrets.json
└── flutter/
    ├── run.sh
    ├── sample-app/         # (사용자 추가) flutter_dotenv 사용 샘플
    └── expected-secrets.json
```

## 실행

```bash
# 개별
npm run test:regression:ios
npm run test:regression:android
npm run test:regression:flutter

# 전체
npm run test:regression
```

각 `run.sh`:
1. `sample-app/` 백업 (git stash 또는 cp -r)
2. `blinder blind --yes` 실행
3. `expected-secrets.json`과 결과 비교 (envVarName/위치 일치)
4. 실제 빌드 명령 실행 (`xcodebuild` / `./gradlew assembleDebug` / `flutter build apk --debug`)
5. 빌드 성공 → PASS, 실패 → FAIL + diff 출력
6. 백업 복원

## 샘플 프로젝트 추가 절차

각 `sample-app/`는 다음을 포함해야 함:

### iOS (`ios/sample-app/`)
- `*.xcodeproj` 또는 `*.xcworkspace`
- `Podfile` (선택, Bridge 검증용)
- `Info.plist`에 `KAKAO_APP_KEY`, `NMFClientId` 같은 SDK 키 하드코딩
- `AppDelegate.swift`/.m 에 SDK 초기화 코드 (하드코딩 secret 포함)
- `xcodebuild -scheme … -configuration Debug build` 가 통과하는 상태

### Android (`android/sample-app/`)
- `gradlew` + `app/` 모듈
- `gradle.properties`에 `MY_API_KEY=xxx` 하드코딩
- `AndroidManifest.xml`의 `<meta-data>`에 `com.kakao.sdk.AppKey` 박힌 상태
- `MainActivity.kt`에 `String apiKey = "..."` 하드코딩
- `./gradlew assembleDebug` 통과 상태

### Flutter (`flutter/sample-app/`)
- `pubspec.yaml` + `lib/main.dart`
- `flutter_dotenv` 의존성 + 하드코딩 secret
- `flutter build apk --debug` 통과 상태

## 회귀 통과 기준

- 모든 platform별 회귀 테스트 PASS
- blind 적용 후에도 빌드 성공
- expected-secrets.json과 실제 검출/치환 결과 일치
- restore 후 원본과 동일 (round-trip 검증)

## 라이선스 / 코드 출처 주의

샘플 앱은 가능하면 **공식 SDK 빈 템플릿** 또는 **OSS MIT/Apache 라이선스 프로젝트**에서 가져올 것.
사내 코드 절대 포함 금지.
