import { createContext, useContext, useEffect, useState } from 'react'

type ColorMode = 'dark' | 'light'

export const COLOR_PRESETS = [
  { name: 'Blue',   hue: 217 },
  { name: 'Indigo', hue: 240 },
  { name: 'Purple', hue: 258 },
  { name: 'Cyan',   hue: 195 },
  { name: 'Teal',   hue: 175 },
]

const DEFAULT_HUE = 217

interface ThemeCtx {
  colorMode: ColorMode
  setColorMode: (m: ColorMode) => void
  primaryHue: number
  setPrimaryHue: (h: number) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>(
    () => (localStorage.getItem('mm-color-mode') as ColorMode) ?? 'dark'
  )
  const [primaryHue, setPrimaryHue] = useState(() => {
    const stored = localStorage.getItem('mm-primary-hue')
    // 258 was the pre-rebrand default (purple) — migrate it to blue once
    if (stored === null || stored === '258') return DEFAULT_HUE
    return Number(stored)
  })

  useEffect(() => {
    document.documentElement.classList.toggle('light', colorMode === 'light')
    localStorage.setItem('mm-color-mode', colorMode)
  }, [colorMode])

  useEffect(() => {
    document.documentElement.style.setProperty('--p-h', String(primaryHue))
    localStorage.setItem('mm-primary-hue', String(primaryHue))
  }, [primaryHue])

  return (
    <Ctx.Provider value={{ colorMode, setColorMode, primaryHue, setPrimaryHue }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme outside ThemeProvider')
  return ctx
}
