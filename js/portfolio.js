/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   PORTFOLIO MANAGER
   File: js/portfolio.js
========================================================= */

'use strict';

const CryptoPortfolio = {

  holdings: [],
  realizedPnL: 0,

  init() {
    this.load();
    return this.getSummary();
  },

  validateNumber(value, name) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      throw new Error(name + ' must be a valid non-negative number.');
    }

    return number;
  },

  addHolding(data) {
    if (!data || !data.symbol) {
      throw new Error('A cryptocurrency symbol is required.');
    }

    const symbol = String(data.symbol).toUpperCase().trim();

    const quantity = this.validateNumber(
      data.quantity,
      'Quantity'
    );

    const price = this.validateNumber(
      data.purchasePrice,
      'Purchase price'
    );

    if (!quantity || !price) {
      throw new Error('Quantity and purchase price must be greater than zero.');
    }

    const existing = this.holdings.find(
      h => h.symbol === symbol
    );

    if (existing) {
      const totalQuantity = existing.quantity + quantity;

      existing.averagePrice = (
        existing.quantity * existing.averagePrice +
        quantity * price
      ) / totalQuantity;

      existing.quantity = totalQuantity;
      existing.updatedAt = new Date().toISOString();

    } else {
      this.holdings.push({
        id: this.createId(),
        symbol,
        quantity,
        averagePrice: price,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    this.save();

    return this.getHolding(symbol);
  },

  createId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    return 'asset-' + Date.now() + '-' +
      Math.random().toString(36).slice(2);
  },

  getHolding(symbol) {
    return this.holdings.find(
      h => h.symbol === String(symbol).toUpperCase()
    ) || null;
  },

  updateHolding(symbol, updates) {
    const holding = this.getHolding(symbol);

    if (!holding) {
      throw new Error('Holding not found.');
    }

    if (updates.quantity !== undefined) {
      holding.quantity = this.validateNumber(
        updates.quantity,
        'Quantity'
      );
    }

    if (updates.purchasePrice !== undefined) {
      holding.averagePrice = this.validateNumber(
        updates.purchasePrice,
        'Purchase price'
      );
    }

    holding.updatedAt = new Date().toISOString();

    if (holding.quantity === 0) {
      this.holdings = this.holdings.filter(
        h => h.symbol !== holding.symbol
      );
    }

    this.save();

    return this.getHolding(symbol);
  },

  removeHolding(symbol) {
    const normalized = String(symbol).toUpperCase();

    const previousLength = this.holdings.length;

    this.holdings = this.holdings.filter(
      h => h.symbol !== normalized
    );

    this.save();

    return this.holdings.length < previousLength;
  },

  recordSale(symbol, quantity, salePrice) {
    const holding = this.getHolding(symbol);

    if (!holding) {
      throw new Error('Holding not found.');
    }

    quantity = this.validateNumber(quantity, 'Sale quantity');
    salePrice = this.validateNumber(salePrice, 'Sale price');

    if (!quantity || quantity > holding.quantity) {
      throw new Error('Invalid sale quantity.');
    }

    const profit = (
      salePrice - holding.averagePrice
    ) * quantity;

    this.realizedPnL += profit;

    holding.quantity -= quantity;

    if (holding.quantity <= 0) {
      this.holdings = this.holdings.filter(
        h => h.symbol !== holding.symbol
      );
    }

    this.save();

    return {
      symbol: String(symbol).toUpperCase(),
      quantitySold: quantity,
      salePrice,
      realizedPnL: profit,
      totalRealizedPnL: this.realizedPnL
    };
  },

  getHoldingValue(holding, marketPrice) {
    marketPrice = Number(marketPrice);

    if (!Number.isFinite(marketPrice) || marketPrice < 0) {
      throw new Error('Invalid market price.');
    }

    const marketValue = holding.quantity * marketPrice;

    const costBasis = holding.quantity * holding.averagePrice;

    const unrealizedPnL = marketValue - costBasis;

    const pnlPercentage = costBasis
      ? unrealizedPnL / costBasis * 100
      : 0;

    return {
      symbol: holding.symbol,
      quantity: holding.quantity,
      averagePrice: holding.averagePrice,
      marketPrice,
      marketValue,
      costBasis,
      unrealizedPnL,
      pnlPercentage
    };
  },

  getSummary(prices = {}) {
    let totalValue = 0;
    let totalCost = 0;
    let pricedAssets = 0;

    const assets = this.holdings.map(holding => {
      const price = Number(prices[holding.symbol]);

      const validPrice = Number.isFinite(price) && price >= 0;

      if (!validPrice) {
        return {
          ...holding,
          marketPrice: null,
          marketValue: null,
          unrealizedPnL: null,
          pnlPercentage: null,
          allocation: null,
          priceUnavailable: true
        };
      }

      const result = this.getHoldingValue(holding, price);

      totalValue += result.marketValue;
      totalCost += result.costBasis;
      pricedAssets++;

      return {
        ...result,
        allocation: null,
        priceUnavailable: false
      };
    });

    assets.forEach(asset => {
      if (asset.marketValue !== null && totalValue > 0) {
        asset.allocation =
          asset.marketValue / totalValue * 100;
      }
    });

    const unrealizedPnL = totalValue - totalCost;

    const performance = totalCost > 0
      ? unrealizedPnL / totalCost * 100
      : 0;

    return {
      totalValue,
      totalCost,
      unrealizedPnL,
      realizedPnL: this.realizedPnL,
      totalPnL: unrealizedPnL + this.realizedPnL,
      performance,
      assets,
      holdingsCount: this.holdings.length,
      pricedAssets,
      unpricedAssets: this.holdings.length - pricedAssets,
      timestamp: new Date().toISOString()
    };
  },

  getAllocation(prices = {}) {
    const summary = this.getSummary(prices);

    return summary.assets
      .filter(asset => asset.allocation !== null)
      .map(asset => ({
        symbol: asset.symbol,
        allocation: asset.allocation,
        value: asset.marketValue
      }))
      .sort((a, b) => b.allocation - a.allocation);
  },

  getPerformance(prices = {}) {
    const summary = this.getSummary(prices);

    return {
      totalValue: summary.totalValue,
      totalCost: summary.totalCost,
      realizedPnL: summary.realizedPnL,
      unrealizedPnL: summary.unrealizedPnL,
      totalPnL: summary.totalPnL,
      percentage: summary.performance
    };
  },

  save() {
    try {
      localStorage.setItem(
        'crypto_terminal_portfolio',
        JSON.stringify({
          holdings: this.holdings,
          realizedPnL: this.realizedPnL,
          version: 1
        })
      );

      return true;

    } catch (error) {
      console.error('Portfolio save failed:', error);
      return false;
    }
  },

  load() {
    try {
      const stored = localStorage.getItem(
        'crypto_terminal_portfolio'
      );

      if (!stored) return false;

      const parsed = JSON.parse(stored);

      if (!parsed || !Array.isArray(parsed.holdings)) {
        return false;
      }

      this.holdings = parsed.holdings.filter(h =>
        h &&
        typeof h.symbol === 'string' &&
        Number.isFinite(h.quantity) &&
        Number.isFinite(h.averagePrice) &&
        h.quantity > 0 &&
        h.averagePrice > 0
      );

      this.realizedPnL = Number.isFinite(parsed.realizedPnL)
        ? parsed.realizedPnL
        : 0;

      return true;

    } catch (error) {
      console.error('Portfolio load failed:', error);
      this.holdings = [];
      this.realizedPnL = 0;
      return false;
    }
  },

  exportJSON() {
    return JSON.stringify({
      holdings: this.holdings,
      realizedPnL: this.realizedPnL,
      exportedAt: new Date().toISOString()
    }, null, 2);
  },

  clear() {
    this.holdings = [];
    this.realizedPnL = 0;

    try {
      localStorage.removeItem(
        'crypto_terminal_portfolio'
      );
    } catch (error) {
      console.error('Portfolio clearing failed:', error);
    }

    return true;
  }

};

window.CryptoPortfolio = CryptoPortfolio;

CryptoPortfolio.init();

console.info('Crypto Intelligence Terminal portfolio loaded.');
