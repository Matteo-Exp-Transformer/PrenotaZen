/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Default build-time fallback (Midnight). Altri temi admin (`theme-2` … `warm-sand-pro`): scala `--color-primary-*` da `:root[data-admin-theme]` in `src/index.css`.
        primary: {
          50:  '#EEF6FC',
          100: '#D6ECFE',
          200: '#B8DEFD',
          300: '#7CC6FE',
          400: '#4F7CAC',
          500: '#386891',
          600: '#1E3A5F',
          700: '#183049',
          800: '#122538',
          900: '#18324A',
        },

        // Stato prenotazioni
        status: {
          pending:  '#F59E0B',   // amber
          accepted: '#10B981',   // emerald
          rejected: '#EF4444',   // red
          deleted:  '#6B7280',   // gray
        },

        // Colori eventi calendario
        booking: {
          cena:     '#1E3A5F',   // primary
          aperitivo:'#F59E0B',   // amber
          evento:   '#8B5CF6',   // violet
          laurea:   '#10B981',   // emerald
        },
        'al-ritrovo': {
          primary: '#1E3A5F',
          'primary-dark': '#183049',
        },
        warm: {
          wood: '#6b4226',
          'wood-dark': '#4a2d19',
          orange: '#f97316',
          beige: '#fef3c7',
          stone: '#d4c4b0',
        },
        terracotta: '#c2410c',
        muted: '#EDF2F7',
        background: '#ffffff',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'soft':   '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        'medium': '0 4px 25px -5px rgba(0,0,0,0.10), 0 10px 10px -5px rgba(0,0,0,0.04)',
      }
    },
  },
  plugins: [],
}
