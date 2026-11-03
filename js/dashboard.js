/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   MAIN DASHBOARD CONTROLLER
   File: js/dashboard.js
========================================================= */

'use strict';

/* ---------------------------------------------------------
   DASHBOARD STATE
--------------------------------------------------------- */

const Dashboard = {
  coins: [],
  selectedCoin: 'BTC',

  searchQuery: '',

  refreshInterval: null,

  refreshing: false,

  lastUpdated: null,

  market: {},

  selectedRange: '1D',
  selectedInterval: '1h'
};

/* ---------------------------------------------------------
   DOM HELPERS
--------------------------------------------------------- */

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);

  if (element) {
    element.textContent = value;
  }
}

function formatCurrency(value) {
  if (!Number.isFinite(Number(value))) return '--';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number(value) < 1 ? 6 : 2
  }).format(value);
}

function formatCompact(value) {
  if (!Number.isFinite(Number(value))) return '--';

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercentage(value) {
  if (!Number.isFinite(Number(value))) return '--';

  return (value >= 0 ? '+' : '') +
    Number(value).toFixed(2) + '%';
}

/* ---------------------------------------------------------
   SAFE HTML
--------------------------------------------------------- */

function escapeHTML(value) {
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

/* ---------------------------------------------------------
   CONNECTION STATUS
--------------------------------------------------------- */

function setConnectionStatus(status, message) {
  const element = getElement('connectionStatus');

  if (!element) return;

  element.textContent = message || status;

  element.dataset.status = status;

  element.className = 'connection-status ' + status;
}

/* ---------------------------------------------------------
   LOAD MARKET DATA
--------------------------------------------------------- */

async function loadMarketData() {
  try {
    setConnectionStatus(
      'loading',
      'Connecting to market data...'
    );

    const coins = await window.CryptoAPI.getTopCoins(50);

    if (!Array.isArray(coins)) {
      throw new Error('Invalid market response.');
    }

    Dashboard.coins = coins;

    Dashboard.lastUpdated = new Date();

    renderCoinTable();

    updateMarketStatistics(coins);

    setConnectionStatus(
      'connected',
      'Market data connected'
    );

    return coins;

  } catch (error) {
    console.error('Market data error:', error);

    setConnectionStatus(
      'error',
      'Market data unavailable'
    );

    return [];
  }
}

/* ---------------------------------------------------------
   RENDER TOP 50 TABLE
--------------------------------------------------------- */

function renderCoinTable() {
  const table = getElement('coinTable');

  if (!table) return;

  const filtered = Dashboard.coins.filter(coin => {
    const query = Dashboard.searchQuery.toLowerCase();

    return (
      String(coin.name || '').toLowerCase().includes(query) ||
      String(coin.symbol || '').toLowerCase().includes(query)
    );
  });

  table.innerHTML = filtered.map((coin, index) => {
    const symbol = escapeHTML(coin.symbol);

    const name = escapeHTML(coin.name);

    const price = Number(coin.price);

    const change = Number(coin.change24h);

    const positive = change >= 0;

    const selected =
      coin.symbol === Dashboard.selectedCoin;

    return `
      <tr
        class="coin-row ${selected ? 'selected' : ''}"
        data-symbol="${symbol}"
        tabindex="0"
        role="button"
        aria-label="Select ${name}"
      >
        <td>${index + 1}</td>

        <td class="coin-name">
          <strong>${symbol}</strong>
          <span>${name}</span>
        </td>

        <td>${formatCurrency(price)}</td>

        <td class="${positive ? 'positive' : 'negative'}">
          ${formatPercentage(change)}
        </td>

        <td>
          ${formatCompact(coin.marketCap)}
        </td>

        <td>
          ${formatCompact(coin.volume24h)}
        </td>
      </tr>
    `;
  }).join('');

  table.querySelectorAll('.coin-row').forEach(row => {
    const select = () => {
      selectCoin(row.dataset.symbol);
    };

    row.addEventListener('click', select);

    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });
}

/* ---------------------------------------------------------
   MARKET STATISTICS
--------------------------------------------------------- */

function updateMarketStatistics(coins) {
  if (!coins.length) return;

  const marketCap = coins.reduce(
    (sum, coin) => sum + (Number(coin.marketCap) || 0),
    0
  );

  const totalVolume = coins.reduce(
    (sum, coin) => sum + (Number(coin.volume24h) || 0),
    0
  );

  const positive = coins.filter(
    coin => Number(coin.change24h) > 0
  ).length;

  const negative = coins.filter(
    coin => Number(coin.change24h) < 0
  ).length;

  setText('marketCap', formatCurrency(marketCap));

  setText('marketVolume', formatCurrency(totalVolume));

  setText('advancingCoins', positive);

  setText('decliningCoins', negative);

  const btc = coins.find(
    coin => coin.symbol === 'BTC'
  );

  if (btc) {
    setText('btcPrice', formatCurrency(btc.price));

    setText(
      'btcChange',
      formatPercentage(btc.change24h)
    );
  }
}

/* ---------------------------------------------------------
   SELECT CRYPTOCURRENCY
--------------------------------------------------------- */

async function selectCoin(symbol) {
  const coin = Dashboard.coins.find(
    item => item.symbol === symbol
  );

  if (!coin) return;

  Dashboard.selectedCoin = symbol;

  setText('selectedCoinName', coin.name);

  setText('selectedCoinSymbol', symbol);

  setText('selectedCoinPrice', formatCurrency(coin.price));

  setText(
    'selectedCoinChange',
    formatPercentage(coin.change24h)
  );

  renderCoinTable();

  try {
    setConnectionStatus(
      'loading',
      'Loading ' + symbol + ' chart...'
    );

    await window.CryptoCharts.loadCryptoChart(
      symbol,
      Dashboard.selectedRange,
      Dashboard.selectedInterval
    );

    setConnectionStatus(
      'connected',
      'Market data connected'
    );

  } catch (error) {
    console.error('Coin selection error:', error);
  }
}

/* ---------------------------------------------------------
   UPDATE TRADING SIGNAL
--------------------------------------------------------- */

function updateTradingSignal(indicators) {
  try {
    const result =
      window.TradingSignals.generateTradingSignal(
        indicators
      );

    Dashboard.lastSignal = result;

    renderTradingSignal(result);

    return result;

  } catch (error) {
    console.error('Signal calculation error:', error);

    setText('tradingSignal', 'INSUFFICIENT DATA');

    return null;
  }
}

/* ---------------------------------------------------------
   RENDER SIGNAL
--------------------------------------------------------- */

function renderTradingSignal(result) {
  if (!result) return;

  const signalElement = getElement('tradingSignal');

  if (signalElement) {
    signalElement.textContent = result.signal;

    signalElement.className =
      'trading-signal ' +
      result.signal.toLowerCase().replaceAll(' ', '-');
  }

  setText('signalScore', result.score + '/100');

  setText('trendDirection', result.trend);

  setText('signalAgreement', result.agreement + '%');

  setText(
    'signalPrice',
    formatCurrency(result.price)
  );

  setText(
    'stopLoss',
    result.risk.stopLoss === null
      ? '--'
      : formatCurrency(result.risk.stopLoss)
  );

  setText(
    'takeProfit',
    result.risk.takeProfit === null
      ? '--'
      : formatCurrency(result.risk.takeProfit)
  );

  setText(
    'riskReward',
    result.risk.riskReward === null
      ? '--'
      : '1:' + result.risk.riskReward.toFixed(2)
  );

  setText(
    'signalWarning',
    result.warning || ''
  );

  renderIndicatorSummary(result.indicators);
}

/* ---------------------------------------------------------
   RENDER INDICATOR SUMMARY
--------------------------------------------------------- */

function renderIndicatorSummary(indicators) {
  const container = getElement('indicatorSummary');

  if (!container) return;

  container.innerHTML = Object.entries(indicators)
    .map(([name, result]) => {
      const direction = result.direction;

      return `
        <div class="indicator-item">
          <span>${escapeHTML(name)}</span>
          <strong class="${direction}">
            ${direction.toUpperCase()}
          </strong>
        </div>
      `;
    }).join('');
}

/* ---------------------------------------------------------
   CHANGE HISTORICAL RANGE
--------------------------------------------------------- */

async function selectHistoricalRange(range) {
  Dashboard.selectedRange = range;

  document.querySelectorAll('[data-range]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.range === range
    );
  });

  try {
    await window.CryptoCharts.changeChartRange(
      range,
      Dashboard.selectedInterval
    );

  } catch (error) {
    console.error('Range update failed:', error);
  }
}

/* ---------------------------------------------------------
   CHANGE CANDLE INTERVAL
--------------------------------------------------------- */

async function selectInterval(interval) {
  Dashboard.selectedInterval = interval;

  document.querySelectorAll('[data-interval]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.interval === interval
    );
  });

  try {
    await window.CryptoCharts.changeChartRange(
      Dashboard.selectedRange,
      interval
    );

  } catch (error) {
    console.error('Interval update failed:', error);
  }
}

/* ---------------------------------------------------------
   SEARCH COINS
--------------------------------------------------------- */

function initializeCoinSearch() {
  const search = getElement('coinSearch');

  if (!search) return;

  search.addEventListener('input', event => {
    Dashboard.searchQuery = event.target.value.trim();

    renderCoinTable();
  });
}

/* ---------------------------------------------------------
   INITIALIZE RANGE BUTTONS
--------------------------------------------------------- */

function initializeRangeButtons() {
  document.querySelectorAll('[data-range]').forEach(button => {
    button.addEventListener('click', () => {
      selectHistoricalRange(button.dataset.range);
    });
  });

  document.querySelectorAll('[data-interval]').forEach(button => {
    button.addEventListener('click', () => {
      selectInterval(button.dataset.interval);
    });
  });
}

/* ---------------------------------------------------------
   REFRESH DASHBOARD
--------------------------------------------------------- */

async function refreshDashboard() {
  if (Dashboard.refreshing) return;

  Dashboard.refreshing = true;

  try {
    const previousSelection = Dashboard.selectedCoin;

    await loadMarketData();

    if (previousSelection) {
      const selected = Dashboard.coins.find(
        coin => coin.symbol === previousSelection
      );

      if (selected) {
        setText(
          'selectedCoinPrice',
          formatCurrency(selected.price)
        );

        setText(
          'selectedCoinChange',
          formatPercentage(selected.change24h)
        );
      }
    }

  } finally {
    Dashboard.refreshing = false;
  }
}

/* ---------------------------------------------------------
   AUTOMATIC REFRESH
--------------------------------------------------------- */

function startAutoRefresh(seconds = 30) {
  stopAutoRefresh();

  Dashboard.refreshInterval = setInterval(
    refreshDashboard,
    seconds * 1000
  );
}

function stopAutoRefresh() {
  if (Dashboard.refreshInterval) {
    clearInterval(Dashboard.refreshInterval);

    Dashboard.refreshInterval = null;
  }
}

/* ---------------------------------------------------------
   MAIN INITIALIZATION
--------------------------------------------------------- */

async function initializeDashboard() {
  console.info(
    'Initializing Crypto Intelligence Terminal...'
  );

  initializeCoinSearch();

  initializeRangeButtons();

  await loadMarketData();

  const defaultCoin = Dashboard.coins.find(
    coin => coin.symbol === 'BTC'
  ) || Dashboard.coins[0];

  if (defaultCoin) {
    await selectCoin(defaultCoin.symbol);
  }

  startAutoRefresh(30);

  console.info(
    'Crypto Intelligence Terminal initialized.'
  );
}

/* ---------------------------------------------------------
   CLEANUP
--------------------------------------------------------- */

window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoDashboard = {
  initializeDashboard,

  loadMarketData,

  refreshDashboard,

  selectCoin,

  selectHistoricalRange,

  selectInterval,

  updateTradingSignal,

  renderTradingSignal,

  renderCoinTable,

  startAutoRefresh,

  stopAutoRefresh,

  getState() {
    return {
      selectedCoin: Dashboard.selectedCoin,

      selectedRange: Dashboard.selectedRange,

      selectedInterval: Dashboard.selectedInterval,

      lastUpdated: Dashboard.lastUpdated
    };
  }
};

/* ---------------------------------------------------------
   START APPLICATION
--------------------------------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeDashboard
  );
} else {
  initializeDashboard();
}

console.info(
  'Crypto Intelligence Terminal dashboard controller loaded.'
);
