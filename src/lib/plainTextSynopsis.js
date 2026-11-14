// Parse in a detached, inert template. Only plain text ever reaches the page.
export function plainTextSynopsis(value) {
  let text = String(value ?? '')
  for (let pass = 0; pass < 3; pass++) {
    const template = document.createElement('template')
    template.innerHTML = text
    template.content.querySelectorAll('script, style, noscript, iframe, object, template').forEach(node => node.remove())
    template.content.querySelectorAll('br').forEach(node => node.replaceWith('\n'))
    template.content.querySelectorAll('p, div, li, blockquote, section, article, h1, h2, h3, h4, h5, h6').forEach(node => node.after('\n\n'))
    const next = template.content.textContent || ''
    if (next === text) break
    text = next
  }
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
