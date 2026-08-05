import React, { useState } from 'react';

interface Props {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export const ExpandableSection: React.FC<Props> = ({ title, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border rounded-lg dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      >
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <div className="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          {children}
        </div>
      )}
    </div>
  );
};
