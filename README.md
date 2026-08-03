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

Android 에뮬레이터 또는 연결된 기기에서 실행하려면 `npm run android`를 사용합니다.

## 검증

```bash
npm run validate
```

위 명령은 포맷, lint, TypeScript typecheck와 Jest/RNTL 테스트를 순서대로 실행합니다.

공개 가능한 앱 환경변수의 예시는 `apps/mobile/.env.example`에 두며, API key나 token 같은 secret은 `EXPO_PUBLIC_*` 변수에 넣지 않습니다.

