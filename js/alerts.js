/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   MARKET ALERT ENGINE
   File: js/alerts.js
========================================================= */

'use strict';

const ALERT_CONFIG = {
  storageKey: 'crypto_intelligence_alerts',
  historyKey: 'crypto_intelligence_alert_history',
  maximumAlerts: 100,
  maximumHistory: 200,
  pollingInterval: 30000
};

const CryptoAlerts = {
  alerts: [],
  history: [],
  timer: null,
  initialized: false,
  previousPrices: {},
  previousIndicators: {},
  triggered: new Set()
};

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function alertElement(id) {
  return document.getElementById(id);
}

function alertEscape(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[char]
  );
}

function alertCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 6
  }).format(value);
}

function alertId() {
  return crypto.randomUUID();
}

/* ---------------------------------------------------------
   STORAGE
--------------------------------------------------------- */

function saveAlerts() {
  try {
    localStorage.setItem(
      ALERT_CONFIG.storageKey,
      JSON.stringify(CryptoAlerts.alerts)
    );

    localStorage.setItem(
      ALERT_CONFIG.historyKey,
      JSON.stringify(CryptoAlerts.history)
    );

  } catch (error) {
    console.error('Unable to save alerts:', error);
  }
}

function loadAlerts() {
  try {
    CryptoAlerts.alerts = JSON.parse(
      localStorage.getItem(ALERT_CONFIG.storageKey) || '[]'
    );

    CryptoAlerts.history = JSON.parse(
      localStorage.getItem(ALERT_CONFIG.historyKey) || '[]'
    );

    if (!Array.isArray(CryptoAlerts.alerts)) {
      CryptoAlerts.alerts = [];
    }

    if (!Array.isArray(CryptoAlerts.history)) {
      CryptoAlerts.history = [];
    }

  } catch (error) {
    CryptoAlerts.alerts = [];
    CryptoAlerts.history = [];
  }
}

/* ---------------------------------------------------------
   CREATE ALERT
--------------------------------------------------------- */

function createAlert({
  symbol,
  type,
  threshold = null,
  enabled = true
}) {
  symbol = String(symbol || '').trim().toUpperCase();

  const validTypes = [
    'price_above',
    'price_below',
    'price_change',
    'rsi_above',
    'rsi_below',
    'macd_bullish',
    'macd_bearish'
  ];

  if (!symbol || !validTypes.includes(type)) {
    return false;
  }

  if (CryptoAlerts.alerts.length >= ALERT_CONFIG.maximumAlerts) {
    alert('Maximum number of alerts reached.');
    return false;
  }

  if (
    ['price_above', 'price_below', 'price_change',
     'rsi_above', 'rsi_below'].includes(type) &&
    (!Number.isFinite(Number(threshold)) || Number(threshold) <= 0)
  ) {
    alert('Please enter a valid positive threshold.');
    return false;
  }

  const alertItem = {
    id: alertId(),
    symbol,
    type,
    threshold: threshold === null ? null : Number(threshold),
    enabled: Boolean(enabled),
    createdAt: Date.now(),
    lastTriggered: null
  };

  CryptoAlerts.alerts.push(alertItem);

  saveAlerts();
  renderAlerts();

  return alertItem;
}

/* ---------------------------------------------------------
   REMOVE ALERT
--------------------------------------------------------- */

function removeAlert(id) {
  CryptoAlerts.alerts = CryptoAlerts.alerts.filter(
    item => item.id !== id
  );

  CryptoAlerts.triggered.delete(id);

  saveAlerts();
  renderAlerts();
}

/* ---------------------------------------------------------
   ENABLE / DISABLE ALERT
--------------------------------------------------------- */

function toggleAlert(id) {
  const item = CryptoAlerts.alerts.find(
    alert => alert.id === id
  );

  if (!item) return;

  item.enabled = !item.enabled;

  CryptoAlerts.triggered.delete(id);

  saveAlerts();
  renderAlerts();
}

/* ---------------------------------------------------------
   NOTIFICATIONS
--------------------------------------------------------- */

async function requestAlertPermission() {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const permission = await Notification.requestPermission();

  return permission === 'granted';
}

function sendAlertNotification(item, message) {
  if (
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    const notification = new Notification(
      'Crypto Intelligence Terminal',
      {
        body: message,
        tag: item.id
      }
    );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  console.info('[CRYPTO ALERT]', message);
}

/* ---------------------------------------------------------
   ALERT HISTORY
--------------------------------------------------------- */

function recordAlert(item, message, value) {
  const event = {
    id: alertId(),
    alertId: item.id,
    symbol: item.symbol,
    type: item.type,
    message,
    value,
    timestamp: Date.now()
  };

  CryptoAlerts.history.unshift(event);

  CryptoAlerts.history = CryptoAlerts.history.slice(
    0,
    ALERT_CONFIG.maximumHistory
  );

  item.lastTriggered = event.timestamp;

  saveAlerts();

  renderAlertHistory();

  sendAlertNotification(item, message);
}

/* ---------------------------------------------------------
   PRICE MONITORING
--------------------------------------------------------- */

function evaluatePriceAlert(item, price) {
  const previous = CryptoAlerts.previousPrices[item.symbol];

  switch (item.type) {
    case 'price_above':
      return previous !== undefined &&
        previous <= item.threshold &&
        price > item.threshold;

    case 'price_below':
      return previous !== undefined &&
        previous >= item.threshold &&
        price < item.threshold;

    case 'price_change':
      if (previous === undefined || previous === 0) {
        return false;
      }

      return Math.abs(
        ((price - previous) / previous) * 100
      ) >= item.threshold;

    default:
      return false;
  }
}

/* ---------------------------------------------------------
   INDICATOR MONITORING
--------------------------------------------------------- */

function evaluateIndicatorAlert(item, indicators) {
  if (!indicators) return false;

  const rsiValues = indicators.rsi || [];

  const rsi = rsiValues.length
    ? rsiValues[rsiValues.length - 1]
    : null;

  const macd = indicators.macd || {};

  const macdValues = macd.macd || [];
  const signalValues = macd.signal || [];

  const lastMacd = macdValues[macdValues.length - 1];
  const previousMacd = macdValues[macdValues.length - 2];

  const lastSignal = signalValues[signalValues.length - 1];
  const previousSignal = signalValues[signalValues.length - 2];

  switch (item.type) {
    case 'rsi_above':
      return Number.isFinite(rsi) &&
        rsi >= item.threshold;

    case 'rsi_below':
      return Number.isFinite(rsi) &&
        rsi <= item.threshold;

    case 'macd_bullish':
      return Number.isFinite(previousMacd) &&
        Number.isFinite(previousSignal) &&
        Number.isFinite(lastMacd) &&
        Number.isFinite(lastSignal) &&
        previousMacd <= previousSignal &&
        lastMacd > lastSignal;

    case 'macd_bearish':
      return Number.isFinite(previousMacd) &&
        Number.isFinite(previousSignal) &&
        Number.isFinite(lastMacd) &&
        Number.isFinite(lastSignal) &&
        previousMacd >= previousSignal &&
        lastMacd < lastSignal;

    default:
      return false;
  }
}

/* ---------------------------------------------------------
   ALERT MESSAGE
--------------------------------------------------------- */

function getAlertMessage(item, price, indicators) {
  const descriptions = {
    price_above: 'crossed above',
    price_below: 'crossed below',
    price_change: 'moved by at least',
    rsi_above: 'RSI reached',
    rsi_below: 'RSI reached',
    macd_bullish: 'has a bullish MACD crossover',
    macd_bearish: 'has a bearish MACD crossover'
  };

  if (item.type.startsWith('macd_')) {
    return item.symbol + ' ' + descriptions[item.type] + '.';
  }

  if (item.type.startsWith('rsi_')) {
    const values = indicators.rsi;

    const rsi = values[values.length - 1];

    return item.symbol + ' RSI ' +
      descriptions[item.type] + ' ' +
      rsi.toFixed(2);
  }

  return item.symbol + ' ' +
    descriptions[item.type] + ' ' +
    item.threshold +
    (item.type === 'price_change' ? '%' : '') +
    '. Current price: ' + alertCurrency(price);
}

/* ---------------------------------------------------------
   EVALUATE ALERTS
--------------------------------------------------------- */

function evaluateAlerts(symbol, price, indicators = null) {
  if (!Number.isFinite(Number(price))) return;

  const currentPrice = Number(price);

  CryptoAlerts.alerts
    .filter(item =>
      item.enabled &&
      item.symbol === symbol
    )
    .forEach(item => {
      let triggered = false;

      if (
        ['price_above', 'price_below', 'price_change']
          .includes(item.type)
      ) {
        triggered = evaluatePriceAlert(item, currentPrice);
      } else {
        triggered = evaluateIndicatorAlert(item, indicators);
      }

      if (triggered && !CryptoAlerts.triggered.has(item.id)) {
        const message = getAlertMessage(
          item,
          currentPrice,
          indicators
        );

        recordAlert(item, message, currentPrice);

        CryptoAlerts.triggered.add(item.id);
      }
    });

  CryptoAlerts.previousPrices[symbol] = currentPrice;
}

/* ---------------------------------------------------------
   MONITOR MARKET
--------------------------------------------------------- */

async function monitorMarket() {
  if (!window.CryptoDashboard) return;

  const coins = window.CryptoDashboard.coins || [];

  if (!coins.length) return;

  coins.forEach(coin => {
    evaluateAlerts(
      coin.symbol,
      Number(coin.price),
      coin.symbol === window.CryptoDashboard.getState().selectedCoin
        ? window.CryptoCharts &&
          window.CryptoCharts.getState().initialized
          ? window.CryptoDashboard.lastIndicators
          : null
        : null
    );
  });
}

/* ---------------------------------------------------------
   RENDER ALERTS
--------------------------------------------------------- */

function renderAlerts() {
  const container = alertElement('alertsList');

  if (!container) return;

  if (!CryptoAlerts.alerts.length) {
    container.innerHTML =
      '<p class="empty-alerts">No alerts configured.</p>';

    return;
  }

  container.innerHTML = CryptoAlerts.alerts.map(item => {
    return `
      <div class="alert-item">

        <div class="alert-description">
          <strong>${alertEscape(item.symbol)}</strong>

          <span>${alertEscape(item.type.replaceAll('_', ' '))}</span>

          <small>
            Threshold: ${item.threshold ?? 'Indicator crossover'}
          </small>
        </div>

        <label>
          <input
            type="checkbox"
            data-toggle-alert="${alertEscape(item.id)}"
            ${item.enabled ? 'checked' : ''}
          >
          Enabled
        </label>

        <button
          type="button"
          data-delete-alert="${alertEscape(item.id)}"
        >
          Delete
        </button>

      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-toggle-alert]').forEach(input => {
    input.addEventListener('change', () => {
      toggleAlert(input.dataset.toggleAlert);
    });
  });

  container.querySelectorAll('[data-delete-alert]').forEach(button => {
    button.addEventListener('click', () => {
      removeAlert(button.dataset.deleteAlert);
    });
  });
}

/* ---------------------------------------------------------
   RENDER ALERT HISTORY
--------------------------------------------------------- */

function renderAlertHistory() {
  const container = alertElement('alertHistory');

  if (!container) return;

  container.innerHTML = CryptoAlerts.history.map(event => `
    <div class="alert-history-item">

      <strong>${alertEscape(event.symbol)}</strong>

      <span>${alertEscape(event.message)}</span>

      <time>
        ${new Date(event.timestamp).toLocaleString()}
      </time>

    </div>
  `).join('') || '<p>No triggered alerts yet.</p>';
}

/* ---------------------------------------------------------
   ALERT FORM
--------------------------------------------------------- */

function initializeAlertForm() {
  const form = alertElement('alertForm');

  if (!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();

    const symbol = alertElement('alertSymbol').value;

    const type = alertElement('alertType').value;

    const thresholdInput = alertElement('alertThreshold');

    const threshold = [
      'macd_bullish',
      'macd_bearish'
    ].includes(type)
      ? null
      : Number(thresholdInput.value);

    const result = createAlert({
      symbol,
      type,
      threshold
    });

    if (result) {
      form.reset();
    }
  });
}

/* ---------------------------------------------------------
   MONITORING TIMER
--------------------------------------------------------- */

function startAlertMonitoring() {
  stopAlertMonitoring();

  monitorMarket();

  CryptoAlerts.timer = setInterval(
    monitorMarket,
    ALERT_CONFIG.pollingInterval
  );
}

function stopAlertMonitoring() {
  if (CryptoAlerts.timer) {
    clearInterval(CryptoAlerts.timer);

    CryptoAlerts.timer = null;
  }
}

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

async function initializeAlerts() {
  if (CryptoAlerts.initialized) return;

  loadAlerts();

  initializeAlertForm();

  renderAlerts();

  renderAlertHistory();

  startAlertMonitoring();

  CryptoAlerts.initialized = true;

  console.info('Crypto alert system initialized.');
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoAlertSystem = {
  initializeAlerts,

  createAlert,

  removeAlert,

  toggleAlert,

  evaluateAlerts,

  monitorMarket,

  requestAlertPermission,

  startAlertMonitoring,

  stopAlertMonitoring,

  renderAlerts,

  renderAlertHistory,

  getAlerts() {
    return [...CryptoAlerts.alerts];
  },

  getHistory() {
    return [...CryptoAlerts.history];
  },

  clearHistory() {
    CryptoAlerts.history = [];

    saveAlerts();

    renderAlertHistory();
  }
};

/* ---------------------------------------------------------
   START
--------------------------------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeAlerts
  );
} else {
  initializeAlerts();
}

console.info(
  'Crypto Intelligence Terminal alert engine loaded.'
);
