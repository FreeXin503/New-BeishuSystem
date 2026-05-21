/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        workspace: {
          bg: '#f8fafc',
          surface: '#ffffff',
          border: 'rgba(226, 232, 240, 0.7)',
          subtext: '#64748b'
        },
        brand: {
          primary: '#4f46e5',
          accent: '#6366f1',
          dark: '#1e1b4b'
        },
        feedback: {
          success: '#10b981',
          successLight: 'rgba(16, 185, 129, 0.04)',
          error: '#f43f5e',
          errorLight: 'rgba(244, 63, 94, 0.05)',
          warning: '#f59e0b',
          info: '#3b82f6'
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      boxShadow: {
        'master-card': '0 20px 50px -12px rgba(0, 0, 0, 0.02), 0 30px 60px -15px rgba(99, 102, 241, 0.05)',
        'panel-flat': '0 8px 30px rgba(226, 232, 240, 0.3)',
        'popover': '0 12px 40px -6px rgba(0, 0, 0, 0.08)'
      },
      borderRadius: {
        'master': '32px',
      }
    },
  },
  plugins: [],
}
