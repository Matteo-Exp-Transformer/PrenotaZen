import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { logger } from '@/lib/logger'

// Solo dev: nasconde il messaggio informativo di React DevTools (non è un errore).
if (import.meta.env.DEV) {
  const stripReactDevtoolsBanner =
    (original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      const first = args[0]
      if (
        typeof first === 'string' &&
        first.includes('Download the React DevTools')
      ) {
        return
      }
      original(...args)
    }
  // eslint-disable-next-line no-console
  console.log = stripReactDevtoolsBanner(console.log.bind(console))
  // eslint-disable-next-line no-console
  console.info = stripReactDevtoolsBanner(console.info.bind(console))
}

logger.info(
  `CalendarBackup v${__APP_VERSION__} | commit ${__BUILD_COMMIT__} | build ${__BUILD_DATE__}`
)

function showSplash() {
  const splash = document.getElementById('sw-update-splash')
  if (splash) splash.style.display = 'flex'
}

// Nascondi la microschermata splash appena React è pronto a montare.
function hideSplash() {
  const splash = document.getElementById('sw-update-splash')
  if (splash) splash.style.display = 'none'
}

// Registrazione SW in modalità 'prompt' (vite.config.ts): il nuovo SW resta in WAITING e
// non si attiva da solo. updateSW(true) invia skipWaiting al SW in waiting e ricarica la
// pagina quando ha preso il controllo (gestito da workbox-window).
// - onNeedRefresh: nuova versione disponibile MENTRE l'app è aperta → NON fare nulla
//   (niente popup, niente reload). Lo swap avverrà solo al prossimo avvio.
// - onRegisteredSW: all'avvio, se esiste già un SW in waiting (versione precacheata in una
//   sessione precedente), mostra la splash e applica l'aggiornamento prima dell'uso.
const updateSW = registerSW({
  onNeedRefresh() {
    // Sessione attiva: non interrompere Mario. La versione nuova si applica al riavvio.
  },
  onOfflineReady() {
    logger.debug('PWA pronta per uso offline')
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration?.waiting) {
      showSplash()
      void updateSW(true)
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Nasconde la splash dopo il mount React (caso normale, nessun SW in waiting).
hideSplash()
