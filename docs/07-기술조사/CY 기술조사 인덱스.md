---
type: moc
status: active
owner: 고대리_BOT
reviewer: 슈퍼돼지_BOT
implementer: 이과장_BOT
tags: [cy, 기술조사, 최신정보, 이과장지원]
---

# CY 기술조사 인덱스

## 역할

- **고대리_BOT:** 공식 문서·릴리스 노트·X/웹 최신정보 조사, CY 적용 차이와 위험 기록
- **슈퍼돼지_BOT:** 출처·호환성·범위 검토, 구현 승인, 팀 간 충돌 방지
- **이과장_BOT:** 승인된 항목만 격리 후보 저장소에서 구현·테스트

## 안전 경계

- 고대리는 CY 코드·Rules·설정·테스트를 읽기 전용으로 조사한다.
- 고대리는 Git add·commit·push, 운영 Firebase 접근, 배포를 수행하지 않는다.
- 외부 스킬은 출처·명령·네트워크·파일 쓰기 범위를 감사하고 슈퍼돼지 승인 후에만 설치한다.
- 개인정보, 계좌, 실제 급여 금액, 토큰, 서비스 계정은 문서에 기록하지 않는다.

## 조사 문서

- [[2026-09-01 CY 기술 스킬 및 최신정보 기준선]]
- [[2026-09-01 Firestore Emulator Rules 실행지원]]
- [[2026-09-02 P0-1 급여명세서 서버 발행 무결성 조사]]
- [[../06-검증/2026-09-02 P0-1 급여명세서 출력 경로 인벤토리]]

## 우선 조사 큐

1. Firestore transaction·batched write·원자성·작업 제한
2. Firestore Security Rules `getAfter()`·access-call 제한·Emulator 테스트
3. React 18 비동기 요청 identity·stale response 차단
4. TypeScript strict·런타임 스키마 검증 경계
5. Firebase Functions Node.js 런타임·지원 일정
6. 급여 `paymentSnapshot` 불변성과 재발행 revision
7. 데이터 마이그레이션·백업·복원·rollback
8. TDD·회귀·E2E·Rules 행위 테스트

## 상태 규칙

`조사 → 검토 대기 → 승인 → 적용` 또는 `보류`

고대리는 문서를 `검토 대기`까지만 올릴 수 있다. `승인`은 슈퍼돼지가, `적용`은 이과장의 구현과 슈퍼돼지 검증 후에 기록한다.

## 관련 문서

- [[../00-CY 운영 홈]]
- [[../06-검증/CY 운영 안정화 실행 로드맵]]
- [[../06-검증/2026-09-01 Phase 3 급여·가불 P0 P1 조사]]
- [[../02-업무규칙/급여 및 정산 검증 원칙]]