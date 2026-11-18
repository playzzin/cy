import React, { useState } from 'react';
import { CardBillingTargetManager } from '../../src/components/card/CardBillingTargetManager';
import type { Card } from '../../src/types/card';
import { createRoot } from 'react-dom/client';
import ExpenseLedgerPage from '../../src/pages/support/ExpenseLedgerPage';
import { rememberSupportManagementYearMonth } from '../../src/utils/supportManagementState';
import './styles.css';

rememberSupportManagementYearMonth('2026-09');
function DatesFixture() {
  const [billingStartDate, setDate] = useState(sessionStorage.getItem('fixture.billingStartDate'));
  const card: Card = { id: 'date-fixture', name: '가상카드', issuer: '가상', last4: '1234', maskedNumber: '****1234',
    cardType: 'CREDIT', status: 'ASSIGNED', currentAssigneeType: 'TEAM', currentAssigneeId: 'team-a', currentAssigneeName: '가상A팀', billingStartDate };
  return <CardBillingTargetManager cards={[card]} loading={false} initialCardId={card.id}
    onRefresh={() => setDate(sessionStorage.getItem('fixture.billingStartDate'))} />;
}
createRoot(document.getElementById('root')!).render(
  new URLSearchParams(window.location.search).get('mode') === 'dates' ? <DatesFixture /> : <ExpenseLedgerPage embedded />
);
