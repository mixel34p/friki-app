import { useLayoutEffect } from 'react'

// The settings portal sits outside Layout's animated stacking context.
export default function usePwaSettingsScreen(active) {
  useLayoutEffect(() => {
    if (!active) return undefined
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.classList.add('pwa-settings-open')
    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousRootOverflow
      document.body.classList.remove('pwa-settings-open')
    }
  }, [active])
}
