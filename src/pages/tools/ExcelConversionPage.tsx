import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ChatConversionWorkspace from '../../features/excel-converter/ChatConversionWorkspace';
import { excelConversionService, makePlannerRequest } from '../../services/excelConversionService';

export default function ExcelConversionPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  const analyze = (prompt: string, plan: Parameters<typeof makePlannerRequest>[1], table: Parameters<typeof makePlannerRequest>[2], target: Parameters<typeof makePlannerRequest>[3], example?: Parameters<typeof makePlannerRequest>[4]) => excelConversionService.analyze(makePlannerRequest(prompt, plan, table, target, example));
  return <ChatConversionWorkspace key={currentUser.uid} ownerId={currentUser.uid} analyze={analyze} checkAi={excelConversionService.status}/>;
}
