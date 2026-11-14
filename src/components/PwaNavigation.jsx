import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { completePwaNavigation } from '../lib/pwaRouteTransition'

export default function PwaNavigation() {
  const { key, pathname } = useLocation()
  useLayoutEffect(() => { completePwaNavigation(pathname) }, [key, pathname])
  return null
}
