import re

with open('src/pages/EditProfile.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    (r"icon: '👤'", "icon: <svg viewBox='0 0 24 24' width='18' height='18' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>"),
    (r"icon: '⭐'", "icon: <svg viewBox='0 0 24 24' width='18' height='18' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>"),
    (r"icon: '🎮'", "icon: <svg viewBox='0 0 24 24' width='18' height='18' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='2' y='6' width='20' height='12' rx='2'/><path d='M6 12h4M8 10v4M15 11h.01M18 13h.01'/></svg>"),
    (r"icon: '🎨'", "icon: <svg viewBox='0 0 24 24' width='18' height='18' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><circle cx='8' cy='10' r='1.5'/><circle cx='12' cy='6' r='1.5'/><circle cx='16' cy='10' r='1.5'/><path d='M12 22a10 10 0 0 0 0-20'/></svg>"),
    (r"icon: '🔗'", "icon: <svg viewBox='0 0 24 24' width='18' height='18' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg>"),
    (r"icon: '🔒'", "icon: <svg viewBox='0 0 24 24' width='18' height='18' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>"),
    (r"🕹️ Retro \(antes 2000\)", "Retro (antes 2000)"),
    (r"📼 Clásica \(2000-2010\)", "Clásica (2000-2010)"),
    (r"💿 Moderna \(2010-2020\)", "Moderna (2010-2020)"),
    (r"🚀 Actual \(2020\+\)", "Actual (2020+)"),
    (r"Casual 🎮", "Casual"),
    (r"Regular 🕹️", "Regular"),
    (r"Hardcore ⚔️", "Hardcore"),
    (r"<div className=\"ep-avatar-hover\">📷</div>", "<div className=\"ep-avatar-hover\"><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" stroke=\"currentColor\" fill=\"none\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/></svg></div>"),
    (r"<span>🖼️ Cambiar banner</span>", "<span><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" stroke=\"currentColor\" fill=\"none\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" style={{marginRight: '6px', verticalAlign: '-4px'}}><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/><polyline points=\"21 15 16 10 5 21\"/></svg> Cambiar banner</span>"),
    (r"<span>🚫</span>", "<svg viewBox=\"0 0 24 24\" width=\"48\" height=\"48\" stroke=\"currentColor\" fill=\"none\" strokeWidth=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"4.93\" y1=\"4.93\" x2=\"19.07\" y2=\"19.07\"/></svg>"),
    (r"<button className=\"ep-close-btn\" onClick=\{onClose\} title=\"Cerrar\">✕</button>", "<button className=\"ep-close-btn\" onClick={onClose} title=\"Cerrar\"><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" stroke=\"currentColor\" fill=\"none\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M18 6L6 18M6 6l12 12\"/></svg></button>"),
    (r">🎮 Juego Favorito", "><svg viewBox='0 0 24 24' width='16' height='16' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '6px', verticalAlign: '-3px'}}><rect x='2' y='6' width='20' height='12' rx='2'/><path d='M6 12h4M8 10v4M15 11h.01M18 13h.01'/></svg>Juego Favorito"),
    (r">🎌 Anime Favorito", "><svg viewBox='0 0 24 24' width='16' height='16' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '6px', verticalAlign: '-3px'}}><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></svg>Anime Favorito"),
    (r">👤 Identidad", "><svg viewBox='0 0 24 24' width='20' height='20' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '8px', verticalAlign: '-4px'}}><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>Identidad"),
    (r">⭐ Favoritos", "><svg viewBox='0 0 24 24' width='20' height='20' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '8px', verticalAlign: '-4px'}}><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>Favoritos"),
    (r">🎮 Gustos", "><svg viewBox='0 0 24 24' width='20' height='20' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '8px', verticalAlign: '-4px'}}><rect x='2' y='6' width='20' height='12' rx='2'/><path d='M6 12h4M8 10v4M15 11h.01M18 13h.01'/></svg>Gustos"),
    (r">🎨 Personalización", "><svg viewBox='0 0 24 24' width='20' height='20' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '8px', verticalAlign: '-4px'}}><circle cx='12' cy='12' r='10'/><circle cx='8' cy='10' r='1.5'/><circle cx='12' cy='6' r='1.5'/><circle cx='16' cy='10' r='1.5'/><path d='M12 22a10 10 0 0 0 0-20'/></svg>Personalización"),
    (r">🔗 Redes Sociales", "><svg viewBox='0 0 24 24' width='20' height='20' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '8px', verticalAlign: '-4px'}}><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg>Redes Sociales"),
    (r">🔒 Privacidad", "><svg viewBox='0 0 24 24' width='20' height='20' stroke='currentColor' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{marginRight: '8px', verticalAlign: '-4px'}}><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>Privacidad"),
    (r"💾 Guardando...", "Guardando..."),
    (r"💾 Guardar", "Guardar")
]

for p, r in replacements:
    text = re.sub(p, r, text)

with open('src/pages/EditProfile.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
