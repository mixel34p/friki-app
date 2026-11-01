import { useLayoutEffect } from 'react'

export default function useAutoResizeTextarea(textareaRef, value) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const style = window.getComputedStyle(textarea)
    const borderHeight = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    const boxAdjustment = style.boxSizing === 'border-box' ? borderHeight : 0
    textarea.style.height = `${textarea.scrollHeight + boxAdjustment}px`
  }, [textareaRef, value])
}
