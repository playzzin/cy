import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClockRotateLeft, faGear, faInbox, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

type MessagePageTab = 'view' | 'compose' | 'settings' | 'logs';

interface MessagePageTabsProps {
  active: MessagePageTab;
  readOnly?: boolean;
}

const tabs: Array<{ key: MessagePageTab; label: string; path: string; icon: typeof faInbox }> = [
  { key: 'view', label: '메시지 보기', path: '/messages', icon: faInbox },
  { key: 'compose', label: '메시지 보내기', path: '/messages/compose', icon: faPaperPlane },
  { key: 'settings', label: '자동 메시지 설정', path: '/messages/settings', icon: faGear },
  { key: 'logs', label: '자동 발송 로그', path: '/messages/automation-logs', icon: faClockRotateLeft }
];

const MessagePageTabs: React.FC<MessagePageTabsProps> = ({ active, readOnly = false }) => {
  const navigate = useNavigate();

  return (
    <nav className="erp-message-page-tabs" aria-label="메시지 메뉴">
      <button type="button" className="erp-message-page-tab" onClick={() => navigate('/notices?tab=notifications')}>공지·알림 센터</button>
      {tabs.filter(tab => !readOnly || tab.key === 'view').map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`erp-message-page-tab ${active === tab.key ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <FontAwesomeIcon icon={tab.icon} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
};

export default MessagePageTabs;
