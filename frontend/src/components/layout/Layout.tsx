import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { DemoBanner } from '../ui/DemoBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#09090b]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* Sidebar — hidden on mobile, shown on lg+ */}
      <div className={`fixed inset-y-0 left-0 z-40 transform lg:relative lg:translate-x-0 transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:block`}>
        <Sidebar />
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <DemoBanner />
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[#09090b]">
          <div className="p-4 sm:p-6 pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
