import { ArrowDownToLine, Building2, CircleHelp, HandCoins, Layers3, Landmark, PenLine, RotateCcw, UserRound, UsersRound, Wallet } from 'lucide-react';
import type { ReceiptChoiceOption } from './ReceiptChoiceSelect';
import { recipientLabels } from '../../features/delegated-receipts/depositState';

const neutral = { color: '#52657b', background: '#f1f5f9' };
export const keepChoice: ReceiptChoiceOption = { value: 'keep', label: '기존 유지', icon: RotateCcw, ...neutral };
export const delegationChoices: ReceiptChoiceOption[] = [
  { value: 'delegate', label: '위임', icon: HandCoins, color: '#08775c', background: '#edf8f3' },
  { value: 'direct', label: '직불', icon: ArrowDownToLine, color: '#1d4ed8', background: '#eef4ff' },
  { value: 'unknown', label: '미확인', icon: CircleHelp, ...neutral },
];
export const delegationFilterChoices: ReceiptChoiceOption[] = [{ value: '', label: '위임·직불 전체', icon: Layers3, ...neutral }, ...delegationChoices];
export const customRecipientChoice: ReceiptChoiceOption = { value: 'custom', label: '직접 입력…', icon: PenLine, color: '#4f46a5', background: '#f3f2ff' };
export function recipientChoices(labels = recipientLabels): ReceiptChoiceOption[] {
  return [
    { value: 'unknown', label: labels.unknown, icon: CircleHelp, ...neutral },
    { value: 'personal', label: labels.personal, icon: UserRound, color: '#0369a1', background: '#edf7fc' },
    { value: 'site_leader', label: labels.site_leader, icon: Building2, color: '#92400e', background: '#fff7e9' },
    { value: 'jaewook_leader', label: labels.jaewook_leader, icon: UsersRound, color: '#7e22a2', background: '#faf0ff' },
  ];
}
export const recipientFilterChoices: ReceiptChoiceOption[] = [{ value: '', label: '전체 계좌', icon: Wallet, ...neutral }, { ...customRecipientChoice, label: '직접 입력한 계좌', icon: Landmark }, ...recipientChoices()];
