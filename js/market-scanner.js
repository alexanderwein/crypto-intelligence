/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   ADVANCED MARKET SCANNER
   File: js/market-scanner.js

   Scans supplied OHLCV market data.
   Technical analysis only. No guaranteed predictions.
========================================================= */

'use strict';

const CryptoMarketScanner = {

  config: {
    minimumCandles: 205,
    rsiPeriod: 14,
    emaShort: 20,
    emaMedium: 50,
    emaLong: 200,
    volumePeriod: 20,
    minimumScore: 60,
    buyThreshold: 65,
    sellThreshold: 35,
    refreshInterval: 60000
  },

  state: {
    coins: [],
    results: [],
    lastScan: null,
    filter: 'ALL',
    sort: 'score',
    scanning: false
  },

  timer: null,

  /* DATA VALIDATION */

  validateCandles(candles) {
    if (!Array.isArray(candles)) return [];

    return candles.filter(c => {
      return (
        Number.isFinite(Number(c.close)) &&
        Number(c.close) > 0 &&
        Number.isFinite(Number(c.high)) &&
        Number.isFinite(Number(c.low)) &&
        Number.isFinite(Number(c.open)) &&
        Number.isFinite(Number(c.volume)) &&
        Number(c.high) >= Number(c.low)
      );
    });
  },

  /* EMA */

  calculateEMA(values, period) {
    if (!Array.isArray(values) || values.length < period) {
      return [];
    }

    const multiplier = 2 / (period + 1);
    const result = [];

    let sum = 0;

    for (let i = 0; i < period; i++) {
      sum += values[i];
      result.push(null);
    }

    let previous = sum / period;
    result[period - 1] = previous;

    for (let i = period; i < values.length; i++) {
      previous =
        (values[i] - previous) * multiplier + previous;

      result.push(previous);
    }

    return result;
  },

  /* RSI */

  calculateRSI(values, period = 14) {
    if (!Array.isArray(values) || values.length <= period) {
      return [];
    }

    const result = Array(period).fill(null);

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const difference = values[i] - values[i - 1];

      gains += Math.max(difference, 0);
      losses += Math.max(-difference, 0);
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    const firstRSI = averageLoss === 0
      ? 100
      : 100 - 100 / (1 + averageGain / averageLoss);

    result.push(firstRSI);

    for (let i = period + 1; i < values.length; i++) {
      const difference = values[i] - values[i - 1];

      averageGain =
        (averageGain * (period - 1) +
        Math.max(difference, 0)) / period;

      averageLoss =
        (averageLoss * (period - 1) +
        Math.max(-difference, 0)) / period;

      const rsi = averageLoss === 0
        ? 100
        : 100 - 100 / (1 + averageGain / averageLoss);

      result.push(rsi);
    }

    return result;
  },

  /* MACD */

  calculateMACD(values) {
    const fast = this.calculateEMA(values, 12);
    const slow = this.calculateEMA(values, 26);

    if (!fast.length || !slow.length) {
      return null;
    }

    const macdLine = values.map((_, index) => {
      if (fast[index] === null || slow[index] === null) {
        return null;
      }

      return fast[index] - slow[index];
    });

    const validMACD = macdLine.filter(
      value => value !== null
    );

    const signalValues = this.calculateEMA(validMACD, 9);

    const signalLine = Array(macdLine.length).fill(null);

    const start = macdLine.length - signalValues.length;

    signalValues.forEach((value, index) => {
      signalLine[start + index] = value;
    });

    const histogram = macdLine.map((value, index) => {
      if (value === null || signalLine[index] === null) {
        return null;
      }

      return value - signalLine[index];
    });

    return {
      macd: macdLine,
      signal: signalLine,
      histogram
    };
  },

  /* RELATIVE VOLUME */

  calculateRelativeVolume(volumes, period = 20) {
    if (volumes.length < period + 1) return null;

    const recent = volumes.slice(-period - 1, -1);

    const average = recent.reduce(
      (sum, value) => sum + value,
      0
    ) / recent.length;

    if (!average) return null;

    return volumes[volumes.length - 1] / average;
  },

  /* PRICE MOMENTUM */

  calculateMomentum(values, period = 10) {
    if (values.length <= period) return null;

    const current = values[values.length - 1];
    const previous = values[values.length - 1 - period];

    return ((current / previous) - 1) * 100;
  },

  /* TECHNICAL ANALYSIS */

  analyzeCoin(coin) {
    const candles = this.validateCandles(coin.candles);

    if (candles.length < this.config.minimumCandles) {
      return {
        symbol: coin.symbol,
        name: coin.name,
        status: 'INSUFFICIENT_DATA',
        signal: 'HOLD',
        score: null,
        error: 'At least 205 valid candles are required.'
      };
    }

    const closes = candles.map(c => Number(c.close));
    const volumes = candles.map(c => Number(c.volume));

    const currentPrice = closes[closes.length - 1];

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);

    const rsiValues = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);

    const rsi = rsiValues[rsiValues.length - 1];

    const currentEMA20 = ema20[ema20.length - 1];
    const currentEMA50 = ema50[ema50.length - 1];
    const currentEMA200 = ema200[ema200.length - 1];

    const previousEMA20 = ema20[ema20.length - 2];
    const previousEMA50 = ema50[ema50.length - 2];

    const currentMACD = macd.macd[macd.macd.length - 1];
    const currentSignal = macd.signal[macd.signal.length - 1];

    const previousMACD = macd.macd[macd.macd.length - 2];
    const previousSignal = macd.signal[macd.signal.length - 2];

    const currentHistogram =
      macd.histogram[macd.histogram.length - 1];

    const previousHistogram =
      macd.histogram[macd.histogram.length - 2];

    const relativeVolume =
      this.calculateRelativeVolume(volumes, 20);

    const momentum = this.calculateMomentum(closes, 10);

    const conditions = [];

    let bullishScore = 0;
    let bearishScore = 0;

    /* EMA TREND */

    if (currentPrice > currentEMA20) {
      bullishScore += 10;
      conditions.push('Price above EMA20');
    } else {
      bearishScore += 10;
      conditions.push('Price below EMA20');
    }

    if (currentEMA20 > currentEMA50) {
      bullishScore += 10;
      conditions.push('EMA20 above EMA50');
    } else {
      bearishScore += 10;
      conditions.push('EMA20 below EMA50');
    }

    if (currentEMA50 > currentEMA200) {
      bullishScore += 15;
      conditions.push('EMA50 above EMA200');
    } else {
      bearishScore += 15;
      conditions.push('EMA50 below EMA200');
    }

    /* EMA CROSSOVER */

    if (
      previousEMA20 <= previousEMA50 &&
      currentEMA20 > currentEMA50
    ) {
      bullishScore += 10;
      conditions.push('Bullish EMA crossover');
    }

    if (
      previousEMA20 >= previousEMA50 &&
      currentEMA20 < currentEMA50
    ) {
      bearishScore += 10;
      conditions.push('Bearish EMA crossover');
    }

    /* RSI */

    if (rsi >= 50 && rsi < 70) {
      bullishScore += 10;
      conditions.push('Positive RSI momentum');
    }

    if (rsi < 30) {
      bullishScore += 8;
      conditions.push('Potentially oversold');
    }

    if (rsi >= 70) {
      bearishScore += 8;
      conditions.push('Potentially overbought');
    }

    if (rsi < 50 && rsi >= 30) {
      bearishScore += 5;
      conditions.push('Weak RSI momentum');
    }

    /* MACD */

    if (currentMACD > currentSignal) {
      bullishScore += 15;
      conditions.push('MACD bullish');
    } else {
      bearishScore += 15;
      conditions.push('MACD bearish');
    }

    if (
      previousMACD <= previousSignal &&
      currentMACD > currentSignal
    ) {
      bullishScore += 10;
      conditions.push('Bullish MACD crossover');
    }

    if (
      previousMACD >= previousSignal &&
      currentMACD < currentSignal
    ) {
      bearishScore += 10;
      conditions.push('Bearish MACD crossover');
    }

    /* MACD HISTOGRAM */

    if (currentHistogram > previousHistogram) {
      bullishScore += 5;
    } else if (currentHistogram < previousHistogram) {
      bearishScore += 5;
    }

    /* VOLUME */

    if (relativeVolume !== null) {
      if (relativeVolume > 1.5 && momentum > 0) {
        bullishScore += 10;
        conditions.push('Strong positive volume');
      } else if (relativeVolume > 1.5 && momentum < 0) {
        bearishScore += 10;
        conditions.push('Strong negative volume');
      }
    }

    /* MOMENTUM */

    if (momentum > 0) {
      bullishScore += 10;
      conditions.push('Positive price momentum');
    } else {
      bearishScore += 10;
      conditions.push('Negative price momentum');
    }

    const total = bullishScore + bearishScore;

    const score = total
      ? Math.round(
          Math.max(bullishScore, bearishScore) /
          total * 100
        )
      : 50;

    let signal = 'HOLD';

    if (
      bullishScore > bearishScore &&
      score >= this.config.buyThreshold &&
      currentPrice > currentEMA200
    ) {
      signal = 'BUY';
    } else if (
      bearishScore > bullishScore &&
      score >= this.config.buyThreshold &&
      currentPrice < currentEMA200
    ) {
      signal = 'SELL';
    }

    return {
      symbol: coin.symbol,
      name: coin.name,
      price: currentPrice,
      signal,
      score,
      bullishScore,
      bearishScore,
      rsi,
      ema20: currentEMA20,
      ema50: currentEMA50,
      ema200: currentEMA200,
      macd: currentMACD,
      macdSignal: currentSignal,
      macdHistogram: currentHistogram,
      relativeVolume,
      momentum,
      conditions,
      status: 'READY',
      timestamp: Date.now()
    };
  },

  /* SCAN ALL COINS */

  scan(coins) {
    if (!Array.isArray(coins)) {
      throw new Error('Market data must be an array.');
    }

    this.state.scanning = true;

    try {
      const results = coins.map(coin => {
        try {
          return this.analyzeCoin(coin);
        } catch (error) {
          return {
            symbol: coin.symbol,
            name: coin.name,
            signal: 'HOLD',
            score: null,
            status: 'ERROR',
            error: error.message
          };
        }
      });

      this.state.coins = coins;
      this.state.results = results;
      this.state.lastScan = Date.now();

      return this.getResults();

    } finally {
      this.state.scanning = false;
    }
  },

  /* FILTER */

  filterResults(filter = 'ALL') {
    this.state.filter = filter;

    if (filter === 'ALL') {
      return this.getResults();
    }

    return this.getResults().filter(
      item => item.signal === filter
    );
  },

  /* SORT */

  sortResults(sort = 'score') {
    this.state.sort = sort;

    const results = this.getResults();

    if (sort === 'score') {
      results.sort((a, b) =>
        (b.score ?? -1) - (a.score ?? -1)
      );
    }

    if (sort === 'price') {
      results.sort((a, b) =>
        (b.price ?? 0) - (a.price ?? 0)
      );
    }

    if (sort === 'rsi') {
      results.sort((a, b) =>
        (b.rsi ?? -1) - (a.rsi ?? -1)
      );
    }

    if (sort === 'momentum') {
      results.sort((a, b) =>
        (b.momentum ?? -Infinity) -
        (a.momentum ?? -Infinity)
      );
    }

    return results;
  },

  /* SUMMARY */

  getSummary() {
    const results = this.state.results;

    return {
      total: results.length,

      buy: results.filter(x => x.signal === 'BUY').length,

      sell: results.filter(x => x.signal === 'SELL').length,

      hold: results.filter(x => x.signal === 'HOLD').length,

      insufficientData: results.filter(
        x => x.status === 'INSUFFICIENT_DATA'
      ).length,

      errors: results.filter(
        x => x.status === 'ERROR'
      ).length,

      lastScan: this.state.lastScan
    };
  },

  /* RESULTS */

  getResults() {
    return this.state.results.map(item => ({
      ...item,
      conditions: item.conditions
        ? [...item.conditions]
        : []
    }));
  },

  getTopOpportunities(limit = 10) {
    return this.getResults()
      .filter(item =>
        item.status === 'READY' &&
        item.signal === 'BUY'
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  getTopBearish(limit = 10) {
    return this.getResults()
      .filter(item =>
        item.status === 'READY' &&
        item.signal === 'SELL'
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  /* AUTOMATIC SCANNING */

  startAutoScan(getCoins, interval = 60000) {
    this.stopAutoScan();

    const run = async () => {
      try {
        const coins = await getCoins();

        this.scan(coins);

        this.render();

      } catch (error) {
        console.error('Market scan failed:', error);
      }
    };

    run();

    this.timer = setInterval(run, interval);
  },

  stopAutoScan() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  /* RENDER SCANNER */

  render() {
    const container =
      document.getElementById('marketScannerResults');

    if (!container) return;

    const sorted = this.sortResults(this.state.sort);

    const visible = sorted.filter(item =>
      this.state.filter === 'ALL' ||
      item.signal === this.state.filter
    );

    container.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No matching market data available.';
      container.appendChild(empty);
      return;
    }

    const table = document.createElement('table');

    const headers = [
      'Asset',
      'Price',
      'Signal',
      'Score',
      'RSI',
      'Momentum',
      'Relative Volume'
    ];

    const thead = document.createElement('thead');
    const headingRow = document.createElement('tr');

    headers.forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      headingRow.appendChild(th);
    });

    thead.appendChild(headingRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    visible.forEach(item => {
      const row = document.createElement('tr');

      const values = [
        item.symbol || '--',
        item.price == null
          ? '--'
          : item.price.toLocaleString(undefined, {
              maximumFractionDigits: 8
            }),
        item.signal || '--',
        item.score == null ? '--' : item.score + '/100',
        item.rsi == null ? '--' : item.rsi.toFixed(2),
        item.momentum == null
          ? '--'
          : item.momentum.toFixed(2) + '%',
        item.relativeVolume == null
          ? '--'
          : item.relativeVolume.toFixed(2) + 'x'
      ];

      values.forEach((value, index) => {
        const cell = document.createElement('td');

        cell.textContent = value;

        if (index === 2) {
          cell.className = item.signal.toLowerCase();
        }

        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    const summary = this.getSummary();

    const summaryContainer =
      document.getElementById('marketScannerSummary');

    if (summaryContainer) {
      summaryContainer.textContent =
        'Scanned: ' + summary.total +
        ' | BUY: ' + summary.buy +
        ' | SELL: ' + summary.sell +
        ' | HOLD: ' + summary.hold;
    }

    const updated =
      document.getElementById('marketScannerUpdated');

    if (updated && this.state.lastScan) {
      updated.textContent =
        'Last scan: ' +
        new Date(this.state.lastScan).toLocaleString();
    }
  },

  /* INITIALIZATION */

  init() {
    const scanButton =
      document.getElementById('runMarketScan');

    const filter =
      document.getElementById('marketScannerFilter');

    const sort =
      document.getElementById('marketScannerSort');

    if (scanButton) {
      scanButton.addEventListener('click', () => {
        try {
          const dashboard = window.CryptoDashboard;

          if (!dashboard) {
            throw new Error('Dashboard not initialized.');
          }

          const state = dashboard.getState();

          if (!state.coins || !state.coins.length) {
            throw new Error('No coins available to scan.');
          }

          this.scan(state.coins);
          this.render();

        } catch (error) {
          alert(error.message);
        }
      });
    }

    if (filter) {
      filter.addEventListener('change', event => {
        this.state.filter = event.target.value;
        this.render();
      });
    }

    if (sort) {
      sort.addEventListener('change', event => {
        this.state.sort = event.target.value;
        this.render();
      });
    }
  }

};

/* GLOBAL API */

window.CryptoMarketScanner = CryptoMarketScanner;

document.addEventListener('DOMContentLoaded', () => {
  CryptoMarketScanner.init();

  console.info(
    'Crypto Intelligence Terminal market scanner loaded.'
  );
});
