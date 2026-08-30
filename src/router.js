/**
 * Minimal hash router. Routes:
 *   #/                      -> home
 *   #/livros                -> book list page
 *   #/sobre/objetivo        -> about/purpose page
 *   #/conta                 -> account/login page
 *   #/:book                 -> chapter 1 of that book
 *   #/:book/:chapter        -> reading view
 *   #/search?q=...          -> search results
 */

// Supabase's email-confirmation/magic-link/password-reset redirects deliver
// the session as #access_token=...&type=signup etc. — since our own routing
// also lives in the URL hash, that fragment would otherwise get parsed as a
// (nonsense) book id. Recognize it and treat it as the account page instead.
function isAuthCallbackHash(hash) {
  return /(^|[&#])access_token=|(^|[&#])error_description=/.test(hash)
}

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '')

  if (isAuthCallbackHash(hash)) {
    return { name: 'account' }
  }

  const [pathPart, queryPart] = hash.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const query = Object.fromEntries(new URLSearchParams(queryPart ?? ''))

  if (segments[0] === 'search') {
    return { name: 'search', query }
  }
  if (segments[0] === 'livros') {
    return { name: 'books' }
  }
  if (segments[0] === 'sobre' && segments[1] === 'objetivo') {
    return { name: 'about-purpose' }
  }
  if (segments[0] === 'conta') {
    return { name: 'account' }
  }
  if (segments.length === 0) {
    return { name: 'home' }
  }
  if (segments.length === 1) {
    return { name: 'chapter', book: segments[0], chapter: 1 }
  }
  return { name: 'chapter', book: segments[0], chapter: Number(segments[1]) || 1 }
}

export function createRouter(onChange) {
  const handler = () => onChange(parseHash())
  window.addEventListener('hashchange', handler)
  handler() // fire once for the initial URL

  // Supabase's auth SDK reads the tokens out of the hash on its own (via
  // detectSessionInUrl) — once it's had a tick to do that, scrub them from
  // the visible URL/history rather than leaving a raw access token sitting
  // in the address bar.
  const initialHash = location.hash.replace(/^#\/?/, '')
  if (isAuthCallbackHash(initialHash)) {
    setTimeout(() => {
      history.replaceState(null, '', `${location.pathname}${location.search}#/conta`)
    }, 0)
  }

  return () => window.removeEventListener('hashchange', handler)
}

export function navigateToChapter(bookId, chapter) {
  location.hash = `#/${bookId}/${chapter}`
}

export function navigateToSearch(q) {
  location.hash = `#/search?${new URLSearchParams({ q })}`
}

export function navigateHome() {
  location.hash = '#/'
}

export function navigateToBooks() {
  location.hash = '#/livros'
}

export function navigateToPurpose() {
  location.hash = '#/sobre/objetivo'
}

export function navigateToAccount() {
  location.hash = '#/conta'
}
