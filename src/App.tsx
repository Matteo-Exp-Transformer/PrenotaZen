import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryCache, MutationCache, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { DevFlowPanel } from '@/components/dev/DevFlowPanel'
import { devFlow, devFlowError, isDevConsoleEnabled, setDevHealth } from '@/lib/devConsole'
import { devQueryName, devCountFromData, devHealthCountKey } from '@/lib/devQueryNames'

// DEV CONSOLE — aggancio UNICO al flusso dati: queste cache globali intercettano OGNI
// lettura (QueryCache) e scrittura (MutationCache) dell'app, senza toccare i singoli hook.
// Tutto dietro `isDevConsoleEnabled`: in produzione le callback non vengono nemmeno installate.
const queryCache = new QueryCache(
  isDevConsoleEnabled
    ? {
        onSuccess: (data, query) => {
          const name = devQueryName(query.queryKey)
          const count = devCountFromData(data)
          devFlow('ok', count != null ? `${name} · ${count} trovate` : `${name} · caricato`)
          // Alimenta i conteggi della fotografia salute (i «dati utili sotto»).
          const healthKey = devHealthCountKey(query.queryKey)
          if (healthKey && count != null) setDevHealth({ counts: { [healthKey]: count } })
        },
        onError: (error, query) => {
          devFlowError(`lettura ${devQueryName(query.queryKey)}`, error)
        },
      }
    : undefined,
)

const mutationCache = new MutationCache(
  isDevConsoleEnabled
    ? {
        onSuccess: (_data, _vars, _ctx, mutation) => {
          const key = mutation.options.mutationKey
          const name = key ? devQueryName(key) : 'salvataggio'
          devFlow('ok', `${name} · salvato`)
        },
        onError: (error, _vars, _ctx, mutation) => {
          const key = mutation.options.mutationKey
          const name = key ? devQueryName(key) : 'salvataggio'
          devFlowError(name, error)
        },
      }
    : undefined,
)

const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ zIndex: 100000 }}
      />
      <DevFlowPanel />
    </QueryClientProvider>
  )
}

export default App
