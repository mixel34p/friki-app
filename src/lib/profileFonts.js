export const PROFILE_FONT_OPTIONS = [
    { value: 'display', label: 'Por defecto', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    { value: 'sans', label: 'Moderna', stack: "'Inter', Arial, sans-serif" },
    { value: 'humanist', label: 'Cercana', stack: '"Trebuchet MS", Arial, sans-serif' },
    { value: 'rounded', label: 'Redonda', stack: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif' },
    { value: 'serif', label: 'Clásica', stack: 'Georgia, "Times New Roman", serif' },
    { value: 'book', label: 'Editorial', stack: 'Palatino, "Book Antiqua", serif' },
    { value: 'mono', label: 'Técnica', stack: 'ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace' },
    { value: 'condensed', label: 'Compacta', stack: '"Arial Narrow", "Roboto Condensed", Impact, sans-serif' },
    { value: 'pixel', label: 'Pixel', stack: '"Pixelify Sans", monospace' },
    { value: 'gothic', label: 'Gótica', stack: '"UnifrakturCook", "Old English Text MT", fantasy' },
    { value: 'handwriting', label: 'Manuscrita', stack: '"Dancing Script", "Segoe Script", cursive' }
]

const PROFILE_FONT_STACKS = Object.fromEntries(PROFILE_FONT_OPTIONS.map(option => [option.value, option.stack]))
// Keep profiles saved with the earlier "system" choice working as the default.
PROFILE_FONT_STACKS.system = PROFILE_FONT_STACKS.display

export function normalizeProfileFont(value, fallback = 'display') {
    if (value === 'system') return 'display'
    return PROFILE_FONT_STACKS[value] ? value : fallback
}

export function getProfileFontStack(value, fallback = 'display') {
    return PROFILE_FONT_STACKS[value] || PROFILE_FONT_STACKS[normalizeProfileFont(fallback)]
}

export function getProfileTypography(nameFont, bioFont) {
    const nameStack = getProfileFontStack(nameFont)
    const bioStack = bioFont === 'inherit' ? nameStack : getProfileFontStack(bioFont, 'sans')
    return {
        '--profile-name-font': nameStack,
        '--profile-bio-font': bioStack
    }
}
