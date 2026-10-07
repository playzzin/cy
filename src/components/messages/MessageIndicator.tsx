import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useMessageNotifications } from '../../hooks/useMessageInbox';
import { useMessageReadActions } from '../../hooks/useMessageReadActions';
import { messageService } from '../../services/messageService';
import type { ErpMessage } from '../../types/erpMessage';
import { messageDestination } from '../../utils/messageNavigation';
import './MessageSystem.css';

const formatRelativeTime = (message: ErpMessage): string => {
  const diffMs = Date.now() - message.createdAt.toMillis();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return '방금';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return message.createdAt.toDate().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

const getTypeLabel = (message: ErpMessage): string => {
  if (message.type === 'system') return '시스템';
  if (message.recipientScope === 'all') return '전체';
  return '개인';
};

export const MessageIndicator: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { markRead, markAllRead, busy, error: actionError, retry: retryRead } = useMessageReadActions(currentUser?.uid);
  const { messages, summary, loading, error, retry } = useMessageNotifications(currentUser?.uid);

  useEffect(() => { setOpen(false); }, [currentUser?.uid]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openMessage = (message: ErpMessage) => {
    if (!currentUser?.uid) return;
    void markRead(message);
    setOpen(false);
    navigate(messageDestination(message));
  };

  const markAllAsRead = () => markAllRead(messages);

  const unreadLabel = summary.unread > 99 ? '99+' : String(summary.unread);

  return (
    <div className="erp-message-indicator" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`header-btn erp-message-button ${summary.unread > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="메시지함"
        aria-label={`메시지함${summary.unread > 0 ? `, 안 읽은 메시지 ${summary.unread}건` : ''}`}
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={faEnvelope} />
        {summary.unread > 0 && <span className="erp-message-badge">{unreadLabel}</span>}
      </button>

      {actionError && <div role="alert" className="erp-message-read-error">{actionError}
        <button type="button" disabled={busy} onClick={() => void retryRead?.()}>읽음 처리 다시 시도</button>
      </div>}

      {open && (
        <div className="erp-message-popover" role="dialog" aria-label="최근 메시지">
          <div className="erp-message-popover-header">
            <div>
              <h3 className="erp-message-popover-title">메시지함</h3>
              <div className="erp-message-popover-subtitle">
                {loading ? '불러오는 중' : `안 읽음 ${summary.unread}건 · 전체 ${summary.total}건`}
              </div>
            </div>
            <div className="erp-message-popover-actions">
              <button
                type="button"
                className="erp-message-text-button"
                onClick={markAllAsRead}
                disabled={summary.unread === 0 || busy || loading || Boolean(error)}
                title="모두 읽음 처리"
                aria-label="모든 알림 읽음 처리"
              >
                <FontAwesomeIcon icon={faCheckDouble} />
              </button>
            </div>
          </div>

          <div className="erp-message-popover-list">
            {error && <div role="alert" className="erp-message-empty">알림을 불러오지 못했습니다.<button type="button" onClick={retry} className="erp-message-text-button">다시 불러오기</button></div>}
            {loading ? <div role="status" className="erp-message-empty">알림을 불러오는 중입니다.</div> : !error && messages.length === 0 ? (
              <div className="erp-message-empty">도착한 메시지가 없습니다.</div>
            ) : (
              !error && [...messages].sort((a, b) => Number(messageService.isReadBy(a, currentUser?.uid || '')) - Number(messageService.isReadBy(b, currentUser?.uid || '')) || b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, 6).map((message) => {
                const unread = currentUser?.uid ? !messageService.isReadBy(message, currentUser.uid) : false;

                return (
                  <button
                    key={message.id}
                    type="button"
                    className={`erp-message-preview ${unread ? 'unread' : ''}`}
                    onClick={() => void openMessage(message)}
                    disabled={busy}
                  >
                    <div className="erp-message-preview-topline">
                      <span className="erp-message-preview-title">{message.title}</span>
                      <span className="erp-message-preview-time">{formatRelativeTime(message)}</span>
                    </div>
                    <div className="erp-message-preview-body">{message.body}</div>
                    <div className="erp-message-preview-meta">
                      {unread && <span className="erp-message-dot" />}
                      <span>{getTypeLabel(message)}</span>
                      <span>·</span>
                      <span>{message.senderName}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="erp-message-popover-footer">
            <button
              type="button"
              className="erp-message-open-all"
              onClick={() => {
                setOpen(false);
                navigate('/messages');
              }}
            >
              전체 메시지 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageIndicator;
