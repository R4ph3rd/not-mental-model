import { createContext, useContext, useEffect, useState } from 'react'

type ColorMode = 'dark' | 'light'

export const COLOR_PRESETS = [
  { name: 'Purple', hue: 258 },
  { name: 'Blue',   hue: 217 },
  { name: 'Cyan',   hue: 185 },
  { name: 'Green',  hue: 142 },
  { name: 'Orange', hue: 31  },
  { name: 'Red',    hue: 4   },
  { name: 'Pink',   hue: 320 },
]

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
  const [primaryHue, setPrimaryHue] = useState(
    () => Number(localStorage.getItem('mm-primary-hue') ?? 258)
  )

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
