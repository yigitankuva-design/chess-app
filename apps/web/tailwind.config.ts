import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chessboard: {
          light: '#f0d9b5',
          dark: '#b58863',
        },
      },
    },
  },
  plugins: [],
};

export default config;
