# Fridge Flow

냉장고 재고, 보관 위치, 유통기한, 레시피 추천, 주간 식단과 장보기를 하나의 흐름으로 연결하는 로컬 우선(local-first) 식생활 관리 앱입니다.

## 문서

- [제품 기획서](docs/PRODUCT_SPEC.md): 해결할 문제, 사용자 흐름, 기능 범위, 성공 지표, MVP와 로드맵
- [기술 설계서](docs/TECHNICAL_DESIGN.md): 기술 스택, 로컬 데이터, 백업·복원, AI proxy, API, 배포와 테스트 전략
- [프로젝트 작업 규칙](AGENTS.md): 이 저장소에서 개발할 때 지켜야 할 지속 규칙

## 한 문장 정의

> 냉장고 안에 무엇이 어디에 얼마나 남았는지 바로 알고, 가진 재료를 식단과 요리로 연결해 낭비와 고민을 줄이는 앱.

## 현재 결정된 방향

- 개인·지인용 Android 앱(Expo + React Native)
- Google 로그인으로 로컬 데이터 소유 계정을 연결하고 AI 접근을 검증
- 기기 내 SQLite `user.db`를 사용자 데이터의 유일한 실행 원본으로 사용
- 중앙 DB, 서버 CRUD와 자동 다중 기기 동기화는 제공하지 않음
- `.ffbackup`을 Android 시스템 파일 선택기로 Google Drive에 내보내고 전체 교체 복원
- 공공 레시피·영양 데이터는 읽기 전용 `catalog.db`로 앱에 포함
- Node.js TypeScript Netlify Functions는 Google token 검증과 OpenAI 호출만 제공
- OpenAI key, 허용 Google 계정과 모델명은 Netlify 환경변수에만 저장
- AI endpoint는 검증된 계정 allowlist, IP rate limit, 고정 모델·token 한도와 kill switch로 보호
- Firebase App Distribution으로 공식 APK 전달 대상을 제한
- 규칙 기반 후보 검색·수량 계산과 AI 기반 설명·개인화를 분리
- 자동 재료 차감은 항상 사용자 확인과 실행 취소를 제공

## 현재 구현

Google 로그인·로컬 소유 계정 연결, 기본 보관 위치 초기화와 재료 묶음별 추가·수정·삭제를 구현했습니다. 로그인 뒤 냉장고 화면에서 이름 검색, 공간·임박 필터, 수량 모름·소진 관리, 구매일·유통기한·메모 입력, 위치 변경과 최근 변경 실행 취소를 사용할 수 있습니다.

홈의 백업·복원 화면에서 .ffbackup을 시스템 파일 선택기로 내보내고 같은 Google 계정의 파일을 검증·미리보기한 뒤 전체 복원할 수 있습니다. 복원 전 안전 사본과 실패 rollback을 제공하며 마지막 백업 시각도 표시합니다. 복원 전 안전 사본 목록에서 내용을 확인하고 이전 데이터로 되돌릴 수 있으며, 되돌리기 직전 데이터도 새 사본으로 보관합니다. 실제 Android 문서 제공자·Drive E2E는 별도 검증이 필요합니다.

홈의 보관 위치 편집에서 공간·선반·서랍·용기를 추가하고 이름·상위 위치·격자 위치·크기를 바꿀 수 있습니다. 겹침·범위·순환 계층을 검사하며 같은 화면에서 최근 수정을 실행 취소할 수 있습니다.

공간·보관함 삭제와 드래그, 카탈로그·추천, 식단·장보기와 AI 서버는 후속 구현 범위입니다.

## 개발 환경

- Node.js 22 LTS
- npm 10 이상
- Expo SDK 57
- React Native 0.86.2
- React 19.2.3

```bash
npm ci
npm run start
```

Google 로그인은 Android Credential Manager 기반 네이티브 모듈을 사용하므로 Expo Go에서는 실행되지 않습니다. `start`와 `android`는 설치된 development build를 대상으로 Metro를 실행합니다.

처음 실행할 때:

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_GOOGLE_SERVER_CLIENT_ID를 실제 Web OAuth client ID로 교체
npm run android:build
```

`android:build`는 Android Studio/SDK와 연결된 기기 또는 에뮬레이터가 있는 로컬 환경에서 네이티브 프로젝트를 생성하고 development build를 설치합니다. 이후에는 `npm run android`로 Metro와 앱을 엽니다. 네이티브 의존성이 바뀌면 다시 빌드해야 합니다.

Google Cloud에는 Web OAuth client와 Android OAuth client가 필요합니다. Android client에 `com.fridgeflow.app` 패키지와 해당 빌드 서명 인증서의 SHA-1을 등록합니다. 이 앱은 `webClientId`를 직접 전달하므로 Firebase 설정 파일과 iOS URL scheme은 사용하지 않습니다. 상세 설정과 기기 점검 절차는 [Android 개발·빌드 안내](docs/ANDROID_DEVELOPMENT.md)를 참고합니다.

클라우드 개발 빌드와 독립 실행 APK를 위한 EAS `development`·`preview` 프로필은 `apps/mobile/eas.json`에 있습니다. 실제 EAS 프로젝트 연결, 빌드 서명과 Google OAuth 설정은 사용자의 환경에서 진행합니다.

## 검증

```bash
npm run validate
```

위 명령은 포맷, lint, TypeScript typecheck, migration 검사와 Jest/RNTL 테스트를 순서대로 실행합니다.

```bash
npm run android:export
npm run android:prebuild
```

`android:export`는 Android JavaScript/Hermes 번들을 생성하며 CI에서도 실행합니다. `android:prebuild`는 네이티브 Android 프로젝트 생성까지 확인합니다. 두 명령은 APK 컴파일·설치나 실제 Google 로그인 검증을 대신하지 않습니다.

공개 가능한 앱 환경변수의 예시는 `apps/mobile/.env.example`에 두며, API key나 token 같은 secret은 `EXPO_PUBLIC_*` 변수에 넣지 않습니다.

홈과 백업·복원 화면은 마지막 성공 백업 시각과 7일 경과 안내를 공유하며, 백업 기록 조회 중·실패·백업 없음을 구분합니다.
