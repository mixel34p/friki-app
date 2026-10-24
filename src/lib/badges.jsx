export const BADGES_MAP = {
    verified: {
        color: '#1d9bf0',
        title: 'Verificado',
        description: 'Este perfil ha sido verificado por el equipo de la plataforma.',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.5 12.5l-2.43 2.8.57 3.65-3.6.86-2.07 3.14-3.47-1.5-3.47 1.5-2.07-3.14-3.6-.86.57-3.65L.5 12.5l2.43-2.8-.57-3.65 3.6-.86 2.07-3.14 3.47 1.5 3.47-1.5 2.07 3.14 3.6.86-.57 3.65 2.43 2.8zM10.1 17.6l7.7-7.7-1.4-1.4-6.3 6.3-3-3-1.4 1.4 4.4 4.4z"/>
            </svg>
        )
    },
    dev: {
        color: '#f59e0b',
        title: 'Desarrollador',
        description: 'Identifica a quienes forman parte del equipo de desarrollo de la plataforma.',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
        )
    },
    early: {
        color: '#8b5cf6',
        title: 'Pionero',
        description: 'Reconoce a quienes acompañaron a la comunidad desde sus primeras etapas.',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
                <path d="M20 3v4"></path>
                <path d="M22 5h-4"></path>
                <path d="M4 17v2"></path>
                <path d="M5 18H3"></path>
            </svg>
        )
    },
    mod: {
        color: '#10b981',
        title: 'Moderador',
        description: 'Indica que esta persona ayuda a mantener la comunidad segura y ordenada.',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
            </svg>
        )
    },
    bug_hunter: {
        color: '#84cc16',
        title: 'Cazabichos',
        description: 'Reconoce a quienes ayudan a detectar y comunicar errores para mejorar la app.',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="8" height="14" x="8" y="6" rx="4"/>
                <path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/>
                <path d="M20 13h-4"/><path d="M4 13h4"/><path d="m9 4 1 2"/><path d="m15 4-1 2"/>
            </svg>
        )
    },
    vip: {
        color: '#f43f5e',
        title: 'VIP',
        description: 'Distintivo especial para miembros con reconocimiento VIP dentro de la comunidad.',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12l4 6-10 12L2 9Z"/>
                <path d="m11.637 17.136-4.218-8.136h9.16l-4.218 8.136Z"/>
                <path d="M2 9h20"/>
            </svg>
        )
    }
}
