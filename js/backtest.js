/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   HISTORICAL BACKTEST ENGINE
   File: js/backtest.js

   Historical simulation only.
   No real orders are submitted.
========================================================= */

'use strict';

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const BACKTEST_CONFIG = {
  initialCapital: 10000,

  tradingFee: 0.001,

  slippage: 0.0005,

  defaultPositionSize: 1,

  maximumTrades: 10000
};

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

const Backtest = {
  running: false,

  results: null,

  trades: [],

  settings: {
    strategy: 'ema',
    initialCapital: BACKTEST_CONFIG.initialCapital,
    tradingFee: BACKTEST_CONFIG.tradingFee,
    slippage: BACKTEST_CONFIG.slippage,
    positionSize: BACKTEST_CONFIG.defaultPositionSize
  }
};

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function btNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function btCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function btPercent(value) {
  return Number(value).toFixed(2) + '%';
}

function btElement(id) {
  return document.getElementById(id);
}

function btEscape(value) {
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

/* ---------------------------------------------------------
   VALIDATE HISTORICAL DATA
--------------------------------------------------------- */

function validateBacktestData(candles) {
  if (!Array.isArray(candles) || candles.length < 50) {
    throw new Error(
      'At least 50 historical candles are required.'
    );
  }

  return candles
    .map(candle => ({
      time: Number(candle.time),

      open: Number(candle.open),

      high: Number(candle.high),

      low: Number(candle.low),

      close: Number(candle.close)
    }))
    .filter(candle =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.close) &&
      candle.close > 0 &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close)
    )
    .sort((a, b) => a.time - b.time)
    .filter((candle, index, array) =>
      index === 0 ||
      candle.time !== array[index - 1].time
    );
}

/* ---------------------------------------------------------
   MOVING AVERAGE
--------------------------------------------------------- */

function btEMA(values, period) {
  const result = new Array(values.length).fill(null);

  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);

  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += values[i];
  }

  let previous = sum / period;

  result[period - 1] = previous;

  for (let i = period; i < values.length; i++) {
    previous =
      (values[i] - previous) * multiplier + previous;

    result[i] = previous;
  }

  return result;
}

/* ---------------------------------------------------------
   RSI
--------------------------------------------------------- */

function btRSI(values, period = 14) {
  const result = new Array(values.length).fill(null);

  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const difference = values[i] - values[i - 1];

    gains += Math.max(difference, 0);

    losses += Math.max(-difference, 0);
  }

  let averageGain = gains / period;

  let averageLoss = losses / period;

  function calculateRSI() {
    if (averageLoss === 0) {
      return averageGain === 0 ? 50 : 100;
    }

    const rs = averageGain / averageLoss;

    return 100 - 100 / (1 + rs);
  }

  result[period] = calculateRSI();

  for (let i = period + 1; i < values.length; i++) {
    const difference = values[i] - values[i - 1];

    const gain = Math.max(difference, 0);

    const loss = Math.max(-difference, 0);

    averageGain =
      ((averageGain * (period - 1)) + gain) / period;

    averageLoss =
      ((averageLoss * (period - 1)) + loss) / period;

    result[i] = calculateRSI();
  }

  return result;
}

/* ---------------------------------------------------------
   MACD
--------------------------------------------------------- */

function btMACD(values) {
  const fast = btEMA(values, 12);

  const slow = btEMA(values, 26);

  const macd = values.map((value, index) => {
    if (fast[index] === null || slow[index] === null) {
      return null;
    }

    return fast[index] - slow[index];
  });

  const signalInput = macd.map(
    value => value === null ? 0 : value
  );

  const signal = btEMA(signalInput, 9);

  const histogram = macd.map((value, index) => {
    if (value === null || signal[index] === null) {
      return null;
    }

    return value - signal[index];
  });

  return {
    macd,
    signal,
    histogram
  };
}

/* ---------------------------------------------------------
   CALCULATE ALL BACKTEST INDICATORS
--------------------------------------------------------- */

function calculateBacktestIndicators(candles) {
  const closes = candles.map(candle => candle.close);

  return {
    ema20: btEMA(closes, 20),

    ema50: btEMA(closes, 50),

    ema200: btEMA(closes, 200),

    rsi: btRSI(closes, 14),

    macd: btMACD(closes)
  };
}

/* ---------------------------------------------------------
   STRATEGY SIGNALS
--------------------------------------------------------- */

function getBacktestSignal(strategy, indicators, index) {
  const {
    ema20,
    ema50,
    rsi,
    macd
  } = indicators;

  if (index < 1) return 'HOLD';

  switch (strategy) {

    case 'ema': {
      if (
        ema20[index] === null ||
        ema50[index] === null ||
        ema20[index - 1] === null ||
        ema50[index - 1] === null
      ) return 'HOLD';

      if (
        ema20[index - 1] <= ema50[index - 1] &&
        ema20[index] > ema50[index]
      ) return 'BUY';

      if (
        ema20[index - 1] >= ema50[index - 1] &&
        ema20[index] < ema50[index]
      ) return 'SELL';

      return 'HOLD';
    }

    case 'rsi': {
      if (
        rsi[index] === null ||
        rsi[index - 1] === null
      ) return 'HOLD';

      if (
        rsi[index - 1] < 30 &&
        rsi[index] >= 30
      ) return 'BUY';

      if (
        rsi[index - 1] > 70 &&
        rsi[index] <= 70
      ) return 'SELL';

      return 'HOLD';
    }

    case 'macd': {
      const current = macd.macd[index];

      const previous = macd.macd[index - 1];

      const currentSignal = macd.signal[index];

      const previousSignal = macd.signal[index - 1];

      if (
        current === null ||
        previous === null ||
        currentSignal === null ||
        previousSignal === null
      ) return 'HOLD';

      if (
        previous <= previousSignal &&
        current > currentSignal
      ) return 'BUY';

      if (
        previous >= previousSignal &&
        current < currentSignal
      ) return 'SELL';

      return 'HOLD';
    }

    case 'combined': {
      const emaBuy =
        ema20[index] !== null &&
        ema50[index] !== null &&
        ema20[index] > ema50[index];

      const emaSell =
        ema20[index] !== null &&
        ema50[index] !== null &&
        ema20[index] < ema50[index];

      const rsiBuy =
        rsi[index] !== null &&
        rsi[index] > 30 &&
        rsi[index] < 65;

      const rsiSell =
        rsi[index] !== null &&
        rsi[index] > 70;

      const macdBuy =
        macd.macd[index] !== null &&
        macd.signal[index] !== null &&
        macd.macd[index] > macd.signal[index];

      const macdSell =
        macd.macd[index] !== null &&
        macd.signal[index] !== null &&
        macd.macd[index] < macd.signal[index];

      if (emaBuy && rsiBuy && macdBuy) {
        return 'BUY';
      }

      if (emaSell && rsiSell && macdSell) {
        return 'SELL';
      }

      return 'HOLD';
    }

    default:
      return 'HOLD';
  }
}

/* ---------------------------------------------------------
   EXECUTION PRICE
--------------------------------------------------------- */

function getExecutionPrice(price, direction, settings) {
  const slippage = settings.slippage;

  return direction === 'BUY'
    ? price * (1 + slippage)
    : price * (1 - slippage);
}

/* ---------------------------------------------------------
   RUN BACKTEST
--------------------------------------------------------- */

function runBacktest(candles, options = {}) {
  if (Backtest.running) {
    throw new Error('A backtest is already running.');
  }

  Backtest.running = true;

  try {
    const data = validateBacktestData(candles);

    const settings = {
      ...Backtest.settings,
      ...options
    };

    const initialCapital = btNumber(
      settings.initialCapital,
      10000
    );

    const fee = btNumber(settings.tradingFee, 0.001);

    const slippage = btNumber(settings.slippage, 0.0005);

    const positionSize = btNumber(
      settings.positionSize,
      1
    );

    if (
      initialCapital <= 0 ||
      fee < 0 ||
      fee >= 1 ||
      slippage < 0 ||
      slippage >= 1 ||
      positionSize <= 0 ||
      positionSize > 1
    ) {
      throw new Error('Invalid backtest settings.');
    }

    const normalizedSettings = {
      ...settings,
      initialCapital,
      tradingFee: fee,
      slippage,
      positionSize
    };

    const indicators =
      calculateBacktestIndicators(data);

    let cash = initialCapital;

    let quantity = 0;

    let entryPrice = 0;

    let entryTime = null;

    let entryCost = 0;

    let equityPeak = initialCapital;

    let maxDrawdown = 0;

    let wins = 0;

    let losses = 0;

    let totalFees = 0;

    const trades = [];

    const equityCurve = [];

    for (let i = 1; i < data.length; i++) {
      const candle = data[i];

      const signal = getBacktestSignal(
        normalizedSettings.strategy,
        indicators,
        i - 1
      );

      // Signals are calculated from the previous candle.
      // Orders are simulated at the current candle open.

      const executionBase = candle.open;

      if (signal === 'BUY' && quantity === 0) {
        const budget =
          cash * positionSize;

        const price = getExecutionPrice(
          executionBase,
          'BUY',
          normalizedSettings
        );

        const feeAmount = budget * fee;

        const purchaseAmount =
          (budget - feeAmount) / price;

        if (
          Number.isFinite(purchaseAmount) &&
          purchaseAmount > 0
        ) {
          cash -= budget;

          quantity = purchaseAmount;

          entryPrice = price;

          entryTime = candle.time;

          entryCost = budget;

          totalFees += feeAmount;
        }
      }

      else if (signal === 'SELL' && quantity > 0) {
        const price = getExecutionPrice(
          executionBase,
          'SELL',
          normalizedSettings
        );

        const gross = quantity * price;

        const feeAmount = gross * fee;

        const proceeds = gross - feeAmount;

        const profitLoss = proceeds - entryCost;

        totalFees += feeAmount;

        trades.push({
          type: 'SELL',

          entryTime,

          exitTime: candle.time,

          entryPrice,

          exitPrice: price,

          quantity,

          invested: entryCost,

          proceeds,

          profitLoss,

          returnPercentage:
            entryCost > 0
              ? (profitLoss / entryCost) * 100
              : 0
        });

        if (profitLoss > 0) wins++;
        else losses++;

        cash += proceeds;

        quantity = 0;

        entryPrice = 0;

        entryTime = null;

        entryCost = 0;
      }

      const equity =
        cash + quantity * candle.close;

      equityPeak = Math.max(equityPeak, equity);

      const drawdown =
        equityPeak > 0
          ? ((equityPeak - equity) / equityPeak) * 100
          : 0;

      maxDrawdown = Math.max(maxDrawdown, drawdown);

      equityCurve.push({
        time: candle.time,
        value: equity
      });
    }

    // Close any open position at the final historical close.
    if (quantity > 0) {
      const last = data[data.length - 1];

      const price = getExecutionPrice(
        last.close,
        'SELL',
        normalizedSettings
      );

      const gross = quantity * price;

      const feeAmount = gross * fee;

      const proceeds = gross - feeAmount;

      const profitLoss = proceeds - entryCost;

      totalFees += feeAmount;

      trades.push({
        type: 'SELL',
        entryTime,
        exitTime: last.time,
        entryPrice,
        exitPrice: price,
        quantity,
        invested: entryCost,
        proceeds,
        profitLoss,
        returnPercentage:
          entryCost > 0
            ? (profitLoss / entryCost) * 100
            : 0
      });

      if (profitLoss > 0) wins++;
      else losses++;

      cash += proceeds;

      quantity = 0;
    }

    const finalValue = cash;

    const totalProfit = finalValue - initialCapital;

    const totalReturn =
      (totalProfit / initialCapital) * 100;

    const closedTrades = trades.length;

    const grossProfit = trades
      .filter(trade => trade.profitLoss > 0)
      .reduce(
        (sum, trade) => sum + trade.profitLoss,
        0
      );

    const grossLoss = Math.abs(
      trades
        .filter(trade => trade.profitLoss < 0)
        .reduce(
          (sum, trade) => sum + trade.profitLoss,
          0
        )
    );

    const winRate = closedTrades
      ? (wins / closedTrades) * 100
      : 0;

    const profitFactor = grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

    const buyAndHoldQuantity =
      initialCapital /
      getExecutionPrice(
        data[0].close,
        'BUY',
        normalizedSettings
      );

    const buyAndHoldValue =
      buyAndHoldQuantity *
      getExecutionPrice(
        data[data.length - 1].close,
        'SELL',
        normalizedSettings
      ) *
      (1 - fee);

    const buyAndHoldReturn =
      ((buyAndHoldValue - initialCapital) /
        initialCapital) * 100;

    const averageWin = wins
      ? grossProfit / wins
      : 0;

    const averageLoss = losses
      ? grossLoss / losses
      : 0;

    const result = {
      strategy: normalizedSettings.strategy,

      initialCapital,

      finalValue,

      totalProfit,

      totalReturn,

      maxDrawdown,

      totalTrades: closedTrades,

      wins,

      losses,

      winRate,

      grossProfit,

      grossLoss,

      profitFactor,

      averageWin,

      averageLoss,

      totalFees,

      buyAndHoldValue,

      buyAndHoldReturn,

      trades,

      equityCurve,

      startTime: data[0].time,

      endTime: data[data.length - 1].time,

      candleCount: data.length,

      settings: normalizedSettings
    };

    Backtest.results = result;

    Backtest.trades = trades;

    return result;

  } finally {
    Backtest.running = false;
  }
}

/* ---------------------------------------------------------
   RENDER RESULTS
--------------------------------------------------------- */

function renderBacktestResults(result) {
  if (!result) return;

  const fields = {
    backtestInitial: btCurrency(result.initialCapital),

    backtestFinal: btCurrency(result.finalValue),

    backtestProfit: btCurrency(result.totalProfit),

    backtestReturn: btPercent(result.totalReturn),

    backtestDrawdown: btPercent(result.maxDrawdown),

    backtestTrades: result.totalTrades,

    backtestWinRate: btPercent(result.winRate),

    backtestProfitFactor:
      Number.isFinite(result.profitFactor)
        ? result.profitFactor.toFixed(2)
        : '∞',

    backtestFees: btCurrency(result.totalFees),

    backtestBuyHold: btPercent(result.buyAndHoldReturn)
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = btElement(id);

    if (element) {
      element.textContent = value;
    }
  });

  const profitElement = btElement('backtestProfit');

  if (profitElement) {
    profitElement.className =
      result.totalProfit >= 0
        ? 'positive'
        : 'negative';
  }

  renderBacktestTrades(result.trades);

  renderBacktestChart(result.equityCurve);
}

/* ---------------------------------------------------------
   RENDER TRADE HISTORY
--------------------------------------------------------- */

function renderBacktestTrades(trades) {
  const container = btElement('backtestTradeHistory');

  if (!container) return;

  if (!trades.length) {
    container.innerHTML =
      '<p>No trades generated by this strategy.</p>';

    return;
  }

  container.innerHTML = trades.map(trade => `
    <tr>
      <td>${new Date(trade.entryTime * 1000).toLocaleString()}</td>

      <td>${new Date(trade.exitTime * 1000).toLocaleString()}</td>

      <td>${btCurrency(trade.entryPrice)}</td>

      <td>${btCurrency(trade.exitPrice)}</td>

      <td>${trade.quantity.toFixed(6)}</td>

      <td class="${trade.profitLoss >= 0 ? 'positive' : 'negative'}">
        ${btCurrency(trade.profitLoss)}
      </td>

      <td>
        ${btPercent(trade.returnPercentage)}
      </td>
    </tr>
  `).join('');
}

/* ---------------------------------------------------------
   RENDER EQUITY CURVE
--------------------------------------------------------- */

function renderBacktestChart(curve) {
  const container = btElement('backtestChart');

  if (!container || !window.LightweightCharts) return;

  if (Backtest.chart) {
    Backtest.chart.remove();
  }

  Backtest.chart = LightweightCharts.createChart(
    container,
    {
      width: container.clientWidth,
      height: 280,

      layout: {
        background: {
          type: 'solid',
          color: '#101722'
        },

        textColor: '#A8B3C7'
      },

      grid: {
        vertLines: {
          color: 'rgba(255,255,255,0.05)'
        },

        horzLines: {
          color: 'rgba(255,255,255,0.05)'
        }
      },

      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal
      },

      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)'
      },

      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)'
      }
    }
  );

  const series = Backtest.chart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#16C784',
      lineWidth: 2,
      title: 'Strategy equity'
    }
  );

  series.setData(curve);

  Backtest.chart.timeScale().fitContent();
}

/* ---------------------------------------------------------
   FORM INITIALIZATION
--------------------------------------------------------- */

function initializeBacktestForm() {
  const form = btElement('backtestForm');

  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const symbol = btElement('backtestSymbol').value;

      const strategy = btElement('backtestStrategy').value;

      const capital = Number(
        btElement('backtestCapital').value
      );

      const fee = Number(
        btElement('backtestFee').value
      ) / 100;

      const interval = btElement('backtestInterval').value;

      const range = btElement('backtestRange').value;

      const status = btElement('backtestStatus');

      if (status) {
        status.textContent = 'Loading historical data...';
      }

      const candles =
        await window.CryptoAPI.getHistoricalData(
          symbol,
          range,
          interval
        );

      if (status) {
        status.textContent = 'Running historical simulation...';
      }

      const result = runBacktest(candles, {
        strategy,
        initialCapital: capital,
        tradingFee: fee
      });

      renderBacktestResults(result);

      if (status) {
        status.textContent =
          'Backtest completed. Historical results are not predictive.';
      }

    } catch (error) {
      console.error('Backtest failed:', error);

      const status = btElement('backtestStatus');

      if (status) {
        status.textContent = error.message;
      }
    }
  });
}

/* ---------------------------------------------------------
   EXPORT RESULTS
--------------------------------------------------------- */

function exportBacktestCSV() {
  if (!Backtest.results) {
    alert('Run a backtest first.');
    return;
  }

  const trades = Backtest.results.trades;

  const headers = [
    'Entry Time',
    'Exit Time',
    'Entry Price',
    'Exit Price',
    'Quantity',
    'Profit Loss',
    'Return Percentage'
  ];

  const rows = trades.map(trade => [
    new Date(trade.entryTime * 1000).toISOString(),
    new Date(trade.exitTime * 1000).toISOString(),
    trade.entryPrice,
    trade.exitPrice,
    trade.quantity,
    trade.profitLoss,
    trade.returnPercentage
  ]);

  const csv = [headers, ...rows]
    .map(row =>
      row.map(value =>
        '"' + String(value).replace(/"/g, '""') + '"'
      ).join(',')
    )
    .join('\n');

  const blob = new Blob(
    [csv],
    { type: 'text/csv;charset=utf-8;' }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;

  link.download = 'crypto-backtest-results.csv';

  link.click();

  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

function initializeBacktest() {
  initializeBacktestForm();

  console.info('Backtest engine initialized.');
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoBacktest = {
  runBacktest,

  renderBacktestResults,

  calculateBacktestIndicators,

  getBacktestSignal,

  exportBacktestCSV,

  getResults() {
    return Backtest.results;
  },

  getTrades() {
    return [...Backtest.trades];
  },

  setSettings(settings) {
    Backtest.settings = {
      ...Backtest.settings,
      ...settings
    };
  }
};

/* ---------------------------------------------------------
   START
--------------------------------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeBacktest
  );
} else {
  initializeBacktest();
}

console.info(
  'Crypto Intelligence Terminal backtest engine loaded.'
);
