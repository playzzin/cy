# 카드 명세서 가져오기 테스트

현재 화면과 운영 코드의 동작을 직접 검사한다. 운영 코드에서 사용하지 않던 별도 모의 구현과 전용 데이터는 제거했다. 테스트에는 합성 데이터만 사용하며 실제 PDF나 금융 자료는 저장소에 넣지 않는다.

## 화면과 중복 방지 검사

```bash
npm run test:card-statement-import
```

이 명령은 다음 기존 테스트를 실행한다. 화면 테스트의 서버 호출은 모의 처리한다.

- `src/components/card/CardStatementImportModal.test.tsx`: 서버 응답 전 저장 완료 표시 금지, 중복 요청 방지, 부분 저장·제외·실패 표시.
- `src/components/card/CardStatementImportHistoryModal.test.tsx`: 원본 열기, 취소 확인, 일괄 취소의 순차 실행과 실패 후 재시도.
- `src/utils/cardStatementDeduplication.test.ts`: 파일 식별과 첨부 경로, 기존 거래 중복 제거.

## 서버 검사

```bash
npm run functions:build
npm run test:functions
```

전체 서버 검사에는 다음 카드 관련 테스트가 포함된다.

- `functions/src/cardStatementImportIdentity.test.ts`: 원본 해시와 거래 식별자, 분석 결과의 행·블록 순서가 달라져도 중복 방지.
- `functions/src/cardStatementImportCancellation.test.ts`: 처리 중이거나 금액이 남은 내역의 취소 차단. Firestore 원자성·재실행 검사는 에뮬레이터가 있어야 실행된다.
- `functions/src/cardStatementFileDetails.test.ts`: 원본 경로, 분석 상태, 청구 월, 분할 결과 처리.

빌드 후 취소·식별자 검사를 로컬 에뮬레이터에서 실행하려면 다음 명령을 사용한다. Firebase CLI와 Java가 필요하다.

```bash
node scripts/test-card-upload-emulator.cjs
```

이 검사는 `demo-card-upload-cancellation` 프로젝트의 합성 데이터를 사용한다. 실제 Gemini 호출이나 실제 PDF의 인식 정확도까지 검증하는 명령은 아니다.
