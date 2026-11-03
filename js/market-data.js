/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   MARKET DATA ENGINE
   File: js/market-data.js

   Hybrid cryptocurrency market data.
   Providers: CoinGecko + Binance public endpoints.
========================================================= */

'use strict';

const CryptoMarketData = {

  config: {
    providers: {
      coingecko: true,
      binance: true
    },

    defaultCurrency: 'usd',

    refreshInterval: 30000,

    cacheDuration: 15000,

    topCoins: 50,

    coingeckoBase: 'https://api.coingecko.com/api/v3',

    binanceBase: 'https://api.binance.com/api/v3'
  },

  cache: new Map(),

  lastUpdate: null,

  supportedIntervals: {
    '1d': { days: 1, binance: '1d' },
    '7d': { days: 7, binance: '1h' },
    '30d': { days: 30, binance: '4h' },
    '90d': { days: 90, binance: '1d' },
    '180d': { days: 180, binance: '1d' },
    '1y': { days: 365, binance: '1d' },
    'max': { days: 'max', binance: '1w' }
  },

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(
        'Market provider error: ' + response.status
      );
    }

    return response.json();
  },

  async cachedRequest(key, url, duration = this.config.cacheDuration) {
    const cached = this.cache.get(key);

    if (
      cached &&
      Date.now() - cached.timestamp < duration
    ) {
      return cached.data;
    }

    const data = await this.request(url);

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  },

  async getTopCoins(limit = 50, currency = 'usd') {
    limit = Math.min(Math.max(Number(limit) || 50, 1), 250);

    const key = 'top-' + limit + '-' + currency;

    const url =
      this.config.coingeckoBase +
      '/coins/markets' +
      '?vs_currency=' + encodeURIComponent(currency) +
      '&order=market_cap_desc' +
      '&per_page=' + limit +
      '&page=1' +
      '&sparkline=true' +
      '&price_change_percentage=24h';

    try {
      const coins = await this.cachedRequest(
        key,
        url,
        60000
      );

      this.lastUpdate = new Date().toISOString();

      return coins.map(coin => ({
        id: coin.id,
        rank: coin.market_cap_rank,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,

        price: coin.current_price,

        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,

        volume24h: coin.total_volume,

        change24h: coin.price_change_percentage_24h,

        high24h: coin.high_24h,
        low24h: coin.low_24h,

        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply,
        maxSupply: coin.max_supply,

        sparkline: coin.sparkline_in_7d?.price || []
      }));

    } catch (error) {
      console.error('CoinGecko market list failed:', error);
      throw error;
    }
  },

  async getCoinPrice(id, currency = 'usd') {
    const url =
      this.config.coingeckoBase +
      '/simple/price' +
      '?ids=' + encodeURIComponent(id) +
      '&vs_currencies=' + encodeURIComponent(currency) +
      '&include_24hr_change=true' +
      '&include_market_cap=true' +
      '&include_24hr_vol=true';

    const data = await this.cachedRequest(
      'price-' + id + '-' + currency,
      url
    );

    return data[id] || null;
  },

  async getBinancePrice(symbol) {
    const pair = String(symbol).toUpperCase();

    const url =
      this.config.binanceBase +
      '/ticker/24hr?symbol=' +
      encodeURIComponent(pair);

    const data = await this.request(url);

    return {
      symbol: data.symbol,

      price: Number(data.lastPrice),

      change24h: Number(data.priceChangePercent),

      high24h: Number(data.highPrice),

      low24h: Number(data.lowPrice),

      volume24h: Number(data.quoteVolume),

      trades: Number(data.count),

      provider: 'binance'
    };
  },

  async getHistoricalData(
    coinId,
    days = 30,
    currency = 'usd'
  ) {
    const key = [
      'history',
      coinId,
      days,
      currency
    ].join('-');

    const url =
      this.config.coingeckoBase +
      '/coins/' + encodeURIComponent(coinId) +
      '/ohlc' +
      '?vs_currency=' + encodeURIComponent(currency) +
      '&days=' + encodeURIComponent(days);

    const data = await this.cachedRequest(
      key,
      url,
      60000
    );

    return data.map(candle => ({
      time: candle[0],
      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
      volume: 0
    }));
  },

  async getBinanceCandles(
    symbol,
    interval = '1d',
    limit = 500
  ) {
    const url =
      this.config.binanceBase +
      '/klines' +
      '?symbol=' + encodeURIComponent(symbol) +
      '&interval=' + encodeURIComponent(interval) +
      '&limit=' + Math.min(Math.max(limit, 1), 1000);

    const data = await this.request(url);

    return data.map(candle => ({
      time: Number(candle[0]),

      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),

      volume: Number(candle[5]),

      closeTime: Number(candle[6]),

      quoteVolume: Number(candle[7]),

      trades: Number(candle[8])
    }));
  },

  async getCandles(
    symbol,
    interval = '30d',
    options = {}
  ) {
    const configuration =
      this.supportedIntervals[interval];

    if (!configuration) {
      throw new Error('Unsupported chart interval: ' + interval);
    }

    const provider = options.provider || 'coingecko';

    if (provider === 'binance') {
      const binanceInterval = options.binanceInterval ||
        configuration.binance;

      return this.getBinanceCandles(
        options.pair || symbol.toUpperCase() + 'USDT',
        binanceInterval,
        options.limit || 500
      );
    }

    return this.getHistoricalData(
      symbol,
      configuration.days,
      options.currency || 'usd'
    );
  },

  async getMarketOverview(currency = 'usd') {
    const url =
      this.config.coingeckoBase +
      '/global';

    const data = await this.cachedRequest(
      'global-market-' + currency,
      url,
      60000
    );

    const market = data.data;

    return {
      totalMarketCap: market.total_market_cap[currency],

      totalVolume: market.total_volume[currency],

      marketCapChange24h: market.market_cap_change_percentage_24h_usd,

      bitcoinDominance: market.market_cap_percentage.btc,

      ethereumDominance: market.market_cap_percentage.eth,

      activeCryptocurrencies: market.active_cryptocurrencies,

      markets: market.markets
    };
  },

  async getTrendingCoins() {
    const url =
      this.config.coingeckoBase +
      '/search/trending';

    const data = await this.cachedRequest(
      'trending-coins',
      url,
      120000
    );

    return (data.coins || []).map(item => ({
      id: item.item.id,
      name: item.item.name,
      symbol: item.item.symbol,
      rank: item.item.market_cap_rank,
      image: item.item.small
    }));
  },

  async searchCoins(query) {
    if (!query || String(query).trim().length < 2) {
      return [];
    }

    const url =
      this.config.coingeckoBase +
      '/search?query=' + encodeURIComponent(query);

    const data = await this.request(url);

    return (data.coins || []).slice(0, 20).map(coin => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      rank: coin.market_cap_rank
    }));
  },

  async getHybridMarketData(coins) {
    const results = await Promise.allSettled(
      coins.map(async coin => {
        try {
          const data = await this.getBinancePrice(
            coin.symbol + 'USDT'
          );

          return {
            ...coin,
            ...data,
            provider: 'binance'
          };

        } catch (error) {
          return {
            ...coin,
            provider: 'coingecko',
            fallback: true
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return {
        ...coins[index],
        provider: 'unavailable',
        error: result.reason?.message
      };
    });
  },

  clearCache() {
    this.cache.clear();
  },

  getLastUpdate() {
    return this.lastUpdate;
  }

};

window.CryptoMarketData = CryptoMarketData;

console.info('Crypto Intelligence Terminal market data loaded.');
