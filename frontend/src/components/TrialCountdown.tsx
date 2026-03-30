import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';

interface TrialCountdownProps {
  trialEndsAt?: string;
  onUpgrade: () => void;
}

export const TrialCountdown: React.FC<TrialCountdownProps> = ({ trialEndsAt, onUpgrade }) => {
  const [daysLeft, setDaysLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!trialEndsAt) return;

    const updateCountdown = () => {
      const end = new Date(trialEndsAt);
      const now = new Date();
      const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diff <= 0) {
        setIsExpired(true);
        setDaysLeft(0);
      } else {
        setIsExpired(false);
        setDaysLeft(Math.max(0, diff));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [trialEndsAt]);

  if (!trialEndsAt) return null;

  if (isExpired) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">Trial Expired</h3>
            <p className="text-sm text-red-700 dark:text-red-200">Your trial has ended. Upgrade to continue using CashOS.</p>
          </div>
          <Button onClick={onUpgrade} className="bg-red-600 hover:bg-red-700">
            Upgrade Now →
          </Button>
        </div>
      </div>
    );
  }

  // Determine colors based on days remaining
  const isUrgent = daysLeft < 3; // Red: <3 days
  const isWarning = daysLeft >= 3 && daysLeft <= 7; // Yellow: 3-7 days
  const isHealthy = daysLeft > 7; // Green: >7 days

  const bgColor = isUrgent ? 'bg-red-50 dark:bg-red-900/20' : isWarning ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20';
  const borderColor = isUrgent ? 'border-red-400' : isWarning ? 'border-yellow-400' : 'border-green-400';
  const titleColor = isUrgent ? 'text-red-900 dark:text-red-100' : isWarning ? 'text-yellow-900 dark:text-yellow-100' : 'text-green-900 dark:text-green-100';
  const textColor = isUrgent ? 'text-red-700 dark:text-red-200' : isWarning ? 'text-yellow-700 dark:text-yellow-200' : 'text-green-700 dark:text-green-200';

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} p-4 mb-6`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold ${titleColor}`}>
            {isHealthy ? '✅ Trial Active' : '⏰ Trial Ending'} — {daysLeft === 1 ? 'Tomorrow' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
          </h3>
          <p className={`text-sm ${textColor}`}>
            {isUrgent
              ? 'Your trial expires very soon. Upgrade now to keep using CashOS.'
              : isWarning
              ? 'Your trial is ending soon. Upgrade when you\'re ready.'
              : 'You have plenty of time. Explore all features risk-free.'}
          </p>
        </div>
        <Button onClick={onUpgrade} variant="primary">
          Upgrade Now →
        </Button>
      </div>
    </div>
  );
};
