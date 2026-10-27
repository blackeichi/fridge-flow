# Android 개발·빌드 안내

Fridge Flow는 Android 전용 Expo development build를 사용한다. Expo Go에서는 Google 로그인 네이티브 모듈을 실행할 수 없다.

## 1. Google OAuth 준비

1. Google Cloud 프로젝트에서 Web OAuth client를 만들고 공개 client ID를 확인한다.
2. `apps/mobile/.env.example`을 `apps/mobile/.env`로 복사한다.
3. `EXPO_PUBLIC_GOOGLE_SERVER_CLIENT_ID`를 실제 Web client ID로 바꾼다. 이 값은 공개 식별자이며 client secret이나 token을 넣지 않는다.
4. Android OAuth client를 만들고 패키지 이름 `com.fridgeflow.app`과 설치할 APK 서명 인증서의 SHA-1을 등록한다. 로컬 debug·EAS development·preview의 서명이 다르면 각 인증서에 대응하는 Android client가 필요하다.

이 앱은 로그인 client의 `configure({ webClientId })`에 값을 명시한다. Android 네이티브 모듈은 autolinking으로 연결되며 `google-services.json`이나 iOS OAuth client를 요구하지 않는다. iOS 지원은 현재 범위에 없다.

## 2. 로컬 development build

필요 환경: Node.js 22 LTS, npm 10 이상, Android Studio와 SDK, JDK 및 연결된 Android 기기 또는 Google Play Services가 있는 에뮬레이터.

저장소 루트에서 실행한다.

```bash
npm ci
npm run android:build
```

`android:build`는 `expo run:android`를 실행한다. 첫 실행 시 `apps/mobile/android`를 생성하고 개발 APK를 컴파일·설치한 뒤 Metro를 시작한다. 생성된 네이티브 디렉터리는 Git에 포함하지 않는다.

빌드 후 JavaScript만 수정했을 때:

```bash
npm run android
```

이 명령은 `expo start --dev-client --android`로 설치된 development client를 연다. `npm run start`도 development client를 대상으로 한다. 네이티브 모듈이나 앱 설정이 바뀌면 `android:build`를 다시 실행한다.

로컬 debug 서명 SHA-1 확인은 프로젝트가 생성된 뒤 다음 명령을 사용한다.

```bash
cd apps/mobile/android
./gradlew signingReport
```

Google Cloud Android client에 보고서의 해당 variant SHA-1을 등록한다. 기기의 Play Services 상태와 Google 계정도 확인한다.

## 3. EAS 빌드 프로필

`apps/mobile/eas.json`에 다음 구성을 둔다.

| 프로필 | 결과 | 용도 | EAS 환경 |
|---|---|---|---|
| development | development client APK | Metro에 연결하는 개발·기기 디버깅 | development |
| preview | 독립 실행 APK | Metro 없이 테스트하는 배포 후보 | preview |

사용자의 Expo 계정에서 EAS CLI로 로그인하고 앱 프로젝트를 연결한 다음 실행한다. EAS 관련 명령은 모노레포 루트가 아닌 앱 디렉터리에서 실행한다.

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile development
# 독립 실행 APK가 필요할 때
npx eas-cli build --platform android --profile preview
```

`eas init`이 생성한 프로젝트 ID와 owner는 실제 계정 기준으로 관리한다. 각 EAS 환경에 공개 `EXPO_PUBLIC_GOOGLE_SERVER_CLIENT_ID`를 설정하고, EAS가 사용하는 Android 서명 인증서 SHA-1도 Google Cloud에 등록한다. `.env`는 Git에서 제외되므로 클라우드 환경 설정을 따로 확인한다. 이 저장소에는 가짜 프로젝트 ID나 인증 값을 넣지 않는다.

기존 사용자 데이터가 있는 설치는 같은 패키지·같은 서명 키로 업데이트해야 한다. 로컬 debug와 EAS APK의 서명이 달라 설치가 거부될 때, 해결 목적으로 기존 앱을 삭제하면 로컬 DB도 사라진다. 서명 변경 전에는 백업·복원을 실제 기기에서 검증한 뒤 별도 백업을 보관하고 서명 키를 유지한다.

EAS 빌드 실행과 Firebase App Distribution 업로드는 이 구성 파일을 추가하는 것만으로 시작되지 않는다.

## 4. 코드와 번들 검증

저장소 루트에서 실행한다.

```bash
npm run validate
npm run android:export
npm run android:prebuild
```

- `validate`: 포맷·lint·타입·migration·Jest/RNTL 검증
- `android:export`: Android JavaScript/Hermes 번들 생성. CI에서도 실행
- `android:prebuild`: 네이티브 Android 프로젝트 생성. SDK·기기 없이도 구성 확인 가능

export와 prebuild 성공은 APK 컴파일·실제 OAuth 로그인 성공을 보장하지 않는다. SDK·서명·Google Cloud client 등록까지 맞춘 기기에서 아래 흐름을 확인한다.

## 5. 기기 확인 순서

1. 첫 실행 후 Google 로그인 → 냉장고 화면·기본 위치 표시.
2. 우유 1.2 L 등 소수 수량, 위치, 유통기한, 메모를 입력하고 저장.
3. 같은 이름을 다른 유통기한의 별도 묶음으로 추가해 독립 표시 확인.
4. 수량·위치 수정, 검색·공간·임박 필터, 수량 모름·0 소진 확인.
5. 삭제 전 확인 → 실행 취소 → 복원된 위치·수량 확인.
6. 앱을 완전히 종료하고 다시 열어 재료·변경 기록 보존 확인.
7. 연결된 계정으로 한 번 로그인한 뒤 네트워크를 끄고 재시작해 로컬 재고 조회·수정 확인.
8. 다른 Google 계정에서는 기존 DB를 열 수 없는지 확인.
9. 홈의 백업·복원에서 Drive와 기기 저장소 각각에 파일을 내보내고 선택 취소 시 성공 시각이 바뀌지 않는지 확인.
10. 기존 재고를 수정한 뒤 백업 선택 → 시각·건수 미리보기 → 전체 교체 확인 → 원래 재고·undo 기록 복원 확인.
11. 손상·다른 계정·상위 버전·10MiB 초과 파일 거부와 실패 시 기존 데이터 보존 확인.
12. 파일 저장·임시 DB 검사·안전 사본·실제 복원 중 앱 종료 후 재시작 시 부분 데이터가 남지 않는지 확인.
13. 보관 위치 편집에서 공간 추가 → 선반·용기 추가 → 안쪽 보기 → 이름·행·열·크기 수정 → 실행 취소를 확인.
14. 겹치는 칸·범위 밖·순환 부모 연결이 거부되고, 공간 이름만 바꿔도 재료 목록에 새 이름이 표시되는지 확인. 앱 재시작·백업 복원 뒤 배치와 재료 수량도 확인.
15. preview APK에서는 Metro 없이 같은 핵심 흐름 확인.

기기·OS·앱 버전·빌드 프로필·결과만 기록하고 Google token이나 사용자 원문 데이터를 진단 로그에 남기지 않는다.

## 참고

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS 모노레포 빌드](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [EAS build profiles](https://docs.expo.dev/build/eas-json/)
- [Nitro Google Sign-In 설정](https://react-native-nitro-google-sign-in.github.io/docs/setup/expo)
