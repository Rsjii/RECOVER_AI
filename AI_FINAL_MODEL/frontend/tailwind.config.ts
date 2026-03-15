import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
        },
        surface: {
          DEFAULT: '#0d1117',
          card: '#0d1424',
          hover: '#111827',
          border: '#1a2035',
          'border-hover': '#2d3748',
        },
        risk: {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0f172a 0%, #060910 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
