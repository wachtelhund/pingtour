/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sourceful dark palette (TV display defaults to dark)
        bg: '#131313',
        fg: '#FFFFFF',
        primary: {
          DEFAULT: '#00FF84',
          fg: '#0A0A0A',
        },
        secondary: {
          DEFAULT: '#16191B',
          fg: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#1F2937',
          fg: '#9CA3AF',
        },
        accent: {
          DEFAULT: '#1A3D1A',
          fg: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#FF0D0D',
          fg: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#F59E0B',
          fg: '#000000',
        },
        success: {
          DEFAULT: '#0CF300',
          fg: '#000000',
        },
        border: '#374151',
        ring: '#00FF84',
      },
      fontFamily: {
        sans: [
          '"Satoshi"',
          '"Inter"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      boxShadow: {
        glow: '0 0 24px rgba(0, 255, 132, 0.35)',
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 132, 0.6)' },
          '50%': { boxShadow: '0 0 0 8px rgba(0, 255, 132, 0)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
