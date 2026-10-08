import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { COMMON_ITEMS, CATEGORIES } from './items'
import { guessCategory } from './categorize'

// Everyone who opens this app with the same link shares ONE list.
// There is no login - your name is just a label stored on this device
// so the family can see who added or bought each item.
const ITEMS_COLLECTION = 'groceryItems'

// Items typed in via "Not on the list?" get saved here, so they become
// permanent tiles for the whole family - no code changes needed.
const CUSTOM_TILES_COLLECTION = 'customTiles'

// Each completed shopping trip gets logged here: what was actually bought,
// what wasn't found in the store, and when.
const PURCHASE_HISTORY_COLLECTION = 'purchaseHistory'

const UNIT_OPTIONS = ['nos', 'kg','gram', 'litres']
const OTHER_CATEGORY = { id: 'other', label: 'மற்றவை', icon: '🛒' }

// A single collator covering both Tamil and English forces every comparison
// through one script's rules, which produces inconsistent results for mixed
// lists. Instead: split by script (based on the name's first character),
// sort each group with its own proper collation, English group first.
const enCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
const taCollator = new Intl.Collator('ta', { sensitivity: 'base', numeric: true })
const TAMIL_RANGE = /[\u0B80-\u0BFF]/

function sortMixedByName(list, getName = (x) => x) {
  const english = []
  const tamil = []
  list.forEach((item) => {
    const name = (getName(item) || '').trim()
    if (TAMIL_RANGE.test(name[0] || '')) tamil.push(item)
    else english.push(item)
  })
  english.sort((a, b) => enCollator.compare(getName(a), getName(b)))
  tamil.sort((a, b) => taCollator.compare(getName(a), getName(b)))
  return [...english, ...tamil]
}

function useName() {
  const [name, setName] = useState(() => localStorage.getItem('grocery_name') || '')

  const saveName = (value) => {
    localStorage.setItem('grocery_name', value)
    setName(value)
  }

  return [name, saveName]
}

// Small helper to make unique-enough local ids for draft items
// (these never touch Firebase, so they don't need to be globally unique)
let draftIdCounter = 0
function makeDraftId() {
  draftIdCounter += 1
  return `draft-${Date.now()}-${draftIdCounter}`
}

// Combines a numeric amount + unit into the single string that gets stored,
// e.g. amount="2", unit="kg" -> "2 kg". Falls back sensibly if amount is blank.
function combineQty(amount, unit) {
  const trimmedAmount = (amount || '').trim()
  if (!trimmedAmount) return ''
  return `${trimmedAmount} ${unit}`
}

export default function App() {
  const [name, setName] = useName()
  const [items, setItems] = useState(null) // null = loading, shared Firestore items
  const [customTiles, setCustomTiles] = useState([]) // extra tiles added via the UI, shared for everyone
  const [draftItems, setDraftItems] = useState([]) // local only, not yet in Firebase
  const [customText, setCustomText] = useState('')
  const [customError, setCustomError] = useState('')
  const [error, setError] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [completingTrip, setCompletingTrip] = useState(false)
  const [page, setPage] = useState('home') // 'home' | 'checkout' | 'history' - which screen is showing
  const [history, setHistory] = useState(null) // null = not loaded yet

  useEffect(() => {
    const q = query(collection(db, ITEMS_COLLECTION), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setError('')
      },
      (err) => {
        console.error(err)
        setError('Could not connect to the shared list. Check your Firebase setup.')
      }
    )
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, CUSTOM_TILES_COLLECTION), orderBy('name', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setCustomTiles(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          category: d.data().category || null, // saved once the AI (or keywords) decided
        }))
      )
    })
    return unsub
  }, [])

  // Only listen to purchase history while that page is actually open -
  // no need to keep reading it in the background otherwise.
  useEffect(() => {
    if (page !== 'history') return
    const q = query(collection(db, PURCHASE_HISTORY_COLLECTION), orderBy('completedAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error(err)
        setError('Could not load buy history.')
      }
    )
    return unsub
  }, [page])

  // AI fallback: when the keyword method can't place a custom tile, ask the
  // Gemini model once (via Firebase AI Logic) and save the answer on the tile,
  // so every device reuses it and the AI is never asked about it again.
  // If the AI call fails (offline, quota, App Check), the item just stays in
  // "Other" - nothing breaks.
  const aiTried = useRef(new Set())

  async function classifyWithAI(tileId, tileName) {
    if (aiTried.current.has(tileId)) return
    aiTried.current.add(tileId)
    try {
      const { aiGuessCategory } = await import('./aiCategory')
      const category = await aiGuessCategory(tileName)
      if (category) {
        await updateDoc(doc(db, CUSTOM_TILES_COLLECTION, tileId), { category })
      }
    } catch (err) {
      console.error('AI category failed for', tileName, err)
    }
  }

  useEffect(() => {
    const hardcodedNames = new Set(COMMON_ITEMS.map((i) => i.ta))
    customTiles
      .filter(
        (t) =>
          !t.category &&
          !hardcodedNames.has(t.name) &&
          !guessCategory(t.name) &&
          !aiTried.current.has(t.id)
      )
      .slice(0, 3) // a few at a time, the next batch runs after these are saved
      .forEach((t) => classifyWithAI(t.id, t.name))
  }, [customTiles])

  // Hardcoded items already carry a category + icon. Custom items use the
  // category saved on their tile (set by the AI fallback), otherwise a
  // keyword guess. Only ones with no answer fall into the "Other" bucket.
  const groupedTiles = useMemo(() => {
    const hardcodedNames = new Set(COMMON_ITEMS.map((i) => i.ta))
    const extra = customTiles.filter((t) => !hardcodedNames.has(t.name))
    const catOf = (t) => t.category || guessCategory(t.name)

    const groups = CATEGORIES.map((cat) => {
      const hardcodedTiles = COMMON_ITEMS.filter((i) => i.category === cat.id)
      const customForCat = sortMixedByName(
        extra.filter((t) => catOf(t) === cat.id),
        (t) => t.name
      ).map((t) => ({ ta: t.name, icon: cat.icon }))
      return { ...cat, tiles: [...hardcodedTiles, ...customForCat] }
    }).filter((g) => g.tiles.length > 0)

    const uncategorized = sortMixedByName(
      extra.filter((t) => {
        const c = catOf(t)
        return !c || !CATEGORIES.some((cat) => cat.id === c)
      }),
      (t) => t.name
    )
    if (uncategorized.length > 0) {
      groups.push({
        ...OTHER_CATEGORY,
        tiles: uncategorized.map((t) => ({ ta: t.name, icon: OTHER_CATEGORY.icon })),
      })
    }
    return groups
  }, [customTiles])

  const allTileNames = useMemo(
    () => groupedTiles.flatMap((g) => g.tiles.map((t) => t.ta)),
    [groupedTiles]
  )

  // Maps an item name back to its category id, so items already saved in
  // Firebase (which only store the name) can still be grouped visually.
  // Hardcoded names use their known category; anything else (custom items)
  // falls back to the same keyword guess used for the tile grid.
  const categoryByName = useMemo(() => {
    const map = new Map()
    customTiles.forEach((t) => {
      const c = t.category || guessCategory(t.name)
      if (c && c !== OTHER_CATEGORY.id) map.set(t.name, c)
    })
    COMMON_ITEMS.forEach((i) => map.set(i.ta, i.category))
    return map
  }, [customTiles])

  function resolveCategory(itemName) {
    return categoryByName.get(itemName) || guessCategory(itemName) || OTHER_CATEGORY.id
  }

  function groupByCategory(list) {
    const byCategory = new Map()
    list.forEach((item) => {
      const catId = resolveCategory(item.name)
      if (!byCategory.has(catId)) byCategory.set(catId, [])
      byCategory.get(catId).push(item)
    })
    const orderedGroups = [...CATEGORIES, OTHER_CATEGORY]
      .map((cat) => ({
        ...cat,
        entries: sortMixedByName(byCategory.get(cat.id) || [], (item) => item.name),
      }))
      .filter((g) => g.entries.length > 0)
    return orderedGroups
  }

  const pending = useMemo(() => (items || []).filter((i) => !i.bought), [items])
  const bought = useMemo(() => (items || []).filter((i) => i.bought), [items])
  const pendingGroups = useMemo(() => groupByCategory(pending), [pending, categoryByName])
  const boughtGroups = useMemo(() => groupByCategory(bought), [bought, categoryByName])

  // Names currently in your draft (so we know which grid tiles to show as "selected")
  const draftNames = useMemo(() => new Set(draftItems.map((d) => d.name)), [draftItems])

  // Tapping a tile in the grid toggles it in/out of your draft list.
  function toggleItem(tileName) {
    setDraftItems((prev) => {
      const existing = prev.find((d) => d.name === tileName)
      if (existing) {
        return prev.filter((d) => d.name !== tileName)
      }
      return [...prev, { id: makeDraftId(), name: tileName, amount: '', unit: UNIT_OPTIONS[0] }]
    })
  }

  async function addCustomItem(e) {
    e.preventDefault()
    const trimmed = customText.trim()
    // Guard against empty/whitespace-only names - these never get added to the
    // draft list or saved as a permanent tile.
    if (!trimmed) {
      setCustomError('Please type an item name before adding.')
      return
    }
    setCustomError('')
    setDraftItems((prev) => [
      ...prev,
      { id: makeDraftId(), name: trimmed, amount: '', unit: UNIT_OPTIONS[0] },
    ])
    setCustomText('')

    if (!allTileNames.includes(trimmed)) {
      try {
        await addDoc(collection(db, CUSTOM_TILES_COLLECTION), {
          name: trimmed,
          addedBy: name || 'Someone',
          createdAt: serverTimestamp(),
        })
      } catch (err) {
        console.error(err)
      }
    }
  }

  function updateDraftField(id, field, value) {
    setDraftItems((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)))
  }

  function removeDraftItem(id) {
    setDraftItems((prev) => prev.filter((d) => d.id !== id))
  }

  async function finalizeList() {
    if (!draftItems.length || finalizing) return
    setFinalizing(true)
    try {
      const batch = writeBatch(db)
      draftItems.forEach((draft) => {
        const ref = doc(collection(db, ITEMS_COLLECTION))
        batch.set(ref, {
          name: draft.name,
          qty: combineQty(draft.amount, draft.unit),
          bought: false,
          addedBy: name || 'Someone',
          createdAt: serverTimestamp(),
        })
      })
      await batch.commit()
      setDraftItems([])
      setPage('checkout')
    } catch (err) {
      console.error(err)
      setError('Could not save the list to Firebase. Check your connection.')
    } finally {
      setFinalizing(false)
    }
  }

  async function toggleBought(item) {
    await updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
      bought: !item.bought,
      boughtBy: !item.bought ? name || 'Someone' : null,
    })
  }

  async function removeItem(id) {
    await deleteDoc(doc(db, ITEMS_COLLECTION, id))
  }

  async function clearBought() {
    if (!bought.length) return
    const batch = writeBatch(db)
    bought.forEach((item) => batch.delete(doc(db, ITEMS_COLLECTION, item.id)))
    await batch.commit()
  }

  // Ends the shopping trip: checked items are logged as bought, anything
  // still unchecked is logged as "not available in store" - then the whole
  // active list clears out so the next trip starts fresh.
  async function completeTrip() {
    if (!items || !items.length || completingTrip) return
    const confirmed = window.confirm(
      `Mark this trip complete?\n\n${bought.length} item(s) bought, ${pending.length} item(s) not available.\nThis clears the current list.`
    )
    if (!confirmed) return

    setCompletingTrip(true)
    try {
      await addDoc(collection(db, PURCHASE_HISTORY_COLLECTION), {
        completedAt: serverTimestamp(),
        completedBy: name || 'Someone',
        purchased: bought.map((i) => ({ name: i.name, qty: i.qty || '' })),
        unavailable: pending.map((i) => ({ name: i.name, qty: i.qty || '' })),
      })

      const batch = writeBatch(db)
      items.forEach((item) => batch.delete(doc(db, ITEMS_COLLECTION, item.id)))
      await batch.commit()
      setPage('home')
    } catch (err) {
      console.error(err)
      setError('Could not complete the trip. Check your connection and try again.')
    } finally {
      setCompletingTrip(false)
    }
  }

  if (!name) {
    return (
      <div className="screen">
        <div className="card">
          <h1>🛒 Family Grocery List</h1>
          <p className="muted">What's your name? This just helps everyone see who added or bought each item.</p>
          <NameForm onSubmit={setName} />
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="card wide">
        <header className="header">
          <div className="header-top">
            <h1>🛒 Family Grocery List</h1>
            <span className="hello">Hi, {name}</span>
          </div>
          <nav className="nav-tabs">
            {page !== 'home' && (
              <button className="nav-btn" onClick={() => setPage('home')}>
                <span className="nav-btn-icon">←</span> Add items
              </button>
            )}
            {page !== 'checkout' && (
              <button className="nav-btn" onClick={() => setPage('checkout')}>
                <span className="nav-btn-icon">🛒</span> Buy list
                {items && items.length > 0 ? <span className="nav-btn-badge">{items.length}</span> : null}
              </button>
            )}
            {page !== 'history' && (
              <button className="nav-btn" onClick={() => setPage('history')}>
                <span className="nav-btn-icon">🕘</span> History
              </button>
            )}
          </nav>
        </header>

        {error && <p className="error">{error}</p>}

        {page === 'history' ? (
          <HistoryView history={history} />
        ) : page === 'checkout' ? (
          <>
          {items === null ? (
            <p className="muted">Loading shared list…</p>
          ) : (
            <>
              <section>
                <h2 className="section-title">To buy ({pending.length})</h2>
                {pending.length === 0 && <p className="muted">Nothing pending. Nice!</p>}
                {pendingGroups.map((group) => (
                  <details key={group.id} className="category-block" open>
                    <summary className="category-heading">
                      <span>{group.icon}</span> {group.label}
                      <span className="category-count">({group.entries.length})</span>
                    </summary>
                    <ul className="list">
                      {group.entries.map((item) => (
                        <li key={item.id} className="item">
                          <label className="item-main">
                            <input type="checkbox" checked={false} onChange={() => toggleBought(item)} />
                            <span className="item-name">{item.name}</span>
                          </label>
                          <div className="item-meta">
                            {item.qty && <span className="item-qty">{item.qty}</span>}
                            <span className="muted small">added by {item.addedBy}</span>
                            <button className="btn-icon" onClick={() => removeItem(item.id)} aria-label="Delete">✕</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </section>

              {bought.length > 0 && (
                <section>
                  <div className="section-title-row">
                    <h2 className="section-title">Bought ({bought.length})</h2>
                    <button className="btn btn-ghost" onClick={clearBought}>Clear bought</button>
                  </div>
                  {boughtGroups.map((group) => (
                    <details key={group.id} className="category-block">
                      <summary className="category-heading">
                        <span>{group.icon}</span> {group.label}
                        <span className="category-count">({group.entries.length})</span>
                      </summary>
                      <ul className="list">
                        {group.entries.map((item) => (
                          <li key={item.id} className="item bought">
                            <label className="item-main">
                              <input type="checkbox" checked={true} onChange={() => toggleBought(item)} />
                              <span className="item-name strike">{item.name}</span>
                              {item.qty && <span className="item-qty">{item.qty}</span>}
                            </label>
                            <div className="item-meta">
                              <span className="muted small">by {item.boughtBy || item.addedBy}</span>
                              <button className="btn-icon" onClick={() => removeItem(item.id)} aria-label="Delete">✕</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </section>
              )}

              {items.length === 0 && (
                <p className="muted">Nothing in the buy list yet. Add items from the list page.</p>
              )}

              {items.length > 0 && (
                <button
                  className="btn btn-primary btn-block checkout-btn"
                  onClick={completeTrip}
                  disabled={completingTrip}
                >
                  {completingTrip ? 'Saving trip…' : '✅ Purchase completed'}
                </button>
              )}
            </>
          )}
          </>
        ) : (
        <>
        <section>
          <form className="add-form" onSubmit={addCustomItem}>
            <input
              className="input name-input"
              placeholder="Not on the list? Type it here…"
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value)
                if (customError) setCustomError('')
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={!customText.trim()}>
              Add
            </button>
          </form>
          {customError && <p className="error small-error">{customError}</p>}

          <h2 className="section-title">Tap items to select</h2>

          {groupedTiles.map((group) => (
            <details key={group.id} className="category-block">
              <summary className="category-heading">
                <span>{group.icon}</span> {group.label}
                <span className="category-count">({group.tiles.length})</span>
              </summary>
              <div className="item-grid">
                {group.tiles.map((tile) => {
                  const selected = draftNames.has(tile.ta)
                  return (
                    <button
                      key={tile.ta}
                      type="button"
                      className={selected ? 'item-tile item-tile-selected' : 'item-tile'}
                      onClick={() => toggleItem(tile.ta)}
                    >
                      <span className="tile-icon">{tile.icon}</span>
                      <span className="tile-label">{tile.ta}</span>
                      <span className="tile-check">{selected ? '✓' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </details>
          ))}
        </section>

        <section>
          <div className="section-title-row">
            <h2 className="section-title">Your list ({draftItems.length})</h2>
            {draftItems.length > 0 && (
              <span className="muted small">not shared yet</span>
            )}
          </div>
          {draftItems.length === 0 ? (
            <p className="muted">Tap items above, set quantities, then move them to the buy list.</p>
          ) : (
            <ul className="list">
              {draftItems.map((item) => (
                <li key={item.id} className="item">
                  <span className="item-main">
                    <span className="item-name">{item.name}</span>
                  </span>
                  <div className="item-meta">
                    <input
                      className="input qty-input-inline"
                      placeholder="Qty"
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(e) => updateDraftField(item.id, 'amount', e.target.value)}
                    />
                    <select
                      className="input unit-select"
                      value={item.unit}
                      onChange={(e) => updateDraftField(item.id, 'unit', e.target.value)}
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <button className="btn-icon" onClick={() => removeDraftItem(item.id)} aria-label="Remove">✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            className="btn btn-primary btn-block"
            onClick={() => (draftItems.length ? finalizeList() : setPage('checkout'))}
            disabled={finalizing}
          >
            {finalizing ? 'Saving…' : 'Proceed to checkout'}
          </button>
        </section>
        </>
        )}

        <footer className="footer">
          <span className="muted small">
            Not you? <button className="link-btn" onClick={() => setName('')}>Change name</button>
          </span>
        </footer>
      </div>
    </div>
  )
}

function HistoryView({ history }) {
  if (history === null) {
    return <p className="muted">Loading buy history…</p>
  }
  if (history.length === 0) {
    return <p className="muted">No completed trips yet. Once you tap "Purchase completed," trips show up here.</p>
  }

  return (
    <section>
      {history.map((trip) => {
        const when = trip.completedAt?.toDate
          ? trip.completedAt.toDate().toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'Just now'
        return (
          <details key={trip.id} className="category-block">
            <summary className="category-heading">
              <span>🧾</span> {when}
              <span className="category-count">by {trip.completedBy}</span>
            </summary>
            <div className="history-trip">
              <div className="history-group">
                <p className="muted small history-label">✅ Bought ({trip.purchased.length})</p>
                {trip.purchased.length === 0 ? (
                  <p className="muted small">Nothing bought this trip.</p>
                ) : (
                  <ul className="list">
                    {trip.purchased.map((item, i) => (
                      <li key={i} className="item">
                        <span className="item-name">{item.name}</span>
                        {item.qty && <span className="item-qty">{item.qty}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {trip.unavailable.length > 0 && (
                <div className="history-group">
                  <p className="muted small history-label">❌ Not available ({trip.unavailable.length})</p>
                  <ul className="list">
                    {trip.unavailable.map((item, i) => (
                      <li key={i} className="item">
                        <span className="item-name">{item.name}</span>
                        {item.qty && <span className="item-qty">{item.qty}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )
      })}
    </section>
  )
}

function NameForm({ onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="add-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit(value.trim())
      }}
    >
      <input
        className="input name-input"
        placeholder="Your name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button className="btn btn-primary" type="submit">Continue</button>
    </form>
  )
}
