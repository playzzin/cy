import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faInbox, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

type MessagePageTab = 'view' | 'compose' | 'settings';

interface MessagePageTabsProps {
  active: MessagePageTab;
}

const tabs: Array<{ key: MessagePageTab; label: string; path: string; icon: typeof faInbox }> = [
  { key: 'view', label: '메시지 보기', path: '/messages', icon: faInbox },
  { key: 'compose', label: '메시지 보내기', path: '/messages/compose', icon: faPaperPlane },
  { key: 'settings', label: '자동 메시지 설정', path: '/messages/settings', icon: faGear }
];

const MessagePageTabs: React.FC<MessagePageTabsProps> = ({ active }) => {
  const navigate = useNavigate();

  return (
    <nav className="erp-message-page-tabs" aria-label="메시지 메뉴">
      {tabs.map((tab) => (
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
