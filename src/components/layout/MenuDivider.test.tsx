import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MenuDivider from './MenuDivider';

it('작은 제목과 양쪽 선을 표시하며 긴 제목은 너비 안에서 생략한다', () => {
    render(<MenuDivider item={{ text: '-', dividerTitle: '  현장 관리  ', dividerStyle: 'dashed', dividerSpacing: 'compact' }} />);
    expect(screen.getByRole('separator', { name: '현장 관리 구분선' })).toHaveStyle({ padding: '8px 16px', width: '100%' });
    expect(screen.getByText('현장 관리')).toHaveStyle({ fontSize: '11px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('빈 제목, 접힌 메뉴와 숨김 설정을 처리한다', () => {
    const view = render(<MenuDivider item={{ text: '-', dividerTitle: '   ' }} />);
    expect(screen.getByRole('separator', { name: '메뉴 구분선' })).toHaveTextContent(/^$/);
    view.rerender(<MenuDivider item={{ text: '-', dividerTitle: '현장 관리' }} collapsed />);
    expect(screen.getByRole('separator', { name: '현장 관리 구분선' })).toHaveAttribute('title', '현장 관리');
    expect(screen.queryByText('현장 관리')).not.toBeInTheDocument();
    view.rerender(<MenuDivider item={{ text: '-', dividerTitle: '현장 관리', hide: true }} />);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
});
