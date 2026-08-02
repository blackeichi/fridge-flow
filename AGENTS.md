# Fridge Flow 저장소 작업 규칙

이 파일은 사람과 AI 개발 도구가 이 저장소에서 일할 때 적용하는 지속 규칙이다.

## 작업 전 필수 확인

1. 제품 동작이나 화면을 변경하기 전 `docs/PRODUCT_SPEC.md`를 읽는다.
2. 데이터, 백업·복원, API, AI, 배포를 변경하기 전 `docs/TECHNICAL_DESIGN.md`를 읽는다.
3. 구현과 문서가 충돌하면 임의로 한쪽을 선택하지 않는다. 사용자 가치와 기존 데이터 호환성을 기준으로 판단하고, 같은 작업에서 문서도 갱신한다.
4. 아직 결정되지 않은 내용은 문서의 `미결정 사항`에 기록하며 숨은 전제로 굳히지 않는다.

## 제품 원칙

- 핵심 기능은 AI 없이도 동작해야 한다. 재고 CRUD, 유통기한 표시, 위치 이동, 식단 저장, 장보기 체크, 재료 차감은 결정론적 기능이다.
- 사용자 데이터의 유일한 실행 원본은 기기 내 `user.db`다. 중앙 사용자 DB, 서버 CRUD와 자동 동기화를 전제로 만들지 않는다.
- 기본 재료·공공 레시피·영양 데이터는 읽기 전용 `catalog.db`에 두고 사용자 데이터와 분리한다.
- 모든 사용자 변경은 로컬 SQLite transaction으로 즉시 반영한다.
- 원격 백엔드는 AI 호출 전용 Node.js Netlify Functions다. 사용자 데이터 CRUD·동기화·백업 파일 저장 endpoint를 추가하지 않는다.
- AI endpoint는 Google ID token을 서버에서 검증하고 Netlify 환경변수의 허용 `sub` 또는 verified email 목록과 일치할 때만 호출한다.
- Google ID token은 앱의 일반 SQLite·로그·백업에 저장하지 않는다. Android의 안전한 인증 저장소를 사용하고 만료 전에 Google 인증 client로 갱신한다.
- 현재 `user.db`는 첫 Google 계정의 `sub` hash와 연결한다. 다른 계정은 기존 DB를 바로 열 수 없으며 재로그인 또는 명시적 데이터 초기화가 필요하다.
- 재료 소진, 일괄 변경, 삭제에는 변경 내역과 실행 취소 경로를 둔다.
- 레시피 추천 전에 식단 목적, 제외 재료, 조리 시간, 인분 등 사용자의 의도를 입력하거나 기존 선호를 확인할 수 있게 한다.
- 영양·칼로리 값에는 출처와 계산 기준을 저장한다. AI가 생성한 추정치를 공인 데이터처럼 표시하지 않는다.
- 알레르기, 질환, 임신 등 건강 관련 입력은 최소 수집하며 추천은 의료 조언으로 표현하지 않는다.
- 앱의 `유통기한` 표시는 사용자가 입력한 관리용 날짜이며 음식의 실제 안전을 보증하는 판정으로 표현하지 않는다.

## 구현 규칙

- 로컬 엔터티 식별자는 앱에서 생성한 UUID를 사용한다.
- `user.db`와 `catalog.db` 접근은 Drizzle schema와 feature repository를 통하며 화면 컴포넌트에서 직접 SQL을 실행하지 않는다.
- 반응형 화면 조회는 Drizzle `useLiveQuery`를 사용하고 동일 데이터를 전역 상태에 중복 보관하지 않는다.
- Drizzle, Drizzle Kit과 Expo SQLite 버전은 Expo SDK 호환성을 확인해 정확한 버전으로 고정한다.
- 재고 차감과 undo는 로컬 append-only transaction으로 기록하고 동일 `operation_id`의 중복 적용을 금지한다.
- 수량은 부동소수점 하나로 뭉개지 말고 `amount`와 `unit`을 함께 저장한다. 단위 변환은 명시된 변환표가 있을 때만 한다.
- 시각은 UTC ISO 8601로 저장하고, 달력상의 날짜(식단 날짜, 표시된 유통기한)는 별도 date 의미를 보존한다.
- 백업 format과 schema는 명시적으로 versioning하며 구버전 migration fixture를 유지한다.
- 복원은 현재 Google 계정의 `sub` hash와 백업 owner hash가 일치할 때만 수행한다. 파일 구조·크기·schema·checksum을 검증하고 현재 DB의 안전 snapshot을 만든 뒤 임시 SQLite DB 검증을 거쳐 원자적으로 교체한다.
- MVP 복원은 로컬 사용자 데이터 전체 교체만 허용하며 임의의 병합·다중 기기 동기화 로직을 만들지 않는다.
- AI 출력은 버전 관리되는 스키마로 검증한 뒤 저장한다. 검증 실패 출력을 그대로 UI에 노출하지 않는다.
- OpenAI API key, 허용 계정 목록과 HMAC secret은 앱 번들·백업·저장소에 넣지 않고 Netlify Functions 환경변수 또는 CI secret으로만 제공한다.
- Netlify AI Function은 사용자 재고·식단·선호 payload와 AI 요청·응답 원문을 DB, 파일 또는 application log에 영속 저장하지 않는다. 사용자가 저장한 검증 결과는 `user.db`에만 둔다.
- 앱이 보낸 `model`, `api_key`, `user_id`를 신뢰하지 않는다. 모델과 input/output token 상한은 서버 환경변수로 강제한다.
- Netlify function instance의 process memory를 전역 quota 원본으로 사용하지 않는다. durable store가 없는 현재 구조에는 사용자별 일·월 누적 hard cap이 없음을 숨기지 않는다.
- 모든 AI endpoint는 Google token·allowlist, method/content type, body·입출력 token, Netlify IP rate limit과 kill switch를 거친다.
- 한도나 AI 장애 시 로컬 카탈로그 기반 기능으로 fallback한다.
- `.ffbackup` 내보내기와 복원은 Android Storage Access Framework를 사용한다. Google Drive 인증·업로드는 시스템 문서 제공자가 담당하며 Drive token이나 백업 파일을 Netlify로 보내지 않는다.
- 새 의존성을 추가할 때는 필요성, 유지보수 상태, 라이선스, 번들/운영 비용을 확인한다.

## 구조와 품질

- 기능 단위(feature-first)로 코드를 묶고, 화면 컴포넌트에 DB·HTTP·AI 로직을 직접 넣지 않는다.
- 도메인 규칙은 UI와 분리하고 가능한 한 순수 함수로 작성한다.
- 정상 경로뿐 아니라 완전 오프라인, 손상·다른 계정 백업, 복원 rollback, AI 인증·한도, 부분 차감과 수량 부족을 테스트한다.
- 추천 로직은 고정된 평가 데이터셋으로 관련성, 다양성, 재료 일치율을 회귀 테스트한다.
- 변경 후 해당 범위의 lint, typecheck, unit/integration test를 실행한다.
- 마이그레이션은 전진 호환과 기존 로컬 데이터 보존을 우선한다. 파괴적 마이그레이션에는 백업·복구 경로가 필요하다.

## 문서 유지

- 기능 범위나 사용자 흐름 변경: `docs/PRODUCT_SPEC.md`
- 기술, 데이터 모델, 백업·복원, API, 배포 변경: `docs/TECHNICAL_DESIGN.md`
- 저장소 전체 작업 방식 변경: 이 `AGENTS.md`
- 문서에는 구현 완료와 계획을 구분한다. 아직 없는 기능을 현재 기능처럼 서술하지 않는다.
- 기획·설계 작업이 끝났을 때 미결정 사항이 남아 있으면 한 번에 하나씩 사용자에게 묻는다. 각 질문에는 의미, 선택지의 영향과 추천안을 함께 설명하고, 답을 반영한 뒤 다음 항목으로 진행한다.
- 사용자 경험, 비용, 개인정보, 데이터 보존, 배포 대상이나 운영 범위를 실질적으로 바꾸지 않는 구현 세부사항은 합리적인 근거와 함께 자율적으로 결정하고 문서의 결정 기록에 남긴다. 이런 기술 선택은 사용자에게 확인 질문을 반복하지 않는다.
- 사용자 확인은 제품 동작과 우선순위, 유료 지출, 개인정보·보안 수준, 되돌리기 어려운 운영 정책처럼 사용자의 선호나 권한이 필요한 결정에만 요청한다.
