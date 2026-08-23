import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    abbreviateConstructionPlanSha256,
    constructionPlanAnnotationStyleDisplay,
    constructionPlanDrawingPanelTitle,
    constructionPlanDrawingSourceDisplay,
    constructionPlanSectionPageLabel,
    constructionPlanStatusDisplayName,
    constructionPlanTemplateDisplay,
    formatConstructionPlanKstTimestamp,
} from './fieldUsePdfPresentation';

test('field-use PDF presentation replaces internal keys, tokens and ISO timestamps with Korean labels', () => {
    const sha = 'a'.repeat(64);
    assert.equal(constructionPlanStatusDisplayName('complete'), '작성완료');
    assert.equal(formatConstructionPlanKstTimestamp('2026-08-22T00:00:00.000Z'), '2026-08-22 09:00 (KST)');
    assert.equal(constructionPlanSectionPageLabel(31), '표준 페이지 31');
    assert.equal(
        constructionPlanTemplateDisplay({
            tradeType: 'system-scaffold',
            templateVersion: '1.0.0',
            rendererVersion: 'field-use-a4-v3',
            schemaVersion: 1,
            snapshotSchemaVersion: 2,
        }),
        '시스템비계 표준 1.0.0 · 서버 현장사용본 A4 렌더러 v3 · 문서구조 v1 · 승인스냅샷 v2',
    );
    assert.equal(abbreviateConstructionPlanSha256(sha), `SHA-256 ${'a'.repeat(16)}…`);
    assert.equal(constructionPlanDrawingPanelTitle({ drawingNo: 'D-04', pageIndex: 0, revision: 'A' }), 'D-04 · 도면 1쪽 · 개정 A');
    assert.equal(
        constructionPlanDrawingSourceDisplay({ sourceSha256: sha, sourceGeneration: '17', pageFingerprintHash: sha }),
        `원본 SHA-256 ${'a'.repeat(16)}… · 원본 버전 17 · 페이지 지문 SHA-256 ${'a'.repeat(16)}…`,
    );
    const style = constructionPlanAnnotationStyleDisplay({
        strokeToken: 'construction-plan.retain.stroke',
        fillToken: 'construction-plan.retain.fill',
        strokeWidthPt: 2,
        opacity: 0.42,
        dash: 'solid',
        hatch: 'diagonal',
    });
    assert.equal(style, '선색 빨강 · 채움 연빨강 · 굵기 2pt · 불투명도 0.42 · 선형 실선 · 해치 사선');
    ['system-scaffold', 'work-platform-access-plan', 'complete', 'construction-plan.retain', 'field-use-a4-v3', 'T00:00:00.000Z']
        .forEach((internalValue) => assert.equal([
            constructionPlanSectionPageLabel(31),
            constructionPlanStatusDisplayName('complete'),
            constructionPlanTemplateDisplay({
                tradeType: 'system-scaffold', templateVersion: '1.0.0', rendererVersion: 'field-use-a4-v3', schemaVersion: 1, snapshotSchemaVersion: 2,
            }),
            style,
            formatConstructionPlanKstTimestamp('2026-08-22T00:00:00.000Z'),
        ].join(' ').includes(internalValue), false, internalValue));
});
