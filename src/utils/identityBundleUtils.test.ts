import {
  buildIdentityBundleManifestCsv,
  buildIdentityPersonGroups,
  createUniqueIdentityBundleFileName,
} from './identityBundleUtils';
import type { IdentityDocumentAnalysis } from '../types/identityBundle';

const document = (
  fileIndex: number,
  personName: string,
  birthDate = '',
  identityHash = '',
): IdentityDocumentAnalysis => ({
  fileIndex,
  originalFileName: `${fileIndex}.jpg`,
  personName,
  birthDate,
  identityNumber: '',
  address: '',
  nationality: '',
  documentNumber: '',
  expirationDate: '',
  identityHash,
  documentType: 'OTHER_ID',
  documentLabel: '기타 신분증',
  crop: { x: 0, y: 0, width: 1, height: 1 },
  confidence: 0.95,
  matchingConfidence: 0.95,
  warnings: [],
});

describe('buildIdentityPersonGroups', () => {
  it('같은 이름과 호환되는 생년월일 문서를 한 사람으로 묶는다', () => {
    const groups = buildIdentityPersonGroups([
      document(0, '홍 길동', '1988-04-03'),
      document(1, '홍길동', ''),
      document(2, '김영희', '1990-01-01'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].documents.map((item) => item.fileIndex)).toEqual([0, 1]);
  });

  it('같은 이름이어도 생년월일이 충돌하면 분리한다', () => {
    const groups = buildIdentityPersonGroups([
      document(0, '김민수', '1980-01-01'),
      document(1, '김민수', '1992-11-20'),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('생년월일 없는 문서가 동명이인 그룹을 연결하지 않는다', () => {
    const groups = buildIdentityPersonGroups([
      document(0, '김민수', '1980-01-01'),
      document(1, '김민수', ''),
      document(2, '김민수', '1992-11-20'),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups.find((group) => group.documents[0].fileIndex === 1)?.requiresReview).toBe(true);
  });

  it('보호된 식별 해시가 같으면 문서 표기가 달라도 묶는다', () => {
    const groups = buildIdentityPersonGroups([
      document(0, 'PARK MIN SU', '', 'same-session-hash'),
      document(1, '박민수', '1985-03-02', 'same-session-hash'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].documents).toHaveLength(2);
  });
});

describe('identity bundle ZIP metadata', () => {
  it('동명이인 결과 파일을 덮어쓰지 않도록 연속 번호를 붙인다', () => {
    const usedNames = new Map<string, number>();
    expect(createUniqueIdentityBundleFileName('김민수', usedNames)).toBe('김민수_신분증묶음.jpg');
    expect(createUniqueIdentityBundleFileName('김민수', usedNames)).toBe('김민수_신분증묶음_2.jpg');
  });

  it('ZIP 목록 CSV에 확인 상태와 원본 파일을 기록하고 수식 실행 문자를 차단한다', () => {
    const csv = buildIdentityBundleManifestCsv([{
      personName: '=위험한이름',
      documentCount: 2,
      confirmed: false,
      outputFileName: '미확인_위험한이름.jpg',
      originalFileNames: ['1.jpg', '2.jpg'],
    }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=위험한이름");
    expect(csv).toContain('미확인');
    expect(csv).toContain('1.jpg | 2.jpg');
  });
});
