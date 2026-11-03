/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   MAIN DASHBOARD CONTROLLER
   File: js/dashboard.js
========================================================= */

'use strict';

const CryptoDashboard = {

  config: {
    defaultSymbol: 'BTCUSDT',
    defaultTimeframe: '1d',
    refreshInterval: 30000,
    candleLimit: 500
  },

  state: {
    symbol: 'BTCUSDT',
    timeframe: '1d',
    chart: null,
    initialized: false,
    refreshing: false,
    lastUpdated: null,
    refreshTimer: null,
    marketData: null,
    selectedCoin: null
  },

  elements: {},

  init() {
    if (this.state.initialized) return;

    console.info('Initializing Crypto Intelligence Terminal...');

    this.cacheElements();
    this.bindEvents();
    this.initializeChart();
    this.loadInitialMarket();

    this.state.initialized = true;

    this.startAutoRefresh();

    console.info('Dashboard initialized.');
  },

  cacheElements() {
    const selectors = {
      chart: '#main-chart',
      symbol: '#selected-symbol',
      price: '#selected-price',
      change: '#selected-change',
      volume: '#selected-volume',
      marketCap: '#selected-market-cap',
      signal: '#selected-signal',
      timeframe: '#timeframe-selector',
      coinSearch: '#coin-search',
      marketTable: '#market-table',
      lastUpdated: '#last-updated',
      refresh: '#refresh-market',
      loading: '#dashboard-loading'
    };

    Object.entries(selectors).forEach(([key, selector]) => {
      this.elements[key] = document.querySelector(selector);
    });
  },

  bindEvents() {
    document.addEventListener('click', event => {
      const coin = event.target.closest('[data-symbol]');

      if (coin) {
        const symbol = coin.dataset.symbol;

        if (symbol) {
          this.selectCoin(symbol);
        }
      }

      const timeframe = event.target.closest('[data-timeframe]');

      if (timeframe) {
        this.changeTimeframe(timeframe.dataset.timeframe);
      }

      const indicator = event.target.closest('[data-indicator]');

      if (indicator) {
        this.toggleIndicator(
          indicator.dataset.indicator,
          indicator
        );
      }
    });

    if (this.elements.timeframe) {
      this.elements.timeframe.addEventListener(
        'change',
        event => this.changeTimeframe(event.target.value)
      );
    }

    if (this.elements.coinSearch) {
      this.elements.coinSearch.addEventListener(
        'input',
        event => this.filterCoins(event.target.value)
      );
    }

    if (this.elements.refresh) {
      this.elements.refresh.addEventListener(
        'click',
        () => this.refreshMarket()
      );
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopAutoRefresh();
      } else {
        this.startAutoRefresh();
        this.refreshMarket();
      }
    });
  },

  initializeChart() {
    if (
      !this.elements.chart ||
      typeof CryptoChartEngine === 'undefined'
    ) {
      console.warn('Chart engine or chart container unavailable.');
      return;
    }

    this.state.chart = CryptoChartEngine.create(
      this.elements.chart,
      {
        symbol: this.state.symbol,
        timeframe: this.state.timeframe,
        height: 560,

        callbacks: {
          onCrosshairMove: data => {
            this.updateChartDetails(data);
          },

          onTimeframeChange: timeframe => {
            this.state.timeframe = timeframe;
          }
        }
      }
    );

    this.state.chart.setIndicators({
      ema20: true,
      ema50: true,
      ema200: true,
      bollinger: true,
      volume: true,
      rsi: true,
      macd: true
    });
  },

  async loadInitialMarket() {
    await this.refreshMarket();
  },

  async refreshMarket() {
    if (this.state.refreshing) return;

    this.state.refreshing = true;

    this.setLoading(true);

    try {
      await Promise.all([
        this.loadMarketOverview(),
        this.loadSelectedCoin()
      ]);

      this.state.lastUpdated = new Date();

      this.updateLastUpdated();

    } catch (error) {
      console.error('Market refresh failed:', error);

      this.notify(
        'Unable to refresh market data. Please try again.',
        'error'
      );

    } finally {
      this.state.refreshing = false;
      this.setLoading(false);
    }
  },

  async loadMarketOverview() {
    if (
      typeof CryptoMarketScanner === 'undefined'
    ) {
      return;
    }

    const result = await CryptoMarketScanner.scan();

    this.state.marketData = result;

    this.renderMarketTable(result);
  },

  async loadSelectedCoin() {
    if (
      typeof CryptoMarketData === 'undefined' ||
      !this.state.chart
    ) {
      return;
    }

    const candles = await CryptoMarketData.getBinanceCandles(
      this.state.symbol,
      this.state.timeframe,
      this.config.candleLimit
    );

    if (!Array.isArray(candles) || !candles.length) {
      throw new Error('No historical candles received.');
    }

    this.state.chart.setData(candles);

    this.updateSelectedCoinDisplay(candles);
    this.calculateSignal(candles);
  },

  async selectCoin(symbol) {
    if (!symbol || symbol === this.state.symbol) return;

    this.state.symbol = symbol;

    if (this.state.chart) {
      this.state.chart.setSymbol(symbol);
    }

    if (this.elements.symbol) {
      this.elements.symbol.textContent = symbol;
    }

    try {
      await this.loadSelectedCoin();

    } catch (error) {
      console.error('Coin selection failed:', error);

      this.notify(
        'Unable to load ' + symbol,
        'error'
      );
    }
  },

  async changeTimeframe(timeframe) {
    const allowed = [
      '1m',
      '5m',
      '15m',
      '30m',
      '1h',
      '4h',
      '1d',
      '1w',
      '1M'
    ];

    if (!allowed.includes(timeframe)) return;

    this.state.timeframe = timeframe;

    if (this.state.chart) {
      this.state.chart.setTimeframe(timeframe);
    }

    try {
      await this.loadSelectedCoin();
    } catch (error) {
      console.error('Timeframe update failed:', error);
    }
  },

  updateSelectedCoinDisplay(candles) {
    if (!candles || !candles.length) return;

    const latest = candles[candles.length - 1];

    const previous = candles.length > 1
      ? candles[candles.length - 2]
      : latest;

    const change = previous.close
      ? ((latest.close - previous.close) /
          previous.close) * 100
      : 0;

    this.setText('symbol', this.state.symbol);

    this.setText(
      'price',
      this.formatCurrency(latest.close)
    );

    this.setText(
      'change',
      (change >= 0 ? '+' : '') +
      change.toFixed(2) + '%'
    );

    this.setText(
      'volume',
      latest.volume.toLocaleString()
    );

    if (this.elements.change) {
      this.elements.change.style.color =
        change >= 0 ? '#00d69a' : '#ff526e';
    }
  },

  calculateSignal(candles) {
    if (
      typeof CryptoSignalEngine === 'undefined'
    ) {
      return;
    }

    const signal = CryptoSignalEngine.analyze(candles);

    if (!signal) return;

    this.state.selectedCoin = signal;

    this.renderSignal(signal);
  },

  renderSignal(signal) {
    if (!this.elements.signal) return;

    const action = String(
      signal.action || signal.signal || 'HOLD'
    ).toUpperCase();

    const colors = {
      BUY: '#00d69a',
      SELL: '#ff526e',
      HOLD: '#ffd166'
    };

    this.elements.signal.textContent = action;

    this.elements.signal.style.color =
      colors[action] || colors.HOLD;

    const confidence = document.querySelector(
      '#signal-confidence'
    );

    if (confidence) {
      const value = Number(signal.confidence);

      confidence.textContent =
        Number.isFinite(value)
          ? value.toFixed(1) + '%'
          : 'N/A';
    }

    const explanation = document.querySelector(
      '#signal-explanation'
    );

    if (explanation) {
      explanation.textContent =
        signal.reason ||
        signal.explanation ||
        'Based on available technical indicators.';
    }
  },

  updateChartDetails(data) {
    const element = document.querySelector(
      '#chart-crosshair-details'
    );

    if (!element || !data.candle) return;

    const candle = data.candle;

    element.textContent = [
      'O: ' + this.formatCurrency(candle.open),
      'H: ' + this.formatCurrency(candle.high),
      'L: ' + this.formatCurrency(candle.low),
      'C: ' + this.formatCurrency(candle.close)
    ].join('  |  ');
  },

  renderMarketTable(result) {
    if (!this.elements.marketTable) return;

    const coins = Array.isArray(result)
      ? result
      : result && Array.isArray(result.coins)
        ? result.coins
        : [];

    if (!coins.length) return;

    const fragment = document.createDocumentFragment();

    coins.forEach((coin, index) => {
      const row = document.createElement('tr');

      const symbol = coin.symbol || '--';
      const price = Number(coin.price);
      const change = Number(coin.change24h);

      const cells = [
        String(index + 1),
        symbol,
        Number.isFinite(price)
          ? this.formatCurrency(price)
          : '--',
        Number.isFinite(change)
          ? change.toFixed(2) + '%'
          : '--'
      ];

      cells.forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      });

      if (Number.isFinite(change)) {
        row.lastElementChild.style.color =
          change >= 0 ? '#00d69a' : '#ff526e';
      }

      row.dataset.symbol = symbol;
      row.style.cursor = 'pointer';

      fragment.appendChild(row);
    });

    this.elements.marketTable.replaceChildren(fragment);
  },

  filterCoins(query) {
    const search = String(query || '').toLowerCase();

    document.querySelectorAll(
      '#market-table tr[data-symbol]'
    ).forEach(row => {
      const matches =
        row.dataset.symbol.toLowerCase().includes(search);

      row.style.display = matches ? '' : 'none';
    });
  },

  toggleIndicator(name, button) {
    if (!this.state.chart) return;

    const allowed = [
      'ema20',
      'ema50',
      'ema200',
      'bollinger',
      'volume',
      'rsi',
      'macd'
    ];

    if (!allowed.includes(name)) return;

    const current =
      this.state.chart.getChart().indicators[name];

    this.state.chart.setIndicators({
      [name]: !current
    });

    if (button) {
      button.classList.toggle('active', !current);
    }
  },

  updateLastUpdated() {
    if (!this.elements.lastUpdated) return;

    this.elements.lastUpdated.textContent =
      this.state.lastUpdated.toLocaleTimeString();
  },

  setLoading(loading) {
    if (!this.elements.loading) return;

    this.elements.loading.style.display =
      loading ? 'block' : 'none';
  },

  setText(element, value) {
    if (!this.elements[element]) return;

    this.elements[element].textContent = value;
  },

  formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value < 1 ? 8 : 2
    }).format(value);
  },

  notify(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }

    console[type === 'error' ? 'error' : 'info'](message);
  },

  startAutoRefresh() {
    this.stopAutoRefresh();

    this.state.refreshTimer = setInterval(() => {
      if (!document.hidden) {
        this.refreshMarket();
      }
    }, this.config.refreshInterval);
  },

  stopAutoRefresh() {
    if (this.state.refreshTimer) {
      clearInterval(this.state.refreshTimer);
      this.state.refreshTimer = null;
    }
  },

  destroy() {
    this.stopAutoRefresh();

    if (this.state.chart) {
      this.state.chart.destroy();
      this.state.chart = null;
    }

    this.state.initialized = false;
  }

};

document.addEventListener('DOMContentLoaded', () => {
  CryptoDashboard.init();
});

window.CryptoDashboard = CryptoDashboard;

console.info('Crypto Intelligence Terminal dashboard loaded.');
