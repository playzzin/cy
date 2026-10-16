import React from 'react';
import { Navigate } from 'react-router-dom';
import { useMessageAccess } from '../../hooks/useMessageAccess';

export default function MessageWriteAccessGate({ children }: { children: React.ReactNode }) {
    const { loading, canSend } = useMessageAccess();
    if (loading) return <div role="status" className="p-6">메시지 권한을 확인하는 중입니다.</div>;
    if (!canSend) return <Navigate to="/messages" replace />;
    return <>{children}</>;
}
