/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   PORTFOLIO MANAGEMENT
   File: js/portfolio.js
========================================================= */

'use strict';

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const PORTFOLIO_CONFIG = {
  storageKey: 'crypto_intelligence_portfolio',

  maximumHoldings: 200,

  currency: 'USD'
};

/* ---------------------------------------------------------
   PORTFOLIO STATE
--------------------------------------------------------- */

const Portfolio = {
  holdings: [],

  initialized: false
};

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function portfolioElement(id) {
  return document.getElementById(id);
}

function portfolioCurrency(value) {
  if (!Number.isFinite(Number(value))) return '--';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: PORTFOLIO_CONFIG.currency,
    maximumFractionDigits: 2
  }).format(value);
}

function portfolioNumber(value) {
  return Number.isFinite(Number(value))
    ? Number(value)
    : 0;
}

function portfolioEscape(value) {
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
   STORAGE
--------------------------------------------------------- */

function savePortfolio() {
  try {
    localStorage.setItem(
      PORTFOLIO_CONFIG.storageKey,
      JSON.stringify(Portfolio.holdings)
    );

    return true;

  } catch (error) {
    console.error('Portfolio save failed:', error);

    return false;
  }
}

function loadPortfolio() {
  try {
    const saved = localStorage.getItem(
      PORTFOLIO_CONFIG.storageKey
    );

    Portfolio.holdings = saved
      ? JSON.parse(saved)
      : [];

    if (!Array.isArray(Portfolio.holdings)) {
      Portfolio.holdings = [];
    }

    return Portfolio.holdings;

  } catch (error) {
    console.error('Portfolio loading failed:', error);

    Portfolio.holdings = [];

    return [];
  }
}

/* ---------------------------------------------------------
   MARKET DATA
--------------------------------------------------------- */

function getPortfolioMarketCoins() {
  if (
    window.CryptoDashboard &&
    window.CryptoDashboard.coins
  ) {
    return window.CryptoDashboard.coins;
  }

  return [];
}

function getPortfolioMarketPrice(symbol) {
  const coin = getPortfolioMarketCoins().find(
    item => item.symbol === symbol
  );

  return coin
    ? portfolioNumber(coin.price)
    : null;
}

/* ---------------------------------------------------------
   ADD HOLDING
--------------------------------------------------------- */

function addPortfolioHolding(
  symbol,
  quantity,
  purchasePrice
) {
  symbol = String(symbol || '').trim().toUpperCase();

  quantity = Number(quantity);

  purchasePrice = Number(purchasePrice);

  if (!symbol) {
    alert('Please enter a cryptocurrency symbol.');
    return false;
  }

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    alert('Enter a valid quantity.');
    return false;
  }

  if (
    !Number.isFinite(purchasePrice) ||
    purchasePrice <= 0
  ) {
    alert('Enter a valid purchase price.');
    return false;
  }

  if (
    Portfolio.holdings.length >=
    PORTFOLIO_CONFIG.maximumHoldings
  ) {
    alert('Maximum portfolio entries reached.');
    return false;
  }

  const holding = {
    id: crypto.randomUUID(),

    symbol,

    quantity,

    purchasePrice,

    purchaseDate: new Date().toISOString(),

    addedAt: Date.now()
  };

  Portfolio.holdings.push(holding);

  savePortfolio();

  renderPortfolio();

  return true;
}

/* ---------------------------------------------------------
   REMOVE HOLDING
--------------------------------------------------------- */

function removePortfolioHolding(id) {
  Portfolio.holdings = Portfolio.holdings.filter(
    holding => holding.id !== id
  );

  savePortfolio();

  renderPortfolio();
}

/* ---------------------------------------------------------
   CALCULATE HOLDING VALUE
--------------------------------------------------------- */

function calculateHolding(holding) {
  const quantity = portfolioNumber(holding.quantity);

  const purchasePrice =
    portfolioNumber(holding.purchasePrice);

  const currentPrice =
    getPortfolioMarketPrice(holding.symbol);

  const invested = quantity * purchasePrice;

  const currentValue = currentPrice === null
    ? null
    : quantity * currentPrice;

  const profitLoss = currentValue === null
    ? null
    : currentValue - invested;

  const percentage = currentValue === null || invested === 0
    ? null
    : (profitLoss / invested) * 100;

  return {
    ...holding,

    currentPrice,

    invested,

    currentValue,

    profitLoss,

    percentage
  };
}

/* ---------------------------------------------------------
   CALCULATE PORTFOLIO TOTALS
--------------------------------------------------------- */

function calculatePortfolioTotals() {
  const holdings = Portfolio.holdings.map(
    calculateHolding
  );

  const invested = holdings.reduce(
    (sum, item) => sum + item.invested,
    0
  );

  const currentValue = holdings.reduce(
    (sum, item) =>
      sum + (item.currentValue ?? 0),
    0
  );

  const knownValue = holdings.reduce(
    (sum, item) =>
      sum + (item.currentValue === null ? 0 : item.currentValue),
    0
  );

  const profitLoss = currentValue - invested;

  const percentage = invested > 0
    ? (profitLoss / invested) * 100
    : 0;

  const unpricedHoldings = holdings.filter(
    item => item.currentValue === null
  ).length;

  return {
    holdings,

    invested,

    currentValue,

    knownValue,

    profitLoss,

    percentage,

    unpricedHoldings,

    complete: unpricedHoldings === 0
  };
}

/* ---------------------------------------------------------
   ASSET ALLOCATION
--------------------------------------------------------- */

function calculateAssetAllocation() {
  const totals = calculatePortfolioTotals();

  const grouped = {};

  totals.holdings.forEach(holding => {
    if (holding.currentValue === null) return;

    grouped[holding.symbol] =
      (grouped[holding.symbol] || 0) +
      holding.currentValue;
  });

  return Object.entries(grouped).map(
    ([symbol, value]) => ({
      symbol,

      value,

      percentage: totals.knownValue > 0
        ? (value / totals.knownValue) * 100
        : 0
    })
  ).sort((a, b) => b.value - a.value);
}

/* ---------------------------------------------------------
   RENDER PORTFOLIO SUMMARY
--------------------------------------------------------- */

function renderPortfolioSummary(totals) {
  const invested = portfolioElement('portfolioInvested');

  const value = portfolioElement('portfolioValue');

  const pnl = portfolioElement('portfolioPnL');

  const percentage = portfolioElement('portfolioReturn');

  if (invested) {
    invested.textContent = portfolioCurrency(
      totals.invested
    );
  }

  if (value) {
    value.textContent = portfolioCurrency(
      totals.knownValue
    );
  }

  if (pnl) {
    pnl.textContent = totals.unpricedHoldings
      ? portfolioCurrency(totals.profitLoss) + ' (partial)'
      : portfolioCurrency(totals.profitLoss);

    pnl.className =
      totals.profitLoss >= 0
        ? 'positive'
        : 'negative';
  }

  if (percentage) {
    percentage.textContent =
      totals.percentage.toFixed(2) + '%';

    percentage.className =
      totals.percentage >= 0
        ? 'positive'
        : 'negative';
  }

  const warning = portfolioElement(
    'portfolioWarning'
  );

  if (warning) {
    warning.textContent =
      totals.unpricedHoldings > 0
        ? 'Some holdings do not have current market prices. Portfolio valuation is incomplete.'
        : '';
  }
}

/* ---------------------------------------------------------
   RENDER HOLDINGS TABLE
--------------------------------------------------------- */

function renderPortfolioTable(totals) {
  const container = portfolioElement('portfolioTable');

  if (!container) return;

  if (!totals.holdings.length) {
    container.innerHTML =
      '<p class="empty-portfolio">No holdings added yet.</p>';

    return;
  }

  container.innerHTML = totals.holdings.map(
    holding => {
      const positive =
        holding.profitLoss !== null &&
        holding.profitLoss >= 0;

      return `
        <tr>
          <td>
            <strong>${portfolioEscape(holding.symbol)}</strong>
          </td>

          <td>
            ${holding.quantity}
          </td>

          <td>
            ${portfolioCurrency(holding.purchasePrice)}
          </td>

          <td>
            ${holding.currentPrice === null
              ? '--'
              : portfolioCurrency(holding.currentPrice)}
          </td>

          <td>
            ${portfolioCurrency(holding.invested)}
          </td>

          <td>
            ${holding.currentValue === null
              ? '--'
              : portfolioCurrency(holding.currentValue)}
          </td>

          <td class="${positive ? 'positive' : 'negative'}">
            ${holding.profitLoss === null
              ? '--'
              : portfolioCurrency(holding.profitLoss)}
          </td>

          <td class="${positive ? 'positive' : 'negative'}">
            ${holding.percentage === null
              ? '--'
              : holding.percentage.toFixed(2) + '%'}
          </td>

          <td>
            <button
              type="button"
              data-remove-holding="${portfolioEscape(holding.id)}"
              aria-label="Remove holding"
            >
              Remove
            </button>
          </td>
        </tr>
      `;
    }
  ).join('');

  container.querySelectorAll(
    '[data-remove-holding]'
  ).forEach(button => {
    button.addEventListener('click', () => {
      removePortfolioHolding(
        button.dataset.removeHolding
      );
    });
  });
}

/* ---------------------------------------------------------
   RENDER ASSET ALLOCATION
--------------------------------------------------------- */

function renderAssetAllocation() {
  const container = portfolioElement(
    'portfolioAllocation'
  );

  if (!container) return;

  const allocation = calculateAssetAllocation();

  if (!allocation.length) {
    container.innerHTML =
      '<p>No allocation data available.</p>';

    return;
  }

  container.innerHTML = allocation.map(item => `
    <div class="allocation-item">

      <div class="allocation-label">
        <strong>${portfolioEscape(item.symbol)}</strong>

        <span>
          ${item.percentage.toFixed(2)}%
        </span>
      </div>

      <div class="allocation-track">
        <div
          class="allocation-fill"
          style="width:${Math.min(item.percentage, 100)}%"
        ></div>
      </div>

      <small>
        ${portfolioCurrency(item.value)}
      </small>

    </div>
  `).join('');
}

/* ---------------------------------------------------------
   RENDER EVERYTHING
--------------------------------------------------------- */

function renderPortfolio() {
  const totals = calculatePortfolioTotals();

  renderPortfolioSummary(totals);

  renderPortfolioTable(totals);

  renderAssetAllocation();

  return totals;
}

/* ---------------------------------------------------------
   FORM INITIALIZATION
--------------------------------------------------------- */

function initializePortfolioForm() {
  const form = portfolioElement('portfolioForm');

  if (!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();

    const symbol = portfolioElement(
      'portfolioSymbol'
    ).value;

    const quantity = portfolioElement(
      'portfolioQuantity'
    ).value;

    const purchasePrice = portfolioElement(
      'portfolioPurchasePrice'
    ).value;

    const added = addPortfolioHolding(
      symbol,
      quantity,
      purchasePrice
    );

    if (added) {
      form.reset();
    }
  });
}

/* ---------------------------------------------------------
   EXPORT PORTFOLIO CSV
--------------------------------------------------------- */

function exportPortfolioCSV() {
  const totals = calculatePortfolioTotals();

  const rows = [
    [
      'Symbol',
      'Quantity',
      'Purchase Price',
      'Current Price',
      'Invested',
      'Current Value',
      'Profit Loss',
      'Return Percentage'
    ]
  ];

  totals.holdings.forEach(item => {
    rows.push([
      item.symbol,
      item.quantity,
      item.purchasePrice,
      item.currentPrice ?? '',
      item.invested,
      item.currentValue ?? '',
      item.profitLoss ?? '',
      item.percentage ?? ''
    ]);
  });

  const csv = rows.map(row =>
    row.map(value =>
      '"' + String(value).replace(/"/g, '""') + '"'
    ).join(',')
  ).join('\n');

  const blob = new Blob(
    [csv],
    { type: 'text/csv;charset=utf-8;' }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;

  link.download = 'crypto-portfolio.csv';

  link.click();

  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   INITIALIZE
--------------------------------------------------------- */

function initializePortfolio() {
  if (Portfolio.initialized) return;

  loadPortfolio();

  initializePortfolioForm();

  renderPortfolio();

  Portfolio.initialized = true;

  console.info(
    'Crypto Intelligence Terminal portfolio initialized.'
  );
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoPortfolio = {
  initializePortfolio,

  addPortfolioHolding,

  removePortfolioHolding,

  calculateHolding,

  calculatePortfolioTotals,

  calculateAssetAllocation,

  renderPortfolio,

  exportPortfolioCSV,

  getHoldings() {
    return [...Portfolio.holdings];
  },

  clearPortfolio() {
    Portfolio.holdings = [];

    savePortfolio();

    renderPortfolio();
  }
};

/* ---------------------------------------------------------
   START
--------------------------------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializePortfolio
  );
} else {
  initializePortfolio();
}

console.info(
  'Crypto Intelligence Terminal portfolio module loaded.'
);
