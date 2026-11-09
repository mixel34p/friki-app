import { useLayoutEffect } from 'react'
import { getSystemBarColor } from '../lib/colorContrast'

// Share one opaque top edge between an installed page and Android's status bar.
export default function useSystemBarColor(accent, maxWidth = 960) {
  const color = getSystemBarColor(accent)
  useLayoutEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)')
    const mobile = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return undefined
    const previousColor = meta.getAttribute('content')
    const previousBackground = document.documentElement.style.backgroundColor
    const update = () => {
      const active = mobile.matches && (standalone.matches || navigator.standalone === true)
      meta.setAttribute('content', active ? color : previousColor || '#070709')
      document.documentElement.style.backgroundColor = active ? color : previousBackground
    }
    update()
    standalone.addEventListener('change', update)
    mobile.addEventListener('change', update)
    return () => {
      standalone.removeEventListener('change', update)
      mobile.removeEventListener('change', update)
      if (previousColor === null) meta.removeAttribute('content')
      else meta.setAttribute('content', previousColor)
      document.documentElement.style.backgroundColor = previousBackground
    }
  }, [color, maxWidth])
  return color
}
