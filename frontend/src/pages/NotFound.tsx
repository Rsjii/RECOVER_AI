import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

const NotFound: React.FC = () => {
  useEffect(() => {
    document.title = '404 — RecoverAI';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl font-bold text-blue-600 mb-3">404</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/">
          <Button variant="primary">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

