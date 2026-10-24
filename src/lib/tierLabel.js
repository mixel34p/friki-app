export function getTierLabelFontSize(label, options = {}) {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const maxSize = options.maxSize ?? (isMobile ? 18 : 22);
    const availableWidth = options.availableWidth ?? (isMobile ? 72 : 88);
    const availableHeight = options.availableHeight ?? (isMobile ? 72 : 88);
    const lineHeight = 1.05;
    const fontFamily = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-sans').trim() || 'sans-serif';
    const measureContext = document.createElement('canvas').getContext('2d');
    const words = String(label || '').trim().split(/\s+/).filter(Boolean);
    for (let size = maxSize; size >= 4; size -= 0.5) {
        measureContext.font = `400 ${size}px ${fontFamily}`;
        const spaceWidth = measureContext.measureText(' ').width;
        let lineCount = 1;
        let lineWidth = 0;
        let fitsWidth = true;

        for (const word of words) {
            const wordWidth = measureContext.measureText(word).width;
            if (wordWidth > availableWidth) {
                fitsWidth = false;
                break;
            }
            const nextWidth = lineWidth ? lineWidth + spaceWidth + wordWidth : wordWidth;
            if (nextWidth > availableWidth) {
                lineCount += 1;
                lineWidth = wordWidth;
            } else {
                lineWidth = nextWidth;
            }
        }

        if (fitsWidth && lineCount * size * lineHeight <= availableHeight) return `${size}px`;
    }
    return '4px';
}
