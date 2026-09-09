/**
 * Minimal hash router. Routes:
 *   #/                      -> home
 *   #/livros                -> book list page
 *   #/sobre/objetivo        -> about/purpose page
 *   #/conta                 -> account/login page
 *   #/marcacoes             -> list of highlighted excerpts
 *   #/:book                 -> chapter picker grid for that book
 *   #/:book/:chapter[?v=n]  -> reading view, optionally opened at one verse
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
  if (segments[0] === 'marcacoes') {
    return { name: 'marked-texts' }
  }
  if (segments.length === 0) {
    return { name: 'home' }
  }
  if (segments.length === 1) {
    return { name: 'book-chapters', book: segments[0] }
  }
  return {
    name: 'chapter',
    book: segments[0],
    chapter: Number(segments[1]) || 1,
    // Present when the reader was opened from a highlight, so the view knows
    // which verse to scroll to instead of starting at the top of the chapter.
    verse: Number(query.v) || null,
  }
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

export function navigateToChapter(bookId, chapter, verse = null) {
  location.hash = verse ? `#/${bookId}/${chapter}?v=${verse}` : `#/${bookId}/${chapter}`
}

export function navigateToBookChapters(bookId) {
  location.hash = `#/${bookId}`
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

export function navigateToMarkedTexts() {
  location.hash = '#/marcacoes'
}
