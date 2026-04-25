/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Wine / Bordeaux scale (from design tokens) ──────────────────
        wine: {
          900: '#4A0E1C',
          800: '#5E1324',
          700: '#7A1D2E',
          600: '#912739',
          500: '#A83449',
          100: '#F6E6E9',
          50:  '#FBF3F4',
        },
        // backwards-compat alias → now matches wine-700 exactly
        bordeaux: {
          DEFAULT: '#7A1D2E',
          light:   '#912739',
          dark:    '#5E1324',
        },

        // ── Gold scale ──────────────────────────────────────────────────
        gold: {
          DEFAULT: '#B8893E',
          700: '#8A6329',
          600: '#A37937',
          500: '#B8893E',
          400: '#D1A660',
          300: '#E3C386',
          100: '#F7ECD4',
          50:  '#FCF6E8',
          light: '#D1A660',
          dark:  '#8A6329',
        },

        // ── Warm neutrals ────────────────────────────────────────────────
        ivory: '#F9F5ED',
        paper: '#FDFBF6',
        cream: {
          DEFAULT: '#F9F5ED',
          dark:    '#E8E0D1',
        },
        line: {
          DEFAULT: '#E8E0D1',
          2:       '#D9CEB9',
        },
        ink: {
          900: '#1F1A1A',
          700: '#3A3231',
          500: '#6B5F5C',
          400: '#8C7F7B',
          300: '#B5A9A4',
        },

        // ── Semantic ─────────────────────────────────────────────────────
        'fs-success': { 700: '#3F6B3A', 500: '#5A8B53', 100: '#E8F0E5' },
        'fs-warning': { 700: '#8B5A14', 500: '#C48518', 100: '#FAEFD4' },
        'fs-danger':  { 700: '#8B2C1A', 500: '#C23E24', 100: '#FAE5DF' },
        'fs-info':    { 700: '#1E4E6B', 500: '#2E7599', 100: '#DCECF4' },
      },

      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      boxShadow: {
        'fs-sm': '0 1px 2px rgba(31,26,26,0.06), 0 1px 1px rgba(31,26,26,0.04)',
        'fs-md': '0 2px 6px rgba(31,26,26,0.08), 0 1px 2px rgba(31,26,26,0.05)',
        'fs-lg': '0 10px 30px rgba(31,26,26,0.10), 0 2px 6px rgba(31,26,26,0.06)',
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
