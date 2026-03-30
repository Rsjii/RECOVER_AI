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

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
            Trial Ending {daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} days`}
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-200">
            {daysLeft === 1
              ? 'Your trial expires tomorrow. Upgrade now to keep using CashOS.'
              : `You have ${daysLeft} days left in your trial. Upgrade when you're ready.`}
          </p>
        </div>
        <Button onClick={onUpgrade} variant="primary">
          Upgrade Now →
        </Button>
      </div>
    </div>
  );
};
