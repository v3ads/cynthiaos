/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-elevated': 'hsl(var(--surface-elevated))',
        border: 'hsl(var(--border))',
        'border-subtle': 'hsl(var(--border-subtle))',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-muted': 'hsl(var(--text-muted))',
        accent: 'hsl(var(--accent))',
        'accent-muted': 'hsl(var(--accent-muted))',
        'accent-bg': 'hsl(var(--accent-bg))',
        danger: 'hsl(var(--danger))',
        'danger-bg': 'hsl(var(--danger-bg))',
        warning: 'hsl(var(--warning))',
        'warning-bg': 'hsl(var(--warning-bg))',
        info: 'hsl(var(--info))',
        'info-bg': 'hsl(var(--info-bg))',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
    },
  },
  plugins: [],
};