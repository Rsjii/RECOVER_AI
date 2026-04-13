import { useEffect } from 'react';

interface SEOMetaTags {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  robots?: string;
}

/**
 * Hook to manage SEO meta tags dynamically for each page.
 * Updates document.title, meta tags, OG tags, Twitter Card tags, and canonical URL.
 * Safe to use on every public route — tags are upserted, not duplicated.
 */
export const useSEO = (metadata: SEOMetaTags) => {
  useEffect(() => {
    // Set title
    document.title = metadata.title;

    // Upsert a meta tag by name attribute
    const updateMetaTag = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Upsert a meta tag by property attribute (Open Graph)
    const updateOGTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Standard meta
    updateMetaTag('description', metadata.description);
    if (metadata.keywords) updateMetaTag('keywords', metadata.keywords);
    if (metadata.robots) updateMetaTag('robots', metadata.robots);

    // Open Graph
    updateOGTag('og:title', metadata.title);
    updateOGTag('og:description', metadata.description);
    updateOGTag('og:type', metadata.ogType || 'website');
    if (metadata.canonical) updateOGTag('og:url', metadata.canonical);
    if (metadata.ogImage) updateOGTag('og:image', metadata.ogImage);

    // Twitter Card (uses name="twitter:*", not property)
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', metadata.title);
    updateMetaTag('twitter:description', metadata.description);
    if (metadata.canonical) updateMetaTag('twitter:url', metadata.canonical);
    if (metadata.ogImage) updateMetaTag('twitter:image', metadata.ogImage);

    // Canonical link
    if (metadata.canonical) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', metadata.canonical);
    }
  }, [metadata]);
};
