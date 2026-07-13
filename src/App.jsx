import { useEffect, useMemo, useState } from 'react'
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
import { COMMON_ITEMS } from './items'

// Everyone who opens this app with the same link shares ONE list.
// There is no login - your name is just a label stored on this device
// so the family can see who added or bought each item.
const ITEMS_COLLECTION = 'groceryItems'

// Items typed in via "Not on the list?" get saved here, so they become
// permanent tiles for the whole family - no code changes needed.
const CUSTOM_TILES_COLLECTION = 'customTiles'

const UNIT_OPTIONS = ['nos', 'kg', 'litres']

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

// Tries to split a stored qty string like "2 kg" back into amount + unit,
// so existing items can still be edited sensibly.
function splitQty(qtyString) {
  const trimmed = (qtyString || '').trim()
  if (!trimmed) return { amount: '', unit: UNIT_OPTIONS[0] }
  const match = trimmed.match(/^([\d.]+)\s*(kg|litres|nos)?$/i)
  if (match) {
    const unit = (match[2] || UNIT_OPTIONS[0]).toLowerCase()
    return { amount: match[1], unit: UNIT_OPTIONS.includes(unit) ? unit : UNIT_OPTIONS[0] }
  }
  // Doesn't match the amount+unit pattern (e.g. old free-text qty) - keep it
  // as-is in the amount box so nothing gets silently lost.
  return { amount: trimmed, unit: UNIT_OPTIONS[0] }
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
      setCustomTiles(snap.docs.map((d) => d.data().name))
    })
    return unsub
  }, [])

  // The full set of tiles shown in the grid: hardcoded items.js + anything
  // added by anyone through the "Not on the list?" box.
  const allTiles = useMemo(() => {
    const hardcodedNames = COMMON_ITEMS.map((i) => i.ta)
    const extra = customTiles.filter((tileName) => !hardcodedNames.includes(tileName))
    return [...hardcodedNames, ...extra]
  }, [customTiles])

  const pending = useMemo(() => (items || []).filter((i) => !i.bought), [items])
  const bought = useMemo(() => (items || []).filter((i) => i.bought), [items])

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

    // If this exact name isn't already a tile, save it so it shows up
    // as a permanent tile for the whole family from now on.
    if (!allTiles.includes(trimmed)) {
      try {
        await addDoc(collection(db, CUSTOM_TILES_COLLECTION), {
          name: trimmed,
          addedBy: name || 'Someone',
          createdAt: serverTimestamp(),
        })
      } catch (err) {
        console.error(err)
        // Not a big deal if this fails - the item is still in the draft list either way.
      }
    }
  }

  function updateDraftField(id, field, value) {
    setDraftItems((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)))
  }

  function removeDraftItem(id) {
    setDraftItems((prev) => prev.filter((d) => d.id !== id))
  }

  // This is the only place that writes to Firebase for new items now.
  // Items you tap in the grid first sit in your local draft above,
  // and only get pushed here once you tap "Move to buy list".
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

  async function updateItemQty(id, qty) {
    await updateDoc(doc(db, ITEMS_COLLECTION, id), { qty })
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
          <h1>🛒 Family Grocery List</h1>
          <span className="hello">Hi, {name}</span>
        </header>

        {error && <p className="error">{error}</p>}

        <section>
          <form
            className="add-form"
            onSubmit={addCustomItem}
          >
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
          <div className="item-grid">
            {allTiles.map((tileName) => {
              const selected = draftNames.has(tileName)
              return (
                <button
                  key={tileName}
                  type="button"
                  className={selected ? 'item-tile item-tile-selected' : 'item-tile'}
                  onClick={() => toggleItem(tileName)}
                >
                  <span className="tile-label">{tileName}</span>
                  <span className="tile-check">{selected ? '✓' : ''}</span>
                </button>
              )
            })}
          </div>
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
            onClick={finalizeList}
            disabled={!draftItems.length || finalizing}
          >
            {finalizing ? 'Saving…' : 'Move to buy list'}
          </button>
        </section>

        {items === null ? (
          <p className="muted">Loading shared list…</p>
        ) : (
          <>
            <section>
              <h2 className="section-title">To buy ({pending.length})</h2>
              {pending.length === 0 && <p className="muted">Nothing pending. Nice!</p>}
              <ul className="list">
                {pending.map((item) => (
                  <li key={item.id} className="item">
                    <label className="item-main">
                      <input type="checkbox" checked={false} onChange={() => toggleBought(item)} />
                      <span className="item-name">{item.name}</span>
                    </label>
                    <div className="item-meta">
                      <QtyEditor
                        qty={item.qty}
                        onCommit={(newQty) => updateItemQty(item.id, newQty)}
                      />
                      <span className="muted small">added by {item.addedBy}</span>
                      <button className="btn-icon" onClick={() => removeItem(item.id)} aria-label="Delete">✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {bought.length > 0 && (
              <section>
                <div className="section-title-row">
                  <h2 className="section-title">Bought ({bought.length})</h2>
                  <button className="btn btn-ghost" onClick={clearBought}>Clear bought</button>
                </div>
                <ul className="list">
                  {bought.map((item) => (
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
              </section>
            )}
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

function QtyEditor({ qty, onCommit }) {
  const initial = splitQty(qty)
  const [amount, setAmount] = useState(initial.amount)
  const [unit, setUnit] = useState(initial.unit)

  function commit(newAmount, newUnit) {
    const combined = combineQty(newAmount, newUnit)
    if (combined !== (qty || '')) onCommit(combined)
  }

  return (
    <>
      <input
        className="input qty-input-inline"
        placeholder="Qty"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => commit(amount, unit)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
        }}
      />
      <select
        className="input unit-select"
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value)
          commit(amount, e.target.value)
        }}
      >
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    </>
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
