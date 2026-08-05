import React from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import type { QuickMenuAction } from '../useQuickMenuActions';

interface QuickActionTileProps {
    action: QuickMenuAction;
    onActivate: (path: string, openInNewTab?: boolean) => void;
}

const actionThemeMap: Record<string, { color: string; bg: string }> = {
    brand: { color: '#3b82f6', bg: '#eff6ff' },
    blue: { color: '#2563eb', bg: '#eff6ff' },
    green: { color: '#16a34a', bg: '#f0fdf4' },
    slate: { color: '#475569', bg: '#f8fafc' },
    indigo: { color: '#4f46e5', bg: '#eef2ff' },
    emerald: { color: '#059669', bg: '#ecfdf5' },
    sky: { color: '#0284c7', bg: '#f0f9ff' },
    rose: { color: '#e11d48', bg: '#fff1f2' },
    purple: { color: '#9333ea', bg: '#faf5ff' },
    violet: { color: '#8b5cf6', bg: '#f5f3ff' },
    orange: { color: '#f97316', bg: '#fff7ed' },
    amber: { color: '#d97706', bg: '#fffbeb' },
    cyan: { color: '#06b6d4', bg: '#ecfeff' },
    teal: { color: '#0d9488', bg: '#f0fdfa' },
    gray: { color: '#4b5563', bg: '#f9fafb' },
};

const ActionButton = styled.button<{ $color: string; $bg: string }>`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 15px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 116px;
    text-align: left;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        border-color: ${(props) => props.$color};
        background: ${(props) => props.$bg};

        .icon-wrapper {
            background: ${(props) => props.$color};
            color: white;
        }

        h4 {
            color: ${(props) => props.$color};
        }
    }

    &:focus-visible {
        outline: 3px solid ${(props) => props.$color}33;
        outline-offset: 2px;
        border-color: ${(props) => props.$color};
    }
`;

const IconWrapper = styled.div<{ $color: string; $bg: string }>`
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 9px;
    background: ${(props) => props.$bg};
    color: ${(props) => props.$color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    margin-bottom: 8px;
    transition: all 0.2s ease;
`;

const ActionText = styled.div`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const Label = styled.h4`
    width: 100%;
    font-size: 0.93rem;
    line-height: 1.25;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
    transition: color 0.2s ease;
    overflow-wrap: anywhere;
    word-break: keep-all;
`;

const Description = styled.p`
    color: #64748b;
    font-size: 0.78rem;
    line-height: 1.45;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

const ActionMeta = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    width: fit-content;
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 800;
`;

export const QuickActionTile = React.memo<QuickActionTileProps>(({ action, onActivate }) => {
    const theme = actionThemeMap[action.color] || actionThemeMap.slate;

    return (
        <ActionButton
            type="button"
            onClick={() => onActivate(action.path, action.openInNewTab)}
            aria-label={`${action.label} 이동`}
            title={`${action.label} - ${action.desc}`}
            $color={theme.color}
            $bg={theme.bg}
        >
            <IconWrapper
                className="icon-wrapper"
                $color={theme.color}
                $bg={theme.bg}
            >
                <FontAwesomeIcon icon={action.icon} />
            </IconWrapper>
            <ActionText>
                <Label>{action.label}</Label>
                <Description>{action.desc}</Description>
                {action.openInNewTab && (
                    <ActionMeta>
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                        새 탭
                    </ActionMeta>
                )}
            </ActionText>
        </ActionButton>
    );
});
