/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   INTERACTIVE CHART ENGINE
   File: js/charts.js

   Library: TradingView Lightweight Charts
   Browser-only implementation.
========================================================= */

'use strict';

/* ---------------------------------------------------------
   CHART STATE
--------------------------------------------------------- */

const ChartEngine = {
  chart: null,
  volumeChart: null,
  rsiChart: null,
  macdChart: null,

  series: {},

  currentSymbol: 'BTC',
  currentRange: '1D',
  currentInterval: '1h',

  candles: [],
  indicators: null,

  resizeObserver: null,

  initialized: false
};

/* ---------------------------------------------------------
   LIBRARY VALIDATION
--------------------------------------------------------- */

function ensureChartLibrary() {
  if (!window.LightweightCharts) {
    throw new Error(
      'TradingView Lightweight Charts library not loaded.'
    );
  }
}

/* ---------------------------------------------------------
   FORMATTERS
--------------------------------------------------------- */

function chartPriceFormatter(price) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 8 : 2
  }).format(price);
}

function chartTimeFormatter(time) {
  return new Date(time * 1000).toLocaleString();
}

/* ---------------------------------------------------------
   CHART THEME
--------------------------------------------------------- */

function getChartOptions(container, height = 420) {
  return {
    width: container.clientWidth || 800,
    height,

    layout: {
      background: {
        type: 'solid',
        color: '#101722'
      },

      textColor: '#A8B3C7',

      fontFamily: 'Inter, Arial, sans-serif',

      fontSize: 11
    },

    grid: {
      vertLines: {
        color: 'rgba(255,255,255,0.045)'
      },

      horzLines: {
        color: 'rgba(255,255,255,0.045)'
      }
    },

    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,

      vertLine: {
        color: '#8B9BB4',
        width: 1,
        style: LightweightCharts.LineStyle.Dashed,
        labelBackgroundColor: '#26354B'
      },

      horzLine: {
        color: '#8B9BB4',
        width: 1,
        style: LightweightCharts.LineStyle.Dashed,
        labelBackgroundColor: '#26354B'
      }
    },

    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.1)',

      scaleMargins: {
        top: 0.08,
        bottom: 0.08
      }
    },

    timeScale: {
      borderColor: 'rgba(255,255,255,0.1)',

      timeVisible: true,

      secondsVisible: false,

      rightOffset: 5,

      barSpacing: 8,

      fixLeftEdge: false,

      fixRightEdge: false
    },

    localization: {
      priceFormatter: chartPriceFormatter,

      timeFormatter: chartTimeFormatter
    },

    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false
    },

    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true
    }
  };
}

/* ---------------------------------------------------------
   CREATE MAIN CHART
--------------------------------------------------------- */

function createMainChart(containerId) {
  ensureChartLibrary();

  const container = document.getElementById(containerId);

  if (!container) {
    throw new Error('Main chart container not found.');
  }

  if (ChartEngine.chart) {
    ChartEngine.chart.remove();
  }

  ChartEngine.chart = LightweightCharts.createChart(
    container,
    getChartOptions(container, 450)
  );

  ChartEngine.series = {};

  return ChartEngine.chart;
}

/* ---------------------------------------------------------
   CREATE CANDLESTICK SERIES
--------------------------------------------------------- */

function createCandlestickSeries() {
  const chart = ChartEngine.chart;

  const candles = chart.addSeries(
    LightweightCharts.CandlestickSeries,
    {
      upColor: '#16C784',

      downColor: '#EA3943',

      borderUpColor: '#16C784',

      borderDownColor: '#EA3943',

      wickUpColor: '#16C784',

      wickDownColor: '#EA3943',

      priceLineVisible: true,

      lastValueVisible: true
    }
  );

  ChartEngine.series.candles = candles;

  return candles;
}

/* ---------------------------------------------------------
   CREATE LINE SERIES
--------------------------------------------------------- */

function createLineSeries(
  name,
  color,
  lineWidth = 2,
  options = {}
) {
  const series = ChartEngine.chart.addSeries(
    LightweightCharts.LineSeries,
    {
      color,

      lineWidth,

      priceLineVisible: false,

      lastValueVisible: options.lastValueVisible ?? true,

      title: name,

      ...options
    }
  );

  ChartEngine.series[name] = series;

  return series;
}

/* ---------------------------------------------------------
   CREATE VOLUME SERIES
--------------------------------------------------------- */

function createVolumeSeries() {
  const series = ChartEngine.chart.addSeries(
    LightweightCharts.HistogramSeries,
    {
      priceFormat: {
        type: 'volume'
      },

      priceScaleId: 'volume',

      lastValueVisible: false,

      priceLineVisible: false
    }
  );

  ChartEngine.chart.priceScale('volume').applyOptions({
    scaleMargins: {
      top: 0.82,
      bottom: 0
    },

    visible: false
  });

  ChartEngine.series.volume = series;

  return series;
}

/* ---------------------------------------------------------
   FORMAT CANDLE DATA
--------------------------------------------------------- */

function formatCandles(candles) {
  const unique = new Map();

  candles.forEach(candle => {
    const time = Number(candle.time);

    if (!Number.isFinite(time)) return;

    if (
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close)
    ) {
      return;
    }

    if (
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.high < candle.low
    ) {
      return;
    }

    unique.set(time, {
      time,

      open: Number(candle.open),

      high: Number(candle.high),

      low: Number(candle.low),

      close: Number(candle.close)
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => a.time - b.time);
}

/* ---------------------------------------------------------
   FORMAT INDICATOR LINE DATA
--------------------------------------------------------- */

function formatLineData(values, candles) {
  return values
    .map((value, index) => {
      if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
      ) {
        return null;
      }

      if (!candles[index]) return null;

      return {
        time: candles[index].time,
        value
      };
    })
    .filter(Boolean);
}

/* ---------------------------------------------------------
   ADD MOVING AVERAGES
--------------------------------------------------------- */

function addMovingAverageOverlays(indicators) {
  const colors = {
    20: '#F5C542',
    50: '#4DABF7',
    200: '#C084FC'
  };

  Object.entries(indicators.ema).forEach(
    ([period, values]) => {
      const name = 'EMA' + period;

      const series = createLineSeries(
        name,
        colors[period] || '#FFFFFF',
        2
      );

      series.setData(
        formatLineData(values, ChartEngine.candles)
      );
    }
  );

  Object.entries(indicators.sma).forEach(
    ([period, values]) => {
      const name = 'SMA' + period;

      const series = createLineSeries(
        name,
        '#8795A9',
        1,
        {
          lineStyle: LightweightCharts.LineStyle.Dashed
        }
      );

      series.setData(
        formatLineData(values, ChartEngine.candles)
      );
    }
  );
}

/* ---------------------------------------------------------
   ADD BOLLINGER BANDS
--------------------------------------------------------- */

function addBollingerBands(indicators) {
  const bands = indicators.bollinger;

  const upper = createLineSeries(
    'BB Upper',
    '#A78BFA',
    1
  );

  const middle = createLineSeries(
    'BB Middle',
    '#64748B',
    1
  );

  const lower = createLineSeries(
    'BB Lower',
    '#A78BFA',
    1
  );

  upper.setData(
    formatLineData(bands.upper, ChartEngine.candles)
  );

  middle.setData(
    formatLineData(bands.middle, ChartEngine.candles)
  );

  lower.setData(
    formatLineData(bands.lower, ChartEngine.candles)
  );
}

/* ---------------------------------------------------------
   CREATE RSI PANEL
--------------------------------------------------------- */

function createRSIChart(containerId, indicators) {
  const container = document.getElementById(containerId);

  if (!container) return;

  if (ChartEngine.rsiChart) {
    ChartEngine.rsiChart.remove();
  }

  ChartEngine.rsiChart =
    LightweightCharts.createChart(
      container,
      getChartOptions(container, 150)
    );

  const rsiSeries = ChartEngine.rsiChart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#A78BFA',
      lineWidth: 2,
      title: 'RSI'
    }
  );

  rsiSeries.setData(
    formatLineData(
      indicators.rsi,
      ChartEngine.candles
    )
  );

  const overbought = ChartEngine.rsiChart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#EA3943',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false
    }
  );

  const oversold = ChartEngine.rsiChart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#16C784',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false
    }
  );

  const neutral = ChartEngine.rsiChart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#64748B',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      lastValueVisible: false,
      priceLineVisible: false
    }
  );

  const candles = ChartEngine.candles;

  overbought.setData(
    candles.map(candle => ({
      time: candle.time,
      value: 70
    }))
  );

  oversold.setData(
    candles.map(candle => ({
      time: candle.time,
      value: 30
    }))
  );

  neutral.setData(
    candles.map(candle => ({
      time: candle.time,
      value: 50
    }))
  );

  ChartEngine.series.rsi = rsiSeries;
}

/* ---------------------------------------------------------
   CREATE MACD PANEL
--------------------------------------------------------- */

function createMACDChart(containerId, indicators) {
  const container = document.getElementById(containerId);

  if (!container) return;

  if (ChartEngine.macdChart) {
    ChartEngine.macdChart.remove();
  }

  ChartEngine.macdChart =
    LightweightCharts.createChart(
      container,
      getChartOptions(container, 160)
    );

  const chart = ChartEngine.macdChart;

  const macd = chart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#4DABF7',
      lineWidth: 2,
      title: 'MACD'
    }
  );

  const signal = chart.addSeries(
    LightweightCharts.LineSeries,
    {
      color: '#F5C542',
      lineWidth: 2,
      title: 'Signal'
    }
  );

  const histogram = chart.addSeries(
    LightweightCharts.HistogramSeries,
    {
      title: 'Histogram',
      priceLineVisible: false
    }
  );

  macd.setData(
    formatLineData(
      indicators.macd.macd,
      ChartEngine.candles
    )
  );

  signal.setData(
    formatLineData(
      indicators.macd.signal,
      ChartEngine.candles
    )
  );

  const histogramData = indicators.macd.histogram
    .map((value, index) => {
      if (
        value === null ||
        !Number.isFinite(value)
      ) return null;

      return {
        time: ChartEngine.candles[index].time,

        value,

        color: value >= 0 ? '#16C784' : '#EA3943'
      };
    })
    .filter(Boolean);

  histogram.setData(histogramData);

  ChartEngine.series.macd = macd;
  ChartEngine.series.macdSignal = signal;
  ChartEngine.series.macdHistogram = histogram;
}

/* ---------------------------------------------------------
   ADD VOLUME HISTOGRAM
--------------------------------------------------------- */

function addVolumeData(candles) {
  if (!ChartEngine.series.volume) return;

  const volumeData = candles.map(candle => ({
    time: candle.time,

    value: Number(candle.volume) || 0,

    color: candle.close >= candle.open
      ? 'rgba(22,199,132,0.55)'
      : 'rgba(234,57,67,0.55)'
  }));

  ChartEngine.series.volume.setData(volumeData);
}

/* ---------------------------------------------------------
   CROSSHAIR SYNCHRONIZATION
--------------------------------------------------------- */

function synchronizeCrosshairs(charts) {
  charts.forEach(chart => {
    if (!chart) return;

    chart.subscribeCrosshairMove(param => {
      if (!param.time) return;

      charts.forEach(otherChart => {
        if (otherChart === chart) return;

        if (!otherChart) return;

        const coordinate =
          otherChart.timeScale().timeToCoordinate(
            param.time
          );

        if (coordinate === null) return;

        const series = ChartEngine.series.candles;

        if (!series) return;

        const data = series.dataByIndex(
          otherChart.timeScale().coordinateToLogical(
            coordinate
          ),
          -1
        );

        if (!data) return;
      });
    });
  });
}

/* ---------------------------------------------------------
   LOAD CHART
--------------------------------------------------------- */

async function loadCryptoChart(
  symbol = 'BTC',
  range = '1D',
  interval = '1h'
) {
  const mainContainer =
    document.getElementById('mainChart');

  if (!mainContainer) {
    throw new Error('Missing #mainChart element.');
  }

  ChartEngine.currentSymbol = symbol;
  ChartEngine.currentRange = range;
  ChartEngine.currentInterval = interval;

  mainContainer.innerHTML = '';

  try {
    const candles = await window.CryptoAPI.getHistoricalData(
      symbol,
      range,
      interval
    );

    if (!candles.length) {
      throw new Error('No historical candles available.');
    }

    ChartEngine.candles = formatCandles(candles);

    ChartEngine.indicators =
      window.TechnicalIndicators.calculateAllIndicators(
        candles
      );

    createMainChart('mainChart');

    createCandlestickSeries().setData(
      ChartEngine.candles
    );

    createVolumeSeries();

    addVolumeData(candles);

    addMovingAverageOverlays(
      ChartEngine.indicators
    );

    addBollingerBands(
      ChartEngine.indicators
    );

    createRSIChart(
      'rsiChart',
      ChartEngine.indicators
    );

    createMACDChart(
      'macdChart',
      ChartEngine.indicators
    );

    const charts = [
      ChartEngine.chart,
      ChartEngine.rsiChart,
      ChartEngine.macdChart
    ];

    charts.forEach(chart => {
      if (!chart) return;

      chart.timeScale().fitContent();
    });

    synchronizeCrosshairs(charts);

    ChartEngine.initialized = true;

    if (typeof window.updateTradingSignal === 'function') {
      window.updateTradingSignal(
        ChartEngine.indicators
      );
    }

    return ChartEngine.indicators;

  } catch (error) {
    console.error('Chart loading error:', error);

    mainContainer.innerHTML =
      '<div class="chart-error">Unable to load chart data: ' +
      error.message +
      '</div>';

    throw error;
  }
}

/* ---------------------------------------------------------
   RESIZE CHARTS
--------------------------------------------------------- */

function resizeAllCharts() {
  const chartContainers = [
    ['mainChart', ChartEngine.chart],
    ['rsiChart', ChartEngine.rsiChart],
    ['macdChart', ChartEngine.macdChart]
  ];

  chartContainers.forEach(([id, chart]) => {
    const element = document.getElementById(id);

    if (!element || !chart) return;

    chart.applyOptions({
      width: element.clientWidth
    });
  });
}

/* ---------------------------------------------------------
   OBSERVE RESIZE
--------------------------------------------------------- */

function observeChartResize() {
  if (ChartEngine.resizeObserver) {
    ChartEngine.resizeObserver.disconnect();
  }

  ChartEngine.resizeObserver = new ResizeObserver(() => {
    resizeAllCharts();
  });

  [
    'mainChart',
    'rsiChart',
    'macdChart'
  ].forEach(id => {
    const element = document.getElementById(id);

    if (element) {
      ChartEngine.resizeObserver.observe(element);
    }
  });
}

/* ---------------------------------------------------------
   UPDATE LAST CANDLE
--------------------------------------------------------- */

function updateLiveCandle(candle) {
  if (!ChartEngine.series.candles) return;

  const formatted = {
    time: candle.time,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close)
  };

  ChartEngine.series.candles.update(formatted);
}

/* ---------------------------------------------------------
   CHANGE RANGE
--------------------------------------------------------- */

async function changeChartRange(range, interval) {
  return loadCryptoChart(
    ChartEngine.currentSymbol,
    range,
    interval || ChartEngine.currentInterval
  );
}

/* ---------------------------------------------------------
   CHANGE COIN
--------------------------------------------------------- */

async function changeChartSymbol(symbol) {
  return loadCryptoChart(
    symbol,
    ChartEngine.currentRange,
    ChartEngine.currentInterval
  );
}

/* ---------------------------------------------------------
   CLEANUP
--------------------------------------------------------- */

function destroyCharts() {
  [
    ChartEngine.chart,
    ChartEngine.rsiChart,
    ChartEngine.macdChart
  ].forEach(chart => {
    if (chart) chart.remove();
  });

  if (ChartEngine.resizeObserver) {
    ChartEngine.resizeObserver.disconnect();
  }

  ChartEngine.chart = null;
  ChartEngine.rsiChart = null;
  ChartEngine.macdChart = null;

  ChartEngine.series = {};

  ChartEngine.initialized = false;
}

/* ---------------------------------------------------------
   PUBLIC API
--------------------------------------------------------- */

window.CryptoCharts = {
  loadCryptoChart,
  changeChartRange,
  changeChartSymbol,

  createMainChart,
  createCandlestickSeries,

  addMovingAverageOverlays,
  addBollingerBands,

  createRSIChart,
  createMACDChart,

  updateLiveCandle,

  resizeAllCharts,
  observeChartResize,

  destroyCharts,

  getState() {
    return {
      symbol: ChartEngine.currentSymbol,
      range: ChartEngine.currentRange,
      interval: ChartEngine.currentInterval,
      initialized: ChartEngine.initialized
    };
  }
};

/* ---------------------------------------------------------
   INITIALIZATION
--------------------------------------------------------- */

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    observeChartResize
  );
} else {
  observeChartResize();
}

console.info(
  'Crypto Intelligence Terminal chart engine loaded.'
);
