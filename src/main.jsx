import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './lib/pwa'
import { installWorkHistoryTransitions } from './lib/pwaRouteTransition'

registerServiceWorker()
// Subscribe before BrowserRouter so a native back action can capture the old screen.
const disposeWorkHistory = installWorkHistoryTransitions()
if (import.meta.hot) import.meta.hot.dispose(disposeWorkHistory)

createRoot(document.getElementById('root')).render(
    <HelmetProvider>
        <App />
    </HelmetProvider>
)

