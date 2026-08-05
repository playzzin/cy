import { applyDocumentMeta } from './useDocumentMeta';

describe('applyDocumentMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('updates document title and core metadata', () => {
    applyDocumentMeta({
      title: 'ERP Dashboard',
      description: 'Operations dashboard',
      canonicalUrl: '/dashboard',
      image: '/icons/icon-512.png',
    });

    expect(document.title).toBe('ERP Dashboard');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Operations dashboard');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('ERP Dashboard');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('http://localhost/dashboard');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('http://localhost/dashboard');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('http://localhost/icons/icon-512.png');
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe('Operations dashboard');
  });

  it('reuses existing meta nodes', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'description');
    existing.setAttribute('content', 'old');
    document.head.appendChild(existing);

    applyDocumentMeta({
      title: 'New title',
      description: 'new',
    });

    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(existing.getAttribute('content')).toBe('new');
  });

  it('allows page-specific robots and absolute canonical URLs', () => {
    applyDocumentMeta({
      title: 'Private page',
      robots: 'noindex,nofollow',
      canonicalUrl: 'https://erp.example.com/private',
    });

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://erp.example.com/private');
  });
});
