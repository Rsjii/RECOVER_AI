import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  // Tooltip state managed via CSS hover in group

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  return (
    <div className="relative inline-block group">
      {children}

      {/* Tooltip */}
      <div
        className={`absolute ${positionClasses[position]} left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 whitespace-nowrap`}
      >
        <div className="bg-gray-900 dark:bg-gray-950 text-white dark:text-gray-100 text-xs px-3 py-2 rounded-lg shadow-lg border border-gray-700 dark:border-gray-800">
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-950 border-gray-700 dark:border-gray-800 transform rotate-45 ${
              position === 'top'
                ? '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b'
                : position === 'bottom'
                ? '-top-1 left-1/2 -translate-x-1/2 border-l border-t'
                : position === 'left'
                ? '-right-1 top-1/2 -translate-y-1/2 border-l border-t'
                : '-left-1 top-1/2 -translate-y-1/2 border-r border-b'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
