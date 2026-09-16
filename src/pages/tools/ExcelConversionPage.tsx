import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ConversionWorkspace from '../../features/excel-converter/ConversionWorkspace';
import SimpleConversionWorkspace from '../../features/excel-converter/SimpleConversionWorkspace';
import { excelConversionService, makePlannerRequest } from '../../services/excelConversionService';

export default function ExcelConversionPage() {
  const { currentUser } = useAuth();
  const [advanced, setAdvanced] = useState(false);
  if (!currentUser) return null;
  const analyze = (prompt: string, plan: Parameters<typeof makePlannerRequest>[1], table: Parameters<typeof makePlannerRequest>[2], target: Parameters<typeof makePlannerRequest>[3], example?: Parameters<typeof makePlannerRequest>[4]) => excelConversionService.analyze(makePlannerRequest(prompt, plan, table, target, example));
  return advanced ? <><button onClick={() => setAdvanced(false)} className="m-4 rounded-lg border px-4 py-2">← 간편 화면으로</button><ConversionWorkspace key={currentUser.uid} ownerId={currentUser.uid} analyze={analyze}/></> : <SimpleConversionWorkspace key={currentUser.uid} ownerId={currentUser.uid} analyze={analyze} checkAi={excelConversionService.status} onAdvanced={() => setAdvanced(true)}/>;
}
