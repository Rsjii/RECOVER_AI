import { useEffect, useState } from 'react';

interface GoogleAuthButtonProps {
  onSuccess?: (credential: string) => void;
  onError?: () => void;
}

export default function GoogleAuthButton({ onSuccess, onError }: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError('Google Sign-In not configured');
      setIsLoading(false);
      console.warn('VITE_GOOGLE_CLIENT_ID is not set in .env');
      return;
    }

    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
          });

          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
              theme: 'dark',
              size: 'large',
              width: '100%',
            }
          );

          setIsLoading(false);
          setError(null);
        } catch (err) {
          console.error('Failed to initialize Google Sign-In:', err);
          setError('Failed to load Google Sign-In');
          setIsLoading(false);
        }
      }
    };

    script.onerror = () => {
      console.error('Failed to load Google Sign-In script');
      setError('Failed to load Google Sign-In');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const handleGoogleResponse = (response: any) => {
    if (response.credential) {
      const token = response.credential;

      if (onSuccess) {
        onSuccess(token);
      }

      // Redirect to backend to process token
      window.location.href = `/api/auth/oauth/google/callback?credential=${encodeURIComponent(token)}`;
    } else {
      console.error('No credential in Google response');
      setError('Google Sign-In failed');
      if (onError) onError();
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="text-xs text-yellow-600 dark:text-yellow-400 text-center mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading Google Sign-In...</div>
        </div>
      )}

      <div
        id="google-signin-button"
        className="flex justify-center w-full"
        style={{ minHeight: '44px', opacity: isLoading ? 0.5 : 1 }}
      />
    </div>
  );
}

// Declare google object on window
declare global {
  interface Window {
    google?: any;
  }
}
