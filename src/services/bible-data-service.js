import { storageService } from './storage-service.js'

const DATA_BASE = `${import.meta.env.BASE_URL}data`

// Caches are per translation: the same book id holds different text in each, so
// switching translations must not serve what the previous one loaded.
const indexPromises = new Map()
const bookCaches = new Map()

function bookCache(translationId) {
  let cache = bookCaches.get(translationId)
  if (!cache) {
    cache = new Map()
    bookCaches.set(translationId, cache)
  }
  return cache
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return res.json()
}

export const bibleDataService = {
  /** The translation every call below reads from unless one is passed explicitly. */
  get translationId() {
    return storageService.getTranslationId()
  },

  /** Lightweight list of all books (id, name, testament, chapter count) — no verse text. */
  async getIndex(translationId = this.translationId) {
    if (!indexPromises.has(translationId)) {
      indexPromises.set(translationId, fetchJSON(`${DATA_BASE}/${translationId}/books-index.json`))
    }
    return indexPromises.get(translationId)
  },

  /** Full text for one book, loaded and cached on demand. */
  async getBook(bookId, translationId = this.translationId) {
    const cache = bookCache(translationId)
    if (!cache.has(bookId)) {
      cache.set(bookId, fetchJSON(`${DATA_BASE}/${translationId}/books/${bookId}.json`))
    }
    return cache.get(bookId)
  },

  async getChapter(bookId, chapterNumber, translationId = this.translationId) {
    const book = await this.getBook(bookId, translationId)
    const chapter = book.chapters[chapterNumber - 1]
    if (!chapter) throw new Error(`${bookId} has no chapter ${chapterNumber}`)
    return chapter
  },

  /** Every currently-cached book of one translation — used by the search service. */
  getCachedBooks(translationId = this.translationId) {
    return bookCache(translationId)
  },
}
