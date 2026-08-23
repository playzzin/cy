import React, { useMemo } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  History,
  Lock,
  RotateCcw,
} from 'lucide-react';
import type { PlanSection } from '../types';
import {
  buildStandardTextDiff,
  standardTextEquals,
  type StandardTextCatalogEntry,
} from '../domain/standardTextCatalog';

type ConstructionPlanStandardTextPanelProps = {
  section: PlanSection;
  entry: StandardTextCatalogEntry;
  readOnly?: boolean;
  updatedBy: string;
  onChange: (section: PlanSection, immediate?: boolean) => void;
};

const LEGACY_CONTENT_FIELDS = [
  ['scope', '적용 대상 / 범위'],
  ['summary', '섹션 요약'],
  ['body', '기존 현장별 시공 내용'],
] as const;

const stringContent = (section: PlanSection, key: string): string | undefined => {
  const value = section.content[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const statusLabel = (status: PlanSection['status']): string => {
  if (status === 'complete') return '완료';
  if (status === 'not_applicable') return '해당없음';
  if (status === 'in_progress') return '작성 중';
  return '미작성';
};

const ConstructionPlanStandardTextPanel: React.FC<ConstructionPlanStandardTextPanelProps> = ({
  section,
  entry,
  readOnly = false,
  updatedBy,
  onChange,
}) => {
  const storedCurrent = stringContent(section, 'standardTextCurrent');
  const legacyBody = stringContent(section, 'body');
  const migratedLegacyOverride = !storedCurrent && section.standardTextModified && Boolean(legacyBody);
  const currentText = storedCurrent
    ?? (migratedLegacyOverride ? legacyBody : undefined)
    ?? entry.originalText;
  const modified = !standardTextEquals(entry.originalText, currentText);
  const storedVersion = stringContent(section, 'standardTextVersion');
  const versionMismatch = Boolean(storedVersion && storedVersion !== entry.standardTextVersion);
  const catalogStoredOverride = !entry.editable && modified;
  const legacyContent = LEGACY_CONTENT_FIELDS.flatMap(([key, label]) => {
    const value = stringContent(section, key);
    return value ? [{ key, label, value }] : [];
  });
  const diff = useMemo(
    () => (modified ? buildStandardTextDiff(entry.originalText, currentText) : []),
    [currentText, entry.originalText, modified],
  );

  const updateCurrent = (value: string, immediate = false) => {
    const nextModified = !standardTextEquals(entry.originalText, value);
    onChange({
      ...section,
      status: value.trim() ? (section.status === 'empty' ? 'in_progress' : section.status) : section.status,
      content: {
        ...section.content,
        standardTextVersion: entry.standardTextVersion,
        standardTextCurrent: value,
      },
      standardTextModified: nextModified,
      standardTextModificationReason: nextModified
        ? section.standardTextModificationReason
        : undefined,
      updatedAt: new Date().toISOString(),
      updatedBy,
    }, immediate);
  };

  const restoreOriginal = () => {
    onChange({
      ...section,
      content: {
        ...section.content,
        standardTextVersion: entry.standardTextVersion,
        standardTextCurrent: entry.originalText,
      },
      standardTextModified: false,
      standardTextModificationReason: undefined,
      updatedAt: new Date().toISOString(),
      updatedBy,
    }, true);
  };

  const updateReason = (reason: string, immediate = false) => onChange({
    ...section,
    standardTextModified: modified,
    standardTextModificationReason: reason,
    updatedAt: new Date().toISOString(),
    updatedBy,
    content: {
      ...section.content,
      standardTextVersion: entry.standardTextVersion,
      standardTextCurrent: currentText,
    },
  }, immediate);

  return (
    <section className="cp-section-data cp-standard-text-panel" data-validation-record-id={section.id}>
      <div className="cp-panel-heading cp-panel-heading--bordered">
        <div>
          <span className="cp-eyebrow">Section {String(section.order + 1).padStart(2, '0')}</span>
          <h3>{section.title}</h3>
        </div>
        <span className={`cp-completion-chip cp-completion-chip--${section.status}`}>
          {statusLabel(section.status)}
        </span>
      </div>

      <div className="cp-source-callout" data-validation-field="standardTextVersion" tabIndex={-1}>
        <span className="cp-source-callout__icon"><Check size={14} /></span>
        <div>
          <strong>{entry.editable ? '표준 템플릿 + 승인된 변경본' : '잠금된 표준 카탈로그'}</strong>
          <p>{entry.templateId} · {entry.standardTextVersion} · {entry.pageNumber}쪽</p>
        </div>
        {!entry.editable && <Lock size={15} aria-label="표준 카탈로그 잠금" />}
      </div>

      <div className="cp-data-form cp-standard-text-status">
        <label>
          <span>섹션 상태</span>
          <div className="cp-select-wrap">
            <select
              data-validation-field="status"
              value={section.status}
              disabled={readOnly || !entry.editable}
              onChange={(event) => onChange({
                ...section,
                status: event.target.value as PlanSection['status'],
              }, true)}
            >
              <option value="empty">미작성</option>
              <option value="in_progress">작성 중</option>
              <option value="complete">완료</option>
              {!section.required && <option value="not_applicable">해당없음</option>}
            </select>
            <ChevronDown size={15} />
          </div>
        </label>
        {section.status === 'not_applicable' && (
          <label>
            <span>해당없음 사유 *</span>
            <textarea
              data-validation-field="notApplicableReason"
              value={section.notApplicableReason || ''}
              disabled={readOnly || !entry.editable}
              onChange={(event) => onChange({ ...section, notApplicableReason: event.target.value })}
              onBlur={() => onChange(section, true)}
            />
          </label>
        )}
      </div>

      {versionMismatch && (
        <div className="cp-standard-contract-warning" role="alert">
          <History size={15} />
          <div>
            <strong>표준 문구 버전이 다릅니다.</strong>
            <p>저장본 {storedVersion} / 현재 템플릿 {entry.standardTextVersion}. 원문과 차이를 검토한 후 저장하세요.</p>
          </div>
        </div>
      )}

      {migratedLegacyOverride && (
        <div className="cp-standard-contract-warning" role="status">
          <History size={15} />
          <div>
            <strong>기존 body 변경본을 현재문으로 불러왔습니다.</strong>
            <p>원본 body 필드는 삭제하지 않습니다. 저장 시 버전된 표준문구 변경본을 함께 기록합니다.</p>
          </div>
        </div>
      )}

      {catalogStoredOverride && (
        <div className="cp-standard-contract-warning" role="alert">
          <AlertCircle size={15} />
          <div>
            <strong>잠금된 카탈로그에 기존 변경본이 감지됐습니다.</strong>
            <p>현재 화면은 표준 원문만 사용합니다. 서버 검증·PDF도 잠금된 변경본을 거부해야 합니다.</p>
          </div>
        </div>
      )}

      <div className="cp-standard-original">
        <div className="cp-standard-block-heading">
          <div><span>템플릿 원문</span><strong>{entry.standardTextVersion}</strong></div>
          <span className="cp-standard-lock-chip"><Lock size={11} /> 변경 불가</span>
        </div>
        <div className="cp-standard-original__rows" aria-label="표준문구 원문">
          {entry.rows.map((row) => (
            <div key={row.label}>
              <strong>{row.label}</strong>
              <p>{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      {entry.editable ? (
        <div className="cp-standard-current" data-validation-field="content">
          <div className="cp-standard-block-heading">
            <div><span>현장 적용 현재문</span><strong>{modified ? '표준문구 변경본' : '표준 원문과 일치'}</strong></div>
            <button
              type="button"
              onClick={restoreOriginal}
              disabled={readOnly || !modified}
            >
              <RotateCcw size={13} /> 원문 복원
            </button>
          </div>
          <label className="cp-standard-current__editor" data-validation-field="standardTextModified">
            <span>현재 적용할 문구</span>
            <textarea
              data-validation-field="standardTextCurrent"
              aria-label="현재 적용할 표준문구"
              value={currentText}
              disabled={readOnly}
              onChange={(event) => updateCurrent(event.target.value)}
              onBlur={(event) => updateCurrent(event.target.value, true)}
            />
          </label>

          {modified && (
            <>
              <label className="cp-standard-reason">
                <span>표준문구 변경사유 *</span>
                <textarea
                  data-validation-field="standardTextModificationReason"
                  aria-label="표준문구 변경사유"
                  value={section.standardTextModificationReason || ''}
                  disabled={readOnly}
                  aria-invalid={!section.standardTextModificationReason?.trim()}
                  onChange={(event) => updateReason(event.target.value)}
                  onBlur={(event) => updateReason(event.target.value, true)}
                  placeholder="현장 조건, 승인도면 또는 기술검토 근거와 함께 작성하세요."
                />
                {!section.standardTextModificationReason?.trim() && <small>수정본을 검토·발행하려면 변경사유가 필수입니다.</small>}
              </label>
              <div className="cp-standard-diff">
                <div className="cp-standard-block-heading"><div><span>원문 대비 변경사항</span><strong>줄 단위 diff</strong></div></div>
                <div className="cp-standard-diff__legend"><span className="is-removed">원문 삭제</span><span className="is-added">현재문 추가</span></div>
                <div className="cp-standard-diff__lines" role="list" aria-label="표준문구 변경 비교">
                  {diff.map((line, index) => (
                    <div key={`${line.type}-${index}`} role="listitem" className={`is-${line.type}`}>
                      <span>{line.type === 'removed' ? '−' : line.type === 'added' ? '+' : '·'}</span>
                      <p>{line.value || ' '}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="cp-standard-catalog-notice">
          <Lock size={14} />
          <div><strong>표준 카탈로그 섹션</strong><p>템플릿 버전이 바뀌기 전에는 현장 문서에서 수정할 수 없습니다.</p></div>
        </div>
      )}

      {legacyContent.length > 0 && (
        <details className="cp-structured-legacy cp-standard-legacy">
          <summary>기존 자유서술 기록 {legacyContent.length}건 · 원본 보존</summary>
          <p className="cp-standard-legacy__notice">이 기록은 자동 삭제되지 않으며, 표준문구 원문이나 현재문으로 암묵적 합치지 않습니다.</p>
          {legacyContent.map((item) => (
            <div key={item.key}><strong>{item.label}</strong><p>{item.value}</p></div>
          ))}
        </details>
      )}

      {modified && (
        <div className="cp-standard-warning">
          <AlertCircle size={15} />
          <div>
            <strong>표준 문구가 수정되었습니다.</strong>
            <p>{section.standardTextModificationReason || '변경 사유를 입력하고 검토자 확인을 받아야 합니다.'}</p>
          </div>
        </div>
      )}
      {readOnly && <div className="cp-readonly-notice"><Lock size={14} /> 현재 문서는 조회전용입니다. 발행본은 수정할 수 없습니다.</div>}
    </section>
  );
};

export default ConstructionPlanStandardTextPanel;
