/**
 * Performance optimization utilities
 * Monitors Core Web Vitals and helps with SEO metrics
 */

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
}

/**
 * Initialize Core Web Vitals monitoring
 */
export const initPerformanceMonitoring = () => {
  if ('web-vital' in window) {
    return;
  }

  // Monitor Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Silently fail if not supported
    }
  }

  // Monitor Cumulative Layout Shift (CLS)
  if ('PerformanceObserver' in window) {
    try {
      let cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
            console.log('CLS:', cls);
          }
        }
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Silently fail if not supported
    }
  }
};

/**
 * Prefetch a URL for better performance
 */
export const prefetchUrl = (url: string) => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
};

/**
 * Preload critical resources
 */
export const preloadResource = (
  href: string,
  type: 'script' | 'style' | 'font' | 'image',
  options?: Record<string, string>
) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = type;

  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      link.setAttribute(key, value);
    });
  }

  document.head.appendChild(link);
};

/**
 * Report performance metrics to analytics
 */
export const reportPerformanceMetrics = (metrics: Partial<PerformanceMetrics>) => {
  // Send to your analytics service
  if (navigator.sendBeacon) {
    const data = JSON.stringify(metrics);
    navigator.sendBeacon('/api/metrics', data);
  }
};

/**
 * Defer non-critical script loading
 */
export const deferScriptLoad = (src: string) => {
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  document.body.appendChild(script);
};
