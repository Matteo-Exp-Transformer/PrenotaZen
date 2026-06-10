import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'
import { useTenantContext } from '@/contexts/TenantContext'
import { useRestaurantName } from '@/hooks/useRestaurantName'
import { resolvePrivacyReturnPath } from '@/features/booking/utils/privacyPolicyNavigation'

/**
 * Privacy Policy — pagina pubblica (`/privacy`).
 *
 * Conforme a GDPR (Reg. UE 2016/679) e D.Lgs. 196/2003 aggiornato (Codice
 * Privacy italiano). Il contenuto riflette i dati realmente raccolti dall'app
 * (vedi `docs/Legal-Production-Skill/DATA_INVENTORY_CONTEXT.md`).
 *
 * NOMENCLATURA GDPR usata:
 *  - Titolare = il ristorante (decide cosa fare con i dati dei suoi clienti)
 *  - Responsabile = il gestore della piattaforma (Matteo) — tratta per conto
 *  - Sub-Responsabili = Supabase, Vercel (forniscono infrastruttura al Responsabile)
 *
 * Modifiche a questo file: passare per skill `legal-production`
 * (`docs/Legal-Production-Skill/`).
 */
const PRIVACY_POLICY_VERSION = '2.0'
const PRIVACY_POLICY_LAST_UPDATE = '2026-05-23'

export const PrivacyPolicyPage: React.FC = () => {
  const location = useLocation()
  const { organizationName } = useTenantContext()
  const restaurantName = useRestaurantName() || organizationName || 'il ristorante'
  const returnPath = resolvePrivacyReturnPath(location.search, location.state)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back */}
        <Link
          to={returnPath ?? '/'}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {returnPath ? 'Torna alla prenotazione' : 'Torna alla home'}
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-title-page font-bold text-slate-800">Privacy Policy</h1>
            <p className="text-body text-slate-500">Ai sensi del GDPR — Reg. UE 2016/679</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6 text-sm text-slate-600 leading-relaxed">

          <Section title="1. Chi tratta i tuoi dati">
            <p className="mb-2">
              <strong>Titolare del trattamento</strong> dei dati che fornisci tramite questo
              modulo di prenotazione è <strong>{restaurantName}</strong>. Per qualsiasi
              richiesta relativa ai tuoi dati personali puoi contattare direttamente il
              ristorante con i recapiti pubblicati sul suo sito o sui canali di
              comunicazione abituali.
            </p>
            <p>
              Il ristorante utilizza la piattaforma tecnologica CalendarBackup
              (di seguito, la &quot;Piattaforma&quot;) per gestire le prenotazioni.
              Il gestore della Piattaforma agisce come <strong>Responsabile del trattamento</strong>{' '}
              ai sensi dell&apos;art. 28 GDPR, trattando i dati esclusivamente per conto
              del ristorante e secondo le sue istruzioni.
            </p>
          </Section>

          <Section title="2. Quali dati raccogliamo">
            <p className="mb-2">
              Quando compili il modulo di prenotazione, raccogliamo i seguenti dati che
              ci fornisci direttamente:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li><strong>Dati identificativi</strong>: nome e cognome</li>
              <li><strong>Dati di contatto</strong>: indirizzo email e numero di telefono (se forniti)</li>
              <li><strong>Dati della prenotazione</strong>: data e ora desiderate, numero di ospiti, tipologia di evento</li>
              <li><strong>Preferenze alimentari e allergie</strong> (se compilate) — questi dati possono rientrare nella categoria delle &quot;categorie particolari di dati personali&quot; di cui all&apos;art. 9 GDPR (dati relativi alla salute). Vengono trattati solo con il tuo consenso esplicito (checkbox di accettazione della presente policy) ed esclusivamente per consentire al ristorante di organizzare la tua esperienza in sicurezza</li>
              <li><strong>Richieste speciali</strong> e note aggiuntive che inserisci liberamente</li>
            </ul>
            <p className="mb-2">
              Inoltre, raccogliamo automaticamente:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Indirizzo IP</strong> al momento dell&apos;invio della prenotazione, per finalità di sicurezza e prevenzione abusi (rate limiting)</li>
              <li><strong>Cookie tecnici</strong> e dati di sessione del browser strettamente necessari al funzionamento del modulo</li>
            </ul>
          </Section>

          <Section title="3. Per quali finalità usiamo i tuoi dati">
            <p className="mb-2">I dati raccolti vengono utilizzati per:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Gestire, confermare o eventualmente modificare la tua prenotazione</li>
              <li>Comunicarti via email o telefono informazioni relative alla prenotazione</li>
              <li>Consentire al ristorante di organizzare il servizio tenendo conto di eventuali preferenze o restrizioni alimentari segnalate</li>
              <li>Prevenire abusi e attacchi automatizzati al modulo (sicurezza informatica)</li>
              <li>Adempiere a obblighi di legge cui il ristorante è soggetto (es. richieste autorità)</li>
            </ul>
            <p className="mt-3">
              <strong>Non utilizziamo i tuoi dati per profilazione, marketing automatizzato o
              vendita a terzi.</strong>
            </p>
          </Section>

          <Section title="4. Su quale base giuridica trattiamo i tuoi dati">
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Esecuzione di misure precontrattuali e contrattuali</strong> (art. 6.1.b GDPR) per i dati strettamente necessari alla gestione della prenotazione</li>
              <li><strong>Consenso esplicito</strong> (art. 6.1.a e art. 9.2.a GDPR) per le preferenze alimentari e allergie, che presti tramite la checkbox di accettazione di questa policy</li>
              <li><strong>Legittimo interesse</strong> (art. 6.1.f GDPR) del Titolare alla sicurezza dei sistemi, per il trattamento dell&apos;indirizzo IP a fini anti-abuso</li>
              <li><strong>Obbligo legale</strong> (art. 6.1.c GDPR) quando il trattamento è richiesto da norme di legge</li>
            </ul>
          </Section>

          <Section title="5. A chi vengono comunicati i dati (Sub-Responsabili)">
            <p className="mb-2">
              I tuoi dati vengono trattati su infrastrutture cloud fornite da terze parti
              che agiscono come <strong>Sub-Responsabili del trattamento</strong> per conto
              del Responsabile. Attualmente:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>
                <strong>Supabase Inc.</strong> — hosting del database, autenticazione e
                logica server (Edge Functions). Lista aggiornata dei loro sub-fornitori
                disponibile su{' '}
                <a
                  href="https://supabase.com/legal/subprocessors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline"
                >
                  supabase.com/legal/subprocessors
                </a>
              </li>
              <li>
                <strong>Vercel Inc.</strong> — hosting delle pagine web pubbliche
              </li>
            </ul>
            <p>
              Tutti i Sub-Responsabili sono vincolati da contratti di trattamento dati
              (DPA) che garantiscono livelli di protezione adeguati al GDPR.
            </p>
          </Section>

          <Section title="6. Trasferimento dei dati al di fuori dell'Unione Europea">
            <p>
              Alcuni dei nostri Sub-Responsabili (in particolare Supabase Inc. e Vercel
              Inc.) hanno sede negli Stati Uniti d&apos;America e possono memorizzare o
              elaborare i dati anche al di fuori dello Spazio Economico Europeo. Tali
              trasferimenti avvengono sulla base delle{' '}
              <strong>Clausole Contrattuali Standard (SCC)</strong> approvate dalla
              Commissione Europea (Decisione 2021/914) e, ove applicabile, del{' '}
              <strong>EU-US Data Privacy Framework</strong>, oltre che dei rispettivi
              Data Processing Agreement firmati con il Responsabile.
            </p>
          </Section>

          <Section title="7. Per quanto tempo conserviamo i dati">
            <p className="mb-2">
              I dati vengono conservati per il tempo strettamente necessario alle finalità
              indicate:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Dati di prenotazione e CRM</strong>: per la durata del rapporto
                tra te e il ristorante, salvo tu richieda la cancellazione prima. Il
                ristorante può mantenerli per ragioni amministrative e di gestione
                clientela secondo le proprie politiche interne
              </li>
              <li>
                <strong>Indirizzo IP e log di sicurezza</strong>: massimo 12 mesi, salvo
                necessità di indagini per uso improprio del servizio
              </li>
              <li>
                <strong>Dati richiesti per obblighi fiscali o di legge</strong>: per il
                tempo previsto dalle norme applicabili (generalmente 10 anni)
              </li>
            </ul>
          </Section>

          <Section title="8. I tuoi diritti">
            <p className="mb-2">In qualsiasi momento puoi esercitare i seguenti diritti previsti dal GDPR:</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li><strong>Accesso</strong> ai tuoi dati personali (art. 15)</li>
              <li><strong>Rettifica</strong> di dati inesatti o incompleti (art. 16)</li>
              <li><strong>Cancellazione</strong> (&quot;diritto all&apos;oblio&quot;, art. 17)</li>
              <li><strong>Limitazione</strong> del trattamento (art. 18)</li>
              <li><strong>Portabilità</strong> dei dati in formato strutturato (art. 20)</li>
              <li><strong>Opposizione</strong> al trattamento (art. 21)</li>
              <li><strong>Revoca del consenso</strong> in qualsiasi momento, senza pregiudicare la liceità del trattamento basato sul consenso prestato prima della revoca</li>
            </ul>
            <p className="mb-2">
              Per esercitare questi diritti, contatta direttamente <strong>{restaurantName}</strong>{' '}
              utilizzando i recapiti pubblicati.
            </p>
            <p>
              Hai inoltre diritto di proporre reclamo al{' '}
              <strong>Garante per la Protezione dei Dati Personali</strong>{' '}
              (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">garanteprivacy.it</a>)
              se ritieni che il trattamento violi il GDPR.
            </p>
          </Section>

          <Section title="9. Sicurezza dei dati">
            <p>
              Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi
              dati, incluse: cifratura TLS in transito, isolamento dei dati per tenant
              tramite Row-Level Security a livello di database, controllo accessi
              autenticato con autenticazione a più fattori per gli amministratori,
              monitoraggio degli accessi e procedure di gestione degli incidenti di
              sicurezza con notifica entro 72 ore in caso di violazione.
            </p>
          </Section>

          <Section title="10. Cookie e tecnologie di tracciamento">
            <p className="mb-2">
              Questo sito utilizza esclusivamente <strong>cookie tecnici</strong> e
              tecnologie di archiviazione locale necessarie al funzionamento del modulo
              di prenotazione e della sessione di accesso degli amministratori del
              ristorante.
            </p>
            <p>
              <strong>Non utilizziamo cookie di profilazione, di terze parti a fini
              pubblicitari, né strumenti di analytics o tracciamento comportamentale.</strong>{' '}
              Per questo motivo non è richiesto banner di consenso ai cookie ai sensi
              delle Linee Guida del Garante (provvedimento del 10 giugno 2021).
            </p>
          </Section>

          <Section title="11. Conferimento dei dati: facoltativo o obbligatorio?">
            <p>
              Il conferimento dei dati identificativi (nome e cognome), della data e
              numero di ospiti è <strong>obbligatorio</strong> per consentire la
              gestione della prenotazione; il loro mancato conferimento impedisce
              l&apos;invio della richiesta. Email, telefono, preferenze alimentari,
              richieste speciali sono <strong>facoltativi</strong>: senza di essi
              il ristorante potrebbe non riuscire a contattarti per conferma o
              modifiche.
            </p>
          </Section>

          <Section title="12. Modifiche a questa Privacy Policy">
            <p>
              Ci riserviamo il diritto di aggiornare questa policy in qualsiasi
              momento. La versione corrente è sempre disponibile a questa pagina.
              Le modifiche significative verranno comunicate all&apos;atto della tua
              successiva prenotazione tramite richiesta di nuovo consenso.
            </p>
          </Section>

        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Versione {PRIVACY_POLICY_VERSION} — Ultima modifica: {PRIVACY_POLICY_LAST_UPDATE}
        </p>
      </div>
    </div>
  )
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h2 className="text-title-card font-semibold text-slate-800 mb-2">{title}</h2>
    {children}
  </div>
)
