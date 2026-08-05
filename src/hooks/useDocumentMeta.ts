import { useEffect } from 'react';

export interface DocumentMetaOptions {
  title: string;
  description?: string;
  canonicalUrl?: string;
  image?: string;
  robots?: string;
  siteName?: string;
  type?: string;
}

const upsertMeta = (name: string, content: string) => {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertPropertyMeta = (property: string, content: string) => {
  let element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertCanonical = (href: string) => {
  let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const toAbsoluteUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
};

export const applyDocumentMeta = ({
  title,
  description,
  canonicalUrl,
  image,
  robots = 'index,follow',
  siteName = '청연ENG ERP',
  type = 'website',
}: DocumentMetaOptions) => {
  document.title = title;
  upsertMeta('robots', robots);
  upsertPropertyMeta('og:type', type);
  upsertPropertyMeta('og:site_name', siteName);
  upsertMeta('twitter:card', 'summary');

  if (canonicalUrl) {
    const absoluteCanonicalUrl = toAbsoluteUrl(canonicalUrl);
    upsertCanonical(absoluteCanonicalUrl);
    upsertPropertyMeta('og:url', absoluteCanonicalUrl);
  }

  if (image) {
    const absoluteImageUrl = toAbsoluteUrl(image);
    upsertPropertyMeta('og:image', absoluteImageUrl);
    upsertMeta('twitter:image', absoluteImageUrl);
  }

  if (description) {
    upsertMeta('description', description);
    upsertPropertyMeta('og:title', title);
    upsertPropertyMeta('og:description', description);
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);
  }
};

export const useDocumentMeta = (options: DocumentMetaOptions) => {
  useEffect(() => {
    applyDocumentMeta(options);
  }, [
    options.title,
    options.description,
    options.canonicalUrl,
    options.image,
    options.robots,
    options.siteName,
    options.type,
  ]);
};
