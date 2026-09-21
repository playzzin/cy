import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resolveSecureSignature } from '../services/secureSignatureService';

export default function SecureSignature({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { currentUser } = useAuth();
  const [result, setResult] = useState<{ source?: string; uid?: string; url: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setResult(null); setError(false);
    if (src) void resolveSecureSignature(src).then(url => {
      if (!cancelled) setResult({ source: src, uid: currentUser?.uid, url });
    }, () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [src, currentUser?.uid]);
  if (!result || result.source !== src || result.uid !== currentUser?.uid) return <span role={error ? 'alert' : 'status'}>{error ? '서명 열람 권한을 확인해 주세요.' : '서명 확인 중…'}</span>;
  return <img {...props} src={result.url} alt={alt || '서명'} />;
}
