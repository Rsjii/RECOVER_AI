/**
 * SEO Configuration for all public pages.
 * Centralized metadata — keep in sync with public/sitemap.xml.
 */

const OG_IMAGE = 'https://recoverai.com/og-image.png';

export const seoConfig = {
  baseUrl: 'https://recoverai.com',
  siteName: 'RecoverAI',

  pages: {
    landing: {
      title: 'RecoverAI — AR Automation for Service Agencies | DSO Reduction',
      description: 'Reduce days to payment by 15-25 days. Automate dunning emails. Free up 20 hours/month of ops work. AI-powered AR agent for service agencies. 21-day free trial.',
      keywords: 'accounts receivable, AR automation, DSO reduction, dunning automation, service agencies, invoice follow-up automation, payment optimization, collections software',
      canonical: 'https://recoverai.com/',
      ogImage: OG_IMAGE,
      robots: 'index, follow',
    },
    pricing: {
      title: 'Pricing — RecoverAI | Based on Your DSO Improvement',
      description: 'Custom pricing based on DSO improvement and ops time saved. See real results first. 21-day free trial. No credit card required.',
      keywords: 'pricing, custom pricing, AR software pricing, DSO improvement pricing, accounts receivable pricing',
      canonical: 'https://recoverai.com/pricing',
      ogImage: OG_IMAGE,
      robots: 'index, follow',
    },
    security: {
      title: 'Security — RecoverAI | Enterprise-Grade Data Protection',
      description: 'Enterprise-grade security. Bank-level encryption, strict tenant isolation, and regular audits. Built for service agencies handling sensitive AR data.',
      keywords: 'security, encryption, compliance, data protection, invoice security, tenant isolation',
      canonical: 'https://recoverai.com/security',
      ogImage: OG_IMAGE,
      robots: 'index, follow',
    },
    privacy: {
      title: 'Privacy Policy — RecoverAI',
      description: 'RecoverAI Privacy Policy. Learn how we handle, protect, and use your data.',
      keywords: 'privacy, data protection, gdpr, privacy policy',
      canonical: 'https://recoverai.com/privacy',
      ogImage: OG_IMAGE,
      robots: 'index, follow, noarchive',
    },
    terms: {
      title: 'Terms of Service — RecoverAI',
      description: 'RecoverAI Terms of Service. Legal terms and conditions for using the RecoverAI platform.',
      keywords: 'terms, legal, terms of service',
      canonical: 'https://recoverai.com/terms',
      ogImage: OG_IMAGE,
      robots: 'index, follow, noarchive',
    },
    support: {
      title: 'Support — RecoverAI | Help & Documentation',
      description: 'Get help with setup, integration, and troubleshooting. Contact the RecoverAI team directly.',
      keywords: 'support, help, documentation, faq, contact support',
      canonical: 'https://recoverai.com/support',
      ogImage: OG_IMAGE,
      robots: 'index, follow',
    },
    cookiePolicy: {
      title: 'Cookie Policy — RecoverAI',
      description: 'How RecoverAI uses cookies and similar technologies to provide and improve the service.',
      keywords: 'cookies, cookie policy, tracking, gdpr',
      canonical: 'https://recoverai.com/cookie-policy',
      ogImage: OG_IMAGE,
      robots: 'index, follow, noarchive',
    },
    dpa: {
      title: 'Data Processing Agreement — RecoverAI',
      description: 'RecoverAI Data Processing Agreement (DPA) for GDPR-compliant customer data handling.',
      keywords: 'dpa, data processing agreement, gdpr, compliance',
      canonical: 'https://recoverai.com/dpa',
      ogImage: OG_IMAGE,
      robots: 'index, follow, noarchive',
    },
    notFound: {
      title: '404 — Page Not Found | RecoverAI',
      description: 'The page you are looking for does not exist.',
      canonical: 'https://recoverai.com/404',
      ogImage: OG_IMAGE,
      robots: 'noindex, nofollow',
    },
  },

  // Open Graph defaults
  og: {
    image: OG_IMAGE,
    imageWidth: 1200,
    imageHeight: 630,
    locale: 'en_US',
  },

  // Twitter Card defaults
  twitter: {
    handle: '@RecoverAI',
    cardType: 'summary_large_image',
  },
};

export const getPageSEO = (pageName: keyof typeof seoConfig.pages) => {
  return seoConfig.pages[pageName] || seoConfig.pages.landing;
};
