/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        cairo: ["'Cairo'", 'sans-serif'],
        tajawal: ["'Tajawal'", 'sans-serif'],
      },
      colors: {
        ink: '#08080c',
        panel: '#101018',
        panel2: '#16161e',
        gold: '#F5C84B',
        goldlt: '#FFD970',
        cream: '#F6F1E7',
        danger: '#FF5A5A',
        turn: '#6FA8FF',
      },
    },
  },
  plugins: [],
};
