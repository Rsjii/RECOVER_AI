import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';

interface PublicHeaderProps {
  showLinks?: boolean;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ showLinks = true }) => {
  return (
    <header className="border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#111113] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <span className="hidden sm:inline">RecoverAI</span>
        </Link>
        <div className="flex items-center gap-3">
          {showLinks && (
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Privacy</Link>
              <Link to="/terms" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Terms</Link>
              <Link to="/security" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Security</Link>
            </nav>
          )}
          <ThemeToggle />
          <Link to="/login"><Button size="sm">Sign in</Button></Link>
        </div>
      </div>
    </header>
  );
};