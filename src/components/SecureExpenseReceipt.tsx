import { useState } from 'react';
import { teamExpenseRequestService } from '../services/teamExpenseRequestService';

export default function SecureExpenseReceipt({ fullPath, name = '영수증' }: { fullPath: string; name?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const open = async () => {
    if (busy) return;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy(true); setError('');
    try {
      const file = await teamExpenseRequestService.receipt(fullPath);
      const url = URL.createObjectURL(file);
      if (popup) popup.location.href = url;
      else { const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { popup?.close(); setError(cause instanceof Error ? cause.message : '영수증을 열지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <span><button type="button" onClick={() => void open()} disabled={busy}>{busy ? '열람 확인 중…' : name}</button>{error && <span role="alert">{error}</span>}</span>;
}
