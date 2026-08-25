import ExcelJS from 'exceljs';
import { buildConstructionPlanDraft } from '../domain/drafts';
import { REFERENCE_CONSTRUCTION_PLAN_SECTIONS } from '../domain/referenceConstructionPlanSections';
import {
  buildConstructionPlanExcelWorkbook,
  buildReferenceConstructionPlanExcelWorkbook,
  createConstructionPlanExcelFileName,
  createReferenceConstructionPlanExcelFileName,
} from './constructionPlanExcelService';

const reloadWorkbook = async (workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> => {
  const bytes = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(bytes as ExcelJS.Buffer);
  return reloaded;
};

describe('constructionPlanExcelService', () => {
  it('선택한 기준 PDF 본문 페이지를 선택본문 시트 이미지로 포함한다', async () => {
    const pngBytes = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ));
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob([pngBytes as BlobPart], { type: 'image/png' }),
    } as Response);
    try {
      const workbook = await buildReferenceConstructionPlanExcelWorkbook({
        input: {
          siteName: '선택본문 검증 현장',
          projectName: '시스템동바리 설치공사',
          companyName: '청연이엔지',
          documentNo: 'CY-SSP-102',
          revision: 5,
          preparedDate: '2026-08-23',
          applicationScope: 'A구간',
        },
        sections: [REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0]],
        drawings: [],
      }, { embedLogo: false });

      expect(fetchSpy).toHaveBeenCalledWith('/assets/construction-plan/pages/page-05.png');
      expect(workbook.getWorksheet('선택본문')?.getImages()).toHaveLength(1);
      expect(workbook.getWorksheet('선택본문')?.getCell('A5').value).toContain('일반사항');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('직접입력 PDF 구성과 동일한 목차·도면 순서로 Excel을 만든다', async () => {
    const workbook = await buildReferenceConstructionPlanExcelWorkbook({
      input: {
        siteName: '강남 공동주택 현장',
        projectName: '공동주택 신축공사',
        siteAddress: '서울시 강남구',
        siteMapLink: 'https://www.google.com/maps/search/?api=1&query=test',
        aerialViewFileName: '강남현장-조감도.jpg',
        clientName: '발주처',
        contractorName: '원도급사',
        companyName: '청연이엔지',
        documentNo: 'CY-SSP-101',
        revision: 5,
        preparedDate: '2026-08-23',
        applicationScope: '101동 지하 2층',
        buildings: '101동',
        floors: '지하 2층',
        zones: 'A구간',
        coverTemplate: 'executive',
      },
      sections: [
        REFERENCE_CONSTRUCTION_PLAN_SECTIONS[1],
        REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0],
      ],
      drawings: [{
        id: 'drawing-1',
        title: '시스템동바리 배치도',
        fileName: '배치도.pdf',
        bytes: new Uint8Array([1, 2, 3]),
        pageCount: 2,
        sourceType: 'pdf',
        mimeType: 'application/pdf',
      }],
    }, { embedLogo: false, embedSectionPreviews: false, embedSiteVisuals: false });
    const output = await reloadWorkbook(workbook);

    expect(output.worksheets.map(({ name }) => name)).toEqual(['문서개요', '현장위치', '목차', '선택본문', '도면목록']);
    expect(output.getWorksheet('문서개요')?.getCell('B7').value).toBe('강남 공동주택 현장');
    expect(output.getWorksheet('문서개요')?.getCell('F10').value).toBe(5);
    expect(output.getWorksheet('문서개요')?.getCell('F18').value).toBe(8);
    expect((output.getWorksheet('문서개요')?.getCell('B11').value as Date).toISOString()).toBe('2026-08-23T00:00:00.000Z');
    expect(output.getWorksheet('목차')?.getCell('D6').value).toBe('현장 위치 지도');
    expect(output.getWorksheet('목차')?.getCell('D7').value).toBe('공사개요 및 시공방침');
    expect(output.getWorksheet('목차')?.getCell('D8').value).toBe('일반사항');
    expect(output.getWorksheet('목차')?.getCell('D9').value).toBe('시스템동바리 배치도 (1/2)');
    expect(output.getWorksheet('목차')?.getCell('G6').value).toBe(3);
    expect(output.getWorksheet('목차')?.getCell('G7').value).toBe(5);
    expect(output.getWorksheet('현장위치')?.getCell('A5').text).toContain('서울시 강남구');
    expect(output.getWorksheet('현장위치')?.getCell('A8').value).toBe('Google 지도 · 현장 위치');
    expect(output.getWorksheet('선택본문')?.getCell('A5').value).toBe('01  1. 공사개요 및 시공방침');
    expect(output.getWorksheet('선택본문')?.getCell('A45').value).toBe('02  2. 일반사항');
    expect(output.getWorksheet('선택본문')?.getCell('A85').value).toContain('시스템동바리 배치도');
    expect(output.getWorksheet('도면목록')?.getCell('B7').value).toBe('시스템동바리 배치도');
    expect(output.getWorksheet('도면목록')?.pageSetup.paperSize).toBe(9);
    expect(createReferenceConstructionPlanExcelFileName({
      siteName: '강남/현장',
      companyName: '청연이엔지',
      revision: 5,
    })).toBe('청연이엔지_강남-현장_시스템동바리_시공계획서_REV5.xlsx');
  });

  it('현장위치 시트 전체 영역에 Google 지도 이미지만 크게 삽입한다', async () => {
    const pngBytes = Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ));
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob([pngBytes as BlobPart], { type: 'image/png' }),
    } as Response);
    try {
      const workbook = await buildReferenceConstructionPlanExcelWorkbook({
        input: {
          siteName: '이미지 검증 현장',
          projectName: '시스템동바리 설치공사',
          siteAddress: '서울특별시 강남구 테헤란로 123',
          companyName: '청연이엔지',
          documentNo: 'CY-SSP-103',
          revision: 5,
          preparedDate: '2026-08-24',
          applicationScope: 'A구간',
          siteMapImageDataUrl: 'data:image/png;base64,bWFw',
          aerialViewDataUrl: 'data:image/png;base64,YWVyaWFs',
          aerialViewFileName: '현장-조감도.png',
        },
        sections: [REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0]],
        drawings: [],
      }, { embedLogo: false, embedSectionPreviews: false });

      const siteWorksheet = workbook.getWorksheet('현장위치');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(siteWorksheet?.getImages()).toHaveLength(1);
      expect(siteWorksheet?.getCell('A8').value).toBe('Google 지도 · 현장 위치');
      expect(siteWorksheet?.getCell('H28').master.address).toBe('A9');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('저장된 계획서의 목차·장비·위험성평가·도면·조직 데이터를 시트로 분리한다', async () => {
    const draft = buildConstructionPlanDraft('plan-excel-1', {
      siteId: 'site-1',
      siteName: '마포 현장',
      tradeType: 'system-shoring',
      createdBy: 'user-1',
      projectSnapshot: {
        siteName: '마포 현장',
        buildings: ['101동'],
        floors: ['지하 1층'],
        zones: ['A구간'],
        emergencyContactsComplete: true,
      },
    }, '2026-08-23T00:00:00.000Z');
    const plan = {
      ...draft,
      sections: draft.sections.map((section, index) => index === 0
        ? { ...section, status: 'complete' as const, content: { scope: 'A구간', summary: '작업 범위 확인' } }
        : section),
      equipmentPlan: [{
        id: 'equipment-1',
        category: 'lifting' as const,
        equipmentName: '이동식 크레인',
        model: '50t',
        workZones: ['A구간'],
        plannedStages: ['자재 반입'],
        controlMeasures: ['신호수 배치'],
      }],
      riskAssessments: [{
        id: 'risk-1',
        workStage: '자재 반입',
        hazard: '중량물 낙하',
        initialRiskLevel: 'high' as const,
        mitigationMeasures: ['출입 통제'],
        residualRiskLevel: 'low' as const,
      }],
    };
    const workbook = await buildConstructionPlanExcelWorkbook(plan, { embedLogo: false });
    const output = await reloadWorkbook(workbook);

    expect(output.worksheets.map(({ name }) => name)).toEqual([
      '문서개요',
      '목차·입력',
      '장비계획',
      '위험성평가',
      '도면·주석',
      '조직도',
    ]);
    expect(output.getWorksheet('장비계획')?.getCell('C6').value).toBe('이동식 크레인');
    expect(output.getWorksheet('위험성평가')?.getCell('C6').value).toBe('중량물 낙하');
    expect(output.getWorksheet('목차·입력')?.getCell('G6').value).toBe('scope');
    expect(createConstructionPlanExcelFileName(plan)).toMatch(/마포_현장_.*REV-00\.xlsx$/);
  });
});
