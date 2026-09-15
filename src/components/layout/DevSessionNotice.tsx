import React from 'react';
import { useLocation } from 'react-router-dom';

export const DevSessionNotice: React.FC = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    params.set('devAdmin', '0');

    return (
        <aside aria-label="개발용 샘플 세션" style={{ padding: '14px 18px', background: '#fff7ed', color: '#9a3412', borderBottom: '1px solid #fed7aa', fontSize: 13 }}>
            <strong>개발용 샘플 계정</strong>
            <p style={{ margin: '6px 0 10px', lineHeight: 1.6 }}>현재 직책과 메뉴는 샘플 데이터입니다. 실제 계정의 DEV 직책과 저장된 메뉴는 이 화면에 표시되지 않습니다.</p>
            {/* A full navigation reinitializes AuthProvider and menu subscriptions together. */}
            <a href={`${location.pathname}?${params.toString()}${location.hash}`} style={{ color: '#9a3412', fontWeight: 700, textDecoration: 'underline' }}>실제 계정으로 돌아가기</a>
        </aside>
    );
};
