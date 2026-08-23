import React, { useMemo } from 'react';
import type { ConstructionPlan } from '../types';
import { planConstructionPlanPhysicalPages } from '../domain/physicalPagePlan';
import ConstructionPlanA4Preview from './ConstructionPlanA4Preview';

type ConstructionPlanPrintDocumentProps = {
  plan: ConstructionPlan;
  drawingPreviewUrls?: Record<string, string>;
  containerRef?: React.Ref<HTMLElement>;
};

export function ConstructionPlanPrintDocument({
  plan,
  drawingPreviewUrls = {},
  containerRef,
}: ConstructionPlanPrintDocumentProps) {
  const planning = useMemo(() => {
    try {
      return { physicalPlan: planConstructionPlanPhysicalPages(plan), error: '' };
    } catch (error) {
      return {
        physicalPlan: undefined,
        error: error instanceof Error ? error.message : 'construction-plan-physical-page-plan-failed',
      };
    }
  }, [plan]);

  return (
    <section
      ref={containerRef}
      className="cp-print-document"
      aria-label="시공계획서 A4 전체 인쇄본"
      data-physical-page-error={planning.error || undefined}
    >
      {planning.physicalPlan?.pages.map((page) => (
        <ConstructionPlanA4Preview
          key={page.key}
          plan={page.plan}
          section={page.section}
          zoom={1}
          drawingPreviewUrl={drawingPreviewUrls[page.section.id]}
          physicalPageNumber={page.manifest.physicalPageNumber}
          physicalPageCount={planning.physicalPlan!.physicalPageCount}
          continuationIndex={page.manifest.continuationIndex}
          logicalStartPhysicalPages={planning.physicalPlan!.logicalStartPhysicalPages}
        />
      ))}
    </section>
  );
}

export default ConstructionPlanPrintDocument;
