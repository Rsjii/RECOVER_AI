import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  duration?: number;
}

interface CustomTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onBackdropClick?: () => void;
  autoProgress?: boolean;
}

export const CustomTour: React.FC<CustomTourProps> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
  onBackdropClick,
  autoProgress = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isDark, setIsDark] = useState(false);
  const autoProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[currentStep];

  // Detect dark mode
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen || !step?.target || step.target === 'none') {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      // Use 'start' block for tables/large sections to show more content below
      const blockPosition = step.target.includes('table') || step.target.includes('section') ? 'start' : 'center';
      element.scrollIntoView({ behavior: 'smooth', block: blockPosition });
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }, 800);
    }
  }, [isOpen, step?.target, currentStep]);

  useEffect(() => {
    const basePadding = 16;
    const rightMargin = 40; // Extra margin for right-positioned tooltips
    const tooltipWidth = 380;
    const tooltipHeight = 320;

    if (!targetRect || targetRect.width === 0 || targetRect.height === 0) {
      // Fallback: position based on position prop
      if (step?.position === 'center') {
        // Center position: center horizontally and vertically
        setTooltipPos({
          top: window.innerHeight / 2 - tooltipHeight / 2,
          left: window.innerWidth / 2 - tooltipWidth / 2,
        });
      } else {
        // Edge positions
        let left = window.innerWidth - tooltipWidth - rightMargin; // default right with extra margin
        if (step?.position === 'left' || step?.position === 'top') {
          left = basePadding;
        }
        const top = window.innerHeight / 2 - tooltipHeight / 2;
        setTooltipPos({ top, left });
      }
      return;
    }

    let top = 0;
    let left = 0;

    // Handle center position: always center, regardless of element
    if (step?.position === 'center') {
      setTooltipPos({
        top: window.innerHeight / 2 - tooltipHeight / 2,
        left: window.innerWidth / 2 - tooltipWidth / 2,
      });
      return;
    }

    // Check if target is a large dialog/modal (width > 15% of viewport)
    // Most dialogs are 60-90% of viewport width, so 15% is a safe threshold
    const isLargeDialog = targetRect.width > window.innerWidth * 0.15;

    if (isLargeDialog) {
      // DIALOGS: Position tooltip at viewport edges, NOT overlapping dialog
      // Vertical: center, but keep within bounds
      top = Math.max(
        basePadding,
        Math.min(
          window.innerHeight / 2 - tooltipHeight / 2,
          window.innerHeight - tooltipHeight - basePadding
        )
      );

      // Horizontal: Use explicit position prop strictly
      if (step?.position === 'left' || step?.position === 'top') {
        // FAR LEFT: position tooltip at left edge
        left = basePadding;
      } else {
        // FAR RIGHT (default): position tooltip at right edge with extra margin
        left = window.innerWidth - tooltipWidth - rightMargin;
      }
    } else {
      // SMALL ELEMENTS (tables, sections): Relative positioning
      if (step?.position === 'right') {
        left = Math.min(targetRect.right + basePadding, window.innerWidth - tooltipWidth - rightMargin);
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      } else if (step?.position === 'left') {
        left = Math.max(basePadding, targetRect.left - tooltipWidth - basePadding);
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      } else if (step?.position === 'top') {
        left = Math.max(basePadding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - basePadding));
        top = Math.max(basePadding, targetRect.top - tooltipHeight - basePadding);
      } else {
        // Default: bottom
        left = Math.max(basePadding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - basePadding));
        top = Math.min(targetRect.bottom + basePadding, window.innerHeight - tooltipHeight - basePadding);
      }

      // Bounds check
      top = Math.max(basePadding, Math.min(top, window.innerHeight - tooltipHeight - basePadding));
    }

    setTooltipPos({ top, left });
  }, [targetRect, step?.position]);

  // Auto-progression handler
  useEffect(() => {
    if (!autoProgress || !isOpen || currentStep >= steps.length) {
      if (autoProgressTimerRef.current) {
        clearTimeout(autoProgressTimerRef.current);
        autoProgressTimerRef.current = null;
      }
      return;
    }

    const step = steps[currentStep];
    const duration = (step.duration || 4) * 1000; // Convert to milliseconds

    autoProgressTimerRef.current = setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete();
      }
    }, duration);

    return () => {
      if (autoProgressTimerRef.current) {
        clearTimeout(autoProgressTimerRef.current);
        autoProgressTimerRef.current = null;
      }
    };
  }, [autoProgress, isOpen, currentStep, steps, onComplete]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    // Mark as completed even if skipped
    onComplete();
  };

  const handleBackdropClick = () => {
    // Close tour but don't mark as completed
    // This allows user to resume from Settings without forcing auto-restart
    onClose();
    if (onBackdropClick) {
      onBackdropClick();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Overlay - Premium dark background */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/45 to-black/50"
        onClick={handleBackdropClick}
      />

      {/* Highlight Box with premium styling */}
      {targetRect && targetRect.width > 0 && targetRect.height > 0 && (
        <div
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - 14,
            left: targetRect.left - 14,
            width: targetRect.width + 28,
            height: targetRect.height + 28,
            border: '2.5px solid',
            borderColor: isDark ? 'rgb(59, 130, 246)' : 'rgb(37, 99, 235)',
            borderRadius: '16px',
            boxShadow: isDark
              ? '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.5), inset 0 0 20px rgba(59, 130, 246, 0.1)'
              : '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px rgba(37, 99, 235, 0.4), inset 0 0 20px rgba(37, 99, 235, 0.08)',
          }}
        />
      )}

      {/* Premium Sexy Card */}
      <div
        className={`absolute p-8 max-w-sm transition-all duration-300 ${
          isDark
            ? 'bg-gray-800/95 border border-gray-600/60 text-gray-50 rounded-3xl'
            : 'bg-white/98 border border-blue-200/60 text-gray-900 rounded-3xl'
        }`}
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          width: '420px',
          zIndex: 9999,
          boxShadow: isDark
            ? '0 20px 80px rgba(0, 0, 0, 0.5), 0 8px 32px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 20px 80px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(59, 130, 246, 0.3)',
          backdropFilter: 'blur(10px)',
          border: isDark
            ? '1px solid rgba(100, 116, 139, 0.4)'
            : '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        {/* Close Button - Premium - Hidden during auto-progress */}
        {!autoProgress && (
          <button
            onClick={handleClose}
            className={`absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200 hover:scale-110 ${
              isDark
                ? 'bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                : 'bg-gray-100/60 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Header - Premium Typography */}
        <div className="mb-6">
          <h3 className={`text-2xl font-bold mb-3 leading-tight tracking-tight ${
            isDark
              ? 'text-blue-300/90'
              : 'text-blue-700'
          }`}>
            {step.title}
          </h3>
          <p className={`text-base leading-relaxed font-normal ${isDark ? 'text-gray-300/80' : 'text-gray-600'}`}>
            {step.description}
          </p>
        </div>

        {/* Progress Dots - Hidden during auto-progress */}
        {!autoProgress && (
          <div className="flex gap-2 mb-7 mt-6">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentStep
                    ? isDark
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 w-7 shadow-lg shadow-blue-500/50'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 w-7 shadow-lg shadow-blue-500/40'
                    : isDark
                    ? 'bg-gray-700 hover:bg-gray-600 w-2'
                    : 'bg-gray-300 hover:bg-gray-400 w-2'
                }`}
                title={`Step ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Button Section - Hidden during auto-progress */}
        {!autoProgress && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                  currentStep === 0
                    ? isDark
                      ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100/50 text-gray-400 cursor-not-allowed'
                    : isDark
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 active:scale-95'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                }`}
              >
                ← Back
              </button>
              <div className={`text-xs font-semibold px-2.5 py-1.5 rounded whitespace-nowrap ${
                isDark ? 'bg-gray-800/70 text-gray-300' : 'bg-gray-100/70 text-gray-600'
              }`}>
                {currentStep + 1} / {steps.length}
              </div>
              <button
                onClick={handleNext}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-all duration-200 active:scale-95 ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20'
                }`}
              >
                {currentStep === steps.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>

            {/* Skip Link */}
            <button
              onClick={handleClose}
              className={`w-full text-xs font-medium py-1.5 rounded transition-all ${
                isDark
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                  : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100/30'
              }`}
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
