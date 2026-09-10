import { DEFAULT_TRANSLATION_ID } from '../translations.js'

const KEYS = {
  theme: 'bible:theme', // 'light' | 'dark' | 'system'
  translation: 'bible:translation', // id of a translation in src/translations.js
  fontScale: 'bible:font-scale', // number, 1 = default
  lastRead: 'bible:last-read', // { book, chapter }
  bookmarks: 'bible:bookmarks', // [{ book, chapter, verse }]
  markedTexts: 'bible:marked-texts', // [{ id, groupId, translation, book, chapter, verse, startOffset, endOffset, color, text, createdAt }]
  readVerses: 'bible:read-verses', // [{ book, chapter, verse }]
  outbox: 'bible:outbox', // [{ id, op, payload, createdAt, failed?, lastError? }]
  lastSyncedAt: 'bible:last-synced-at', // ISO string of the last fully drained flush
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

const MAX_OUTBOX_ENTRIES = 5000

// One highlight dragged across a verse boundary is stored as one record per
// verse, all sharing a group id. Marks written before groups existed have none,
// so they stand alone as a group of one.
export const markGroupId = (mark) => mark.groupId ?? mark.id

// Offsets are character positions inside one translation's wording, so a
// highlight only means anything in the text it was made in. Highlights saved
// before the app offered a choice were all made in the default translation.
export const markTranslationId = (mark) => mark.translation ?? DEFAULT_TRANSLATION_ID

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

  /** Which translation the reader is currently reading. */
  getTranslationId() {
    return readJSON(KEYS.translation, DEFAULT_TRANSLATION_ID)
  },
  setTranslationId(id) {
    writeJSON(KEYS.translation, id)
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
  /**
   * The marks to paint on one chapter page: only those made in the translation
   * being read, since offsets from another wording would land on the wrong
   * words.
   */
  getMarkedTextsForChapter(book, chapter, translationId = this.getTranslationId()) {
    return this.getMarkedTexts().filter(
      (m) => m.book === book && m.chapter === chapter && markTranslationId(m) === translationId
    )
  },
  /**
   * Persists one highlight as a record per verse it covers, all sharing a group
   * id, and returns the stored records. A highlight inside a single verse is
   * just the one-piece case of the same thing.
   */
  addMarkedTexts(pieces) {
    const list = this.getMarkedTexts()
    const groupId = newId()
    const createdAt = new Date().toISOString()
    const translation = this.getTranslationId()
    const marks = pieces.map(({ book, chapter, verse, startOffset, endOffset, color, text }) => ({
      id: newId(),
      groupId,
      translation,
      book,
      chapter,
      verse,
      startOffset,
      endOffset,
      color,
      text,
      createdAt,
    }))
    list.push(...marks)
    writeJSON(KEYS.markedTexts, list)
    return marks
  },
  /** Recolors every piece of a highlight, so a multi-verse one stays one color. */
  setMarkedGroupColor(groupId, color) {
    const list = this.getMarkedTexts()
    const marks = list.filter((m) => markGroupId(m) === groupId)
    if (!marks.length) return []
    for (const mark of marks) mark.color = color
    writeJSON(KEYS.markedTexts, list)
    return marks
  },
  /** Removes a highlight whole, including the pieces in its other verses. */
  removeMarkedGroup(groupId) {
    const list = this.getMarkedTexts()
    const kept = list.filter((m) => markGroupId(m) !== groupId)
    if (kept.length === list.length) return false
    writeJSON(KEYS.markedTexts, kept)
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

  // A reader who never signs in still queues every verse auto-marked as read,
  // so the outbox needs a ceiling or it grows without bound and eventually
  // blows the storage quota. Oldest entries go first; see the note on
  // sign-in bulk upload in sync-service for the real fix.
  // The outbox is the record of changes that still have to reach Supabase.
  // Local state is written immediately either way, so this is what keeps an
  // offline change from being lost instead of silently diverging from remote.
  getOutbox() {
    return getList(KEYS.outbox)
  },
  /**
   * Queues one change. Any pending entry for the same op and target is dropped
   * first — repeating a change makes earlier copies redundant, and it bounds
   * the queue at two entries per target however often the user toggles.
   */
  enqueue(op, payload) {
    const target = JSON.stringify(payload)
    const list = this.getOutbox().filter((e) => !(e.op === op && JSON.stringify(e.payload) === target))
    const entry = { id: newId(), op, payload, createdAt: new Date().toISOString() }
    list.push(entry)
    writeJSON(KEYS.outbox, list.slice(-MAX_OUTBOX_ENTRIES))
    return entry
  },
  removeOutboxEntry(id) {
    writeJSON(
      KEYS.outbox,
      this.getOutbox().filter((e) => e.id !== id)
    )
  },
  /** Marks an entry as rejected by the server, so the flusher stops retrying it. */
  failOutboxEntry(id, lastError) {
    const list = this.getOutbox()
    const entry = list.find((e) => e.id === id)
    if (!entry) return
    entry.failed = true
    entry.lastError = lastError
    writeJSON(KEYS.outbox, list)
  },

  getLastSyncedAt() {
    return readJSON(KEYS.lastSyncedAt, null)
  },
  setLastSyncedAt(iso) {
    writeJSON(KEYS.lastSyncedAt, iso)
  },
}
