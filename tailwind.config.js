/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // MyPrintStyle (MPS) Official Brand Colors:
        // Navy Blue: C:91 M:56 Y:21 K:50 -> #204563
        // Industrial Orange: C:0 M:60 Y:100 K:0 -> #EF7F1A
        mps: {
          navy: '#204563',
          'navy-50': '#f0f5fa',
          'navy-100': '#dbe7f2',
          'navy-200': '#b9d1e4',
          'navy-300': '#8cb3d2',
          'navy-400': '#548cb8',
          'navy-500': '#2d6591',
          'navy-600': '#204563',
          'navy-700': '#183750',
          'navy-800': '#132c40',
          'navy-900': '#0f2232',
          'navy-950': '#0a1622',
          orange: '#EF7F1A',
          'orange-50': '#fff8f0',
          'orange-100': '#feedd7',
          'orange-200': '#fed4aa',
          'orange-300': '#fdb570',
          'orange-400': '#fb9234',
          'orange-500': '#f57410',
          'orange-600': '#EF7F1A',
          'orange-700': '#d96e12',
          'orange-800': '#b3550e',
          'orange-900': '#8f410d',
          'orange-950': '#4d1e05',
          bg: '#edf3f8',
          card: '#ffffff',
          'card-header': '#eaf2f8',
          border: '#cfe0ee',
          dark: '#0b1723',
          darker: '#08121c',
          sidebar: '#0c1a27',
          toolbar: '#122536',
          surface: '#162e43'
        },
        indigo: {
          50: '#f0f5fa',
          100: '#dbe7f2',
          200: '#b9d1e4',
          300: '#8cb3d2',
          400: '#548cb8',
          500: '#2d6591',
          600: '#204563',
          700: '#183750',
          800: '#132c40',
          900: '#0f2232',
          950: '#0a1622',
        },
        purple: {
          50: '#fff8f0',
          100: '#feedd7',
          200: '#fed4aa',
          300: '#fdb570',
          400: '#fb9234',
          500: '#f57410',
          600: '#EF7F1A',
          700: '#d96e12',
          800: '#b3550e',
          900: '#8f410d',
          950: '#4d1e05',
        },
        dtf: {
          dark: '#0b1723',
          card: '#ffffff',
          primary: '#204563',
          secondary: '#EF7F1A',
          accent: '#EF7F1A',
          slate: '#132c40',
          border: '#cfe0ee',
          hover: '#f0f5fa'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

