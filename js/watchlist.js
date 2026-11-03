/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   PERSONAL WATCHLIST
   File: js/watchlist.js
========================================================= */

'use strict';

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const WATCHLIST_CONFIG = {
  storageKey: 'crypto_intelligence_watchlist',

  maximumCoins: 50
};

/* ---------------------------------------------------------
   WATCHLIST STATE
--------------------------------------------------------- */

const Watchlist = {
  coins: [],

  initialized: false
};

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function watchlistElement(id) {
  return document.getElementById(id);
}

function watchlistEscape(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character]
  );
}

function watchlistCurrency(value) {
  if (!Number.isFinite(Number(value))) return '--';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number(value) < 1 ? 6 : 2
  }).format(value);
}

/* ---------------------------------------------------------
   SAVE WATCHLIST
--------------------------------------------------------- */

function saveWatchlist() {
  try {
    localStorage.setItem(
      WATCHLIST_CONFIG.storageKey,
      JSON.stringify(Watchlist.coins)
    );

    return true;

  } catch (error) {
    console.error('Watchlist storage error:', error);

    return false;
  }
}

/* ---------------------------------------------------------
   LOAD WATCHLIST
--------------------------------------------------------- */

function loadWatchlist() {
  try {
    const stored = localStorage.getItem(
      WATCHLIST_CONFIG.storageKey
    );

    if (!stored) {
      Watchlist.coins = ['BTC', 'ETH', 'SOL'].map(
        symbol => ({
          symbol,
          favorite: true,
          addedAt: Date.now()
        })
      );

      saveWatchlist();

      return Watchlist.coins;
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      throw new Error('Invalid saved watchlist.');
    }

    Watchlist.coins = parsed
      .filter(item =>
        item &&
        typeof item.symbol === 'string'
      )
      .slice(0, WATCHLIST_CONFIG.maximumCoins);

    return Watchlist.coins;

  } catch (error) {
    console.error('Unable to load watchlist:', error);

    Watchlist.coins = [];

    return [];
  }
}

/* ---------------------------------------------------------
   FIND MARKET COIN
--------------------------------------------------------- */

function findMarketCoin(symbol) {
  if (!window.CryptoDashboard) return null;

  const state = window.CryptoDashboard;

  if (typeof state.getState !== 'function') {
    return null;
  }

  const marketCoins = state.marketCoins || [];

  return marketCoins.find(
    coin => coin.symbol === symbol
  ) || null;
}

/* ---------------------------------------------------------
   ADD COIN
--------------------------------------------------------- */

function addToWatchlist(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return false;
  }

  symbol = symbol.trim().toUpperCase();

  const existing = Watchlist.coins.find(
    coin => coin.symbol === symbol
  );

  if (existing) {
    return false;
  }

  if (
    Watchlist.coins.length >=
    WATCHLIST_CONFIG.maximumCoins
  ) {
    alert('Watchlist limit reached.');

    return false;
  }

  Watchlist.coins.push({
    symbol,

    favorite: false,

    addedAt: Date.now()
  });

  saveWatchlist();

  renderWatchlist();

  return true;
}

/* ---------------------------------------------------------
   REMOVE COIN
--------------------------------------------------------- */

function removeFromWatchlist(symbol) {
  Watchlist.coins = Watchlist.coins.filter(
    coin => coin.symbol !== symbol
  );

  saveWatchlist();

  renderWatchlist();
}

/* ---------------------------------------------------------
   TOGGLE FAVORITE
--------------------------------------------------------- */

function toggleFavorite(symbol) {
  const coin = Watchlist.coins.find(
    item => item.symbol === symbol
  );

  if (!coin) return;

  coin.favorite = !coin.favorite;

  saveWatchlist();

  renderWatchlist();
}

/* ---------------------------------------------------------
   CHECK MEMBERSHIP
--------------------------------------------------------- */

function isInWatchlist(symbol) {
  return Watchlist.coins.some(
    coin => coin.symbol === symbol
  );
}

/* ---------------------------------------------------------
   GET CURRENT MARKET DATA
--------------------------------------------------------- */

function getWatchlistMarketData() {
  const marketCoins =
    window.CryptoDashboard &&
    window.CryptoDashboard.getState
      ? window.CryptoDashboard.getState()
      : null;

  const source =
    window.CryptoDashboard &&
    window.CryptoDashboard.coins
      ? window.CryptoDashboard.coins
      : [];

  return source;
}

/* ---------------------------------------------------------
   RENDER WATCHLIST
--------------------------------------------------------- */

function renderWatchlist() {
  const container = watchlistElement('watchlist');

  if (!container) return;

  const marketCoins = getWatchlistMarketData();

  const html = Watchlist.coins.map(item => {
    const marketCoin = marketCoins.find(
      coin => coin.symbol === item.symbol
    );

    const name = marketCoin
      ? marketCoin.name
      : item.symbol;

    const price = marketCoin
      ? watchlistCurrency(marketCoin.price)
      : '--';

    const change = marketCoin
      ? Number(marketCoin.change24h)
      : null;

    const changeText = change === null
      ? '--'
      : (change >= 0 ? '+' : '') +
        change.toFixed(2) + '%';

    const direction = change === null
      ? ''
      : change >= 0
        ? 'positive'
        : 'negative';

    return `
      <div class="watchlist-item">

        <button
          type="button"
          class="watchlist-coin"
          data-select="${watchlistEscape(item.symbol)}"
        >
          <strong>${watchlistEscape(item.symbol)}</strong>

          <span>${watchlistEscape(name)}</span>
        </button>

        <div class="watchlist-price">
          <strong>${price}</strong>

          <span class="${direction}">
            ${changeText}
          </span>
        </div>

        <button
          type="button"
          class="watchlist-favorite"
          data-favorite="${watchlistEscape(item.symbol)}"
          aria-label="Toggle favorite"
        >
          ${item.favorite ? '★' : '☆'}
        </button>

        <button
          type="button"
          class="watchlist-remove"
          data-remove="${watchlistEscape(item.symbol)}"
          aria-label="Remove coin"
        >
          ×
        </button>

      </div>
    `;
  }).join('');

  container.innerHTML = html ||
    '<p class="empty-watchlist">Your watchlist is empty.</p>';

  bindWatchlistEvents();

  const count = watchlistElement('watchlistCount');

  if (count) {
    count.textContent = Watchlist.coins.length;
  }
}

/* ---------------------------------------------------------
   WATCHLIST EVENTS
--------------------------------------------------------- */

function bindWatchlistEvents() {
  const container = watchlistElement('watchlist');

  if (!container) return;

  container.querySelectorAll('[data-select]').forEach(button => {
    button.addEventListener('click', () => {
      const symbol = button.dataset.select;

      if (window.CryptoDashboard) {
        window.CryptoDashboard.selectCoin(symbol);
      }
    });
  });

  container.querySelectorAll('[data-favorite]').forEach(button => {
    button.addEventListener('click', () => {
      toggleFavorite(button.dataset.favorite);
    });
  });

  container.querySelectorAll('[data-remove]').forEach(button => {
    button.addEventListener('click', () => {
      removeFromWatchlist(button.dataset.remove);
    });
  });
}

/* ---------------------------------------------------------
   ADD CURRENT COIN
--------------------------------------------------------- */

function addSelectedCoinToWatchlist() {
  const symbol =
    window.CryptoDashboard &&
    window.CryptoDashboard.getState
      ? window.CryptoDashboard.getState().selectedCoin
      : null;

  if (!symbol) return false;

  return addToWatchlist(symbol);
}

/* ---------------------------------------------------------
   WATCHLIST SEARCH
--------------------------------------------------------- */

function initializeWatchlistSearch() {
  const input = watchlistElement('watchlistSearch');

  if (!input) return;

  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;

    const symbol = input.value.trim().toUpperCase();

    if (!symbol) return;

    const marketCoins = getWatchlistMarketData();

    const coin = marketCoins.find(
      item =>
        item.symbol === symbol ||
        item.name.toUpperCase() === symbol
    );

    if (!coin) {
      alert('Coin not found in the loaded market list.');

      return;
    }

    addToWatchlist(coin.symbol);

    input.value = '';
  });
}

/* ---------------------------------------------------------
   UPDATE MARKET PRICES
--------------------------------------------------------- */

function updateWatchlistPrices() {
  renderWatchlist();
}

/* ---------------------------------------------------------
   INITIALIZE
--------------------------------------------------------- */

function initializeWatchlist() {
  if (Watchlist.initialized) return;

  loadWatchlist();

  initializeWatchlistSearch();

  renderWatchlist();

  Watchlist.initialized = true;

  console.info('Watchlist initialized.');
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoWatchlist = {
  initializeWatchlist,

  addToWatchlist,

  removeFromWatchlist,

  toggleFavorite,

  isInWatchlist,

  renderWatchlist,

  updateWatchlistPrices,

  addSelectedCoinToWatchlist,

  getCoins() {
    return [...Watchlist.coins];
  },

  clear() {
    Watchlist.coins = [];

    saveWatchlist();

    renderWatchlist();
  }
};

/* ---------------------------------------------------------
   START
--------------------------------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeWatchlist
  );
} else {
  initializeWatchlist();
}

console.info(
  'Crypto Intelligence Terminal watchlist loaded.'
);
