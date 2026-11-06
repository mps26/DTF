/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dtf: {
          dark: '#0f111a',
          card: '#ffffff',
          primary: '#5046e5',
          secondary: '#7c3aed',
          accent: '#06b6d4',
          slate: '#1e2235',
          border: '#e2e8f0',
          hover: '#f8fafc'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

