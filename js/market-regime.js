/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   MARKET REGIME ENGINE
   File: js/market-regime.js

   Analyzes market-wide conditions using OHLCV data.
   Historical analysis, not guaranteed predictions.
========================================================= */

'use strict';

const CryptoMarketRegime = {

  config: {
    minimumCoins: 5,
    minimumCandles: 205,
    bullishBreadth: 65,
    bearishBreadth: 35,
    highVolatility: 5,
    rsiPeriod: 14,
    refreshInterval: 60000
  },

  state: {
    regime: 'UNKNOWN',
    sentiment: 50,
    breadth: null,
    volatility: null,
    bitcoin: null,
    lastUpdated: null,
    history: []
  },

  /* -------------------------------------------------------
     EMA
  ------------------------------------------------------- */

  calculateEMA(values, period) {
    if (!Array.isArray(values) || values.length < period) {
      return null;
    }

    const multiplier = 2 / (period + 1);

    let average = values
      .slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

    for (let i = period; i < values.length; i++) {
      average =
        (values[i] - average) * multiplier + average;
    }

    return average;
  },

  /* -------------------------------------------------------
     RSI
  ------------------------------------------------------- */

  calculateRSI(values, period = 14) {
    if (!Array.isArray(values) || values.length <= period) {
      return null;
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];

      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      averageGain =
        (averageGain * (period - 1) +
        Math.max(change, 0)) / period;

      averageLoss =
        (averageLoss * (period - 1) +
        Math.max(-change, 0)) / period;
    }

    if (averageLoss === 0) return 100;

    const rs = averageGain / averageLoss;

    return 100 - 100 / (1 + rs);
  },

  /* -------------------------------------------------------
     COIN TREND
  ------------------------------------------------------- */

  analyzeCoin(coin) {
    if (!coin || !Array.isArray(coin.candles)) {
      return null;
    }

    const candles = coin.candles.filter(c => {
      return (
        Number.isFinite(Number(c.close)) &&
        Number(c.close) > 0
      );
    });

    if (candles.length < this.config.minimumCandles) {
      return null;
    }

    const closes = candles.map(c => Number(c.close));

    const price = closes[closes.length - 1];

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);

    const rsi = this.calculateRSI(closes, 14);

    const momentum = (
      (price / closes[closes.length - 11]) - 1
    ) * 100;

    let trend = 'SIDEWAYS';

    if (
      price > ema20 &&
      ema20 > ema50 &&
      ema50 > ema200
    ) {
      trend = 'BULLISH';

    } else if (
      price < ema20 &&
      ema20 < ema50 &&
      ema50 < ema200
    ) {
      trend = 'BEARISH';
    }

    return {
      symbol: coin.symbol,
      name: coin.name,
      price,
      ema20,
      ema50,
      ema200,
      rsi,
      momentum,
      trend
    };
  },

  /* -------------------------------------------------------
     MARKET BREADTH
  ------------------------------------------------------- */

  calculateBreadth(analyses) {
    const valid = analyses.filter(Boolean);

    if (!valid.length) {
      return null;
    }

    const bullish = valid.filter(
      x => x.trend === 'BULLISH'
    ).length;

    const bearish = valid.filter(
      x => x.trend === 'BEARISH'
    ).length;

    const sideways = valid.filter(
      x => x.trend === 'SIDEWAYS'
    ).length;

    return {
      total: valid.length,
      bullish,
      bearish,
      sideways,
      bullishPercentage: bullish / valid.length * 100,
      bearishPercentage: bearish / valid.length * 100,
      sidewaysPercentage: sideways / valid.length * 100
    };
  },

  /* -------------------------------------------------------
     MARKET MOMENTUM
  ------------------------------------------------------- */

  calculateMarketMomentum(analyses) {
    const valid = analyses.filter(Boolean);

    if (!valid.length) return null;

    const average = valid.reduce(
      (sum, coin) => sum + coin.momentum,
      0
    ) / valid.length;

    return {
      averageMomentum: average,
      direction:
        average > 1
          ? 'POSITIVE'
          : average < -1
            ? 'NEGATIVE'
            : 'NEUTRAL'
    };
  },

  /* -------------------------------------------------------
     MARKET VOLATILITY
  ------------------------------------------------------- */

  calculateVolatility(analyses) {
    const valid = analyses.filter(Boolean);

    if (!valid.length) return null;

    const values = valid.map(coin => {
      return Math.abs(coin.momentum);
    });

    const average = values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;

    return {
      averageAbsoluteMomentum: average,
      classification:
        average >= this.config.highVolatility
          ? 'HIGH'
          : average >= 2
            ? 'MODERATE'
            : 'LOW'
    };
  },

  /* -------------------------------------------------------
     BITCOIN ANALYSIS
  ------------------------------------------------------- */

  analyzeBitcoin(coins) {
    const bitcoin = coins.find(coin =>
      String(coin.symbol).toUpperCase() === 'BTC'
    );

    if (!bitcoin) return null;

    return this.analyzeCoin(bitcoin);
  },

  /* -------------------------------------------------------
     MARKET REGIME
  ------------------------------------------------------- */

  determineRegime(breadth, momentum, bitcoin) {
    if (!breadth || !momentum) {
      return 'UNKNOWN';
    }

    if (
      breadth.bullishPercentage >=
        this.config.bullishBreadth &&
      momentum.direction === 'POSITIVE' &&
      bitcoin &&
      bitcoin.trend === 'BULLISH'
    ) {
      return 'BULLISH';
    }

    if (
      breadth.bearishPercentage >=
        this.config.bearishBreadth &&
      momentum.direction === 'NEGATIVE' &&
      bitcoin &&
      bitcoin.trend === 'BEARISH'
    ) {
      return 'BEARISH';
    }

    if (
      breadth.sidewaysPercentage >= 50 ||
      momentum.direction === 'NEUTRAL'
    ) {
      return 'SIDEWAYS';
    }

    return 'MIXED';
  },

  /* -------------------------------------------------------
     SENTIMENT SCORE
  ------------------------------------------------------- */

  calculateSentiment(breadth, momentum, bitcoin) {
    if (!breadth || !momentum) return 50;

    let score = 50;

    score += (
      breadth.bullishPercentage -
      breadth.bearishPercentage
    ) * 0.35;

    score += Math.max(
      -15,
      Math.min(15, momentum.averageMomentum * 2)
    );

    if (bitcoin) {
      if (bitcoin.trend === 'BULLISH') score += 10;
      if (bitcoin.trend === 'BEARISH') score -= 10;
    }

    return Math.round(
      Math.max(0, Math.min(100, score))
    );
  },

  /* -------------------------------------------------------
     RISK ENVIRONMENT
  ------------------------------------------------------- */

  determineRiskEnvironment(
    regime,
    volatility,
    sentiment
  ) {
    if (
      regime === 'BEARISH' ||
      sentiment < 25
    ) {
      return 'RISK_OFF';
    }

    if (
      regime === 'BULLISH' &&
      sentiment >= 65 &&
      volatility &&
      volatility.classification !== 'HIGH'
    ) {
      return 'RISK_ON';
    }

    return 'NEUTRAL';
  },

  /* -------------------------------------------------------
     COMPLETE MARKET ANALYSIS
  ------------------------------------------------------- */

  analyzeMarket(coins) {
    if (!Array.isArray(coins)) {
      throw new Error('Coins must be supplied as an array.');
    }

    const analyses = coins
      .map(coin => this.analyzeCoin(coin))
      .filter(Boolean);

    if (analyses.length < this.config.minimumCoins) {
      throw new Error(
        'Insufficient valid historical data. At least five coins are required.'
      );
    }

    const breadth = this.calculateBreadth(analyses);

    const momentum =
      this.calculateMarketMomentum(analyses);

    const volatility =
      this.calculateVolatility(analyses);

    const bitcoin =
      this.analyzeBitcoin(coins);

    const regime =
      this.determineRegime(
        breadth,
        momentum,
        bitcoin
      );

    const sentiment =
      this.calculateSentiment(
        breadth,
        momentum,
        bitcoin
      );

    const riskEnvironment =
      this.determineRiskEnvironment(
        regime,
        volatility,
        sentiment
      );

    const result = {
      regime,
      sentiment,
      breadth,
      momentum,
      volatility,
      bitcoin,
      riskEnvironment,
      analyzedCoins: analyses.length,
      timestamp: Date.now()
    };

    this.state = {
      ...this.state,
      ...result
    };

    this.state.history.push({
      timestamp: result.timestamp,
      regime,
      sentiment
    });

    if (this.state.history.length > 500) {
      this.state.history.shift();
    }

    return result;
  },

  /* -------------------------------------------------------
     MARKET HISTORY
  ------------------------------------------------------- */

  getHistory() {
    return this.state.history.map(item => ({ ...item }));
  },

  /* -------------------------------------------------------
     RENDER MARKET OVERVIEW
  ------------------------------------------------------- */

  render() {
    const fields = {
      marketRegime: this.state.regime,
      marketSentiment: this.state.sentiment + '/100',
      marketRisk: this.state.riskEnvironment,
      marketBullish:
        this.state.breadth
          ? this.state.breadth.bullishPercentage.toFixed(1) + '%'
          : '--',
      marketBearish:
        this.state.breadth
          ? this.state.breadth.bearishPercentage.toFixed(1) + '%'
          : '--',
      marketMomentum:
        this.state.momentum
          ? this.state.momentum.averageMomentum.toFixed(2) + '%'
          : '--',
      marketVolatility:
        this.state.volatility
          ? this.state.volatility.classification
          : '--',
      bitcoinTrend:
        this.state.bitcoin
          ? this.state.bitcoin.trend
          : '--'
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    });

    const updated =
      document.getElementById('marketRegimeUpdated');

    if (updated && this.state.lastUpdated) {
      updated.textContent =
        'Updated: ' +
        new Date(this.state.lastUpdated).toLocaleString();
    }
  },

  /* -------------------------------------------------------
     INITIALIZATION
  ------------------------------------------------------- */

  init() {
    const button =
      document.getElementById('runMarketRegime');

    if (!button) return;

    button.addEventListener('click', () => {
      try {
        const dashboard = window.CryptoDashboard;

        if (!dashboard) {
          throw new Error('Dashboard not initialized.');
        }

        const data = dashboard.getState();

        const result = this.analyzeMarket(data.coins);

        this.render();

        console.info('Market regime analysis:', result);

      } catch (error) {
        alert(error.message);
      }
    });
  }

};

/* GLOBAL API */

window.CryptoMarketRegime = CryptoMarketRegime;

document.addEventListener('DOMContentLoaded', () => {
  CryptoMarketRegime.init();

  console.info(
    'Crypto Intelligence Terminal market regime engine loaded.'
  );
});
