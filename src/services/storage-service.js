const KEYS = {
  theme: 'bible:theme', // 'light' | 'dark' | 'system'
  fontScale: 'bible:font-scale', // number, 1 = default
  lastRead: 'bible:last-read', // { book, chapter }
  bookmarks: 'bible:bookmarks', // [{ book, chapter, verse }]
  markedTexts: 'bible:marked-texts', // [{ id, book, chapter, verse, startOffset, endOffset, color, text, createdAt }]
  readVerses: 'bible:read-verses', // [{ book, chapter, verse }]
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

// Shared set-membership helpers backing bookmarks/read-verses — both are
// "does this (book,chapter,verse) tuple exist in this local list" with the
// same toggle/merge/membership shape, just different keys.
function getList(storageKey) {
  return readJSON(storageKey, [])
}

/** Returns { added, list }. */
function toggleInList(storageKey, keyFn, item) {
  const list = getList(storageKey)
  const k = keyFn(item)
  const idx = list.findIndex((x) => keyFn(x) === k)
  let added
  if (idx >= 0) {
    list.splice(idx, 1)
    added = false
  } else {
    list.push(item)
    added = true
  }
  writeJSON(storageKey, list)
  return { added, list }
}

function addToList(storageKey, keyFn, item) {
  if (isInList(storageKey, keyFn, item)) return false
  const list = getList(storageKey)
  list.push(item)
  writeJSON(storageKey, list)
  return true
}

function mergeIntoList(storageKey, keyFn, remoteItems) {
  const local = getList(storageKey)
  const seen = new Set(local.map(keyFn))
  for (const item of remoteItems) {
    const k = keyFn(item)
    if (!seen.has(k)) {
      local.push(item)
      seen.add(k)
    }
  }
  writeJSON(storageKey, local)
  return local
}

function isInList(storageKey, keyFn, item) {
  const k = keyFn(item)
  return getList(storageKey).some((x) => keyFn(x) === k)
}

const bookmarkKey = (b) => `${b.book}:${b.chapter}:${b.verse}`
const verseKey = (v) => `${v.book}:${v.chapter}:${v.verse}`

// crypto.randomUUID() exists only in secure contexts, so it's missing whenever
// the app is served over plain http from a LAN address (a phone hitting the dev
// server at http://192.168.x.x). crypto.getRandomValues() has no such
// restriction, so build the v4 UUID from it when randomUUID isn't there.
function newId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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
    return getList(KEYS.bookmarks)
  },
  /** Returns { added, bookmarks } so callers can mirror the change elsewhere (e.g. sync). */
  toggleBookmark(book, chapter, verse) {
    const { added, list } = toggleInList(KEYS.bookmarks, bookmarkKey, { book, chapter, verse })
    return { added, bookmarks: list }
  },
  /** Unions remote bookmarks into local storage without duplicating existing ones. */
  mergeBookmarks(remoteBookmarks) {
    return mergeIntoList(KEYS.bookmarks, bookmarkKey, remoteBookmarks)
  },
  isBookmarked(book, chapter, verse) {
    return isInList(KEYS.bookmarks, bookmarkKey, { book, chapter, verse })
  },

  /** Every marked (highlighted) text excerpt, oldest first. */
  getMarkedTexts() {
    return getList(KEYS.markedTexts)
  },
  /** Only the marks inside one chapter — what the reader needs to paint a page. */
  getMarkedTextsForChapter(book, chapter) {
    return this.getMarkedTexts().filter((m) => m.book === book && m.chapter === chapter)
  },
  /** Persists a new excerpt and returns the stored record (id/createdAt filled in). */
  addMarkedText({ book, chapter, verse, startOffset, endOffset, color, text }) {
    const list = this.getMarkedTexts()
    const mark = {
      id: newId(),
      book,
      chapter,
      verse,
      startOffset,
      endOffset,
      color,
      text,
      createdAt: new Date().toISOString(),
    }
    list.push(mark)
    writeJSON(KEYS.markedTexts, list)
    return mark
  },
  setMarkedTextColor(id, color) {
    const list = this.getMarkedTexts()
    const mark = list.find((m) => m.id === id)
    if (!mark) return null
    mark.color = color
    writeJSON(KEYS.markedTexts, list)
    return mark
  },
  removeMarkedText(id) {
    const list = this.getMarkedTexts()
    const idx = list.findIndex((m) => m.id === id)
    if (idx < 0) return false
    list.splice(idx, 1)
    writeJSON(KEYS.markedTexts, list)
    return true
  },

  getReadVerses() {
    return getList(KEYS.readVerses)
  },
  /** Idempotent add (not a toggle) — used by auto-marking as a verse scrolls into view. Returns true if newly marked. */
  markVerseRead(book, chapter, verse) {
    return addToList(KEYS.readVerses, verseKey, { book, chapter, verse })
  },
  /** Manual toggle, e.g. tapping a verse number — flips read/unread either way. */
  toggleReadVerse(book, chapter, verse) {
    const { added, list } = toggleInList(KEYS.readVerses, verseKey, { book, chapter, verse })
    return { added, readVerses: list }
  },
  mergeReadVerses(remoteVerses) {
    return mergeIntoList(KEYS.readVerses, verseKey, remoteVerses)
  },
  isVerseRead(book, chapter, verse) {
    return isInList(KEYS.readVerses, verseKey, { book, chapter, verse })
  },
}
