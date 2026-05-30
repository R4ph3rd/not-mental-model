import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

// Apply saved color-mode before first paint to avoid flash
const saved = localStorage.getItem('mm-color-mode')
if (saved === 'light') document.documentElement.classList.add('light')
const hue = localStorage.getItem('mm-primary-hue')
if (hue) document.documentElement.style.setProperty('--p-h', hue)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
