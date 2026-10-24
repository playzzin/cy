import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AiWorkspace } from '../../features/ai-workspace/AiWorkspace';
import { workspaceClient } from '../../features/ai-workspace/service';

export default function AiWorkspacePage() {
  const { currentUser } = useAuth();
  return currentUser ? <AiWorkspace key={currentUser.uid} client={workspaceClient} /> : <p>로그인이 필요합니다.</p>;
}
