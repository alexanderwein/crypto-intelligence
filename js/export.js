/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   DATA EXPORT & REPORTING ENGINE
   File: js/export.js
========================================================= */

'use strict';

const CryptoExport = {

  version: '1.0.0',

  /* -------------------------------------------------------
     CSV HELPERS
  ------------------------------------------------------- */

  escapeCSV(value) {
    if (value === null || value === undefined) return '';

    let text = String(value);

    return '"' + text.replace(/"/g, '""') + '"';
  },

  createCSV(headers, rows) {
    const lines = [
      headers.map(this.escapeCSV).join(','),
      ...rows.map(row =>
        row.map(this.escapeCSV).join(',')
      )
    ];

    return lines.join('\r\n');
  },

  /* -------------------------------------------------------
     DOWNLOAD HELPERS
  ------------------------------------------------------- */

  download(content, filename, mimeType) {
    const blob = new Blob(
      [content],
      { type: mimeType }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  timestamp() {
    return new Date().toISOString()
      .replace(/[:.]/g, '-');
  },

  downloadCSV(headers, rows, filename) {
    const csv = this.createCSV(headers, rows);

    this.download(
      '\ufeff' + csv,
      filename,
      'text/csv;charset=utf-8;'
    );
  },

  downloadJSON(data, filename) {
    this.download(
      JSON.stringify(data, null, 2),
      filename,
      'application/json;charset=utf-8;'
    );
  },

  /* -------------------------------------------------------
     MARKET DATA EXPORT
  ------------------------------------------------------- */

  exportMarketData(coins) {
    if (!Array.isArray(coins) || !coins.length) {
      throw new Error('No market data available.');
    }

    const headers = [
      'Symbol',
      'Name',
      'Price USD',
      '24h Change %',
      '24h Volume',
      'Market Cap',
      'Last Updated'
    ];

    const rows = coins.map(coin => [
      coin.symbol,
      coin.name,
      coin.price,
      coin.change24h,
      coin.volume24h,
      coin.marketCap,
      coin.lastUpdated || ''
    ]);

    this.downloadCSV(
      headers,
      rows,
      'crypto-market-' + this.timestamp() + '.csv'
    );
  },

  /* -------------------------------------------------------
     HISTORICAL PRICE EXPORT
  ------------------------------------------------------- */

  exportHistoricalData(symbol, candles) {
    if (!Array.isArray(candles) || !candles.length) {
      throw new Error('No historical candles available.');
    }

    const headers = [
      'Timestamp',
      'Date',
      'Open',
      'High',
      'Low',
      'Close',
      'Volume'
    ];

    const rows = candles.map(candle => [
      candle.time,
      new Date(candle.time * 1000).toISOString(),
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume ?? ''
    ]);

    this.downloadCSV(
      headers,
      rows,
      symbol.toUpperCase() +
        '-historical-' +
        this.timestamp() +
        '.csv'
    );
  },

  /* -------------------------------------------------------
     INDICATOR EXPORT
  ------------------------------------------------------- */

  exportIndicators(symbol, indicators) {
    if (!indicators) {
      throw new Error('No indicator data available.');
    }

    const headers = [
      'Indicator',
      'Value',
      'Interpretation'
    ];

    const rows = [];

    const add = (name, value, interpretation = '') => {
      if (value === null || value === undefined) return;

      rows.push([
        name,
        value,
        interpretation
      ]);
    };

    const rsi = indicators.rsi;

    const rsiValue = Array.isArray(rsi)
      ? rsi[rsi.length - 1]
      : rsi;

    if (Number.isFinite(rsiValue)) {
      add(
        'RSI',
        rsiValue,
        rsiValue > 70
          ? 'Potentially overbought'
          : rsiValue < 30
            ? 'Potentially oversold'
            : 'Neutral range'
      );
    }

    const macd = indicators.macd;

    if (macd) {
      const macdLine = Array.isArray(macd.macd)
        ? macd.macd[macd.macd.length - 1]
        : macd.macd;

      const signalLine = Array.isArray(macd.signal)
        ? macd.signal[macd.signal.length - 1]
        : macd.signal;

      add('MACD', macdLine);

      add('MACD Signal', signalLine);

      if (
        Number.isFinite(macdLine) &&
        Number.isFinite(signalLine)
      ) {
        add(
          'MACD Histogram',
          macdLine - signalLine,
          macdLine > signalLine
            ? 'Bullish momentum'
            : 'Bearish momentum'
        );
      }
    }

    Object.keys(indicators).forEach(key => {
      if (key === 'rsi' || key === 'macd') return;

      const value = indicators[key];

      if (Array.isArray(value)) {
        const latest = value[value.length - 1];

        if (Number.isFinite(latest)) {
          add(key, latest);
        }
      } else if (Number.isFinite(value)) {
        add(key, value);
      }
    });

    this.downloadCSV(
      headers,
      rows,
      symbol.toUpperCase() +
        '-indicators-' +
        this.timestamp() +
        '.csv'
    );
  },

  /* -------------------------------------------------------
     SIGNAL EXPORT
  ------------------------------------------------------- */

  exportSignals(signals) {
    if (!Array.isArray(signals) || !signals.length) {
      throw new Error('No signals available.');
    }

    const headers = [
      'Symbol',
      'Signal',
      'Confidence',
      'Price',
      'Reason',
      'Timestamp'
    ];

    const rows = signals.map(signal => [
      signal.symbol,
      signal.signal || signal.action,
      signal.confidence ?? '',
      signal.price ?? '',
      signal.reason ?? '',
      signal.timestamp
        ? new Date(signal.timestamp).toISOString()
        : ''
    ]);

    this.downloadCSV(
      headers,
      rows,
      'crypto-signals-' + this.timestamp() + '.csv'
    );
  },

  /* -------------------------------------------------------
     PORTFOLIO EXPORT
  ------------------------------------------------------- */

  exportPortfolio(positions) {
    if (!Array.isArray(positions) || !positions.length) {
      throw new Error('No portfolio positions available.');
    }

    const headers = [
      'Symbol',
      'Quantity',
      'Average Entry',
      'Current Price',
      'Market Value',
      'Cost Basis',
      'Unrealized P/L',
      'P/L Percentage'
    ];

    const rows = positions.map(position => {
      const quantity = Number(position.quantity || 0);

      const entry = Number(position.averageEntry || 0);

      const price = Number(position.currentPrice || 0);

      const marketValue = quantity * price;

      const costBasis = quantity * entry;

      const pnl = marketValue - costBasis;

      const pnlPercentage = costBasis
        ? pnl / costBasis * 100
        : 0;

      return [
        position.symbol,
        quantity,
        entry,
        price,
        marketValue,
        costBasis,
        pnl,
        pnlPercentage
      ];
    });

    this.downloadCSV(
      headers,
      rows,
      'crypto-portfolio-' + this.timestamp() + '.csv'
    );
  },

  /* -------------------------------------------------------
     BACKTEST EXPORT
  ------------------------------------------------------- */

  exportBacktest(result) {
    if (!result) {
      throw new Error('No backtest results available.');
    }

    const report = {
      generatedAt: new Date().toISOString(),

      disclaimer:
        'Historical simulation only. Results do not predict future performance.',

      summary: {
        strategy: result.strategy,
        initialCapital: result.initialCapital,
        finalValue: result.finalValue,
        totalProfit: result.totalProfit,
        totalReturn: result.totalReturn,
        maxDrawdown: result.maxDrawdown,
        totalTrades: result.totalTrades,
        wins: result.wins,
        losses: result.losses,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        totalFees: result.totalFees,
        buyAndHoldReturn: result.buyAndHoldReturn
      },

      trades: result.trades || [],

      equityCurve: result.equityCurve || []
    };

    this.downloadJSON(
      report,
      'crypto-backtest-' + this.timestamp() + '.json'
    );
  },

  /* -------------------------------------------------------
     COMPLETE MARKET SNAPSHOT
  ------------------------------------------------------- */

  exportMarketSnapshot(data) {
    const snapshot = {
      application: 'Crypto Intelligence Terminal',

      version: this.version,

      generatedAt: new Date().toISOString(),

      disclaimer:
        'Market information and analytical signals are informational, not financial advice.',

      market: data.market || [],

      signals: data.signals || [],

      indicators: data.indicators || {},

      portfolio: data.portfolio || [],

      backtest: data.backtest || null
    };

    this.downloadJSON(
      snapshot,
      'crypto-terminal-snapshot-' +
        this.timestamp() +
        '.json'
    );
  },

  /* -------------------------------------------------------
     AUTOMATIC DASHBOARD EXPORT
  ------------------------------------------------------- */

  exportDashboard() {
    const dashboard = window.CryptoDashboard;

    if (!dashboard) {
      throw new Error('Dashboard not initialized.');
    }

    const state = dashboard.getState();

    const portfolio = window.CryptoPortfolio
      ? window.CryptoPortfolio.getPositions()
      : [];

    const signals = window.CryptoSignals
      ? window.CryptoSignals.getSignals()
      : [];

    const snapshot = {
      market: state.coins || [],

      signals,

      portfolio,

      indicators: dashboard.lastIndicators || {}
    };

    this.exportMarketSnapshot(snapshot);
  }

};

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoExport = CryptoExport;

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('[data-export]').forEach(button => {

    button.addEventListener('click', () => {

      const type = button.dataset.export;

      try {

        if (type === 'market') {
          const coins =
            window.CryptoDashboard.getState().coins;

          CryptoExport.exportMarketData(coins);
        }

        else if (type === 'portfolio') {
          CryptoExport.exportPortfolio(
            window.CryptoPortfolio.getPositions()
          );
        }

        else if (type === 'backtest') {
          CryptoExport.exportBacktest(
            window.CryptoBacktest.getResults()
          );
        }

        else if (type === 'dashboard') {
          CryptoExport.exportDashboard();
        }

      } catch (error) {
        console.error('Export error:', error);

        alert(error.message);
      }

    });

  });

  console.info(
    'Crypto Intelligence Terminal export engine loaded.'
  );

});
