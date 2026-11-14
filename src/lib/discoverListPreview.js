export function collectListPreviewImages(content, limit = 4) {
  const images = []
  const add = item => {
    const value = typeof item === 'string' ? item : item?.image_url || item?.cover_url || item?.cover?.url
    if (typeof value !== 'string' || !value.trim()) return
    const url = value.startsWith('//') ? `https:${value}` : value
    if (!images.includes(url)) images.push(url)
  }
  const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
  const groups = Array.isArray(content) ? [content] : content && typeof content === 'object' ? [
    ...priorities.filter(key => content[key] != null).map(key => content[key]),
    ...Object.keys(content).filter(key => !priorities.includes(key) && key !== 'pool').map(key => content[key]),
  ] : []
  for (const group of groups) {
    for (const item of Array.isArray(group) ? group : [group]) {
      add(item)
      if (images.length >= limit) return images
    }
  }
  return images
}

export function templatePreviewImages(template) {
  const covers = collectListPreviewImages(template.cover_items)
  return covers.length ? covers : collectListPreviewImages(template.default_items)
}
