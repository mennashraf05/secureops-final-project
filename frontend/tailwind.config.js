/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        navy: '#07111F',
        ink: '#0F172A',
        electric: '#38BDF8',
        cyber: '#06B6D4',
        brand: '#2563EB',
        violet: '#7C3AED',
        danger: '#DC2626',
        critical: '#991B1B'
      },
      boxShadow: {
        glow: '0 0 40px rgba(56,189,248,.28)',
        card: '0 18px 50px rgba(15,23,42,.08)'
      },
      animation: {
        pulseSoft: 'pulseSoft 2.4s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite linear'
      },
      keyframes: {
        pulseSoft: {'0%,100%':{opacity:.65, transform:'scale(1)'}, '50%':{opacity:1, transform:'scale(1.04)'}},
        float: {'0%,100%':{transform:'translateY(0)'}, '50%':{transform:'translateY(-12px)'}},
        shimmer: {'0%':{backgroundPosition:'-400px 0'}, '100%':{backgroundPosition:'400px 0'}}
      }
    },
  },
  plugins: [],
};
