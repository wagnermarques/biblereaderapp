const KEYS = {
  theme: 'bible:theme', // 'light' | 'dark' | 'system'
  fontScale: 'bible:font-scale', // number, 1 = default
  lastRead: 'bible:last-read', // { book, chapter }
  bookmarks: 'bible:bookmarks', // [{ book, chapter, verse }]
  highlights: 'bible:highlights', // { "book:chapter:verse": colorId }
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode, quota) — fail silently, app still works in-memory
  }
}

export const storageService = {
  getTheme() {
    return readJSON(KEYS.theme, 'system')
  },
  setTheme(theme) {
    writeJSON(KEYS.theme, theme)
  },

  getFontScale() {
    return readJSON(KEYS.fontScale, 1)
  },
  setFontScale(scale) {
    writeJSON(KEYS.fontScale, scale)
  },

  getLastRead() {
    return readJSON(KEYS.lastRead, null)
  },
  setLastRead(book, chapter) {
    writeJSON(KEYS.lastRead, { book, chapter })
  },

  getBookmarks() {
    return readJSON(KEYS.bookmarks, [])
  },
  toggleBookmark(book, chapter, verse) {
    const bookmarks = this.getBookmarks()
    const idx = bookmarks.findIndex(
      (b) => b.book === book && b.chapter === chapter && b.verse === verse
    )
    if (idx >= 0) {
      bookmarks.splice(idx, 1)
    } else {
      bookmarks.push({ book, chapter, verse })
    }
    writeJSON(KEYS.bookmarks, bookmarks)
    return bookmarks
  },
  isBookmarked(book, chapter, verse) {
    return this.getBookmarks().some(
      (b) => b.book === book && b.chapter === chapter && b.verse === verse
    )
  },

  getHighlights() {
    return readJSON(KEYS.highlights, {})
  },
  setHighlight(book, chapter, verse, colorId) {
    const highlights = this.getHighlights()
    const key = `${book}:${chapter}:${verse}`
    if (colorId) {
      highlights[key] = colorId
    } else {
      delete highlights[key]
    }
    writeJSON(KEYS.highlights, highlights)
    return highlights
  },
  getHighlight(book, chapter, verse) {
    return this.getHighlights()[`${book}:${chapter}:${verse}`] ?? null
  },
}
