/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   LIVE MARKET DATA ENGINE
   File: js/api.js

   Providers:
   1. CoinGecko
   2. Binance

   No API key required for the public endpoints used here.
========================================================= */

'use strict';

/* ---------------------------------------------------------
   INTERNAL SETTINGS
--------------------------------------------------------- */

const API_CACHE = new Map();

const API_CACHE_SETTINGS = {
  market: 30000,
  ticker: 15000,
  history: 60000,
  maxPages: 20,
  timeout: 15000
};

const API_STATE = {
  provider: 'hybrid',
  lastUpdate: null,
  lastError: null,
  isLoading: false
};

/* ---------------------------------------------------------
   HELPER: BUILD URL
--------------------------------------------------------- */

function buildApiUrl(base, path, params = {}) {
  const url = new URL(path, base);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

/* ---------------------------------------------------------
   HELPER: FETCH WITH TIMEOUT AND ERROR HANDLING
--------------------------------------------------------- */

async function apiFetch(url, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || API_CACHE_SETTINGS.timeout
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');

      throw new Error(
        'API request failed: ' +
        response.status +
        ' ' +
        response.statusText +
        ' ' +
        message.slice(0, 150)
      );
    }

    return await response.json();

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('API request timed out.');
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

/* ---------------------------------------------------------
   HELPER: CACHE
--------------------------------------------------------- */

function getCachedData(key) {
  const cached = API_CACHE.get(key);

  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    API_CACHE.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedData(key, data, duration) {
  API_CACHE.set(key, {
    data,
    expiresAt: Date.now() + duration
  });

  return data;
}

function clearApiCache() {
  API_CACHE.clear();
}

/* ---------------------------------------------------------
   HELPER: NUMBER FORMATTING
--------------------------------------------------------- */

function normalizeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatApiPrice(value) {
  const price = normalizeNumber(value);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 8 : 2
  }).format(price);
}

/* ---------------------------------------------------------
   COINGECKO: TOP 50 MARKET DATA
--------------------------------------------------------- */

async function fetchCoinGeckoMarkets(forceRefresh = false) {
  const cacheKey = 'coingecko-markets';

  if (!forceRefresh) {
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
  }

  const config = window.API_CONFIG;

  const base = config.providers.coingecko.baseURL;

  const coinIds = window.CRYPTOCURRENCIES
    .map(coin => coin.id)
    .join(',');

  const params = {
    vs_currency: 'usd',
    ids: coinIds,
    order: 'market_cap_desc',
    per_page: 50,
    page: 1,
    sparkline: true,
    price_change_percentage: '1h,24h,7d,30d'
  };

  const url = buildApiUrl(
    base,
    '/coins/markets',
    params
  );

  const data = await apiFetch(url);

  if (!Array.isArray(data)) {
    throw new Error('Invalid CoinGecko market response.');
  }

  return setCachedData(
    cacheKey,
    data,
    API_CACHE_SETTINGS.market
  );
}

/* ---------------------------------------------------------
   BINANCE: 24 HOUR TICKERS
--------------------------------------------------------- */

async function fetchBinanceTickers(forceRefresh = false) {
  const cacheKey = 'binance-tickers';

  if (!forceRefresh) {
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
  }

  const base = window.API_CONFIG.providers.binance.baseURL;

  const url = buildApiUrl(
    base,
    '/ticker/24hr'
  );

  const data = await apiFetch(url);

  if (!Array.isArray(data)) {
    throw new Error('Invalid Binance ticker response.');
  }

  return setCachedData(
    cacheKey,
    data,
    API_CACHE_SETTINGS.ticker
  );
}

/* ---------------------------------------------------------
   FIND BINANCE TICKER
--------------------------------------------------------- */

function findBinanceTicker(symbol, tickers) {
  const tradingPair = window.BINANCE_SYMBOLS[symbol];

  if (!tradingPair) return null;

  return tickers.find(
    ticker => ticker.symbol === tradingPair
  ) || null;
}

/* ---------------------------------------------------------
   NORMALIZE COINGECKO MARKET DATA
--------------------------------------------------------- */

function normalizeCoinGeckoCoin(coin) {
  return {
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,

    image: coin.image,

    rank: coin.market_cap_rank,

    price: normalizeNumber(coin.current_price),

    marketCap: normalizeNumber(coin.market_cap),

    volume24h: normalizeNumber(coin.total_volume),

    high24h: normalizeNumber(coin.high_24h),

    low24h: normalizeNumber(coin.low_24h),

    change1h: normalizeNumber(
      coin.price_change_percentage_1h_in_currency
    ),

    change24h: normalizeNumber(
      coin.price_change_percentage_24h
    ),

    change7d: normalizeNumber(
      coin.price_change_percentage_7d_in_currency
    ),

    change30d: normalizeNumber(
      coin.price_change_percentage_30d_in_currency
    ),

    circulatingSupply: normalizeNumber(
      coin.circulating_supply
    ),

    totalSupply: coin.total_supply,

    maxSupply: coin.max_supply,

    sparkline: coin.sparkline_in_7d?.price || [],

    lastUpdated: coin.last_updated,

    source: 'CoinGecko'
  };
}

/* ---------------------------------------------------------
   HYBRID MARKET DATA
--------------------------------------------------------- */

async function getMarketData(options = {}) {
  const forceRefresh = options.forceRefresh === true;

  API_STATE.isLoading = true;
  API_STATE.lastError = null;

  try {
    let coins;

    try {
      const marketData = await fetchCoinGeckoMarkets(
        forceRefresh
      );

      coins = marketData.map(normalizeCoinGeckoCoin);

      API_STATE.provider = 'CoinGecko';

    } catch (coinGeckoError) {
      console.warn(
        'CoinGecko unavailable:',
        coinGeckoError.message
      );

      const fallback = await getBinanceFallbackMarkets(
        forceRefresh
      );

      coins = fallback;

      API_STATE.provider = 'Binance fallback';
    }

    try {
      const tickers = await fetchBinanceTickers(
        forceRefresh
      );

      coins = coins.map(coin => {
        const ticker = findBinanceTicker(
          coin.symbol,
          tickers
        );

        if (!ticker) return coin;

        return {
          ...coin,

          binancePrice: normalizeNumber(
            ticker.lastPrice
          ),

          binanceChange24h: normalizeNumber(
            ticker.priceChangePercent
          ),

          binanceVolume24h: normalizeNumber(
            ticker.quoteVolume
          ),

          binanceSource: 'Binance'
        };
      });

      if (API_STATE.provider === 'CoinGecko') {
        API_STATE.provider = 'Hybrid';
      }

    } catch (binanceError) {
      console.warn(
        'Binance ticker unavailable:',
        binanceError.message
      );
    }

    coins.sort((a, b) => {
      return (a.rank || 999999) - (b.rank || 999999);
    });

    API_STATE.lastUpdate = new Date().toISOString();

    return coins.slice(0, 50);

  } catch (error) {
    API_STATE.lastError = error.message;

    console.error('Market data error:', error);

    throw error;

  } finally {
    API_STATE.isLoading = false;
  }
}

/* ---------------------------------------------------------
   BINANCE FALLBACK MARKET DATA
--------------------------------------------------------- */

async function getBinanceFallbackMarkets(forceRefresh = false) {
  const tickers = await fetchBinanceTickers(forceRefresh);

  return window.CRYPTOCURRENCIES
    .filter(coin => window.BINANCE_SYMBOLS[coin.symbol])
    .map((coin, index) => {
      const ticker = findBinanceTicker(
        coin.symbol,
        tickers
      );

      if (!ticker) return null;

      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        rank: index + 1,

        price: normalizeNumber(ticker.lastPrice),

        marketCap: 0,

        volume24h: normalizeNumber(
          ticker.quoteVolume
        ),

        high24h: normalizeNumber(ticker.highPrice),

        low24h: normalizeNumber(ticker.lowPrice),

        change1h: 0,

        change24h: normalizeNumber(
          ticker.priceChangePercent
        ),

        change7d: 0,

        change30d: 0,

        circulatingSupply: 0,

        totalSupply: null,

        maxSupply: null,

        sparkline: [],

        lastUpdated: new Date().toISOString(),

        source: 'Binance'
      };
    })
    .filter(Boolean);
}

/* ---------------------------------------------------------
   GET INDIVIDUAL COIN
--------------------------------------------------------- */

async function getCoinMarketData(coinId) {
  const coins = await getMarketData();

  return coins.find(
    coin => coin.id === coinId ||
            coin.symbol === coinId.toUpperCase()
  ) || null;
}

/* ---------------------------------------------------------
   BINANCE HISTORICAL CANDLES
--------------------------------------------------------- */

function normalizeBinanceCandle(candle) {
  return {
    time: Math.floor(candle[0] / 1000),

    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),

    volume: Number(candle[5]),

    closeTime: candle[6],

    quoteVolume: Number(candle[7]),

    trades: Number(candle[8])
  };
}

/* ---------------------------------------------------------
   HISTORICAL RANGE CONVERSION
--------------------------------------------------------- */

function getRangeStart(range) {
  const selected = window.CHART_RANGES.find(
    item => item.label === range
  );

  if (!selected || selected.days === 'max') {
    return null;
  }

  return Date.now() - selected.days * 86400000;
}

/* ---------------------------------------------------------
   FETCH BINANCE HISTORICAL DATA
   Supports pagination for long historical periods.
--------------------------------------------------------- */

async function fetchBinanceHistory(
  symbol,
  interval = '1d',
  range = '1M',
  options = {}
) {
  const tradingPair = window.BINANCE_SYMBOLS[symbol];

  if (!tradingPair) {
    throw new Error(
      'No Binance trading pair configured for ' + symbol
    );
  }

  const base = window.API_CONFIG.providers.binance.baseURL;

  const startTime = getRangeStart(range);

  let endTime = Date.now();

  let candles = [];

  let page = 0;

  const maxPages = options.maxPages ||
    API_CACHE_SETTINGS.maxPages;

  while (page < maxPages) {
    const params = {
      symbol: tradingPair,
      interval,
      limit: 1000,
      endTime
    };

    if (startTime !== null) {
      params.startTime = startTime;
    }

    const url = buildApiUrl(
      base,
      '/klines',
      params
    );

    const data = await apiFetch(url);

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    candles = data.concat(candles);

    const earliestTime = data[0][0];

    if (data.length < 1000) {
      break;
    }

    if (startTime !== null && earliestTime <= startTime) {
      break;
    }

    endTime = earliestTime - 1;

    page++;

    if (options.maxPages === undefined && page >= 5) {
      break;
    }
  }

  const unique = new Map();

  candles.forEach(candle => {
    unique.set(candle[0], normalizeBinanceCandle(candle));
  });

  let result = Array.from(unique.values());

  result.sort((a, b) => a.time - b.time);

  if (startTime !== null) {
    result = result.filter(
      candle => candle.time * 1000 >= startTime
    );
  }

  return result;
}

/* ---------------------------------------------------------
   COINGECKO HISTORICAL OHLC
--------------------------------------------------------- */

async function fetchCoinGeckoHistory(
  coinId,
  range = '1M'
) {
  const selected = window.CHART_RANGES.find(
    item => item.label === range
  );

  const days = selected?.days === 'max'
    ? 'max'
    : selected?.days || 30;

  const base = window.API_CONFIG.providers.coingecko.baseURL;

  const url = buildApiUrl(
    base,
    '/coins/' + encodeURIComponent(coinId) + '/ohlc',
    {
      vs_currency: 'usd',
      days
    }
  );

  const data = await apiFetch(url);

  if (!Array.isArray(data)) {
    throw new Error('Invalid historical OHLC response.');
  }

  return data.map(candle => ({
    time: Math.floor(candle[0] / 1000),
    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),
    volume: 0
  })).sort((a, b) => a.time - b.time);
}

/* ---------------------------------------------------------
   MAIN HISTORICAL DATA FUNCTION
--------------------------------------------------------- */

async function getHistoricalData(
  symbol,
  range = '1D',
  interval = '1h',
  options = {}
) {
  const cacheKey = [
    'history',
    symbol,
    range,
    interval
  ].join('-');

  if (!options.forceRefresh) {
    const cached = getCachedData(cacheKey);

    if (cached) return cached;
  }

  let data;

  try {
    data = await fetchBinanceHistory(
      symbol,
      interval,
      range,
      options
    );

  } catch (binanceError) {
    console.warn(
      'Binance historical data unavailable:',
      binanceError.message
    );

    const coin = window.CRYPTOCURRENCIES.find(
      item => item.symbol === symbol.toUpperCase()
    );

    if (!coin) throw binanceError;

    data = await fetchCoinGeckoHistory(
      coin.id,
      range
    );
  }

  if (!data.length) {
    throw new Error('No historical candle data available.');
  }

  return setCachedData(
    cacheKey,
    data,
    API_CACHE_SETTINGS.history
  );
}

/* ---------------------------------------------------------
   BINANCE LIVE PRICE
--------------------------------------------------------- */

async function getLivePrice(symbol) {
  const tradingPair = window.BINANCE_SYMBOLS[symbol];

  if (!tradingPair) {
    throw new Error('Unsupported Binance symbol: ' + symbol);
  }

  const base = window.API_CONFIG.providers.binance.baseURL;

  const url = buildApiUrl(
    base,
    '/ticker/price',
    {
      symbol: tradingPair
    }
  );

  const data = await apiFetch(url);

  return {
    symbol,
    pair: tradingPair,
    price: Number(data.price),
    timestamp: Date.now(),
    source: 'Binance'
  };
}

/* ---------------------------------------------------------
   BINANCE ORDER BOOK
--------------------------------------------------------- */

async function getOrderBook(symbol, limit = 20) {
  const tradingPair = window.BINANCE_SYMBOLS[symbol];

  if (!tradingPair) {
    throw new Error('Unsupported Binance symbol.');
  }

  const base = window.API_CONFIG.providers.binance.baseURL;

  const url = buildApiUrl(
    base,
    '/depth',
    {
      symbol: tradingPair,
      limit
    }
  );

  const data = await apiFetch(url);

  return {
    symbol,
    lastUpdateId: data.lastUpdateId,

    bids: data.bids.map(item => ({
      price: Number(item[0]),
      quantity: Number(item[1])
    })),

    asks: data.asks.map(item => ({
      price: Number(item[0]),
      quantity: Number(item[1])
    }))
  };
}

/* ---------------------------------------------------------
   MARKET STATISTICS
--------------------------------------------------------- */

async function getGlobalMarketStats() {
  const base = window.API_CONFIG.providers.coingecko.baseURL;

  const url = buildApiUrl(
    base,
    '/global'
  );

  const data = await apiFetch(url);

  const stats = data.data;

  return {
    totalMarketCap: stats.total_market_cap.usd,

    totalVolume: stats.total_volume.usd,

    btcDominance: stats.market_cap_percentage.btc,

    ethDominance: stats.market_cap_percentage.eth,

    activeCryptocurrencies: stats.active_cryptocurrencies,

    marketCapChange24h: stats.market_cap_change_percentage_24h_usd,

    updatedAt: stats.updated_at
  };
}

/* ---------------------------------------------------------
   API CONNECTION STATUS
--------------------------------------------------------- */

function getApiStatus() {
  return {
    provider: API_STATE.provider,

    lastUpdate: API_STATE.lastUpdate,

    lastError: API_STATE.lastError,

    isLoading: API_STATE.isLoading,

    cacheEntries: API_CACHE.size
  };
}

/* ---------------------------------------------------------
   MANUAL CACHE CLEANUP
--------------------------------------------------------- */

function cleanupApiCache() {
  const now = Date.now();

  for (const [key, value] of API_CACHE.entries()) {
    if (now > value.expiresAt) {
      API_CACHE.delete(key);
    }
  }
}

/* ---------------------------------------------------------
   PUBLIC APPLICATION INTERFACE
--------------------------------------------------------- */

window.CryptoAPI = {
  getMarketData,
  getCoinMarketData,

  fetchCoinGeckoMarkets,
  fetchBinanceTickers,
  getBinanceFallbackMarkets,

  getHistoricalData,
  fetchBinanceHistory,
  fetchCoinGeckoHistory,

  getLivePrice,
  getOrderBook,
  getGlobalMarketStats,

  getApiStatus,

  clearApiCache,
  cleanupApiCache,

  formatApiPrice
};

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

console.info(
  'Crypto Intelligence Terminal API engine loaded.'
);

