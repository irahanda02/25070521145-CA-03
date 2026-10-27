import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API = 'http://localhost:5000/api'
const categories = ['All', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Jewellery']
const swatches = ['pink', 'blue', 'cream', 'rose', 'gold', 'black']
const emojiFor = {
  Tops: '👚',
  Bottoms: '👖',
  Shoes: '👠',
  Bags: '👜',
  Jewellery: '💎'
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('dw_token') || '')
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dw_user') || 'null')
    } catch {
      return null
    }
  })
  const [authMode, setAuthMode] = useState('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [clothes, setClothes] = useState([])
  const [outfits, setOutfits] = useState([])
  const [category, setCategory] = useState('All')
  const [activePage, setActivePage] = useState('closet')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [outfit, setOutfit] = useState([])
  const [liked, setLiked] = useState([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Tops')
  const [newColor, setNewColor] = useState('pink')
  const [newImage, setNewImage] = useState('')
  const [lookName, setLookName] = useState('My new look')

  const authHeaders = useMemo(
    () => token ? { Authorization: `Bearer ${token}` } : {},
    [token]
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function loadPrivateData() {
      setLoading(true)

      try {
        const [clothesResponse, looksResponse] = await Promise.all([
          fetch(`${API}/clothes`, { headers: authHeaders }),
          fetch(`${API}/outfits`, { headers: authHeaders })
        ])

        if (
          clothesResponse.status === 401 ||
          looksResponse.status === 401
        ) {
          logout('Your session expired. Please log in again.')
          return
        }

        if (!clothesResponse.ok) {
          throw new Error('Could not load your wardrobe.')
        }

        const clothingData = await clothesResponse.json()
        const looksData = looksResponse.ok
          ? await looksResponse.json()
          : []

        if (!cancelled) {
          setClothes(
            clothingData.map(item => ({
              ...item,
              id: item._id || item.id,
              emoji: item.emoji || emojiFor[item.category] || '👗'
            }))
          )

          setOutfits(Array.isArray(looksData) ? looksData : [])
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(
            `${error.message} Make sure the backend and MongoDB are running.`
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPrivateData()

    return () => {
      cancelled = true
    }
  }, [token])

  function logout(message = '') {
    localStorage.removeItem('dw_token')
    localStorage.removeItem('dw_user')

    setToken('')
    setUser(null)
    setClothes([])
    setOutfits([])
    setOutfit([])
    setAuthPassword('')
    setActivePage('closet')
    setNotice(message)
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)

    try {
      const endpoint = authMode === 'signup' ? 'register' : 'login'

      const payload = authMode === 'signup'
        ? {
            name: authName.trim(),
            email: authEmail.trim(),
            password: authPassword
          }
        : {
            email: authEmail.trim(),
            password: authPassword
          }

      const response = await fetch(`${API}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not sign in. Please check your details.'
        )
      }

      if (!data.token || !data.user) {
        throw new Error(
          'The server response is missing the login token or user. Check the backend API.'
        )
      }

      localStorage.setItem('dw_token', data.token)
      localStorage.setItem('dw_user', JSON.stringify(data.user))

      setToken(data.token)
      setUser(data.user)
      setAuthPassword('')
      setNotice(
        authMode === 'signup'
          ? 'Your wardrobe account is ready. Welcome! 🎀'
          : 'Welcome back to your wardrobe! 💗'
      )
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const filteredClothes = clothes.filter(
    item => category === 'All' || item.category === category
  )

  const currentItem = filteredClothes.length
    ? filteredClothes[currentIndex % filteredClothes.length]
    : null

  function addToLook(item) {
    setOutfit(previous =>
      previous.some(entry => entry.id === item.id)
        ? previous
        : [...previous, item]
    )

    setNotice(`${item.name} added to your outfit canvas ♡`)
  }

  function swipe(direction) {
    if (!currentItem) return

    if (direction === 'right') {
      addToLook(currentItem)

      setLiked(previous =>
        previous.includes(currentItem.id)
          ? previous
          : [...previous, currentItem.id]
      )
    }

    setCurrentIndex(index =>
      filteredClothes.length
        ? (index + 1) % filteredClothes.length
        : 0
    )
  }

  async function addClothing(event) {
    event.preventDefault()

    const payload = {
      name: newName.trim(),
      category: newCategory,
      color: newColor,
      image: newImage,
      emoji: emojiFor[newCategory] || '👗',
      type: 'custom'
    }

    try {
      const response = await fetch(`${API}/clothes`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Could not save this item.')
      }

      setClothes(previous => [
        ...previous,
        {
          ...payload,
          ...data,
          id: data._id || data.id,
          emoji: payload.emoji
        }
      ])

      setCategory('All')
      setCurrentIndex(0)
      setNewName('')
      setNewImage('')
      setShowAddForm(false)
      setNotice('Your new piece has joined the wardrobe! 🎀')
    } catch (error) {
      setNotice(`${error.message} Check that the backend is running.`)
    }
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setNotice('Please choose an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice('Please choose an image smaller than 5 MB.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => setNewImage(reader.result)
    reader.readAsDataURL(file)
  }

  async function saveLook() {
    if (!outfit.length) {
      setNotice('Add a few pieces to the canvas before saving your look.')
      return
    }

    try {
      const payload = {
        name: lookName.trim() || 'My outfit',
        items: outfit.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color,
          image: item.image || '',
          emoji: item.emoji || '👗'
        }))
      }

      const response = await fetch(`${API}/outfits`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Could not save the outfit.')
      }

      setOutfits(previous => [data, ...previous])
      setNotice('Your look has been saved to your account! 💌')
      setActivePage('looks')
    } catch (error) {
      setNotice(`${error.message} Check that the backend is running.`)
    }
  }

  async function deleteClothing(item) {
    if (!window.confirm(`Remove “${item.name}” from your wardrobe?`)) {
      return
    }

    try {
      const response = await fetch(`${API}/clothes/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Could not remove item.')
      }

      setClothes(previous =>
        previous.filter(entry => entry.id !== item.id)
      )

      setOutfit(previous =>
        previous.filter(entry => entry.id !== item.id)
      )

      setNotice('Piece removed from your wardrobe.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <section className="auth-art">
          <div className="auth-logo">୨୧ dear wardrobe.</div>
          <p className="eyebrow">YOUR PERSONAL STYLE DIARY</p>
          <h1>
            Your closet.
            <br />
            <em>Your story.</em>
          </h1>
          <p>
            A little love letter to getting dressed. Keep your favourite
            pieces, create outfits, and save every look you love.
          </p>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <p className="eyebrow">WELCOME TO YOUR STYLE SPACE</p>

            <h2>
              {authMode === 'signup'
                ? 'Create your account.'
                : 'Welcome back.'}
            </h2>

            <p className="auth-subtitle">
              {authMode === 'signup'
                ? 'Sign up to keep your wardrobe and outfits saved to your own account.'
                : 'Log in to open your personal wardrobe and saved looks.'}
            </p>

            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'signup' && (
                <label>
                  YOUR NAME
                  <input
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    autoComplete="name"
                    placeholder="What should we call you?"
                    required
                  />
                </label>
              )}

              <label>
                EMAIL ADDRESS
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                PASSWORD
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  autoComplete={
                    authMode === 'signup' ? 'new-password' : 'current-password'
                  }
                  minLength={8}
                  placeholder="At least 8 characters"
                  required
                />
              </label>

              {authError && (
                <div className="auth-error" role="alert">
                  {authError}
                </div>
              )}

              <button
                className="primary-button full-button"
                type="submit"
                disabled={authBusy}
              >
                {authBusy
                  ? 'ONE MOMENT…'
                  : authMode === 'signup'
                    ? 'CREATE MY ACCOUNT ♡'
                    : 'LOG IN TO MY WARDROBE ♡'}
              </button>
            </form>

            <p className="auth-switch">
              {authMode === 'signup'
                ? 'Already have an account?'
                : 'New to Dear Wardrobe?'}{' '}
              <button
                className="text-button"
                onClick={() => {
                  setAuthMode(authMode === 'signup' ? 'login' : 'signup')
                  setAuthError('')
                }}
              >
                {authMode === 'signup' ? 'Log in' : 'Create an account'}
              </button>
            </p>

            {notice && (
              <p className="auth-subtitle" role="status">
                {notice}
              </p>
            )}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="announcement">
        A LITTLE LOVE LETTER TO YOUR CLOSET <span>♡</span>
      </div>

      {/* Refined website header */}
      <header className="topbar">
        <div className="header-brand-row">
          <button
            className="brand"
            onClick={() => setActivePage('closet')}
            aria-label="Dear Wardrobe home"
          >
            <span className="brand-bow">୨୧</span>

            <span className="brand-copy">
              <span className="brand-name">
                dear wardrobe<span className="brand-dot">.</span>
              </span>

              <span className="brand-tagline">
                YOUR CLOSET, YOUR STORY.
              </span>
            </span>
          </button>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-link ${activePage === 'closet' ? 'active' : ''}`}
            onClick={() => setActivePage('closet')}
          >
            My Closet
          </button>

          <button
            className={`nav-link ${activePage === 'style' ? 'active' : ''}`}
            onClick={() => setActivePage('style')}
          >
            Swipe to Style
          </button>

          <button
            className={`nav-link ${activePage === 'canvas' ? 'active' : ''}`}
            onClick={() => setActivePage('canvas')}
          >
            Outfit Canvas
          </button>

          <button
            className={`nav-link ${activePage === 'looks' ? 'active' : ''}`}
            onClick={() => setActivePage('looks')}
          >
            Saved Looks
          </button>
        </nav>

        <div className="account-chip">
          <span className="account-name">
            ♡ {user?.name || user?.email || 'My Account'}
          </span>

          <button onClick={() => logout()}>
            Log Out
          </button>
        </div>
      </header>

      <main>
        <section className="welcome">
          <div className="welcome-copy">
            <p className="eyebrow">YOUR PERSONAL STYLE DIARY</p>

            <h1>
              Dear wardrobe,
              <br />
              <em>what are we wearing?</em>
            </h1>

            <p className="welcome-description">
              Every piece has a story. Mix your favourites, discover new
              combinations, and fall in love with your closet all over again.
            </p>

            <button
              className="primary-button"
              onClick={() => setActivePage('canvas')}
            >
              LET'S PUT A LOOK TOGETHER <span>↗</span>
            </button>
          </div>

          <div className="hero-art">
            <div className="hero-sticker sticker-one">
              LOVE
              <br />
              YOUR
              <br />
              LOOK ♡
            </div>

            <div className="hero-photo">
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85"
                alt="Fashion inspiration"
              />
            </div>

            <div className="hero-sticker sticker-two">
              THE
              <br />
              STYLE
              <br />
              DIARY ✳
            </div>

            <span className="hero-sparkle sparkle-one">✳</span>
            <span className="hero-sparkle sparkle-two">♡</span>
          </div>
        </section>

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              onClick={() => setNotice('')}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {loading && (
          <p className="empty-state">Opening your wardrobe… 💗</p>
        )}

        {activePage === 'closet' && (
          <section className="wardrobe-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE GOOD STUFF</p>
                <h2>
                  Your little <em>wardrobe</em>
                </h2>
              </div>

              <span className="piece-count">
                {clothes.length} PIECES & COUNTING ♡
              </span>
            </div>

            <div className="category-row">
              {categories.map(item => (
                <button
                  key={item}
                  className={`category-chip ${category === item ? 'selected' : ''}`}
                  onClick={() => {
                    setCategory(item)
                    setCurrentIndex(0)
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="clothing-grid">
              {filteredClothes.map(item => (
                <article className="clothing-card" key={item.id}>
                  <div className={`clothing-visual ${item.color || 'pink'}`}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <span className="clothing-emoji">
                        {item.emoji || emojiFor[item.category] || '👗'}
                      </span>
                    )}

                    <button
                      className={`heart-button ${liked.includes(item.id) ? 'loved' : ''}`}
                      onClick={() =>
                        setLiked(prev =>
                          prev.includes(item.id)
                            ? prev.filter(id => id !== item.id)
                            : [...prev, item.id]
                        )
                      }
                    >
                      {liked.includes(item.id) ? '♥' : '♡'}
                    </button>
                  </div>

                  <div className="clothing-info">
                    <span>{item.category}</span>
                    <h3>{item.name}</h3>

                    <button
                      className="add-to-look"
                      onClick={() => addToLook(item)}
                    >
                      ＋ ADD TO CANVAS
                    </button>{' '}

                    <button
                      className="add-to-look"
                      onClick={() => deleteClothing(item)}
                    >
                      REMOVE
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!loading && clothes.length === 0 && (
              <p className="empty-state">
                Your wardrobe is waiting for its first piece. Add something
                you love. 🎀
              </p>
            )}

            <button
              className="primary-button"
              onClick={() => setShowAddForm(true)}
            >
              ＋ ADD A PIECE
            </button>
          </section>
        )}

        {activePage === 'style' && (
          <section className="style-section">
            <p className="eyebrow">TRUST YOUR FASHION INSTINCT</p>
            <h2>
              Swipe your way to <em>the look.</em>
            </h2>

            <p className="style-intro">
              Love it? Choose the heart to add it to your outfit canvas. Not
              today? Skip it.
            </p>

            <div className="swipe-layout">
              <div className="swipe-card">
                {currentItem ? (
                  <>
                    <div
                      className={`swipe-visual ${currentItem.color || 'pink'}`}
                    >
                      {currentItem.image ? (
                        <img src={currentItem.image} alt={currentItem.name} />
                      ) : (
                        <span>
                          {currentItem.emoji ||
                            emojiFor[currentItem.category] ||
                            '👗'}
                        </span>
                      )}
                    </div>

                    <p className="eyebrow">{currentItem.category}</p>
                    <h3>{currentItem.name}</h3>

                    <div className="swipe-actions">
                      <button
                        className="swipe-no"
                        onClick={() => swipe('left')}
                      >
                        ✕
                      </button>

                      <span>KEEP OR SKIP?</span>

                      <button
                        className="swipe-yes"
                        onClick={() => swipe('right')}
                      >
                        ♥
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="empty-state">
                    Add pieces to your closet to start styling.
                  </p>
                )}
              </div>

              <aside className="outfit-preview">
                <p className="eyebrow">YOUR CURRENT LINEUP</p>
                <h3>
                  The look in progress <span>♡</span>
                </h3>

                {outfit.length ? (
                  outfit.map(item => (
                    <div className="outfit-item" key={item.id}>
                      <span>{item.emoji || '👗'}</span>

                      <div>
                        <small>{item.category}</small>
                        <p>{item.name}</p>
                      </div>

                      <button
                        onClick={() =>
                          setOutfit(prev =>
                            prev.filter(entry => entry.id !== item.id)
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">
                    Your next favourite outfit starts with one piece.
                  </p>
                )}

                <button
                  className="primary-button full-button"
                  onClick={() => setActivePage('canvas')}
                >
                  OPEN OUTFIT CANVAS ♡
                </button>
              </aside>
            </div>
          </section>
        )}

        {activePage === 'canvas' && (
          <section className="style-section">
            <p className="eyebrow">YOUR LITTLE DIGITAL STUDIO</p>
            <h2>
              Put together a <em>look.</em>
            </h2>

            <p className="style-intro">
              Choose pieces from My Closet to place them on this canvas, then
              save your outfit to your account.
            </p>

            <div className="canvas-board">
              <div className="canvas-header">
                <h3>Today's outfit board ♡</h3>
                <span className="piece-count">{outfit.length} PIECES</span>
              </div>

              {outfit.length ? (
                <div className="canvas-items">
                  {outfit.map(item => (
                    <article className="canvas-item" key={item.id}>
                      <div
                        className={`clothing-visual ${item.color || 'pink'}`}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} />
                        ) : (
                          <span className="clothing-emoji">
                            {item.emoji || '👗'}
                          </span>
                        )}
                      </div>

                      <h4>{item.name}</h4>
                      <p>{item.category}</p>

                      <button
                        onClick={() =>
                          setOutfit(prev =>
                            prev.filter(entry => entry.id !== item.id)
                          )
                        }
                      >
                        REMOVE FROM CANVAS ×
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="canvas-empty">
                  <div>
                    <div style={{ fontSize: 48 }}>୨୧</div>
                    <strong>Your canvas is waiting for a look.</strong>
                    <p>
                      Go to My Closet and press “Add to canvas” on pieces you
                      love.
                    </p>

                    <button
                      className="primary-button"
                      onClick={() => setActivePage('closet')}
                    >
                      BROWSE MY CLOSET ↗
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="canvas-save-row">
              <input
                value={lookName}
                onChange={e => setLookName(e.target.value)}
                aria-label="Outfit name"
                placeholder="Name this outfit"
              />

              <button className="primary-button" onClick={saveLook}>
                SAVE THIS LOOK ♡
              </button>
            </div>
          </section>
        )}

        {activePage === 'looks' && (
          <section className="style-section saved-section">
            <p className="eyebrow">A LOOK TO REMEMBER</p>
            <h2>
              Your outfit <em>love notes.</em>
            </h2>

            <p className="style-intro">
              Your saved looks are linked to your account and stored in your
              local MongoDB database.
            </p>

            {outfits.length ? (
              <div className="saved-look-list">
                {outfits.map((look, index) => (
                  <article
                    className="saved-look"
                    key={look._id || index}
                  >
                    <h3>{look.name || 'My outfit'} ♡</h3>

                    <div className="saved-look-items">
                      {(look.items || []).map((item, i) => (
                        <span key={item.id || i}>
                          {item.emoji || '👗'} {item.name}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="canvas-empty">
                <div>
                  <div style={{ fontSize: 44 }}>💌</div>
                  <p>
                    No saved looks yet. Create one on your outfit canvas.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => setActivePage('canvas')}
                  >
                    MAKE A LOOK ↗
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer>
        <div className="footer-brand">
          dear wardrobe<span>.</span> ♡
        </div>
        <p>A little love letter to getting dressed.</p>
        <span>MADE WITH LOVE & A LITTLE BIT OF GLITTER</span>
      </footer>

      {showAddForm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddForm(false)}
        >
          <section
            className="add-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowAddForm(false)}
            >
              ×
            </button>

            <p className="eyebrow">SOMETHING NEW</p>
            <h2>
              Add to your <em>wardrobe.</em>
            </h2>

            <p className="modal-description">
              This piece will be saved to your signed-in account.
            </p>

            <form onSubmit={addClothing}>
              <label>
                WHAT DO YOU CALL IT?
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. My favourite jeans"
                  required
                />
              </label>

              <label>
                THE CATEGORY
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                >
                  {categories
                    .filter(item => item !== 'All')
                    .map(item => (
                      <option key={item}>{item}</option>
                    ))}
                </select>
              </label>

              <label>
                UPLOAD A PHOTO (OPTIONAL)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                />
              </label>

              {newImage && (
                <img
                  className="upload-preview"
                  src={newImage}
                  alt="Clothing preview"
                />
              )}

              <label>
                THE COLOUR STORY
                <div className="swatches">
                  {swatches.map(color => (
                    <button
                      type="button"
                      key={color}
                      className={`swatch ${color} ${
                        newColor === color ? 'swatch-selected' : ''
                      }`}
                      onClick={() => setNewColor(color)}
                      aria-label={color}
                      title={color}
                    />
                  ))}
                </div>
              </label>

              <button
                className="primary-button full-button"
                type="submit"
              >
                ADD TO MY CLOSET ♡
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App