import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import aspectRatio from '@tailwindcss/aspect-ratio';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './constants/**/*.{js,ts,jsx,tsx}',
    './context/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
    './types.ts'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b'
        }
      },
      borderRadius: {
        '3xl': '2rem',
        '4xl': '2.5rem',
        '5xl': '3.5rem'
      },
      boxShadow: {
        premium: '0 25px 50px -12px rgba(0, 0, 0, 0.05)',
        'glass-glow': '0 0 20px rgba(99, 102, 241, 0.4)',
        'inner-glass': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)'
      },
      spacing: {
        32: '8rem',
        80: '20rem'
      },
      fontFamily: {
        sans: ['Segoe UI', 'Segoe UI Variable', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: [forms, typography, aspectRatio]
};
