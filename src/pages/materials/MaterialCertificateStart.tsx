import React from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MaterialCertificateStart({ kind, expired = false }: { kind: 'inbound' | 'outbound'; expired?: boolean }) {
  const navigate = useNavigate();
  const label = kind === 'inbound' ? '입고' : '출고';
  return <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-label={`${label} 확인서 준비`}>
    <FileText size={32} className="mb-4 text-blue-600" aria-hidden="true" />
    <h1 className="text-xl font-bold text-slate-900">{label} 확인서 만들기</h1>
    <p className="mt-3 leading-6 text-slate-600">{expired ? '이전에 열었던 확인서는 다시 준비해 주세요. ' : ''}{label} 등록 화면에서 현장과 자재를 선택하면 확인서를 만들 수 있습니다.</p>
    <ol className="my-6 list-inside list-decimal space-y-3 text-sm leading-6 text-slate-700">
      <li>{label}할 현장과 날짜를 선택하세요.</li>
      <li>자재와 수량을 입력하고 필요한 사진을 첨부하세요.</li>
      <li>사진 도구 아래의 ‘{kind === 'inbound' ? '입고증' : '반출증'} 페이지’를 눌러 내용을 확인하세요.</li>
    </ol>
    <button type="button" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white sm:w-auto"
      onClick={() => navigate(`/materials/${kind}`)}>{label} 내역 준비하기 <ArrowRight size={18} aria-hidden="true" /></button>
  </section>;
}
