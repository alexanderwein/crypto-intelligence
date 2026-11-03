/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   TRADING SIGNAL ENGINE
   File: js/signals.js

   Signals are analytical estimates, not guarantees.
========================================================= */

'use strict';

/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const SIGNAL_ENGINE_CONFIG = {
  minimumConfidence: 65,

  strongBuy: 80,
  buy: 65,

  neutral: 45,
  sell: 35,
  strongSell: 20,

  minimumConfirmations: 3,

  stopLossATR: 2,
  takeProfitATR: 3,

  minimumRiskReward: 1.5
};

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function signalNumber(value) {
  return Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

function signalLatest(values) {
  if (!Array.isArray(values) || !values.length) {
    return null;
  }

  return signalNumber(values[values.length - 1]);
}

function signalDirection(value, threshold = 0) {
  if (value === null) return 'neutral';

  if (value > threshold) return 'bullish';

  if (value < -threshold) return 'bearish';

  return 'neutral';
}

/* ---------------------------------------------------------
   INDIVIDUAL INDICATOR ANALYSIS
--------------------------------------------------------- */

function analyzeRSI(value) {
  if (value === null) {
    return { direction: 'neutral', weight: 0 };
  }

  if (value < 30) {
    return {
      direction: 'bullish',
      weight: 2,
      reason: 'RSI indicates oversold conditions'
    };
  }

  if (value > 70) {
    return {
      direction: 'bearish',
      weight: 2,
      reason: 'RSI indicates overbought conditions'
    };
  }

  if (value > 50) {
    return {
      direction: 'bullish',
      weight: 1,
      reason: 'RSI is above 50'
    };
  }

  if (value < 50) {
    return {
      direction: 'bearish',
      weight: 1,
      reason: 'RSI is below 50'
    };
  }

  return {
    direction: 'neutral',
    weight: 0,
    reason: 'RSI is neutral'
  };
}

function analyzeMACD(macd) {
  if (!macd) {
    return { direction: 'neutral', weight: 0 };
  }

  const line = signalNumber(macd.line);
  const signal = signalNumber(macd.signal);
  const histogram = signalNumber(macd.histogram);

  if (
    line === null ||
    signal === null ||
    histogram === null
  ) {
    return { direction: 'neutral', weight: 0 };
  }

  if (line > signal && histogram > 0) {
    return {
      direction: 'bullish',
      weight: 2,
      reason: 'MACD is above its signal line'
    };
  }

  if (line < signal && histogram < 0) {
    return {
      direction: 'bearish',
      weight: 2,
      reason: 'MACD is below its signal line'
    };
  }

  return {
    direction: 'neutral',
    weight: 0,
    reason: 'MACD has no clear confirmation'
  };
}

function analyzeMovingAverages(price, indicators) {
  const ema20 = signalNumber(indicators.ema?.[20]);
  const ema50 = signalNumber(indicators.ema?.[50]);
  const ema200 = signalNumber(indicators.ema?.[200]);

  let score = 0;

  if (ema20 !== null && price > ema20) score++;
  if (ema20 !== null && price < ema20) score--;

  if (ema50 !== null && price > ema50) score++;
  if (ema50 !== null && price < ema50) score--;

  if (ema200 !== null && price > ema200) score++;
  if (ema200 !== null && price < ema200) score--;

  if (ema20 !== null && ema50 !== null) {
    if (ema20 > ema50) score++;
    if (ema20 < ema50) score--;
  }

  if (score >= 2) {
    return {
      direction: 'bullish',
      weight: 2,
      reason: 'Moving averages support an upward trend'
    };
  }

  if (score <= -2) {
    return {
      direction: 'bearish',
      weight: 2,
      reason: 'Moving averages support a downward trend'
    };
  }

  return {
    direction: 'neutral',
    weight: 0,
    reason: 'Moving averages show mixed conditions'
  };
}

function analyzeBollinger(price, bands) {
  if (!bands) {
    return { direction: 'neutral', weight: 0 };
  }

  const upper = signalNumber(bands.upper);
  const lower = signalNumber(bands.lower);
  const middle = signalNumber(bands.middle);

  if (
    upper === null ||
    lower === null ||
    middle === null
  ) {
    return { direction: 'neutral', weight: 0 };
  }

  if (price < lower) {
    return {
      direction: 'bullish',
      weight: 1,
      reason: 'Price is below the lower Bollinger Band'
    };
  }

  if (price > upper) {
    return {
      direction: 'bearish',
      weight: 1,
      reason: 'Price is above the upper Bollinger Band'
    };
  }

  if (price > middle) {
    return {
      direction: 'bullish',
      weight: 1,
      reason: 'Price is above the Bollinger midpoint'
    };
  }

  if (price < middle) {
    return {
      direction: 'bearish',
      weight: 1,
      reason: 'Price is below the Bollinger midpoint'
    };
  }

  return {
    direction: 'neutral',
    weight: 0
  };
}

function analyzeADX(adx, plusDI, minusDI) {
  if (
    adx === null ||
    plusDI === null ||
    minusDI === null
  ) {
    return { direction: 'neutral', weight: 0 };
  }

  if (adx < 20) {
    return {
      direction: 'neutral',
      weight: 0,
      reason: 'ADX indicates a weak or unclear trend'
    };
  }

  if (adx >= 25 && plusDI > minusDI) {
    return {
      direction: 'bullish',
      weight: 2,
      reason: 'ADX confirms bullish directional strength'
    };
  }

  if (adx >= 25 && minusDI > plusDI) {
    return {
      direction: 'bearish',
      weight: 2,
      reason: 'ADX confirms bearish directional strength'
    };
  }

  return {
    direction: 'neutral',
    weight: 0,
    reason: 'Trend strength is not sufficiently established'
  };
}

function analyzeStochastic(stochastic) {
  if (!stochastic) {
    return { direction: 'neutral', weight: 0 };
  }

  const k = signalNumber(stochastic.k);
  const d = signalNumber(stochastic.d);

  if (k === null || d === null) {
    return { direction: 'neutral', weight: 0 };
  }

  if (k < 20 && k > d) {
    return {
      direction: 'bullish',
      weight: 1,
      reason: 'Stochastic indicates an oversold bullish crossover'
    };
  }

  if (k > 80 && k < d) {
    return {
      direction: 'bearish',
      weight: 1,
      reason: 'Stochastic indicates an overbought bearish crossover'
    };
  }

  return {
    direction: 'neutral',
    weight: 0
  };
}

function analyzeVolume(vwap, price, mfi) {
  let score = 0;
  const reasons = [];

  if (vwap !== null && price > vwap) {
    score++;
    reasons.push('Price is above VWAP');
  } else if (vwap !== null && price < vwap) {
    score--;
    reasons.push('Price is below VWAP');
  }

  if (mfi !== null && mfi > 50) {
    score++;
    reasons.push('Money flow is positive');
  } else if (mfi !== null && mfi < 50) {
    score--;
    reasons.push('Money flow is negative');
  }

  if (score > 0) {
    return {
      direction: 'bullish',
      weight: 1,
      reason: reasons.join('; ')
    };
  }

  if (score < 0) {
    return {
      direction: 'bearish',
      weight: 1,
      reason: reasons.join('; ')
    };
  }

  return {
    direction: 'neutral',
    weight: 0,
    reason: 'Volume analysis is neutral'
  };
}

/* ---------------------------------------------------------
   ANALYZE ALL INDICATORS
--------------------------------------------------------- */

function analyzeTechnicalConditions(latest) {
  const price = signalNumber(latest.price);

  if (price === null || price <= 0) {
    throw new Error('Invalid market price.');
  }

  const analyses = {
    RSI: analyzeRSI(latest.rsi),

    MACD: analyzeMACD(latest.macd),

    MovingAverages: analyzeMovingAverages(
      price,
      latest
    ),

    Bollinger: analyzeBollinger(
      price,
      latest.bollinger
    ),

    ADX: analyzeADX(
      latest.adx,
      latest.plusDI,
      latest.minusDI
    ),

    Stochastic: analyzeStochastic(
      latest.stochastic
    ),

    Volume: analyzeVolume(
      signalNumber(latest.vwap),
      price,
      signalNumber(latest.mfi)
    )
  };

  return analyses;
}

/* ---------------------------------------------------------
   SCORE CALCULATION
--------------------------------------------------------- */

function calculateSignalScore(analyses) {
  let bullish = 0;
  let bearish = 0;
  let availableWeight = 0;

  let bullishConfirmations = 0;
  let bearishConfirmations = 0;

  Object.values(analyses).forEach(analysis => {
    const weight = analysis.weight || 0;

    if (weight === 0) return;

    availableWeight += weight;

    if (analysis.direction === 'bullish') {
      bullish += weight;
      bullishConfirmations++;
    }

    if (analysis.direction === 'bearish') {
      bearish += weight;
      bearishConfirmations++;
    }
  });

  if (availableWeight === 0) {
    return {
      score: 0,
      bullish,
      bearish,
      availableWeight,
      bullishConfirmations,
      bearishConfirmations
    };
  }

  const score = (
    (bullish - bearish) / availableWeight
  ) * 100;

  return {
    score: Math.round(score),
    bullish,
    bearish,
    availableWeight,
    bullishConfirmations,
    bearishConfirmations
  };
}

/* ---------------------------------------------------------
   DETERMINE SIGNAL
--------------------------------------------------------- */

function determineTradingSignal(score, statistics) {
  const config = SIGNAL_ENGINE_CONFIG;

  if (statistics.availableWeight < 5) {
    return 'INSUFFICIENT_DATA';
  }

  if (
    score >= config.strongBuy &&
    statistics.bullishConfirmations >= config.minimumConfirmations
  ) {
    return 'STRONG BUY';
  }

  if (
    score >= config.buy &&
    statistics.bullishConfirmations >= config.minimumConfirmations
  ) {
    return 'BUY';
  }

  if (
    score <= -config.strongBuy &&
    statistics.bearishConfirmations >= config.minimumConfirmations
  ) {
    return 'STRONG SELL';
  }

  if (
    score <= -config.buy &&
    statistics.bearishConfirmations >= config.minimumConfirmations
  ) {
    return 'SELL';
  }

  return 'HOLD';
}

/* ---------------------------------------------------------
   TREND CLASSIFICATION
--------------------------------------------------------- */

function determineTrend(latest) {
  const ema20 = signalNumber(latest.ema?.[20]);
  const ema50 = signalNumber(latest.ema?.[50]);
  const ema200 = signalNumber(latest.ema?.[200]);

  if (
    ema20 === null ||
    ema50 === null ||
    ema200 === null
  ) {
    return 'INSUFFICIENT DATA';
  }

  if (
    ema20 > ema50 &&
    ema50 > ema200 &&
    latest.price > ema20
  ) {
    return 'STRONG UPTREND';
  }

  if (
    ema20 < ema50 &&
    ema50 < ema200 &&
    latest.price < ema20
  ) {
    return 'STRONG DOWNTREND';
  }

  if (latest.price > ema200) {
    return 'BULLISH';
  }

  if (latest.price < ema200) {
    return 'BEARISH';
  }

  return 'SIDEWAYS';
}

/* ---------------------------------------------------------
   ATR-BASED RISK ESTIMATES
--------------------------------------------------------- */

function calculateRiskLevels(
  price,
  atr,
  direction
) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(atr) ||
    atr <= 0
  ) {
    return {
      stopLoss: null,
      takeProfit: null,
      riskReward: null
    };
  }

  const stopDistance =
    atr * SIGNAL_ENGINE_CONFIG.stopLossATR;

  const targetDistance =
    atr * SIGNAL_ENGINE_CONFIG.takeProfitATR;

  if (direction === 'bullish') {
    return {
      entryReference: price,

      stopLoss: price - stopDistance,

      takeProfit: price + targetDistance,

      riskReward:
        targetDistance / stopDistance
    };
  }

  if (direction === 'bearish') {
    return {
      entryReference: price,

      stopLoss: price + stopDistance,

      takeProfit: price - targetDistance,

      riskReward:
        targetDistance / stopDistance
    };
  }

  return {
    entryReference: price,
    stopLoss: null,
    takeProfit: null,
    riskReward: null
  };
}

/* ---------------------------------------------------------
   GENERATE EXPLANATIONS
--------------------------------------------------------- */

function generateSignalReasons(analyses) {
  return Object.entries(analyses)
    .filter(([key, value]) =>
      value.weight > 0 && value.reason
    )
    .map(([indicator, value]) => ({
      indicator,
      direction: value.direction,
      explanation: value.reason
    }));
}

/* ---------------------------------------------------------
   MAIN SIGNAL ENGINE
--------------------------------------------------------- */

function generateTradingSignal(indicators) {
  if (!indicators || !indicators.candles?.length) {
    throw new Error('Valid indicator data is required.');
  }

  const latest =
    window.TechnicalIndicators.getLatestIndicators(
      indicators
    );

  if (!latest) {
    throw new Error('Unable to calculate latest indicators.');
  }

  const analyses = analyzeTechnicalConditions(latest);

  const statistics = calculateSignalScore(analyses);

  const signal = determineTradingSignal(
    statistics.score,
    statistics
  );

  const trend = determineTrend(latest);

  const direction =
    signal.includes('BUY') ? 'bullish' :
    signal.includes('SELL') ? 'bearish' :
    'neutral';

  const risk = calculateRiskLevels(
    latest.price,
    latest.atr,
    direction
  );

  const reasons = generateSignalReasons(analyses);

  const conflict =
    statistics.bullishConfirmations > 0 &&
    statistics.bearishConfirmations > 0;

  return {
    signal,

    score: statistics.score,

    agreement: Math.round(
      Math.abs(statistics.score)
    ),

    trend,

    direction,

    price: latest.price,

    risk,

    indicators: analyses,

    reasons,

    bullishConfirmations:
      statistics.bullishConfirmations,

    bearishConfirmations:
      statistics.bearishConfirmations,

    conflictingSignals: conflict,

    warning: conflict
      ? 'Bullish and bearish indicators disagree. Exercise caution.'
      : null,

    calculatedAt: new Date().toISOString(),

    disclaimer:
      'Analytical signal, not a guaranteed prediction or financial advice.'
  };
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.TradingSignals = {
  analyzeRSI,
  analyzeMACD,
  analyzeMovingAverages,
  analyzeBollinger,
  analyzeADX,
  analyzeStochastic,
  analyzeVolume,

  analyzeTechnicalConditions,

  calculateSignalScore,

  determineTradingSignal,

  determineTrend,

  calculateRiskLevels,

  generateSignalReasons,

  generateTradingSignal
};

console.info(
  'Crypto Intelligence Terminal signal engine loaded.'
);
