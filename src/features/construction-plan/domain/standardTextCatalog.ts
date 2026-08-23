import type {
  ConstructionPlanTradeType,
  SectionDataStrategy,
} from '../types';
import {
  SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
  SYSTEM_SHORING_TEMPLATE_MANIFEST,
} from './templateManifest';

export type StandardTextRow = Readonly<{
  label: string;
  value: string;
}>;

export type StandardTextCatalogEntry = Readonly<{
  id: string;
  tradeType: ConstructionPlanTradeType;
  templateId: string;
  templateVersion: string;
  standardTextVersion: string;
  pageNumber: number;
  sectionKey: string;
  sectionTitle: string;
  strategy: SectionDataStrategy;
  editable: boolean;
  rows: readonly StandardTextRow[];
  originalText: string;
}>;

export type StandardTextDiffLine = Readonly<{
  type: 'unchanged' | 'added' | 'removed';
  value: string;
}>;

const SHORING_STANDARD_ROWS: Readonly<Record<number, readonly StandardTextRow[]>> = {
  5: [
    { label: '적용범위', value: '본 계획서는 승인된 현장·동·층·구간의 시스템동바리 설치, 사용, 존치 및 해체 작업에 적용한다.' },
    { label: '우선 기준', value: '승인도면과 승인된 구조검토 문서를 우선 적용하고 상충 시 작업을 중지하여 기술검토를 요청한다.' },
    { label: '변경관리', value: '현장조건·공법·부재·장비·구간이 변경되면 변경내용을 기록하고 승인 절차를 다시 거친다.' },
  ],
  8: [
    { label: '반입검수', value: '수직재·수평재·가새·잭·받침·연결핀의 외관, 규격, 변형, 부식 및 수량을 확인한다.' },
    { label: '체결부 확인', value: '핀·쇄기·볼트 등 체결부의 손상과 누락을 확인하고 부적합품은 즉시 식별한다.' },
    { label: '보관·격리', value: '부재는 종류별로 평탄한 장소에 적치하고 부적합품은 사용가능품과 분리·격리한다.' },
  ],
  12: [
    { label: '작업 전', value: '작업바닥, 추락방호, 비상정지장치, 장비 상태와 작업구간 출입통제를 확인한다.' },
    { label: '작업 중', value: '구조물·가설재·전선·다른 장비와의 간섭을 감시하고 정해진 신호에 따라 운전한다.' },
    { label: '중지조건', value: '지반 침하, 장비 이상, 통제구역 침입, 신호 두절 또는 시야 불량 시 즉시 작업을 중지한다.' },
  ],
  14: [
    { label: '신호체계', value: '신호수를 지정하고 수신호·무전 신호를 작업 전 공유하며 하나의 지휘체계를 유지한다.' },
    { label: '출입통제', value: '장비 회전·양중 반경과 낙하 위험구역을 표시하고 관계자 외 출입을 통제한다.' },
    { label: '통신 이상', value: '신호가 불명확하거나 통신이 끊기면 장비를 안전상태로 정지한 뒤 재확인한다.' },
  ],
  15: [
    { label: '하중전달', value: '상부 하중은 받침·잭·수직재·기초로 연속 전달되도록 설치하고 편심과 국부집중을 방지한다.' },
    { label: '부재 역할', value: '수평재와 가새는 수직재의 좌굴과 변형을 억제하도록 승인도면의 배치에 맞춰 체결한다.' },
    { label: '현장 적용값', value: '실제 부재 간격, 잭 조정범위와 보강조건은 본 문서의 승인 구조값 및 승인도면을 참조한다.' },
  ],
  16: [
    { label: '수직재·수평재', value: '수직하중 전달과 골조 구속 역할을 하며 변형·손상·부식 여부를 반입 및 설치 전에 확인한다.' },
    { label: '가새·연결부', value: '수평 안정성과 접합 연속성을 확보하며 핀·쇄기·볼트의 체결과 이탈방지 상태를 확인한다.' },
    { label: '잭·받침', value: '상·하부 지지와 높이 조정을 담당하며 나사부, 받침면, 편심 및 지지상태를 확인한다.' },
  ],
  18: [
    { label: '1단계', value: '작업구간 통제, 기초상태 확인, 기준선 표시 후 하부 받침과 수직재를 배치한다.' },
    { label: '2단계', value: '수평재와 가새를 순차 체결하고 수직도·간격·연결상태를 확인한다.' },
    { label: '3단계', value: '상부 지지부를 설치하고 승인도면·구조값과 대조한 뒤 검측을 요청한다.' },
  ],
  19: [
    { label: '조립원칙', value: '수직재를 안정시킨 뒤 수평재를 폐합하고 연결핀·쇄기·볼트를 완전 체결한다.' },
    { label: '진행관리', value: '조립 높이에 따라 작업발판과 추락방호를 선행하고 미완성 골조에는 임시 안정조치를 둔다.' },
    { label: '검측', value: '수직도, 간격, 체결, 받침 및 변형을 구간별로 확인하고 부적합은 다음 공정 전에 조치한다.' },
  ],
  20: [
    { label: '가새 설치', value: '승인도면의 방향·구간·연속성에 맞춰 가새를 설치하고 양단 접합을 확실히 체결한다.' },
    { label: '상부 지지', value: '상부 받침면을 밀착시키고 편심·들뜸·국부하중이 발생하지 않도록 조정한다.' },
    { label: '해체 원칙', value: '해체 승인 후 설치의 역순으로 진행하며 안정에 필요한 가새와 지지는 선행 제거하지 않는다.' },
  ],
  29: [
    { label: '하중경로', value: '상부에서 기초까지 하중전달 경로의 단절·편심·침하 가능성을 점검한다.' },
    { label: '핵심 관리', value: '기초, 수직재, 수평재, 가새, 잭, 상부지지와 접합부를 승인 구조값·도면에 따라 관리한다.' },
    { label: '변경관리', value: '부재·간격·하중·타설순서·현장조건 변경 시 구조검토와 승인을 다시 확인한다.' },
  ],
  30: [
    { label: '설치 착수', value: '기준선·기초·자재·작업구역을 확인한 뒤 승인도면의 구간 순서에 따라 설치한다.' },
    { label: '중간 확인', value: '단계별 수직도·간격·체결·가새·작업발판·추락방호 상태를 확인한다.' },
    { label: '완료 검측', value: '상부 지지와 구간표시까지 완료한 뒤 체크리스트와 승인도면으로 최종 검측한다.' },
  ],
  31: [
    { label: '타설 전', value: 'Hold Point 승인, 장비 동선, 타설순서, 하중 편중 방지 및 감시자를 확인한다.' },
    { label: '타설 중', value: '변형·침하·이상음·접합부 이완을 감시하고 이상 발견 시 타설을 즉시 중지한다.' },
    { label: '타설 후', value: '변형과 지지상태를 재확인하고 존치조건을 충족할 때까지 임의 조정·해체하지 않는다.' },
  ],
  32: [
    { label: '해체 승인', value: '강도·존치조건·작업구간 통제와 해체순서가 확인된 후에만 해체를 시작한다.' },
    { label: '역순 해체', value: '하중과 골조 안정성을 유지하며 설치의 역순으로 단계 해체하고 투하를 금지한다.' },
    { label: '중지조건', value: '예상 밖 변형, 잔류하중, 간섭 또는 통제구역 침입이 확인되면 즉시 작업을 중지한다.' },
  ],
  33: [
    { label: '존치구간', value: '승인도면과 구조검토에서 지정한 존치·재동바리 구간을 현장에 명확히 표시한다.' },
    { label: '변경 금지', value: '승인 없는 이동·완화·부분해체를 금지하고 손상 또는 이완 시 담당자에게 즉시 보고한다.' },
    { label: '인계', value: '존치상태, 금지구역, 점검결과와 향후 해체조건을 다음 작업조에 인계한다.' },
  ],
  34: [
    { label: 'ITP', value: '반입·설치·타설 전·존치·해체 단계별 검사 및 시험계획과 확인 책임자를 운영한다.' },
    { label: '부적합', value: '부적합을 식별·격리하고 원인·조치·재검사 결과를 기록한 뒤 다음 공정을 진행한다.' },
    { label: '기록관리', value: '승인도면, 구조값, 검측표, 사진과 변경기록을 문서번호·개정번호로 추적 관리한다.' },
  ],
  35: [
    { label: '중점 위험', value: '붕괴·추락·낙하·끼임 위험을 작업단계별로 확인하고 방호·통제·신호 조치를 시행한다.' },
    { label: '작업중지', value: '승인조건 불일치, 구조 이상, 방호 미설치 또는 통제 실패 시 누구든 작업중지를 요청할 수 있다.' },
    { label: '재개조건', value: '위험요인 조치와 책임자 재확인이 완료된 뒤 작업자에게 변경내용을 공유하고 재개한다.' },
  ],
  37: [
    { label: '초동조치', value: '이상 발견 즉시 작업중지, 장비 정지, 대피 및 위험구역 통제를 실시한다.' },
    { label: '보고·검토', value: '현장책임자와 관계자에게 보고하고 원인·영향·추가 위험을 검토한다.' },
    { label: '재승인', value: '복구·보강·변경조치 후 점검과 필요한 기술검토·승인을 완료해야 작업을 재개한다.' },
  ],
  38: [
    { label: '5S', value: '정리·정돈·청소·청결·습관화를 통해 자재와 작업공간을 상시 관리한다.' },
    { label: '현장관리', value: '적치·폐기·통로·조도·분진·소음을 관리하고 비상통로와 소방시설 접근을 확보한다.' },
    { label: '인수인계', value: '작업 종료 시 잔재·폐기물·통로·조명 상태와 미결 환경조치를 다음 작업조에 인계한다.' },
  ],
};

const SCAFFOLD_STANDARD_ROWS: Readonly<Record<number, readonly StandardTextRow[]>> = {
  ...SHORING_STANDARD_ROWS,
  5: [
    { label: '적용범위', value: '본 계획서는 승인된 현장·동·층·구간의 시스템비계 설치, 사용, 점검, 변경 및 해체 작업에 적용한다.' },
    { label: '우선 기준', value: '승인도면과 승인된 구조검토 문서를 우선 적용하고 상충 시 사용을 중지하여 기술검토를 요청한다.' },
    { label: '변경관리', value: '벽이음·작업발판·승강로·방호구조 또는 설치구간을 변경하면 변경내용을 기록하고 승인 절차를 다시 거친다.' },
  ],
  8: [
    { label: '반입검수', value: '수직재·수평재·가새·벽이음·발판·받침철물의 외관, 규격, 변형, 부식 및 수량을 확인한다.' },
    { label: '체결부 확인', value: '핀·쇄기·볼트·앵커 등 체결부의 손상과 누락을 확인하고 부적합품은 즉시 식별한다.' },
    { label: '보관·격리', value: '비계 부재는 종류별로 평탄한 장소에 적치하고 손상품과 부적합품은 사용가능품과 분리·격리한다.' },
  ],
  15: [
    { label: '구조 원칙', value: '수직하중과 풍하중이 받침철물·수직재·벽이음·기초로 안전하게 전달되도록 연속적으로 설치한다.' },
    { label: '부재 역할', value: '수평재·가새·벽이음은 비계틀의 변형과 전도를 억제하도록 승인도면의 간격과 배치에 맞춰 체결한다.' },
    { label: '현장 적용값', value: '실제 틀 간격, 벽이음 간격, 작업발판 폭과 보강조건은 승인 구조값 및 승인도면을 참조한다.' },
  ],
  16: [
    { label: '수직재·수평재', value: '비계틀의 골조를 구성하며 변형·손상·부식여부와 연결부 체결상태를 반입 및 설치 전에 확인한다.' },
    { label: '가새·벽이음', value: '수평 안정성과 전도 방지를 담당하며 앵커, 클램프 및 양단 접합의 이탈방지 상태를 확인한다.' },
    { label: '발판·방호구조', value: '작업발판, 안전난간, 발끝막이, 낙하물방지망과 승강로의 손상·고정·연속성을 확인한다.' },
  ],
  18: [
    { label: '1단계', value: '작업구간 통제, 지반·기초 확인, 기준선 표시 후 받침철물과 수직재를 배치한다.' },
    { label: '2단계', value: '수평재·가새·벽이음을 순차 체결하고 수직도·간격·접합상태를 확인한다.' },
    { label: '3단계', value: '작업발판·승강로·난간·발끝막이·낙하방지망을 설치하고 사용 전 검측을 요청한다.' },
  ],
  19: [
    { label: '조립원칙', value: '받침철물을 평탄하게 고정하고 수직재를 세운 뒤 수평재를 폐합하여 비계틀을 안정시킨다.' },
    { label: '진행관리', value: '조립 높이에 따라 작업발판과 추락방호를 선행하고 미완성 비계틀에는 임시 안정조치를 둔다.' },
    { label: '검측', value: '받침, 수직도, 틀 간격, 체결과 변형을 구간별로 확인하고 부적합은 다음 조립 전에 조치한다.' },
  ],
  20: [
    { label: '가새 설치', value: '승인도면의 방향·구간·연속성에 맞춰 가새를 설치하고 양단 접합을 확실히 체결한다.' },
    { label: '벽이음 설치', value: '승인된 수직·수평 간격으로 벽이음을 구조물에 연결하고 앵커·클램프·접합부를 점검한다.' },
    { label: '해체 원칙', value: '해체 승인 후 설치의 역순으로 진행하며 안정에 필요한 가새와 벽이음은 선행 제거하지 않는다.' },
  ],
  29: [
    { label: '하중경로', value: '작업발판에서 수직재·받침·기초로 이어지는 수직하중과 벽이음을 통한 수평하중 경로를 점검한다.' },
    { label: '핵심 관리', value: '기초, 받침철물, 수직재, 수평재, 가새, 벽이음, 작업발판과 방호구조를 승인값·도면에 따라 관리한다.' },
    { label: '변경관리', value: '부재·간격·벽이음·발판·하중·현장조건 변경 시 구조검토와 승인을 다시 확인한다.' },
  ],
  30: [
    { label: '설치 착수', value: '기준선·기초·자재·작업구역을 확인한 뒤 승인도면의 비계 구간 순서에 따라 설치한다.' },
    { label: '중간 확인', value: '단계별 수직도·간격·체결·가새·벽이음·작업발판·추락방호 상태를 확인한다.' },
    { label: '완료 검측', value: '승강로·난간·발끝막이·낙하방지망과 사용금지 표시까지 완료한 뒤 사용 전 검측한다.' },
  ],
  31: [
    { label: '작업발판', value: '작업발판은 뜨지 않게 고정하고 단차·틈새·돌출부와 재료 적치로 인한 통로 저해를 방지한다.' },
    { label: '승강통로', value: '승강로는 전용 설비로 연속 설치하고 출입구와 개구부에 추락·임의 개방 방지조치를 둔다.' },
    { label: '방호구조', value: '안전난간, 중간난간, 발끝막이와 낙하물방지망의 연속성을 확인하고 임의 해체를 금지한다.' },
  ],
  32: [
    { label: '해체 승인', value: '사용자 퇴거, 적치물 제거, 작업구간 통제와 해체순서가 확인된 후에만 시스템비계 해체를 시작한다.' },
    { label: '역순 해체', value: '낙하방지망·발끝막이·난간·발판을 단계별로 해체하고 비계틀의 안정을 유지하며 부재 투하를 금지한다.' },
    { label: '중지조건', value: '벽이음 선행 제거, 비계틀 변형, 간섭 또는 통제구역 침입이 확인되면 즉시 작업을 중지한다.' },
  ],
  33: [
    { label: '정기점검', value: '기초·받침·수직재·가새·벽이음·발판·난간·망의 이탈, 이완, 변형과 부식을 주기적으로 점검한다.' },
    { label: '변경 금지', value: '승인 없는 벽이음·가새·발판·방호구조의 이동, 완화 또는 부분해체를 금지하고 이상 시 즉시 보고한다.' },
    { label: '인계', value: '점검결과, 사용금지 구역, 보수내용과 향후 해체조건을 다음 작업조와 현장 관리자에게 인계한다.' },
  ],
  34: [
    { label: 'ITP', value: '반입·설치·사용 전·사용 중·변경·해체 단계별 검사계획과 확인 책임자를 운영한다.' },
    ...SHORING_STANDARD_ROWS[34].slice(1),
  ],
};

const serializeRows = (rows: readonly StandardTextRow[]): string => rows
  .map((row) => `${row.label}\n${row.value}`)
  .join('\n\n');

const buildCatalogForTrade = (
  tradeType: ConstructionPlanTradeType,
): StandardTextCatalogEntry[] => {
  const manifest = tradeType === 'system-scaffold'
    ? SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST
    : SYSTEM_SHORING_TEMPLATE_MANIFEST;
  const rowMap = tradeType === 'system-scaffold'
    ? SCAFFOLD_STANDARD_ROWS
    : SHORING_STANDARD_ROWS;

  return manifest.pages.flatMap((page) => {
    const rows = rowMap[page.pageNumber];
    if (!rows) return [];
    const frozenRows = Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    return [Object.freeze({
      id: `${tradeType}:${page.sectionKey}`,
      tradeType,
      templateId: manifest.id,
      templateVersion: manifest.version,
      standardTextVersion: `${manifest.id}@${manifest.version}:standard-copy-v1`,
      pageNumber: page.pageNumber,
      sectionKey: page.sectionKey,
      sectionTitle: page.title,
      strategy: page.dataStrategy,
      editable: page.dataStrategy === 'template-with-override',
      rows: frozenRows,
      originalText: serializeRows(frozenRows),
    })];
  });
};

export const STANDARD_TEXT_CATALOG: readonly StandardTextCatalogEntry[] = Object.freeze([
  ...buildCatalogForTrade('system-shoring'),
  ...buildCatalogForTrade('system-scaffold'),
]);

export const getStandardTextCatalogEntry = (input: {
  tradeType: ConstructionPlanTradeType;
  sectionKey: string;
  templateId?: string;
  templateVersion?: string;
}): StandardTextCatalogEntry | undefined => STANDARD_TEXT_CATALOG.find((entry) => (
  entry.tradeType === input.tradeType
  && entry.sectionKey === input.sectionKey
  && (!input.templateId || entry.templateId === input.templateId)
  && (!input.templateVersion || entry.templateVersion === input.templateVersion)
));

export const getStandardTextSectionCatalogEntry = (input: {
  tradeType: ConstructionPlanTradeType;
  sectionKey: string;
  templateId?: string;
  templateVersion?: string;
}): StandardTextCatalogEntry | undefined => {
  const entry = getStandardTextCatalogEntry(input);
  return entry && (entry.strategy === 'template-with-override' || entry.strategy === 'template-catalog')
    ? entry
    : undefined;
};

const normalizeDiffText = (value: string): string[] => value
  .replace(/\r\n/g, '\n')
  .split('\n');

/** Stable line-based LCS diff used by the authoring panel and review tests. */
export const buildStandardTextDiff = (
  originalText: string,
  currentText: string,
): readonly StandardTextDiffLine[] => {
  const original = normalizeDiffText(originalText);
  const current = normalizeDiffText(currentText);
  const lengths = Array.from(
    { length: original.length + 1 },
    () => Array<number>(current.length + 1).fill(0),
  );

  for (let left = original.length - 1; left >= 0; left -= 1) {
    for (let right = current.length - 1; right >= 0; right -= 1) {
      lengths[left][right] = original[left] === current[right]
        ? lengths[left + 1][right + 1] + 1
        : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const diff: StandardTextDiffLine[] = [];
  let left = 0;
  let right = 0;
  while (left < original.length && right < current.length) {
    if (original[left] === current[right]) {
      diff.push({ type: 'unchanged', value: original[left] });
      left += 1;
      right += 1;
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      diff.push({ type: 'removed', value: original[left] });
      left += 1;
    } else {
      diff.push({ type: 'added', value: current[right] });
      right += 1;
    }
  }
  while (left < original.length) diff.push({ type: 'removed', value: original[left++] });
  while (right < current.length) diff.push({ type: 'added', value: current[right++] });
  return diff;
};

export const standardTextEquals = (left: string, right: string): boolean => (
  left.replace(/\r\n/g, '\n').trim() === right.replace(/\r\n/g, '\n').trim()
);

