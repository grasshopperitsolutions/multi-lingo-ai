/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "neo-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        "neo-bounce-1": "neo-bounce 0.8s infinite 0s ease-in-out",
        "neo-bounce-2": "neo-bounce 0.8s infinite 0.15s ease-in-out",
        "neo-bounce-3": "neo-bounce 0.8s infinite 0.3s ease-in-out",
      },
    },
  },
  plugins: [],
}