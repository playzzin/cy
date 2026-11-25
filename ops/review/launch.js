// The app frame receives only the existing expiring, read-only preview identity.
(async () => {
  const status = document.querySelector('[role=status]');
  const retry = document.querySelector('button');
  const frame = document.createElement('iframe');
  frame.title = '청연ENG 개발 화면';
  frame.name = 'cy-dev-preview:' + crypto.randomUUID();
  retry.onclick = () => location.reload();
  function stop(message) {
    frame.remove();
    status.textContent = message;
    retry.hidden = false;
  }
  try {
    const response = await fetch('/_review/session', {
      method: 'POST',
      headers: { 'X-Cy-Review': '1' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    const session = await response.json();
    const lifetime = session.expiresAt * 1000 - Date.now();
    if (!session.token || !Number.isFinite(lifetime) || lifetime <= 0) throw new Error();
    setTimeout(() => stop('조회 시간이 만료되었습니다.'), lifetime);
    const ready = setTimeout(() => stop('개발 화면을 열지 못했습니다.'), 45000);
    const url = new URL(location.href);
    if (url.pathname === '/' || url.pathname === '/login') url.pathname = '/dashboard';
    const initialPath = url.pathname + url.search;
    window.addEventListener('message', (event) => {
      if (
        event.source !== frame.contentWindow ||
        event.origin !== location.origin ||
        event.data?.frameId !== frame.name
      )
        return;
      switch (event.data.type) {
        case 'cy-preview:ready':
          frame.contentWindow.postMessage(
            { type: 'cy-preview:bootstrap', frameId: frame.name, session },
            location.origin,
          );
          break;
        case 'cy-preview:authenticated':
          clearTimeout(ready);
          status.textContent = '';
          frame.contentWindow.postMessage(
            { type: 'cy-preview:navigate', frameId: frame.name, path: initialPath },
            location.origin,
          );
          break;
        case 'cy-preview:failed':
        case 'cy-preview:expired':
        case 'cy-preview:exit':
          clearTimeout(ready);
          stop('조회 세션이 종료되었습니다.');
          break;
      }
    });
    status.textContent = '연결 중';
    url.searchParams.set('devPreviewFrame', '1');
    frame.src = url.href;
    document.body.append(frame);
  } catch {
    stop('운영 계정의 비공개 검증 권한을 확인해 주세요.');
  }
})();
