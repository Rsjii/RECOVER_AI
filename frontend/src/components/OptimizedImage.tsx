import React, { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  srcSet?: string;
}

/**
 * Optimized Image component with lazy loading and responsive optimization
 * Improves Core Web Vitals (LCP, CLS)
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy',
  srcSet,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`${className} transition-opacity duration-300 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
      loading={loading}
      srcSet={srcSet}
      onLoad={() => setIsLoaded(true)}
      decoding="async"
    />
  );
};
