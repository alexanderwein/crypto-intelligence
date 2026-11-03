/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   SIGNAL ENGINE
   File: js/signal-engine.js
========================================================= */

'use strict';

const CryptoSignalEngine = {

  config: {
    buyThreshold: 60,
    sellThreshold: 60,
    minimumTrendStrength: 15,
    atrMultiplier: 2,
    rewardRiskRatio: 2,
    minimumCandles: 52
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  round(value, decimals = 4) {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(decimals));
  },

  last(values) {
    if (!Array.isArray(values) || !values.length) return null;

    for (let i = values.length - 1; i >= 0; i--) {
      if (Number.isFinite(values[i])) return values[i];
    }

    return null;
  },

  calculateMACD(closes) {
    const indicators = window.CryptoAdvancedIndicators;

    const fast = indicators.ema(closes, 12);
    const slow = indicators.ema(closes, 26);

    const macd = closes.map((_, i) =>
      fast[i] !== null && slow[i] !== null
        ? fast[i] - slow[i]
        : null
    );

    const validStart = macd.findIndex(v => v !== null);
    const signal = Array(closes.length).fill(null);

    if (validStart >= 0) {
      const validMACD = macd.slice(validStart);
      const validSignal = indicators.ema(validMACD, 9);

      validSignal.forEach((value, i) => {
        signal[validStart + i] = value;
      });
    }

    const histogram = macd.map((value, i) =>
      value !== null && signal[i] !== null
        ? value - signal[i]
        : null
    );

    return {
      macd: this.last(macd),
      signal: this.last(signal),
      histogram: this.last(histogram),
      history: macd,
      signalHistory: signal,
      histogramHistory: histogram
    };
  },

  analyzeTrend(price, indicators) {
    const ema20 = indicators.EMA20;
    const ema50 = indicators.EMA50;
    const ema200 = indicators.EMA200;

    if (
      ema20 === null ||
      ema50 === null ||
      ema200 === null
    ) {
      return 'INSUFFICIENT_HISTORY';
    }

    if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
      return 'STRONG_BULLISH';
    }

    if (price < ema20 && ema20 < ema50 && ema50 < ema200) {
      return 'STRONG_BEARISH';
    }

    if (price > ema50) return 'BULLISH';
    if (price < ema50) return 'BEARISH';

    return 'SIDEWAYS';
  },

  buildScores(data) {
    const bullish = [];
    const bearish = [];
    const neutral = [];

    const add = (name, direction, weight, detail) => {
      const item = { name, weight, detail };

      if (direction === 'BUY') bullish.push(item);
      else if (direction === 'SELL') bearish.push(item);
      else neutral.push(item);
    };

    const { price, indicators, macd } = data;

    if (indicators.EMA20 !== null && indicators.EMA50 !== null) {
      add(
        'EMA crossover',
        indicators.EMA20 > indicators.EMA50 ? 'BUY' : 'SELL',
        12,
        'EMA20 versus EMA50'
      );
    }

    if (indicators.EMA200 !== null) {
      add(
        'Long-term trend',
        price > indicators.EMA200 ? 'BUY' : 'SELL',
        12,
        'Price versus EMA200'
      );
    }

    if (indicators.RSI !== null) {
      if (indicators.RSI < 30) {
        add('RSI', 'BUY', 9, 'Oversold region');
      } else if (indicators.RSI > 70) {
        add('RSI', 'SELL', 9, 'Overbought region');
      } else if (indicators.RSI > 50) {
        add('RSI', 'BUY', 5, 'Positive momentum');
      } else {
        add('RSI', 'SELL', 5, 'Negative momentum');
      }
    }

    if (macd.histogram !== null) {
      add(
        'MACD',
        macd.histogram > 0 ? 'BUY' : 'SELL',
        12,
        'MACD histogram direction'
      );
    }

    if (
      indicators.ADX !== null &&
      indicators.ADX >= this.config.minimumTrendStrength
    ) {
      const direction =
        indicators.PlusDI > indicators.MinusDI ? 'BUY' : 'SELL';

      add(
        'ADX directional movement',
        direction,
        10,
        'Trend strength confirmed'
      );
    }

    if (
      indicators.BollingerUpper !== null &&
      indicators.BollingerLower !== null
    ) {
      if (price < indicators.BollingerLower) {
        add('Bollinger Bands', 'BUY', 6, 'Below lower band');
      } else if (price > indicators.BollingerUpper) {
        add('Bollinger Bands', 'SELL', 6, 'Above upper band');
      } else {
        neutral.push({
          name: 'Bollinger Bands',
          weight: 0,
          detail: 'Inside bands'
        });
      }
    }

    if (indicators.StochasticK !== null) {
      if (indicators.StochasticK < 20) {
        add('Stochastic RSI', 'BUY', 6, 'Oversold');
      } else if (indicators.StochasticK > 80) {
        add('Stochastic RSI', 'SELL', 6, 'Overbought');
      }
    }

    if (indicators.VWAP !== null) {
      add(
        'VWAP',
        price > indicators.VWAP ? 'BUY' : 'SELL',
        8,
        'Price versus VWAP'
      );
    }

    if (indicators.ParabolicSAR !== null) {
      add(
        'Parabolic SAR',
        price > indicators.ParabolicSAR ? 'BUY' : 'SELL',
        6,
        'SAR trend direction'
      );
    }

    if (indicators.MFI !== null) {
      if (indicators.MFI < 20) {
        add('MFI', 'BUY', 6, 'Oversold money flow');
      } else if (indicators.MFI > 80) {
        add('MFI', 'SELL', 6, 'Overbought money flow');
      } else if (indicators.MFI > 50) {
        add('MFI', 'BUY', 3, 'Positive money flow');
      } else {
        add('MFI', 'SELL', 3, 'Negative money flow');
      }
    }

    if (indicators.CCI !== null) {
      if (indicators.CCI < -100) {
        add('CCI', 'BUY', 5, 'Oversold');
      } else if (indicators.CCI > 100) {
        add('CCI', 'SELL', 5, 'Overbought');
      }
    }

    if (indicators.ROC !== null) {
      add(
        'Rate of Change',
        indicators.ROC > 0 ? 'BUY' : 'SELL',
        5,
        'Momentum direction'
      );
    }

    if (indicators.WilliamsR !== null) {
      if (indicators.WilliamsR < -80) {
        add('Williams %R', 'BUY', 4, 'Oversold');
      } else if (indicators.WilliamsR > -20) {
        add('Williams %R', 'SELL', 4, 'Overbought');
      }
    }

    if (data.obvTrend !== null) {
      add(
        'On Balance Volume',
        data.obvTrend > 0 ? 'BUY' : 'SELL',
        5,
        'Volume trend'
      );
    }

    if (
      indicators.IchimokuA !== null &&
      indicators.IchimokuB !== null
    ) {
      const cloudTop = Math.max(
        indicators.IchimokuA,
        indicators.IchimokuB
      );

      const cloudBottom = Math.min(
        indicators.IchimokuA,
        indicators.IchimokuB
      );

      if (price > cloudTop) {
        add('Ichimoku Cloud', 'BUY', 8, 'Above cloud');
      } else if (price < cloudBottom) {
        add('Ichimoku Cloud', 'SELL', 8, 'Below cloud');
      }
    }

    return { bullish, bearish, neutral };
  },

  calculateConfidence(bullishScore, bearishScore) {
    const total = bullishScore + bearishScore;

    if (!total) return 0;

    return this.clamp(
      Math.round(
        Math.max(bullishScore, bearishScore) / total * 100
      ),
      0,
      100
    );
  },

  generateSignal(input) {
    if (!window.CryptoAdvancedIndicators) {
      throw new Error('Advanced indicators module is missing.');
    }

    const candles = window.CryptoAdvancedIndicators.prepare(
      input.candles || []
    );

    if (candles.length < this.config.minimumCandles) {
      throw new Error('Insufficient historical candles.');
    }

    const closes = candles.map(c => c.close);
    const price = closes[closes.length - 1];

    const advanced = window.CryptoAdvancedIndicators.calculateAll({
      symbol: input.symbol,
      candles
    });

    const last = array => this.last(array);
    const adx = advanced.adx;

    const indicators = {
      RSI: last(advanced.rsi),

      EMA20: last(advanced.ema20),
      EMA50: last(advanced.ema50),
      EMA200: last(advanced.ema200),

      ATR: last(advanced.atr),

      ADX: last(adx.adx),
      PlusDI: last(adx.plusDI),
      MinusDI: last(adx.minusDI),

      StochasticK: last(advanced.stochasticRSI.k),
      StochasticD: last(advanced.stochasticRSI.d),

      BollingerUpper: last(advanced.bollinger.upper),
      BollingerMiddle: last(advanced.bollinger.middle),
      BollingerLower: last(advanced.bollinger.lower),

      VWAP: last(advanced.vwap),

      CCI: last(advanced.cci),
      WilliamsR: last(advanced.williamsR),

      MFI: last(advanced.mfi),
      ROC: last(advanced.roc),

      ParabolicSAR: last(advanced.parabolicSAR),

      IchimokuA: last(advanced.ichimoku.senkouA),
      IchimokuB: last(advanced.ichimoku.senkouB),

      Fibonacci: advanced.fibonacci
    };

    const macd = this.calculateMACD(closes);
    const obv = advanced.obv;

    const obvTrend = obv.length >= 6
      ? obv[obv.length - 1] - obv[obv.length - 6]
      : null;

    const trend = this.analyzeTrend(price, indicators);

    const scores = this.buildScores({
      price,
      indicators,
      macd,
      trend,
      obvTrend
    });

    const bullishScore = scores.bullish.reduce(
      (sum, item) => sum + item.weight, 0
    );

    const bearishScore = scores.bearish.reduce(
      (sum, item) => sum + item.weight, 0
    );

    const totalScore = bullishScore + bearishScore;

    const directionalScore = totalScore
      ? (bullishScore - bearishScore) / totalScore * 100
      : 0;

    let signal = 'HOLD';

    if (
      bullishScore >= this.config.buyThreshold &&
      bullishScore > bearishScore
    ) {
      signal = 'BUY';
    } else if (
      bearishScore >= this.config.sellThreshold &&
      bearishScore > bullishScore
    ) {
      signal = 'SELL';
    }

    const atr = indicators.ATR;

    const stopDistance = atr !== null
      ? atr * this.config.atrMultiplier
      : null;

    let stopLoss = null;
    let takeProfit = null;

    if (signal === 'BUY' && stopDistance !== null) {
      stopLoss = price - stopDistance;
      takeProfit = price +
        stopDistance * this.config.rewardRiskRatio;
    }

    if (signal === 'SELL' && stopDistance !== null) {
      stopLoss = price + stopDistance;
      takeProfit = price -
        stopDistance * this.config.rewardRiskRatio;
    }

    const confidence = this.calculateConfidence(
      bullishScore,
      bearishScore
    );

    const disagreement = bullishScore > 0 && bearishScore > 0
      ? Math.min(bullishScore, bearishScore) /
        Math.max(bullishScore, bearishScore)
      : 0;

    return {
      symbol: input.symbol || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      price: this.round(price, 8),

      signal,
      confidence,
      directionalScore: this.round(directionalScore, 2),
      trend,

      scores: {
        bullish: bullishScore,
        bearish: bearishScore,
        difference: bullishScore - bearishScore
      },

      indicators,

      macd: {
        value: this.round(macd.macd),
        signal: this.round(macd.signal),
        histogram: this.round(macd.histogram)
      },

      risk: {
        atr: this.round(atr, 8),
        stopLoss: this.round(stopLoss, 8),
        takeProfit: this.round(takeProfit, 8),
        rewardRiskRatio: signal === 'HOLD'
          ? null
          : this.config.rewardRiskRatio
      },

      disagreement: this.round(disagreement, 3),

      confirmations: {
        bullish: scores.bullish,
        bearish: scores.bearish,
        neutral: scores.neutral
      },

      warning: 'Technical analysis is not a guaranteed prediction. Validate signals with independent data and risk controls.'
    };
  },

  analyzeMultiple(markets) {
    if (!Array.isArray(markets)) {
      throw new Error('Markets must be an array.');
    }

    return markets.map(market => {
      try {
        return this.generateSignal(market);
      } catch (error) {
        return {
          symbol: market.symbol || 'UNKNOWN',
          signal: 'UNAVAILABLE',
          error: error.message
        };
      }
    });
  }

};

window.CryptoSignalEngine = CryptoSignalEngine;

console.info('Crypto Intelligence Terminal signal engine loaded.');
