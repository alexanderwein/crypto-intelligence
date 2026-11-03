/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   ADVANCED TECHNICAL INDICATORS
   File: js/advanced-indicators.js
========================================================= */

'use strict';

const CryptoAdvancedIndicators = {

  prepare(candles) {
    if (!Array.isArray(candles)) {
      throw new Error('Candles must be an array.');
    }

    return candles.filter(c =>
      Number.isFinite(Number(c.open)) &&
      Number.isFinite(Number(c.high)) &&
      Number.isFinite(Number(c.low)) &&
      Number.isFinite(Number(c.close)) &&
      Number.isFinite(Number(c.volume)) &&
      Number(c.high) >= Number(c.low) &&
      Number(c.close) > 0
    ).map(c => ({
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume),
      time: c.time
    }));
  },

  sma(values, period) {
    const result = Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);

      result[i] = slice.reduce(
        (sum, value) => sum + value, 0
      ) / period;
    }

    return result;
  },

  ema(values, period) {
    const result = Array(values.length).fill(null);

    if (values.length < period) return result;

    const multiplier = 2 / (period + 1);

    let previous = values.slice(0, period)
      .reduce((sum, value) => sum + value, 0) / period;

    result[period - 1] = previous;

    for (let i = period; i < values.length; i++) {
      previous += multiplier * (values[i] - previous);
      result[i] = previous;
    }

    return result;
  },

  bollingerBands(values, period = 20, multiplier = 2) {
    const middle = this.sma(values, period);
    const upper = Array(values.length).fill(null);
    const lower = Array(values.length).fill(null);
    const bandwidth = Array(values.length).fill(null);
    const percentB = Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = middle[i];

      const variance = slice.reduce(
        (sum, value) => sum + (value - mean) ** 2,
        0
      ) / period;

      const deviation = Math.sqrt(variance);

      upper[i] = mean + multiplier * deviation;
      lower[i] = mean - multiplier * deviation;

      bandwidth[i] = mean !== 0
        ? (upper[i] - lower[i]) / mean * 100
        : null;

      percentB[i] = upper[i] !== lower[i]
        ? (values[i] - lower[i]) / (upper[i] - lower[i])
        : null;
    }

    return { upper, middle, lower, bandwidth, percentB };
  },

  rsi(values, period = 14) {
    const result = Array(values.length).fill(null);

    if (values.length <= period) return result;

    let gain = 0;
    let loss = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      gain += Math.max(change, 0);
      loss += Math.max(-change, 0);
    }

    let avgGain = gain / period;
    let avgLoss = loss / period;

    const value = () => avgLoss === 0
      ? 100
      : 100 - 100 / (1 + avgGain / avgLoss);

    result[period] = value();

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      avgGain = (
        avgGain * (period - 1) + Math.max(change, 0)
      ) / period;

      avgLoss = (
        avgLoss * (period - 1) + Math.max(-change, 0)
      ) / period;

      result[i] = value();
    }

    return result;
  },

  stochasticRSI(values, period = 14, smoothK = 3, smoothD = 3) {
    const rsi = this.rsi(values, period);
    const raw = Array(values.length).fill(null);

    for (let i = period * 2 - 1; i < values.length; i++) {
      const slice = rsi.slice(i - period + 1, i + 1);

      if (slice.some(v => v === null)) continue;

      const min = Math.min(...slice);
      const max = Math.max(...slice);

      raw[i] = max === min
        ? 0
        : (rsi[i] - min) / (max - min) * 100;
    }

    const valid = raw.map(v => v ?? 0);
    const kValues = this.sma(valid, smoothK);
    const dValues = this.sma(
      kValues.map(v => v ?? 0), smoothD
    );

    return {
      rsi,
      k: kValues.map((v, i) => raw[i] === null ? null : v),
      d: dValues.map((v, i) => raw[i] === null ? null : v)
    };
  },

  atr(candles, period = 14) {
    const tr = candles.map((c, i) => {
      if (i === 0) return c.high - c.low;

      const previous = candles[i - 1].close;

      return Math.max(
        c.high - c.low,
        Math.abs(c.high - previous),
        Math.abs(c.low - previous)
      );
    });

    const result = Array(tr.length).fill(null);

    if (tr.length < period) return result;

    let previous = tr.slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

    result[period - 1] = previous;

    for (let i = period; i < tr.length; i++) {
      previous = (
        previous * (period - 1) + tr[i]
      ) / period;

      result[i] = previous;
    }

    return result;
  },

  adx(candles, period = 14) {
    const length = candles.length;
    const plusDM = Array(length).fill(0);
    const minusDM = Array(length).fill(0);
    const tr = Array(length).fill(0);

    for (let i = 1; i < length; i++) {
      const up = candles[i].high - candles[i - 1].high;
      const down = candles[i - 1].low - candles[i].low;

      plusDM[i] = up > down && up > 0 ? up : 0;
      minusDM[i] = down > up && down > 0 ? down : 0;

      tr[i] = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
    }

    const smooth = values => {
      const result = Array(length).fill(null);
      if (length <= period) return result;

      let sum = values.slice(1, period + 1)
        .reduce((a, b) => a + b, 0);

      result[period] = sum;

      for (let i = period + 1; i < length; i++) {
        sum = sum - sum / period + values[i];
        result[i] = sum;
      }

      return result;
    };

    const smoothedTR = smooth(tr);
    const smoothedPlus = smooth(plusDM);
    const smoothedMinus = smooth(minusDM);

    const plusDI = Array(length).fill(null);
    const minusDI = Array(length).fill(null);
    const dx = Array(length).fill(null);

    for (let i = period; i < length; i++) {
      if (!smoothedTR[i]) continue;

      plusDI[i] = smoothedPlus[i] / smoothedTR[i] * 100;
      minusDI[i] = smoothedMinus[i] / smoothedTR[i] * 100;

      const total = plusDI[i] + minusDI[i];

      dx[i] = total
        ? Math.abs(plusDI[i] - minusDI[i]) / total * 100
        : 0;
    }

    const adxValues = Array(length).fill(null);
    const first = period * 2 - 1;

    if (length > first) {
      const initial = dx.slice(period, first + 1)
        .filter(v => v !== null);

      let previous = initial.reduce((a, b) => a + b, 0)
        / initial.length;

      adxValues[first] = previous;

      for (let i = first + 1; i < length; i++) {
        if (dx[i] === null) continue;

        previous = (
          previous * (period - 1) + dx[i]
        ) / period;

        adxValues[i] = previous;
      }
    }

    return { adx: adxValues, plusDI, minusDI };
  },

  ichimoku(candles) {
    const length = candles.length;

    const tenkan = Array(length).fill(null);
    const kijun = Array(length).fill(null);
    const senkouA = Array(length).fill(null);
    const senkouB = Array(length).fill(null);
    const chikou = Array(length).fill(null);

    const midpoint = (index, period) => {
      if (index < period - 1) return null;

      const slice = candles.slice(index - period + 1, index + 1);

      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));

      return (high + low) / 2;
    };

    for (let i = 0; i < length; i++) {
      tenkan[i] = midpoint(i, 9);
      kijun[i] = midpoint(i, 26);

      senkouA[i] = tenkan[i] !== null && kijun[i] !== null
        ? (tenkan[i] + kijun[i]) / 2
        : null;

      senkouB[i] = midpoint(i, 52);
      chikou[i] = candles[i].close;
    }

    return { tenkan, kijun, senkouA, senkouB, chikou };
  },

  vwap(candles) {
    let cumulativeVolume = 0;
    let cumulativeValue = 0;

    return candles.map(c => {
      const typical = (c.high + c.low + c.close) / 3;

      cumulativeValue += typical * c.volume;
      cumulativeVolume += c.volume;

      return cumulativeVolume
        ? cumulativeValue / cumulativeVolume
        : null;
    });
  },

  fibonacci(candles, period = 100) {
    const slice = candles.slice(-period);
    if (!slice.length) return null;

    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const difference = high - low;

    return {
      high,
      low,
      levels: {
        '0': high,
        '0.236': high - difference * 0.236,
        '0.382': high - difference * 0.382,
        '0.5': high - difference * 0.5,
        '0.618': high - difference * 0.618,
        '0.786': high - difference * 0.786,
        '1': low
      }
    };
  },

  obv(candles) {
    const result = [0];

    for (let i = 1; i < candles.length; i++) {
      let value = result[i - 1];

      if (candles[i].close > candles[i - 1].close) {
        value += candles[i].volume;
      } else if (candles[i].close < candles[i - 1].close) {
        value -= candles[i].volume;
      }

      result.push(value);
    }

    return result;
  },

  cci(candles, period = 20) {
    const typical = candles.map(c =>
      (c.high + c.low + c.close) / 3
    );

    const result = Array(candles.length).fill(null);

    for (let i = period - 1; i < candles.length; i++) {
      const slice = typical.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;

      const deviation = slice.reduce(
        (sum, v) => sum + Math.abs(v - mean), 0
      ) / period;

      result[i] = deviation
        ? (typical[i] - mean) / (0.015 * deviation)
        : 0;
    }

    return result;
  },

  williamsR(candles, period = 14) {
    const result = Array(candles.length).fill(null);

    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.high));
      const lowest = Math.min(...slice.map(c => c.low));

      result[i] = highest === lowest
        ? -50
        : (candles[i].close - highest) /
          (highest - lowest) * 100;
    }

    return result;
  },

  parabolicSAR(candles, step = 0.02, maximum = 0.2) {
    const length = candles.length;
    const result = Array(length).fill(null);

    if (length < 2) return result;

    let bullish = candles[1].close >= candles[0].close;
    let acceleration = step;

    let extreme = bullish
      ? Math.max(candles[0].high, candles[1].high)
      : Math.min(candles[0].low, candles[1].low);

    let sar = bullish
      ? Math.min(candles[0].low, candles[1].low)
      : Math.max(candles[0].high, candles[1].high);

    result[1] = sar;

    for (let i = 2; i < length; i++) {
      sar += acceleration * (extreme - sar);

      if (bullish) {
        sar = Math.min(sar, candles[i - 1].low, candles[i - 2].low);

        if (candles[i].low < sar) {
          bullish = false;
          sar = extreme;
          extreme = candles[i].low;
          acceleration = step;
        } else if (candles[i].high > extreme) {
          extreme = candles[i].high;
          acceleration = Math.min(acceleration + step, maximum);
        }
      } else {
        sar = Math.max(sar, candles[i - 1].high, candles[i - 2].high);

        if (candles[i].high > sar) {
          bullish = true;
          sar = extreme;
          extreme = candles[i].high;
          acceleration = step;
        } else if (candles[i].low < extreme) {
          extreme = candles[i].low;
          acceleration = Math.min(acceleration + step, maximum);
        }
      }

      result[i] = sar;
    }

    return result;
  },

  donchian(candles, period = 20) {
    const upper = Array(candles.length).fill(null);
    const lower = Array(candles.length).fill(null);
    const middle = Array(candles.length).fill(null);

    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);

      upper[i] = Math.max(...slice.map(c => c.high));
      lower[i] = Math.min(...slice.map(c => c.low));
      middle[i] = (upper[i] + lower[i]) / 2;
    }

    return { upper, middle, lower };
  },

  roc(values, period = 12) {
    const result = Array(values.length).fill(null);

    for (let i = period; i < values.length; i++) {
      const previous = values[i - period];

      result[i] = previous
        ? (values[i] / previous - 1) * 100
        : null;
    }

    return result;
  },

  mfi(candles, period = 14) {
    const result = Array(candles.length).fill(null);

    const typical = candles.map(c =>
      (c.high + c.low + c.close) / 3
    );

    const flow = typical.map((price, i) =>
      price * candles[i].volume
    );

    for (let i = period; i < candles.length; i++) {
      let positive = 0;
      let negative = 0;

      for (let j = i - period + 1; j <= i; j++) {
        if (typical[j] > typical[j - 1]) {
          positive += flow[j];
        } else if (typical[j] < typical[j - 1]) {
          negative += flow[j];
        }
      }

      result[i] = negative === 0
        ? 100
        : 100 - 100 / (1 + positive / negative);
    }

    return result;
  },

  calculateAll(input) {
    const candles = this.prepare(input.candles || input);

    if (candles.length < 52) {
      throw new Error('At least 52 valid candles are required.');
    }

    const closes = candles.map(c => c.close);

    return {
      symbol: input.symbol || null,
      count: candles.length,
      timestamp: Date.now(),

      sma20: this.sma(closes, 20),
      ema20: this.ema(closes, 20),
      ema50: this.ema(closes, 50),
      ema200: this.ema(closes, 200),

      rsi: this.rsi(closes),
      stochasticRSI: this.stochasticRSI(closes),

      bollinger: this.bollingerBands(closes),
      atr: this.atr(candles),
      adx: this.adx(candles),

      ichimoku: this.ichimoku(candles),
      vwap: this.vwap(candles),

      fibonacci: this.fibonacci(candles),
      obv: this.obv(candles),

      cci: this.cci(candles),
      williamsR: this.williamsR(candles),

      parabolicSAR: this.parabolicSAR(candles),
      donchian: this.donchian(candles),

      roc: this.roc(closes),
      mfi: this.mfi(candles)
    };
  },

  getLatest(input) {
    const result = this.calculateAll(input);

    const last = array =>
      array && array.length ? array[array.length - 1] : null;

    const candles = this.prepare(input.candles || input);

    return {
      symbol: result.symbol,
      price: candles[candles.length - 1].close,

      RSI: last(result.rsi),
      EMA20: last(result.ema20),
      EMA50: last(result.ema50),
      EMA200: last(result.ema200),

      ATR: last(result.atr),
      ADX: last(result.adx.adx),

      StochasticK: last(result.stochasticRSI.k),
      StochasticD: last(result.stochasticRSI.d),

      BollingerUpper: last(result.bollinger.upper),
      BollingerMiddle: last(result.bollinger.middle),
      BollingerLower: last(result.bollinger.lower),

      VWAP: last(result.vwap),
      CCI: last(result.cci),
      WilliamsR: last(result.williamsR),

      OBV: last(result.obv),
      MFI: last(result.mfi),
      ROC: last(result.roc),

      ParabolicSAR: last(result.parabolicSAR),

      DonchianUpper: last(result.donchian.upper),
      DonchianLower: last(result.donchian.lower),

      Fibonacci: result.fibonacci
    };
  }
};

window.CryptoAdvancedIndicators = CryptoAdvancedIndicators;

console.info('Crypto advanced indicators loaded.');
