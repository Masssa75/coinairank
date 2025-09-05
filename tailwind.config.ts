import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0b0d',
        'dark-card': '#111214',
        'dark-card-hover': '#1a1c1f',
        'dark-border': '#2a2d31',
        'dark-hover': '#252729',
        'primary-green': '#00ff88',
        'tier-alpha': '#00ff88',
        'tier-solid': '#ffcc00',
        'tier-basic': '#ff8800',
        'tier-trash': '#ff4444',
      },
    },
  },
  plugins: [],
}
export default config