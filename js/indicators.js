/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   TECHNICAL ANALYSIS ENGINE
   File: js/indicators.js
========================================================= */

'use strict';

/* ---------------------------------------------------------
   DATA VALIDATION
--------------------------------------------------------- */

function validateCandles(candles) {
  if (!Array.isArray(candles)) {
    throw new TypeError('Candles must be an array.');
  }

  return candles.filter(candle =>
    Number.isFinite(Number(candle.close)) &&
    Number.isFinite(Number(candle.high)) &&
    Number.isFinite(Number(candle.low)) &&
    Number.isFinite(Number(candle.open))
  );
}

/* ---------------------------------------------------------
   SIMPLE MOVING AVERAGE
--------------------------------------------------------- */

function calculateSMA(values, period = 20) {
  const result = new Array(values.length).fill(null);

  if (period < 1) return result;

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);

    result[i] = slice.reduce(
      (sum, value) => sum + value, 0
    ) / period;
  }

  return result;
}

/* ---------------------------------------------------------
   EXPONENTIAL MOVING AVERAGE
--------------------------------------------------------- */

function calculateEMA(values, period = 20) {
  const result = new Array(values.length).fill(null);

  if (period < 1 || values.length < period) return result;

  const multiplier = 2 / (period + 1);

  let previous = values
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0) / period;

  result[period - 1] = previous;

  for (let i = period; i < values.length; i++) {
    previous =
      (values[i] - previous) * multiplier + previous;

    result[i] = previous;
  }

  return result;
}

/* ---------------------------------------------------------
   RELATIVE STRENGTH INDEX
   Wilder smoothing
--------------------------------------------------------- */

function calculateRSI(values, period = 14) {
  const result = new Array(values.length).fill(null);

  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];

    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  function rsiValue() {
    if (averageLoss === 0) return 100;

    const rs = averageGain / averageLoss;

    return 100 - (100 / (1 + rs));
  }

  result[period] = rsiValue();

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];

    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain =
      (averageGain * (period - 1) + gain) / period;

    averageLoss =
      (averageLoss * (period - 1) + loss) / period;

    result[i] = rsiValue();
  }

  return result;
}

/* ---------------------------------------------------------
   MACD
--------------------------------------------------------- */

function calculateMACD(
  values,
  fast = 12,
  slow = 26,
  signal = 9
) {
  const fastEMA = calculateEMA(values, fast);
  const slowEMA = calculateEMA(values, slow);

  const macdLine = values.map((_, i) => {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      return null;
    }

    return fastEMA[i] - slowEMA[i];
  });

  const validStart = slow - 1;

  const validValues = macdLine
    .slice(validStart)
    .map(value => value === null ? 0 : value);

  const signalValues = calculateEMA(
    validValues,
    signal
  );

  const signalLine = new Array(values.length).fill(null);

  signalValues.forEach((value, i) => {
    signalLine[validStart + i] = value;
  });

  const histogram = macdLine.map((value, i) => {
    if (value === null || signalLine[i] === null) {
      return null;
    }

    return value - signalLine[i];
  });

  return {
    macd: macdLine,
    signal: signalLine,
    histogram
  };
}

/* ---------------------------------------------------------
   BOLLINGER BANDS
--------------------------------------------------------- */

function calculateBollingerBands(
  values,
  period = 20,
  multiplier = 2
) {
  const middle = calculateSMA(values, period);

  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(
      i - period + 1,
      i + 1
    );

    const mean = middle[i];

    const variance = slice.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / period;

    const deviation = Math.sqrt(variance);

    upper[i] = mean + multiplier * deviation;
    lower[i] = mean - multiplier * deviation;
  }

  return {
    upper,
    middle,
    lower
  };
}

/* ---------------------------------------------------------
   STOCHASTIC OSCILLATOR
--------------------------------------------------------- */

function calculateStochastic(
  candles,
  kPeriod = 14,
  dPeriod = 3
) {
  const k = new Array(candles.length).fill(null);

  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(
      i - kPeriod + 1,
      i + 1
    );

    const highest = Math.max(
      ...slice.map(candle => candle.high)
    );

    const lowest = Math.min(
      ...slice.map(candle => candle.low)
    );

    const close = candles[i].close;

    k[i] = highest === lowest
      ? 50
      : ((close - lowest) / (highest - lowest)) * 100;
  }

  const validStart = kPeriod - 1;

  const validK = k.slice(validStart).map(
    value => value === null ? 0 : value
  );

  const dValues = calculateSMA(validK, dPeriod);

  const d = new Array(candles.length).fill(null);

  dValues.forEach((value, i) => {
    d[validStart + i] = value;
  });

  return { k, d };
}

/* ---------------------------------------------------------
   TRUE RANGE
--------------------------------------------------------- */

function calculateTrueRange(candles) {
  return candles.map((candle, i) => {
    if (i === 0) {
      return candle.high - candle.low;
    }

    const previousClose = candles[i - 1].close;

    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
}

/* ---------------------------------------------------------
   AVERAGE TRUE RANGE
--------------------------------------------------------- */

function calculateATR(candles, period = 14) {
  const ranges = calculateTrueRange(candles);

  const result = new Array(candles.length).fill(null);

  if (candles.length < period) return result;

  let previous = ranges
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0) / period;

  result[period - 1] = previous;

  for (let i = period; i < ranges.length; i++) {
    previous =
      (previous * (period - 1) + ranges[i]) / period;

    result[i] = previous;
  }

  return result;
}

/* ---------------------------------------------------------
   DIRECTIONAL MOVEMENT / ADX
--------------------------------------------------------- */

function calculateADX(candles, period = 14) {
  const length = candles.length;

  const plusDM = new Array(length).fill(0);
  const minusDM = new Array(length).fill(0);

  const ranges = calculateTrueRange(candles);

  for (let i = 1; i < length; i++) {
    const upMove =
      candles[i].high - candles[i - 1].high;

    const downMove =
      candles[i - 1].low - candles[i].low;

    if (upMove > downMove && upMove > 0) {
      plusDM[i] = upMove;
    }

    if (downMove > upMove && downMove > 0) {
      minusDM[i] = downMove;
    }
  }

  const plusDI = new Array(length).fill(null);
  const minusDI = new Array(length).fill(null);
  const adx = new Array(length).fill(null);

  if (length < period * 2) {
    return { plusDI, minusDI, adx };
  }

  let smoothTR = ranges.slice(1, period + 1)
    .reduce((sum, value) => sum + value, 0);

  let smoothPlus = plusDM.slice(1, period + 1)
    .reduce((sum, value) => sum + value, 0);

  let smoothMinus = minusDM.slice(1, period + 1)
    .reduce((sum, value) => sum + value, 0);

  const dx = new Array(length).fill(null);

  for (let i = period; i < length; i++) {
    if (i > period) {
      smoothTR =
        smoothTR - smoothTR / period + ranges[i];

      smoothPlus =
        smoothPlus - smoothPlus / period + plusDM[i];

      smoothMinus =
        smoothMinus - smoothMinus / period + minusDM[i];
    }

    plusDI[i] = smoothTR
      ? 100 * smoothPlus / smoothTR
      : 0;

    minusDI[i] = smoothTR
      ? 100 * smoothMinus / smoothTR
      : 0;

    const total = plusDI[i] + minusDI[i];

    dx[i] = total
      ? 100 * Math.abs(plusDI[i] - minusDI[i]) / total
      : 0;
  }

  const firstADX = period * 2 - 1;

  let initial = dx.slice(
    period,
    firstADX + 1
  ).reduce((sum, value) => sum + value, 0) / period;

  adx[firstADX] = initial;

  for (let i = firstADX + 1; i < length; i++) {
    initial =
      (initial * (period - 1) + dx[i]) / period;

    adx[i] = initial;
  }

  return { plusDI, minusDI, adx };
}

/* ---------------------------------------------------------
   VOLUME WEIGHTED AVERAGE PRICE
   Cumulative VWAP over supplied candles.
--------------------------------------------------------- */

function calculateVWAP(candles) {
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  return candles.map(candle => {
    const typicalPrice =
      (candle.high + candle.low + candle.close) / 3;

    const volume = Number(candle.volume) || 0;

    cumulativePV += typicalPrice * volume;
    cumulativeVolume += volume;

    return cumulativeVolume
      ? cumulativePV / cumulativeVolume
      : null;
  });
}

/* ---------------------------------------------------------
   ON BALANCE VOLUME
--------------------------------------------------------- */

function calculateOBV(candles) {
  let obv = 0;

  return candles.map((candle, i) => {
    const volume = Number(candle.volume) || 0;

    if (i > 0) {
      if (candle.close > candles[i - 1].close) {
        obv += volume;
      } else if (
        candle.close < candles[i - 1].close
      ) {
        obv -= volume;
      }
    }

    return obv;
  });
}

/* ---------------------------------------------------------
   COMMODITY CHANNEL INDEX
--------------------------------------------------------- */

function calculateCCI(candles, period = 20) {
  const typicalPrices = candles.map(candle =>
    (candle.high + candle.low + candle.close) / 3
  );

  const result = new Array(candles.length).fill(null);

  for (let i = period - 1; i < candles.length; i++) {
    const slice = typicalPrices.slice(
      i - period + 1,
      i + 1
    );

    const mean = slice.reduce(
      (sum, value) => sum + value, 0
    ) / period;

    const meanDeviation = slice.reduce(
      (sum, value) => sum + Math.abs(value - mean), 0
    ) / period;

    result[i] = meanDeviation === 0
      ? 0
      : (typicalPrices[i] - mean) /
        (0.015 * meanDeviation);
  }

  return result;
}

/* ---------------------------------------------------------
   WILLIAMS %R
--------------------------------------------------------- */

function calculateWilliamsR(candles, period = 14) {
  const result = new Array(candles.length).fill(null);

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(
      i - period + 1,
      i + 1
    );

    const highest = Math.max(
      ...slice.map(candle => candle.high)
    );

    const lowest = Math.min(
      ...slice.map(candle => candle.low)
    );

    result[i] = highest === lowest
      ? -50
      : ((highest - candles[i].close) /
        (highest - lowest)) * -100;
  }

  return result;
}

/* ---------------------------------------------------------
   MONEY FLOW INDEX
--------------------------------------------------------- */

function calculateMFI(candles, period = 14) {
  const result = new Array(candles.length).fill(null);

  const typicalPrices = candles.map(candle =>
    (candle.high + candle.low + candle.close) / 3
  );

  const flows = candles.map((candle, i) => ({
    positive: 0,
    negative: 0,
    flow: typicalPrices[i] *
      (Number(candle.volume) || 0)
  }));

  for (let i = 1; i < candles.length; i++) {
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      flows[i].positive = flows[i].flow;
    } else if (
      typicalPrices[i] < typicalPrices[i - 1]
    ) {
      flows[i].negative = flows[i].flow;
    }
  }

  for (let i = period; i < candles.length; i++) {
    const slice = flows.slice(
      i - period + 1,
      i + 1
    );

    const positive = slice.reduce(
      (sum, item) => sum + item.positive, 0
    );

    const negative = slice.reduce(
      (sum, item) => sum + item.negative, 0
    );

    result[i] = negative === 0
      ? 100
      : 100 - 100 / (1 + positive / negative);
  }

  return result;
}

/* ---------------------------------------------------------
   ICHIMOKU CLOUD
--------------------------------------------------------- */

function calculateIchimoku(
  candles,
  conversionPeriod = 9,
  basePeriod = 26,
  spanBPeriod = 52
) {
  const length = candles.length;

  const conversion = new Array(length).fill(null);
  const base = new Array(length).fill(null);
  const spanA = new Array(length).fill(null);
  const spanB = new Array(length).fill(null);
  const lagging = new Array(length).fill(null);

  function midpoint(index, period) {
    const slice = candles.slice(
      index - period + 1,
      index + 1
    );

    const high = Math.max(
      ...slice.map(candle => candle.high)
    );

    const low = Math.min(
      ...slice.map(candle => candle.low)
    );

    return (high + low) / 2;
  }

  for (let i = 0; i < length; i++) {
    if (i >= conversionPeriod - 1) {
      conversion[i] = midpoint(i, conversionPeriod);
    }

    if (i >= basePeriod - 1) {
      base[i] = midpoint(i, basePeriod);
    }

    if (conversion[i] !== null && base[i] !== null) {
      spanA[i] = (conversion[i] + base[i]) / 2;
    }

    if (i >= spanBPeriod - 1) {
      spanB[i] = midpoint(i, spanBPeriod);
    }

    if (i >= basePeriod) {
      lagging[i - basePeriod] = candles[i].close;
    }
  }

  return {
    conversion,
    base,
    spanA,
    spanB,
    lagging
  };
}

/* ---------------------------------------------------------
   MASTER TECHNICAL ANALYSIS FUNCTION
--------------------------------------------------------- */

function calculateAllIndicators(inputCandles) {
  const candles = validateCandles(inputCandles);

  if (!candles.length) {
    throw new Error('Insufficient valid candle data.');
  }

  const closes = candles.map(candle => candle.close);

  const config = window.INDICATOR_CONFIG;

  const sma = {};

  config.sma.periods.forEach(period => {
    sma[period] = calculateSMA(closes, period);
  });

  const ema = {};

  config.ema.periods.forEach(period => {
    ema[period] = calculateEMA(closes, period);
  });

  const rsi = calculateRSI(
    closes,
    config.rsi.period
  );

  const macd = calculateMACD(
    closes,
    config.macd.fastPeriod,
    config.macd.slowPeriod,
    config.macd.signalPeriod
  );

  const bollinger = calculateBollingerBands(
    closes,
    config.bollinger.period,
    config.bollinger.standardDeviation
  );

  const stochastic = calculateStochastic(
    candles,
    config.stochastic.kPeriod,
    config.stochastic.dPeriod
  );

  const atr = calculateATR(
    candles,
    config.atr.period
  );

  const adx = calculateADX(
    candles,
    config.adx.period
  );

  const vwap = calculateVWAP(candles);

  const obv = calculateOBV(candles);

  const cci = calculateCCI(
    candles,
    config.cci.period
  );

  const williamsR = calculateWilliamsR(
    candles,
    config.williamsR.period
  );

  const mfi = calculateMFI(
    candles,
    config.mfi.period
  );

  const ichimoku = calculateIchimoku(
    candles,
    config.ichimoku.conversionPeriod,
    config.ichimoku.basePeriod,
    config.ichimoku.spanBPeriod
  );

  return {
    candles,
    sma,
    ema,
    rsi,
    macd,
    bollinger,
    stochastic,
    atr,
    adx,
    vwap,
    obv,
    cci,
    williamsR,
    mfi,
    ichimoku,

    calculatedAt: new Date().toISOString(),

    candleCount: candles.length
  };
}

/* ---------------------------------------------------------
   GET LATEST INDICATOR VALUES
--------------------------------------------------------- */

function getLatestIndicators(indicators) {
  const index = indicators.candles.length - 1;

  if (index < 0) return null;

  function latest(series) {
    return series?.[index] ?? null;
  }

  const sma = {};

  Object.entries(indicators.sma).forEach(
    ([period, values]) => {
      sma[period] = latest(values);
    }
  );

  const ema = {};

  Object.entries(indicators.ema).forEach(
    ([period, values]) => {
      ema[period] = latest(values);
    }
  );

  return {
    price: indicators.candles[index].close,

    sma,
    ema,

    rsi: latest(indicators.rsi),

    macd: {
      line: latest(indicators.macd.macd),
      signal: latest(indicators.macd.signal),
      histogram: latest(indicators.macd.histogram)
    },

    bollinger: {
      upper: latest(indicators.bollinger.upper),
      middle: latest(indicators.bollinger.middle),
      lower: latest(indicators.bollinger.lower)
    },

    stochastic: {
      k: latest(indicators.stochastic.k),
      d: latest(indicators.stochastic.d)
    },

    atr: latest(indicators.atr),

    adx: latest(indicators.adx.adx),

    plusDI: latest(indicators.adx.plusDI),

    minusDI: latest(indicators.adx.minusDI),

    vwap: latest(indicators.vwap),

    obv: latest(indicators.obv),

    cci: latest(indicators.cci),

    williamsR: latest(indicators.williamsR),

    mfi: latest(indicators.mfi),

    ichimoku: {
      conversion: latest(indicators.ichimoku.conversion),
      base: latest(indicators.ichimoku.base),
      spanA: latest(indicators.ichimoku.spanA),
      spanB: latest(indicators.ichimoku.spanB),
      lagging: latest(indicators.ichimoku.lagging)
    }
  };
}

/* ---------------------------------------------------------
   EXPORT ENGINE
--------------------------------------------------------- */

window.TechnicalIndicators = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateTrueRange,
  calculateATR,
  calculateADX,
  calculateVWAP,
  calculateOBV,
  calculateCCI,
  calculateWilliamsR,
  calculateMFI,
  calculateIchimoku,

  calculateAllIndicators,
  getLatestIndicators
};

console.info(
  'Crypto Intelligence Terminal technical analysis engine loaded.'
);
