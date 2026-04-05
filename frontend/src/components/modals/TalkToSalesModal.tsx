import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface TalkToSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TalkToSalesModal: React.FC<TalkToSalesModalProps> = ({ isOpen, onClose }) => {
  const [selectedOption, setSelectedOption] = useState<'calendar' | 'email' | null>(null);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleScheduleCall = () => {
    // Open Calendly in new tab
    // Replace with actual Calendly URL when available
    window.open('https://calendly.com/recoverai/sales', '_blank');
    onClose();
  };

  const handleSendEmail = async () => {
    if (!email || !company) {
      alert('Please fill in your email and company name');
      return;
    }

    setSending(true);
    try {
      // Send email inquiry
      const response = await fetch('/api/contact/sales-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, message }),
      });

      if (response.ok) {
        alert('Thanks! Our sales team will be in touch shortly.');
        onClose();
      } else {
        alert('Failed to send. Please try emailing sales@recoverai.com directly');
      }
    } catch (error) {
      alert('Please email sales@recoverai.com with your inquiry');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#111113] rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
          <h2 className="text-xl font-bold text-white mb-1">Talk to Our Sales Team</h2>
          <p className="text-blue-100 text-sm">Let's discuss how RecoverAI can help your business</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {selectedOption === null ? (
            <div className="space-y-3">
              <button
                onClick={() => setSelectedOption('calendar')}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600">Schedule a Call</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Book time with our sales team</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedOption('email')}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600">Send an Email</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tell us about your needs</p>
                  </div>
                </div>
              </button>

              <div className="pt-2 text-center">
                <button
                  onClick={onClose}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedOption === 'calendar' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Click below to schedule a 20-minute call with our sales team. We'll discuss your AR challenges and how RecoverAI can help.
                </p>
                <Button
                  onClick={handleScheduleCall}
                  variant="primary"
                  className="w-full"
                >
                  Open Calendly
                </Button>
              </div>
              <button
                onClick={() => setSelectedOption(null)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium"
              >
                ← Back
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your Company"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Tell us more (optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What challenges are you facing with AR recovery?"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleSendEmail}
                variant="primary"
                className="w-full"
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Message'}
              </Button>

              <button
                onClick={() => setSelectedOption(null)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalkToSalesModal;