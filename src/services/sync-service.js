import { supabase } from './supabase-client.js'
import { storageService } from './storage-service.js'
import { authService } from './auth-service.js'

// Debounce so a burst of changes (scrolling past a screenful of verses, each
// auto-marking as read) results in one flush rather than one per verse.
const FLUSH_DEBOUNCE_MS = 600

/**
 * How one queued change is applied remotely. Every handler must be safe to
 * repeat: a flush can be interrupted after the write lands but before the
 * entry is dropped from the queue, so the same op will be replayed. Inserts
 * are therefore upserts that ignore duplicates, and deletes are already
 * naturally idempotent.
 */
const OPS = {
  'bookmark.add': (userId, p) =>
    supabase
      .from('bookmarks')
      .upsert(
        { user_id: userId, book_id: p.book, chapter: p.chapter, verse: p.verse },
        { onConflict: 'user_id,book_id,chapter,verse', ignoreDuplicates: true }
      ),
  'bookmark.remove': (userId, p) =>
    supabase
      .from('bookmarks')
      .delete()
      .match({ user_id: userId, book_id: p.book, chapter: p.chapter, verse: p.verse }),
  'readVerse.add': (userId, p) =>
    supabase
      .from('read_verses')
      .upsert(
        { user_id: userId, book_id: p.book, chapter: p.chapter, verse: p.verse },
        { onConflict: 'user_id,book_id,chapter,verse', ignoreDuplicates: true }
      ),
  'readVerse.remove': (userId, p) =>
    supabase
      .from('read_verses')
      .delete()
      .match({ user_id: userId, book_id: p.book, chapter: p.chapter, verse: p.verse }),
}

/**
 * A PostgREST error carries a `code`, meaning the server understood the
 * request and refused it — replaying won't change the answer. Anything without
 * one failed in transport, which is exactly what retrying is for.
 */
function isRetryable(error) {
  return !error?.code
}

let flushing = false
let flushTimer = null
// navigator.onLine only reports whether an interface exists — a captive portal
// or a dead uplink still says true — so being able to reach the server is
// tracked from what actually happened on the last attempt.
let reachable = true
let status = { state: 'synced', pending: 0, failed: 0, lastSyncedAt: null }
const statusListeners = new Set()

/**
 * Everything except 'syncing' is derived from the queue and reachability, so
 * no caller can publish a state that a later recomputation silently erases.
 * 'syncing' is the one genuinely transient state, hence the override.
 */
function publishStatus(override) {
  const outbox = storageService.getOutbox()
  const failed = outbox.filter((e) => e.failed).length
  const pending = outbox.length - failed
  let state = override
  if (!state) {
    if (failed) state = 'error'
    else if (!pending) state = 'synced'
    else if (navigator.onLine === false || !reachable) state = 'offline'
    else state = 'pending'
  }
  status = { state, pending, failed, lastSyncedAt: storageService.getLastSyncedAt() }
  statusListeners.forEach((fn) => fn(status))
}

export const syncService = {
  /** Current sync state — see publishStatus for the shape. */
  getStatus() {
    return status
  },
  /** Calls back immediately, then on every status change. */
  subscribeStatus(callback) {
    statusListeners.add(callback)
    callback(status)
    return () => statusListeners.delete(callback)
  },

  /**
   * The single entry point for "this local change must reach the server".
   * TODO: on first sign-in, upload local state in bulk and clear the queue
   * instead of replaying a queue that may have been accumulating for months.
   * Deliberately takes no user id: queuing is unconditional, so a change made
   * while signed out — or in the moment before the persisted session resolves —
   * is still delivered once a session exists, instead of being dropped.
   */
  enqueue(op, payload) {
    if (!supabase) return
    storageService.enqueue(op, payload)
    publishStatus()
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => this.flush(), FLUSH_DEBOUNCE_MS)
  },

  /**
   * Drains the outbox oldest-first, stopping at the first entry that fails in
   * transport so ordering is preserved — a queued add must not overtake the
   * remove that preceded it.
   */
  async flush() {
    clearTimeout(flushTimer)
    if (!supabase || flushing) return
    const userId = authService.getCurrentUser()?.id
    if (!userId) return publishStatus()
    if (navigator.onLine === false) return publishStatus()

    flushing = true
    publishStatus('syncing')
    let drained = true
    try {
      for (;;) {
        const entry = storageService.getOutbox().find((e) => !e.failed)
        if (!entry) break
        const handler = OPS[entry.op]
        if (!handler) {
          // An op from a newer version of the app, or a typo — dropping it is
          // better than blocking every later change behind something we can't apply.
          storageService.removeOutboxEntry(entry.id)
          continue
        }
        const { error } = await handler(userId, entry.payload)
        if (!error) {
          reachable = true
          storageService.removeOutboxEntry(entry.id)
          continue
        }
        if (isRetryable(error)) {
          reachable = false
          drained = false
          break
        }
        console.error(`Servidor rejeitou "${entry.op}"`, error)
        storageService.failOutboxEntry(entry.id, error.message)
      }
      if (drained) storageService.setLastSyncedAt(new Date().toISOString())
    } finally {
      flushing = false
      publishStatus()
    }
  },

  /** Pulls the signed-in user's remote bookmarks and unions them into local storage. */
  async pullBookmarks(userId) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('bookmarks')
      .select('book_id, chapter, verse')
      .eq('user_id', userId)
    if (error) {
      console.error('Falha ao buscar favoritos do Supabase', error)
      return
    }
    storageService.mergeBookmarks(
      (data ?? []).map((r) => ({ book: r.book_id, chapter: r.chapter, verse: r.verse }))
    )
  },

  /** Pulls the signed-in user's remote read-verses and unions them into local storage. */
  async pullReadVerses(userId) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('read_verses')
      .select('book_id, chapter, verse')
      .eq('user_id', userId)
    if (error) {
      console.error('Falha ao buscar versículos lidos do Supabase', error)
      return
    }
    storageService.mergeReadVerses(
      (data ?? []).map((r) => ({ book: r.book_id, chapter: r.chapter, verse: r.verse }))
    )
  },

  /**
   * Sends everything queued, then pulls. The order matters: the merges below
   * only ever add, so pulling first would resurrect locally-deleted rows that
   * are still sitting in the outbox waiting to be deleted remotely.
   */
  async syncAll(userId) {
    await this.flush()
    await Promise.all([this.pullBookmarks(userId), this.pullReadVerses(userId)])
    publishStatus()
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Optimistic: the next flush is what actually proves reachability.
    reachable = true
    syncService.flush()
  })
  window.addEventListener('offline', () => publishStatus())
  publishStatus()
}
