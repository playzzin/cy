import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CeoProfileTabs from './CeoProfileTabs';

describe('CeoProfileTabs', () => {
    it('기존 대표 프로필 섹션과 세 개의 탭을 유지한다', () => {
        render(<CeoProfileTabs isDarkMode={false} />);

        expect(screen.getByRole('heading', { name: '대표 경영 원칙' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /대표브랜드/ }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tab', { name: /대표이력서/ })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /대표소개서/ })).toBeTruthy();
    });

    it('대표이력서 안에 이재욱 대표 사진과 이력서 양식을 표시한다', () => {
        render(<CeoProfileTabs isDarkMode={false} />);

        fireEvent.click(screen.getByRole('tab', { name: /대표이력서/ }));

        expect(screen.getByRole('heading', { name: '대표이사 이재욱 이력서' })).toBeTruthy();
        expect(screen.getByRole('img', { name: '청연이엔지 이재욱 대표이사 프로필' })).toBeTruthy();
        expect(screen.getByText('건설 현장 및 전사 운영관리')).toBeTruthy();
        expect(screen.getByRole('heading', { name: '주요 경력 및 담당 업무' })).toBeTruthy();
    });

    it('지정한 대표 인사말 본문을 대표이력서 탭 내부에 통합한다', () => {
        render(<CeoProfileTabs isDarkMode={false} />);

        fireEvent.click(screen.getByRole('tab', { name: /대표이력서/ }));

        expect(screen.getByRole('heading', { name: '신뢰할 수 있는 청연의 약속' })).toBeTruthy();
        expect(screen.getByText(/청연에 보내주시는/)).toBeTruthy();
        expect(screen.getByText(/발주처와 협력사가 함께 안심할 수 있는 현장 운영 체계/)).toBeTruthy();
        expect(screen.getByText(/임금 사고 없는 투명한 경영/)).toBeTruthy();
        expect(screen.getByText(/감에 의존하는 시공이 아니라 데이터로 확인하고 책임 있게 관리하는 시공/)).toBeTruthy();
        expect(screen.getByText('이 재 욱')).toBeTruthy();
    });

    it('방향키로 기존 프로필 탭을 이동한다', () => {
        render(<CeoProfileTabs isDarkMode={false} />);

        const brandTab = screen.getByRole('tab', { name: /대표브랜드/ });
        fireEvent.keyDown(brandTab, { key: 'ArrowRight' });

        expect(screen.getByRole('tab', { name: /대표이력서/ }).getAttribute('aria-selected')).toBe('true');
    });
});
