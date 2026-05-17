import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelopeOpenText, faArrowRight, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useMessageInbox } from '../../hooks/useMessageInbox';
import { messageService } from '../../services/messageService';
import type { ErpMessage } from '../../types/erpMessage';
import './MessageSystem.css';

const formatTime = (message: ErpMessage): string =>
  message.createdAt.toDate().toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export const DashboardMessageWidget: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { messages, summary, loading } = useMessageInbox(currentUser?.uid, 3);

  const openMessage = async (message: ErpMessage) => {
    if (currentUser?.uid && !messageService.isReadBy(message, currentUser.uid)) {
      await messageService.markAsRead(message.id, currentUser.uid);
    }
    navigate(`/messages?messageId=${message.id}`);
  };

  const markAllAsRead = async () => {
    if (!currentUser?.uid) return;
    await messageService.markAllAsRead(messages, currentUser.uid);
  };

  return (
    <section className="erp-message-dashboard-card" aria-label="대시보드 메시지 요약">
      <div className="erp-message-dashboard-header">
        <div>
          <h2 className="erp-message-dashboard-title">
            <FontAwesomeIcon icon={faEnvelopeOpenText} />
            업무 메시지
          </h2>
          <div className="erp-message-dashboard-summary">
            <span className="erp-message-summary-pill">안 읽음 {summary.unread}건</span>
            {summary.urgentUnread > 0 && (
              <span className="erp-message-summary-pill urgent">중요 {summary.urgentUnread}건</span>
            )}
            <span>{loading ? '동기화 중' : '실시간 업데이트'}</span>
          </div>
        </div>

        <div className="erp-message-popover-actions">
          <button
            type="button"
            className="erp-message-secondary-button"
            onClick={markAllAsRead}
            disabled={summary.unread === 0}
          >
            <FontAwesomeIcon icon={faCheckDouble} />
            모두 읽음
          </button>
          <button
            type="button"
            className="erp-message-primary-button"
            onClick={() => navigate('/messages')}
          >
            메시지함
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="erp-message-dashboard-empty">현재 확인할 메시지가 없습니다.</div>
      ) : (
        <div className="erp-message-dashboard-list">
          {messages.map((message) => {
            const unread = currentUser?.uid ? !messageService.isReadBy(message, currentUser.uid) : false;

            return (
              <button
                key={message.id}
                type="button"
                className={`erp-message-dashboard-item ${unread ? 'unread' : ''}`}
                onClick={() => void openMessage(message)}
              >
                <div className="erp-message-preview-topline">
                  <span className="erp-message-preview-title">{message.title}</span>
                  <span className="erp-message-preview-time">{formatTime(message)}</span>
                </div>
                <div className="erp-message-preview-body">{message.body}</div>
                <div className="erp-message-preview-meta">
                  {unread && <span className="erp-message-dot" />}
                  <span>{message.senderName}</span>
                  <span>·</span>
                  <span>{message.category}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default DashboardMessageWidget;
