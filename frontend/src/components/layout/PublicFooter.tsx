import React from 'react';
import { Link } from 'react-router-dom';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 py-10 border-t border-gray-200 dark:border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs text-white">R</div>
            RecoverAI
          </div>
          <div className="flex flex-wrap gap-4 text-sm justify-center">
            <Link to="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
            <Link to="/security" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Security</Link>
            <Link to="/support" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Support</Link>
            <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Terms</Link>
            <Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</Link>
          </div>
          <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            <p>2026 RecoverAI. All rights reserved.</p>
            <a href="mailto:hello@recoverai.tech" className="text-blue-600 dark:text-blue-400 hover:underline">hello@recoverai.tech</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
