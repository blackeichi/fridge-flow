# Fridge Flow

냉장고 재고, 보관 위치, 유통기한, 레시피 추천, 주간 식단과 장보기를 하나의 흐름으로 연결하는 로컬 우선(local-first) 식생활 관리 앱입니다.

앱과 문서의 공식 표시명은 영어 `Fridge Flow`로 통일합니다.

현재 저장소는 기획 단계입니다. 구현을 시작하기 전에 아래 문서를 기준으로 범위와 설계를 확인합니다.

## 문서

- [제품 기획서](docs/PRODUCT_SPEC.md): 해결할 문제, 사용자 흐름, 기능 범위, 성공 지표, MVP와 로드맵
- [기술 설계서](docs/TECHNICAL_DESIGN.md): 기술 스택, 로컬 데이터, 백업·복원, AI proxy, API, 배포와 테스트 전략
- [프로젝트 작업 규칙](AGENTS.md): 이 저장소에서 개발할 때 지켜야 할 지속 규칙

## 한 문장 정의

> 냉장고 안에 무엇이 어디에 얼마나 남았는지 바로 알고, 가진 재료를 식단과 요리로 연결해 낭비와 고민을 줄이는 앱.

## 현재 결정된 방향

- 개인·지인용 Android 앱(Expo + React Native)
- 초대된 Google 계정만 로그인·최초 가입 가능
- Neon PostgreSQL을 사용자 데이터의 서버 원본으로 사용하고 계정별 데이터를 분리
- 기기 내 SQLite `user.db`는 즉시 표시·오프라인 작업·동기화 대기열로 사용
- `.ffbackup` 파일을 이용한 수동·자동 보조 백업과 계정 단위 전체 교체 복원
- 공공 레시피·영양 데이터는 읽기 전용 `catalog.db`로 앱에 포함
- Python FastAPI는 인증, 계정별 CRUD·동기화와 AI proxy를 제공
- FastAPI는 Render Free Web Service에 배포하고 Git 자동 배포를 사용
- OpenAI API key와 Neon connection string은 Render 환경변수에만 저장
- Neon PostgreSQL에는 사용자 계정, 초대 목록, 동기화 상태와 AI quota 운영 데이터를 저장
- AI endpoint는 요청량·token·동시성·일·월 한도와 kill switch로 비용 제한
- Firebase App Distribution으로 공식 빌드를 전달하고 서버 초대 목록으로 실제 사용자를 제한
- 규칙 기반 후보 검색·수량 계산과 AI 기반 설명·개인화를 분리
- 자동 재료 차감은 항상 사용자 확인과 실행 취소를 제공

결정이 바뀌면 코드보다 먼저 또는 같은 변경 안에서 관련 문서를 갱신합니다.
