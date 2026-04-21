/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bordeaux: {
          DEFAULT: '#8B1A2B',
          light: '#a82235',
          dark: '#6d1422',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#d4b76a',
          dark: '#a8882e',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          dark: '#e8e0cc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shrink: {
          '0%':   { width: '100%' },
          '100%': { width: '0%' },
        },
      },
      animation: {
        shrink: 'shrink 3.5s linear forwards',
      },
    },
  },
  plugins: [],
};
