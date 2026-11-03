/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   RISK MANAGEMENT ENGINE
   File: js/risk.js

   Analytical calculations only.
   Does not execute real trades.
========================================================= */

'use strict';

const RISK_CONFIG = {
  defaultRiskPercentage: 1,
  maximumRiskPercentage: 5,
  defaultRewardRatio: 2,
  maximumPortfolioExposure: 80,
  highVolatilityThreshold: 5,
  maximumDrawdownWarning: 15,
  maximumDrawdownCritical: 25
};

const CryptoRisk = {

  state: {
    initialCapital: 10000,
    currentCapital: 10000,
    maximumEquity: 10000,
    currentDrawdown: 0,
    positions: [],
    warnings: []
  },

  /* VALIDATION */

  validatePositive(value, name) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      throw new Error(name + ' must be greater than zero.');
    }

    return number;
  },

  /* LONG POSITION SIZE */

  calculatePositionSize({
    accountBalance,
    riskPercentage = 1,
    entryPrice,
    stopLoss
  }) {
    accountBalance = this.validatePositive(
      accountBalance, 'Account balance'
    );

    entryPrice = this.validatePositive(
      entryPrice, 'Entry price'
    );

    stopLoss = this.validatePositive(
      stopLoss, 'Stop loss'
    );

    if (
      !Number.isFinite(Number(riskPercentage)) ||
      riskPercentage <= 0 ||
      riskPercentage > RISK_CONFIG.maximumRiskPercentage
    ) {
      throw new Error('Risk percentage must be between 0 and 5%.');
    }

    if (stopLoss >= entryPrice) {
      throw new Error('For a long position, stop loss must be below entry price.');
    }

    const riskAmount =
      accountBalance * (riskPercentage / 100);

    const riskPerUnit = entryPrice - stopLoss;

    const quantity = riskAmount / riskPerUnit;

    const positionValue = quantity * entryPrice;

    return {
      accountBalance,
      riskPercentage,
      riskAmount,
      entryPrice,
      stopLoss,
      riskPerUnit,
      quantity,
      positionValue,
      exposurePercentage:
        positionValue / accountBalance * 100
    };
  },

  /* SHORT POSITION SIZE */

  calculateShortPositionSize({
    accountBalance,
    riskPercentage = 1,
    entryPrice,
    stopLoss
  }) {
    accountBalance = this.validatePositive(
      accountBalance, 'Account balance'
    );

    entryPrice = this.validatePositive(
      entryPrice, 'Entry price'
    );

    stopLoss = this.validatePositive(
      stopLoss, 'Stop loss'
    );

    if (
      !Number.isFinite(Number(riskPercentage)) ||
      riskPercentage <= 0 ||
      riskPercentage > RISK_CONFIG.maximumRiskPercentage
    ) {
      throw new Error('Risk percentage must be between 0 and 5%.');
    }

    if (stopLoss <= entryPrice) {
      throw new Error('For a short position, stop loss must be above entry price.');
    }

    const riskAmount =
      accountBalance * riskPercentage / 100;

    const riskPerUnit = stopLoss - entryPrice;

    const quantity = riskAmount / riskPerUnit;

    return {
      accountBalance,
      riskPercentage,
      riskAmount,
      entryPrice,
      stopLoss,
      riskPerUnit,
      quantity,
      positionValue: quantity * entryPrice
    };
  },

  /* STOP LOSS */

  calculateStopLoss({
    entryPrice,
    stopPercentage,
    direction = 'LONG'
  }) {
    entryPrice = this.validatePositive(
      entryPrice, 'Entry price'
    );

    stopPercentage = this.validatePositive(
      stopPercentage, 'Stop percentage'
    );

    if (stopPercentage >= 100) {
      throw new Error('Stop percentage must be below 100%.');
    }

    const stopLoss = direction === 'SHORT'
      ? entryPrice * (1 + stopPercentage / 100)
      : entryPrice * (1 - stopPercentage / 100);

    return {
      entryPrice,
      stopLoss,
      stopPercentage,
      direction
    };
  },

  /* TAKE PROFIT */

  calculateTakeProfit({
    entryPrice,
    stopLoss,
    rewardRatio = 2,
    direction = 'LONG'
  }) {
    entryPrice = this.validatePositive(
      entryPrice, 'Entry price'
    );

    stopLoss = this.validatePositive(
      stopLoss, 'Stop loss'
    );

    rewardRatio = this.validatePositive(
      rewardRatio, 'Reward ratio'
    );

    let takeProfit;

    if (direction === 'SHORT') {
      if (stopLoss <= entryPrice) {
        throw new Error('Short stop loss must be above entry price.');
      }

      const risk = stopLoss - entryPrice;

      takeProfit = entryPrice - risk * rewardRatio;

      if (takeProfit <= 0) {
        throw new Error('Calculated take-profit price is invalid.');
      }

    } else {
      if (stopLoss >= entryPrice) {
        throw new Error('Long stop loss must be below entry price.');
      }

      const risk = entryPrice - stopLoss;

      takeProfit = entryPrice + risk * rewardRatio;
    }

    return {
      entryPrice,
      stopLoss,
      takeProfit,
      rewardRatio,
      direction
    };
  },

  /* RISK / REWARD */

  calculateRiskReward({
    entryPrice,
    stopLoss,
    takeProfit,
    direction = 'LONG'
  }) {
    entryPrice = this.validatePositive(
      entryPrice, 'Entry price'
    );

    stopLoss = this.validatePositive(
      stopLoss, 'Stop loss'
    );

    takeProfit = this.validatePositive(
      takeProfit, 'Take profit'
    );

    let risk;
    let reward;

    if (direction === 'SHORT') {
      risk = stopLoss - entryPrice;
      reward = entryPrice - takeProfit;
    } else {
      risk = entryPrice - stopLoss;
      reward = takeProfit - entryPrice;
    }

    if (risk <= 0 || reward <= 0) {
      throw new Error('Invalid entry, stop-loss or take-profit combination.');
    }

    return {
      risk,
      reward,
      ratio: reward / risk,
      description: '1:' + (reward / risk).toFixed(2)
    };
  },

  /* HISTORICAL VOLATILITY */

  calculateVolatility(prices, period = 20) {
    if (!Array.isArray(prices) || prices.length < period + 1) {
      return null;
    }

    const returns = [];

    for (
      let i = prices.length - period;
      i < prices.length;
      i++
    ) {
      const previous = Number(prices[i - 1]);
      const current = Number(prices[i]);

      if (
        !Number.isFinite(previous) ||
        !Number.isFinite(current) ||
        previous <= 0
      ) {
        return null;
      }

      returns.push((current / previous - 1) * 100);
    }

    const average =
      returns.reduce((sum, value) => sum + value, 0) /
      returns.length;

    const variance =
      returns.reduce(
        (sum, value) => sum + Math.pow(value - average, 2),
        0
      ) / returns.length;

    const standardDeviation = Math.sqrt(variance);

    return {
      period,
      averageReturn: average,
      standardDeviation,
      classification:
        standardDeviation >= RISK_CONFIG.highVolatilityThreshold
          ? 'HIGH'
          : standardDeviation >= 2
            ? 'MODERATE'
            : 'LOW'
    };
  },

  /* MAXIMUM DRAWDOWN */

  calculateDrawdown(equityCurve) {
    if (!Array.isArray(equityCurve) || !equityCurve.length) {
      return null;
    }

    let peak = Number(equityCurve[0].value);
    let maximumDrawdown = 0;
    let currentDrawdown = 0;

    equityCurve.forEach(point => {
      const equity = Number(point.value);

      if (!Number.isFinite(equity) || equity < 0) return;

      peak = Math.max(peak, equity);

      currentDrawdown = peak > 0
        ? ((peak - equity) / peak) * 100
        : 0;

      maximumDrawdown = Math.max(
        maximumDrawdown,
        currentDrawdown
      );
    });

    return {
      currentDrawdown,
      maximumDrawdown,
      peak
    };
  },

  /* PORTFOLIO EXPOSURE */

  calculatePortfolioExposure(positions, accountBalance) {
    accountBalance = this.validatePositive(
      accountBalance, 'Account balance'
    );

    if (!Array.isArray(positions)) {
      throw new Error('Positions must be an array.');
    }

    const totalExposure = positions.reduce(
      (sum, position) => {
        const quantity = Number(position.quantity || 0);
        const price = Number(position.currentPrice || 0);

        if (
          !Number.isFinite(quantity) ||
          !Number.isFinite(price) ||
          quantity < 0 ||
          price < 0
        ) {
          return sum;
        }

        return sum + quantity * price;
      },
      0
    );

    return {
      totalExposure,
      accountBalance,
      exposurePercentage:
        totalExposure / accountBalance * 100,
      availableCapital:
        accountBalance - totalExposure,
      status:
        totalExposure / accountBalance * 100 >
        RISK_CONFIG.maximumPortfolioExposure
          ? 'HIGH'
          : 'NORMAL'
    };
  },

  /* PORTFOLIO CONCENTRATION */

  calculateConcentration(positions) {
    if (!Array.isArray(positions) || !positions.length) {
      return [];
    }

    const total = positions.reduce(
      (sum, position) =>
        sum +
        Number(position.quantity || 0) *
        Number(position.currentPrice || 0),
      0
    );

    if (total <= 0) return [];

    return positions.map(position => {
      const value =
        Number(position.quantity || 0) *
        Number(position.currentPrice || 0);

      return {
        symbol: position.symbol,
        value,
        percentage: value / total * 100
      };
    }).sort((a, b) => b.percentage - a.percentage);
  },

  /* RISK WARNINGS */

  generateWarnings({
    volatility,
    drawdown,
    exposure,
    riskPercentage
  }) {
    const warnings = [];

    if (
      volatility &&
      volatility.classification === 'HIGH'
    ) {
      warnings.push({
        level: 'WARNING',
        message: 'High historical volatility detected.'
      });
    }

    if (
      drawdown &&
      drawdown.currentDrawdown >=
      RISK_CONFIG.maximumDrawdownCritical
    ) {
      warnings.push({
        level: 'CRITICAL',
        message: 'Portfolio drawdown exceeds 25%.'
      });

    } else if (
      drawdown &&
      drawdown.currentDrawdown >=
      RISK_CONFIG.maximumDrawdownWarning
    ) {
      warnings.push({
        level: 'WARNING',
        message: 'Portfolio drawdown exceeds 15%.'
      });
    }

    if (
      exposure &&
      exposure.exposurePercentage >
      RISK_CONFIG.maximumPortfolioExposure
    ) {
      warnings.push({
        level: 'WARNING',
        message: 'Portfolio exposure exceeds 80%.'
      });
    }

    if (
      Number.isFinite(riskPercentage) &&
      riskPercentage > 2
    ) {
      warnings.push({
        level: 'WARNING',
        message: 'Trade risk exceeds 2% of account balance.'
      });
    }

    return warnings;
  },

  /* COMPLETE RISK ANALYSIS */

  analyze(options) {
    const {
      accountBalance,
      entryPrice,
      stopPercentage = 2,
      riskPercentage = 1,
      rewardRatio = 2,
      direction = 'LONG',
      prices = [],
      positions = []
    } = options;

    const stop = this.calculateStopLoss({
      entryPrice,
      stopPercentage,
      direction
    });

    const target = this.calculateTakeProfit({
      entryPrice,
      stopLoss: stop.stopLoss,
      rewardRatio,
      direction
    });

    const position = direction === 'SHORT'
      ? this.calculateShortPositionSize({
          accountBalance,
          riskPercentage,
          entryPrice,
          stopLoss: stop.stopLoss
        })
      : this.calculatePositionSize({
          accountBalance,
          riskPercentage,
          entryPrice,
          stopLoss: stop.stopLoss
        });

    const ratio = this.calculateRiskReward({
      entryPrice,
      stopLoss: stop.stopLoss,
      takeProfit: target.takeProfit,
      direction
    });

    const volatility = this.calculateVolatility(prices);

    const exposure = this.calculatePortfolioExposure(
      positions,
      accountBalance
    );

    const warnings = this.generateWarnings({
      volatility,
      exposure,
      riskPercentage
    });

    return {
      position,
      stop,
      target,
      ratio,
      volatility,
      exposure,
      warnings
    };
  },

  /* UPDATE ACCOUNT EQUITY */

  updateEquity(value) {
    value = this.validatePositive(value, 'Equity');

    this.state.currentCapital = value;

    this.state.maximumEquity = Math.max(
      this.state.maximumEquity,
      value
    );

    this.state.currentDrawdown =
      this.state.maximumEquity > 0
        ? (
            (this.state.maximumEquity - value) /
            this.state.maximumEquity
          ) * 100
        : 0;

    return this.state.currentDrawdown;
  },

  /* RENDER RESULTS */

  renderAnalysis(result) {
    const fields = {
      riskPositionSize: result.position.quantity,
      riskPositionValue: result.position.positionValue,
      riskAmount: result.position.riskAmount,
      riskStopLoss: result.stop.stopLoss,
      riskTakeProfit: result.target.takeProfit,
      riskRewardRatio: result.ratio.description,
      riskExposure:
        result.exposure.exposurePercentage.toFixed(2) + '%'
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent =
          typeof value === 'number'
            ? value.toFixed(6)
            : value;
      }
    });

    const container =
      document.getElementById('riskWarnings');

    if (container) {
      container.replaceChildren();

      if (result.warnings.length) {
        result.warnings.forEach(warning => {
          const item = document.createElement('div');
          item.className =
            'risk-warning ' + warning.level.toLowerCase();

          const heading = document.createElement('strong');
          heading.textContent = warning.level;

          const message = document.createElement('span');
          message.textContent = warning.message;

          item.append(heading, message);
          container.appendChild(item);
        });
      } else {
        const message = document.createElement('p');
        message.textContent =
          'No configured risk thresholds exceeded.';
        container.appendChild(message);
      }
    }
  },

  /* PUBLIC API */

  getState() {
    return structuredClone(this.state);
  },

  getConfig() {
    return { ...RISK_CONFIG };
  }

};

/* GLOBAL API */

window.CryptoRisk = CryptoRisk;

/* FORM INITIALIZATION */

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('riskCalculatorForm');

  if (!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();

    try {
      const result = CryptoRisk.analyze({

        accountBalance: Number(
          document.getElementById('riskCapital').value
        ),

        entryPrice: Number(
          document.getElementById('riskEntry').value
        ),

        stopPercentage: Number(
          document.getElementById('riskStopPercentage').value
        ),

        riskPercentage: Number(
          document.getElementById('riskPercentage').value
        ),

        rewardRatio: Number(
          document.getElementById('riskReward').value
        ),

        direction:
          document.getElementById('riskDirection').value

      });

      CryptoRisk.renderAnalysis(result);

    } catch (error) {
      alert(error.message);
    }

  });

});

console.info(
  'Crypto Intelligence Terminal risk engine loaded.'
);
