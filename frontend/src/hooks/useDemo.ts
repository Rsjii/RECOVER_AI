/**
 * Check if user is in demo mode (read-only)
 */
export const useDemo = () => {
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemo') === 'true';

  return {
    isDemo,
    isDemoReadOnly: isDemo,
  };
};
