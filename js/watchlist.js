/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   CRYPTOCURRENCY WATCHLIST
   File: js/watchlist.js
========================================================= */

'use strict';

const CryptoWatchlist = {

  coins: [],
  initialized: false,
  refreshTimer: null,

  config: {
    storageKey: 'cit-watchlist',
    refreshInterval: 30000,
    maxCoins: 50
  },

  init() {
    if (this.initialized) return;

    this.load();
    this.bindEvents();
    this.render();
    this.refreshPrices();
    this.startAutoRefresh();

    this.initialized = true;

    console.info('Crypto watchlist initialized.');
  },

  add(symbol, name = '') {
    symbol = String(symbol || '').trim().toUpperCase();

    if (!symbol) {
      throw new Error('Enter a cryptocurrency symbol.');
    }

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
      throw new Error('Invalid cryptocurrency symbol.');
    }

    if (this.coins.some(coin => coin.symbol === symbol)) {
      return false;
    }

    if (this.coins.length >= this.config.maxCoins) {
      throw new Error('Watchlist limit reached.');
    }

    const coin = {
      symbol,
      name: String(name || symbol),
      addedAt: Date.now(),
      price: null,
      change24h: null,
      loading: true
    };

    this.coins.push(coin);

    this.save();
    this.render();
    this.refreshCoin(symbol);

    return coin;
  },

  remove(symbol) {
    this.coins = this.coins.filter(
      coin => coin.symbol !== symbol
    );

    this.save();
    this.render();
  },

  has(symbol) {
    return this.coins.some(
      coin => coin.symbol === String(symbol).toUpperCase()
    );
  },

  toggle(symbol, name = '') {
    if (this.has(symbol)) {
      this.remove(symbol);
      return false;
    }

    this.add(symbol, name);
    return true;
  },

  async refreshCoin(symbol) {
    if (typeof CryptoMarketData === 'undefined') return;

    const coin = this.coins.find(
      item => item.symbol === symbol
    );

    if (!coin) return;

    try {
      const result = await CryptoMarketData.getPrice(symbol);

      const price = Number(
        typeof result === 'object'
          ? result.price
          : result
      );

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Invalid market price.');
      }

      coin.price = price;
      coin.loading = false;

      if (typeof CryptoMarketData.get24HourChange === 'function') {
        const change = Number(
          CryptoMarketData.get24HourChange(symbol)
        );

        coin.change24h = Number.isFinite(change)
          ? change
          : null;
      }

      this.save();
      this.render();

    } catch (error) {
      coin.loading = false;
      console.warn('Watchlist update failed:', symbol, error);
      this.render();
    }
  },

  async refreshPrices() {
    await Promise.all(
      this.coins.map(coin =>
        this.refreshCoin(coin.symbol)
      )
    );
  },

  startAutoRefresh() {
    this.stopAutoRefresh();

    this.refreshTimer = setInterval(() => {
      if (!document.hidden) {
        this.refreshPrices();
      }
    }, this.config.refreshInterval);
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  sort(method = 'symbol') {
    const methods = {
      symbol: (a, b) =>
        a.symbol.localeCompare(b.symbol),

      price: (a, b) =>
        (b.price || 0) - (a.price || 0),

      change: (a, b) =>
        (b.change24h || 0) - (a.change24h || 0),

      added: (a, b) =>
        a.addedAt - b.addedAt
    };

    if (methods[method]) {
      this.coins.sort(methods[method]);
      this.render();
    }
  },

  bindEvents() {
    document.addEventListener('click', event => {

      const removeButton = event.target.closest(
        '[data-watchlist-remove]'
      );

      if (removeButton) {
        this.remove(removeButton.dataset.watchlistRemove);
        return;
      }

      const selectButton = event.target.closest(
        '[data-watchlist-select]'
      );

      if (selectButton) {
        const symbol = selectButton.dataset.watchlistSelect;

        if (window.CryptoDashboard) {
          CryptoDashboard.selectCoin(symbol);
        }

        return;
      }

      const addButton = event.target.closest(
        '[data-watchlist-add]'
      );

      if (addButton) {
        const symbol = addButton.dataset.watchlistAdd;

        try {
          this.add(symbol);

          if (window.showNotification) {
            window.showNotification(
              symbol + ' added to watchlist.',
              'success'
            );
          }
        } catch (error) {
          if (window.showNotification) {
            window.showNotification(error.message, 'error');
          }
        }
      }
    });

    const form = document.querySelector('#watchlist-form');

    if (form) {
      form.addEventListener('submit', event => {
        event.preventDefault();

        const input = form.querySelector(
          '[name="symbol"]'
        );

        if (!input) return;

        try {
          this.add(input.value);
          input.value = '';

          if (window.showNotification) {
            window.showNotification(
              'Cryptocurrency added.',
              'success'
            );
          }
        } catch (error) {
          if (window.showNotification) {
            window.showNotification(error.message, 'error');
          }
        }
      });
    }

    const sortSelect = document.querySelector(
      '#watchlist-sort'
    );

    if (sortSelect) {
      sortSelect.addEventListener('change', event => {
        this.sort(event.target.value);
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopAutoRefresh();
      } else {
        this.startAutoRefresh();
        this.refreshPrices();
      }
    });
  },

  render() {
    const container = document.querySelector(
      '#watchlist-container'
    );

    if (!container) return;

    const fragment = document.createDocumentFragment();

    if (!this.coins.length) {
      const empty = document.createElement('p');

      empty.className = 'watchlist-empty';
      empty.textContent =
        'Your watchlist is empty. Add a cryptocurrency to start tracking.';

      fragment.appendChild(empty);
      container.replaceChildren(fragment);

      this.updateCount();
      return;
    }

    this.coins.forEach(coin => {
      const row = document.createElement('div');

      row.className = 'watchlist-row';

      const name = document.createElement('span');
      name.className = 'watchlist-symbol';
      name.textContent = coin.symbol;

      const price = document.createElement('span');
      price.className = 'watchlist-price';

      price.textContent = coin.loading
        ? 'Loading...'
        : coin.price === null
          ? 'Unavailable'
          : this.formatPrice(coin.price);

      const change = document.createElement('span');
      change.className = 'watchlist-change';

      if (coin.change24h === null) {
        change.textContent = '--';
      } else {
        change.textContent =
          (coin.change24h >= 0 ? '+' : '') +
          coin.change24h.toFixed(2) + '%';

        change.classList.add(
          coin.change24h >= 0 ? 'positive' : 'negative'
        );
      }

      const select = document.createElement('button');
      select.type = 'button';
      select.textContent = 'Chart';
      select.dataset.watchlistSelect = coin.symbol;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.dataset.watchlistRemove = coin.symbol;

      row.append(
        name,
        price,
        change,
        select,
        remove
      );

      fragment.appendChild(row);
    });

    container.replaceChildren(fragment);

    this.updateCount();
  },

  updateCount() {
    const counter = document.querySelector(
      '#watchlist-count'
    );

    if (counter) {
      counter.textContent = this.coins.length;
    }
  },

  formatPrice(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value < 1 ? 8 : 2
    }).format(value);
  },

  getCoins() {
    return this.coins.map(coin => ({ ...coin }));
  },

  save() {
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(this.coins)
      );
    } catch (error) {
      console.warn('Watchlist storage failed:', error);
    }
  },

  load() {
    try {
      const stored = localStorage.getItem(
        this.config.storageKey
      );

      if (!stored) return;

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        this.coins = parsed
          .filter(coin =>
            coin &&
            typeof coin.symbol === 'string'
          )
          .slice(0, this.config.maxCoins);
      }
    } catch (error) {
      console.warn('Could not restore watchlist:', error);
      this.coins = [];
    }
  },

  destroy() {
    this.stopAutoRefresh();
    this.initialized = false;
  }

};

window.CryptoWatchlist = CryptoWatchlist;

document.addEventListener('DOMContentLoaded', () => {
  CryptoWatchlist.init();
});

console.info('Crypto watchlist module loaded.');
