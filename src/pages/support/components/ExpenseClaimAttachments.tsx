import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import SecureExpenseReceipt from '../../../components/SecureExpenseReceipt';
import ResponsiveDetailDialog from '../../../components/common/ResponsiveDetailDialog';
import type { TeamExpenseClaimAttachment } from '../../../types/teamExpenseLedger';

const thumbnailClass = 'inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 text-slate-500';

function isProtectedReceipt(attachment: TeamExpenseClaimAttachment) {
  return attachment.fullPath?.startsWith('team-expense-receipts/');
}

export default function ExpenseClaimAttachments({ attachments }: { attachments: TeamExpenseClaimAttachment[] }) {
  const [open, setOpen] = useState(false);
  const [first] = attachments;
  if (!first) return null;

  const protectedReceipt = isProtectedReceipt(first);
  const previewUrl = protectedReceipt ? undefined : first.url;
  const additionalCount = attachments.length - 1;
  const name = first.name || '첨부 사진';
  const thumbnail = previewUrl ? (
    <img src={previewUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <ImageIcon size={14} aria-hidden="true" />
  );

  if (additionalCount === 0 && previewUrl) {
    return <a href={previewUrl} target="_blank" rel="noreferrer" title={name} aria-label={name} className={thumbnailClass}>{thumbnail}</a>;
  }

  if (additionalCount === 0 && !protectedReceipt) {
    return <span title={name} role="img" aria-label={name} className={thumbnailClass}>{thumbnail}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`첨부 사진 ${attachments.length}장 보기`}
        className="inline-flex shrink-0 items-center gap-1 rounded text-[10px] font-bold text-slate-600 hover:text-blue-700"
      >
        <span className={thumbnailClass}>{thumbnail}</span>
        {additionalCount > 0 && <span className="tabular-nums">+{additionalCount}</span>}
      </button>
      <ResponsiveDetailDialog open={open} onOpenChange={setOpen} title="첨부 사진" description={`${attachments.length}장`}>
        <ul className="grid gap-2">
          {attachments.map((attachment) => {
            const label = attachment.name || '첨부 사진';
            const url = attachment.url;
            return (
              <li key={attachment.id || attachment.fullPath || url || label} className="break-all rounded border border-slate-200 p-2 text-sm">
                {isProtectedReceipt(attachment) ? (
                  <SecureExpenseReceipt fullPath={attachment.fullPath} name={label} />
                ) : url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-bold text-blue-700 hover:underline">
                    <img src={url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />
                    {label}
                  </a>
                ) : (
                  <span className="text-slate-500">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      </ResponsiveDetailDialog>
    </>
  );
}
