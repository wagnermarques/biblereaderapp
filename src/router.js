/**
 * Minimal hash router. Routes:
 *   #/                      -> home
 *   #/livros                -> book list page
 *   #/sobre/objetivo        -> about/purpose page
 *   #/:book                 -> chapter 1 of that book
 *   #/:book/:chapter        -> reading view
 *   #/search?q=...          -> search results
 */

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '')
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
