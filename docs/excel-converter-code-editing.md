# 대화형 수식·VBA 편집

2026-09-30. localhost 변환기 구현 및 가상 자료 검증.

## 구현

- 채팅 한 번으로 문구, 서식, 수식, VBA를 함께 수정한다. 기본 파일 변환은 편집 분류 요청 없이 기존 변환기로 직접 처리한다. Gemini가 첨부 파일을 접근 불가능한 외부 파일로 오해하던 지시문도 수정했다.
- `formulaEdits`와 `macroEdits`를 서식과 별도로 누적한다. 서식 복원은 계산식·VBA를 지우지 않는다. 버전 분기, 조건 해제, 기기 보관 및 복원에 포함한다.
- 범위 수식은 상대 참조를 이동하고 절대 참조·문자열·시트 이름을 유지한다. 선택한 사람의 수식은 원본 행을 따라 정렬된다. 공유 수식의 일부를 고칠 때는 나머지 참조를 풀어 보존한다. 병합 범위는 보이는 기준 칸만 채운다.
- 기존 계산기에 `AVERAGE`, `SUMIF`, `SUMIFS`, `COUNTIFS`를 추가했다. 브라우저에서 계산할 수 없는 Excel 함수도 파일에 저장하되 오래된 계산값을 없애고 Excel 재계산 필요 상태로 표시한다.
- 의도적으로 바꾼 수식은 작성 값·원본 금액 대조와 구분한다. 바뀐 금액은 경고와 변경 내역에 표시하고, 요청하지 않은 수식 변경은 여전히 보존 검사 오류다.
- VBA는 기존 `.xlsm`의 모듈을 MS-OVBA 방식으로 읽고 실제 `vbaProject.bin`에 다시 저장한다. 기존 모듈 안에서 `Sub`와 `Function`을 수정하거나 추가할 수 있다. 원본 속성과 다른 모듈 소스를 보존하고, 이전 컴파일 캐시를 제거한 후 모든 모듈 코드를 재읽어 검사한다. `.bas` 파일만 별도로 만드는 방식이 아니다.
- 수식 변경과 VBA 변경을 결과 비교에 표시한다. ‘수식·매크로 코드 보기’에서 적용 내용을 확인할 수 있다.
- 원본 셀 값과 행 식별자는 새 편집 요청에 포함하지 않는다. 코드의 문자열 리터럴은 로컬 치환표로 가리고 VBA 주석도 제외한다. 코드와 수식 텍스트는 실행하지 않는다.

## 실제 검증

- 관련 16개 검사 묶음에서 **186개 통과**, 실제 사용자 파일이 지정되지 않은 조건부 검사 1개 미실행. `EXCEL_FORMULA_GOLDEN`에 기존 Excel 계산 사본을 지정했다. 마지막 상대 참조 수정 후 수식/VBA 검사도 다시 통과했다.
- 최종 전체 타입 검사, 수정 범위 린트(경고 0개), production build 및 배포 확인 기록 생성이 통과했다. 초기 빌드에서 발견한 조건부 함수 배열의 타입 정의 누락을 보완한 뒤 다시 검증했다.
- 실제 Gemini 게이트웨이에서 제목 20pt·파란 배경, E7/E9/E11 수식 변경, `EditedTotal` 함수 수정 및 `MarkReady` 매크로 추가를 한 요청으로 완료했다. AI 응답을 대체하지 않았다.
- 실제 AI 결과를 기기 보관 후 다시 열어 결과 2개와 서식·수식·VBA 계획을 복원했다. 390px 모바일에서 가로 넘침이 없었다. 검증용 보관본은 삭제했고 화면은 빈 작업으로 돌려두었다.
- Microsoft Excel 16.0에서 직접 작성한 가상 시험 파일의 수식 `E7=609210`, `E13=1249210`을 확인했다. 직접 작성한 무해한 `EditedTotal(100000)=96700`과 `MarkReady` 실행도 확인했다.
- 실제 AI 결과 `live-combined.xlsm`은 매크로와 이벤트를 끄고 읽기 전용으로 열었다. 제목 ‘9월 지급 정산표’·20pt, E7=609210, E9=386800, E11=232080, 합계 E13=1228090, VBA 프로젝트 존재 및 원본 해시 불변을 확인했다.
- 최초 AI 생성 VBA 실행은 자동 승인 심사가 거부했다. 이후 사용자에게 실행 여부를 물었고 사용자가 다음 작업 진행을 요청해 실행 검증을 이어갔다. 모든 모듈 소스를 검사하고 파일 해시를 고정한 가상 파일에 한해 별도 숨김 Excel에서 실행했다. `EditedTotal(100000)=96700`, `MarkReady`의 A2 문구 변경, 원본 해시 불변을 확인했다. 이벤트와 외부 링크 갱신은 끄고 읽기 전용으로 열었으며 원본은 저장하지 않았다. 근거는 `outputs/excel-converter/production-readiness/macro-inspection.json`, `native-live-report.json`이다.
- 브라우저 자동화의 다운로드 이벤트 저장 시 브라우저 컨텍스트가 종료돼, 실제 AI 결과 바이트는 앱의 검증용 보관본에서 추출해 Excel 검증에 사용했다. 다운로드 버튼의 파일 생성 경로는 기존 UI 회귀 검사에서 별도로 검증한다.

근거: `outputs/excel-converter/formula-macro-validation/`의 `full-tests.log`, `final-code-tests.log`, `typecheck.log`, `lint.log`, `build.log`, `native-excel-report.json`, `native-live-readonly-report.json`, `live-combined.xlsm`, `live-combined-desktop.png`, `live-combined-mobile.png`, `live-restored-mobile.png`.

## 적용 범위와 한계

후속 안정성 개선과 최신 검증은 [상용화 준비 검증 기록](excel-converter-production-readiness.md)에 정리했다.

- 사용자가 승인한 `functions:geminiGateway` 한 개를 `cyee-9c1e4`에 배포했다. 이후 추가 배포 요청으로 프런트엔드도 Hosting에 반영했다. 배포 커밋과 운영 검증은 [상용화 준비 검증 기록](excel-converter-production-readiness.md)에 정리했다. Git push는 수행하지 않았다.
- 기존 모듈이 들어 있는, 잠기지 않고 서명되지 않은 `.xlsm`이 VBA 편집 대상이다. 새 VBA 프로젝트/모듈 컨테이너 생성, 잠금 해제, 디지털 서명 재생성은 포함하지 않는다. 기존 모듈 내 프로시저 추가는 지원한다.
- 배열 수식·데이터 표의 일부 수정, 외부 연결/DDE 실행 수식은 지원하지 않는다. 100열·30,000칸 범위 제한을 유지한다.
- VBA 실행과 임의의 사용자 정의 함수 계산은 브라우저에서 하지 않는다. 임의의 VBA 프로젝트와 모든 Excel 함수에 대한 호환성을 보장하지 않는다.
- 매크로 예제 바이너리는 XlsxWriter의 공개 검증 자료다. 출처와 BSD 2-Clause 라이선스는 `src/features/excel-converter/fixtures/LICENSE-XlsxWriter.txt`에 포함했다.

## 2026-10-07 구조 편집 확장

- 자연어 편집 응답의 `layout`에서 행·열 삽입/삭제, 범위 복사/이동/비우기를 실행한다. 변경한 양식 사본을 다시 분석한 뒤 원본 데이터를 채운다. 원본 첨부파일의 바이트는 바꾸지 않는다.
- 셀 주소, 일반·공유 수식, 병합, 검증 범위, 이름 정의, 고정 창과 기존 그림의 행·열 앵커를 이동한다. 다음 편집과 보관본 복원은 해당 결과의 양식 사본을 이어 사용한다.
- 첫 요청이 서식 편집이어도 원본 데이터를 함께 변환한다. 기존 제목, 직접 수정값, 서식·수식 요청도 변경한 좌표로 이전한다.
- 자동 회귀 검사와 로컬 브라우저의 가상 응답으로 행 삽입 → 제목 변경 → 후속 서식 편집을 확인했다. 이번 확장에서 실제 Gemini의 구조 편집 응답이나 Microsoft Excel의 표시·인쇄를 재검증하지는 않았다.
- 피벗 구조 변경, Excel Table 내부 열 변경, 새 그림 추가는 이번 확장에 포함하지 않는다. 복잡한 차트·VBA 코드에 포함된 셀 주소의 자동 수정도 보장하지 않는다.

### 형식 근거

Microsoft MS-OVBA의 [모듈 스트림](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba/c66b58a6-f8ba-4141-9382-0612abce9926), [압축 청크](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba/f1b0ac3a-d6f8-4487-8e96-5c318d0c5462), [프로젝트 캐시 기록 규칙](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba/ef7087ac-3974-4452-aab2-7dba2214d239), [보호 상태](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba/55e770e2-e1a4-4d1c-a8a4-dcfca27d6663)을 확인했다.
