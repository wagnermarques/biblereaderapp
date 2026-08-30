const DATA_BASE = `${import.meta.env.BASE_URL}data`

let indexPromise = null
const bookCache = new Map()

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return res.json()
}

export const bibleDataService = {
  /** Lightweight list of all books (id, name, testament, chapter count) — no verse text. */
  async getIndex() {
    if (!indexPromise) {
      indexPromise = fetchJSON(`${DATA_BASE}/books-index.json`)
    }
    return indexPromise
  },

  /** Full text for one book, loaded and cached on demand. */
  async getBook(bookId) {
    if (!bookCache.has(bookId)) {
      bookCache.set(bookId, fetchJSON(`${DATA_BASE}/books/${bookId}.json`))
    }
    return bookCache.get(bookId)
  },

  async getChapter(bookId, chapterNumber) {
    const book = await this.getBook(bookId)
    const chapter = book.chapters[chapterNumber - 1]
    if (!chapter) throw new Error(`${bookId} has no chapter ${chapterNumber}`)
    return chapter
  },

  /** Every currently-cached book — used by the search service to search what's loaded. */
  getCachedBooks() {
    return bookCache
  },
}
