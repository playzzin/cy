import React from 'react';
import { createRoot } from 'react-dom/client';
import SimpleConversionWorkspace from '../../src/features/excel-converter/ChatConversionWorkspace';
import { makePlannerRequest } from '../../src/features/excel-converter/plannerRequest';
import { planSchema } from '../../src/features/excel-converter/types';

const checkAi = async () => { const response = await fetch('/api/excel-converter/status'); if(!response.ok) throw new Error('연결 실패');return response.json(); };
createRoot(document.getElementById('root')!).render(<SimpleConversionWorkspace ownerId="fixture-only-excel-converter-simple" checkAi={checkAi} analyze={async (prompt, plan, table, target) => {
  const response = await fetch('/api/excel-converter/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makePlannerRequest(prompt, { ...plan, overrides: [] }, table, target)) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Gemini 분석에 실패했습니다.');
  result.plan = planSchema.parse({ ...result.plan, mappings: result.plan.mappings.map((m: any) => {
    const candidates = plan.mappings.filter(p => p.targetColumn === m.targetColumn);
    const named = candidates.filter(p => p.label === m.label);
    const sourced = candidates.filter(p => p.sourceKeys.length && JSON.stringify(p.sourceKeys) === JSON.stringify(m.sourceKeys));
    const previous = named.length === 1 ? named[0] : sourced.length === 1 ? sourced[0] : candidates.length === 1 ? candidates[0] : undefined;
    if (candidates.some(p => p.rowOffset) && !previous) throw new Error('두 줄 날짜 연결이 모호합니다.');
    return { ...m, rowOffset: previous?.rowOffset ?? m.rowOffset, verifyKey: previous?.verifyKey || '' };
  }), fixedCells: result.plan.fixedCells.map((f: any) => ({ ...f, mapping: { ...f.mapping, verifyKey: plan.fixedCells.find(p=>p.address===f.address)?.mapping.verifyKey || '' } })) });
  return result;
}}/>);
