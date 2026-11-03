/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   INTERACTIVE CHART ENGINE
   File: js/chart-engine.js
========================================================= */

'use strict';

const CryptoChartEngine = {

  charts: new Map(),

  defaults: {
    background: '#090d16',
    panel: '#101827',
    grid: '#202b3c',
    text: '#8493a9',
    bullish: '#00d69a',
    bearish: '#ff526e',
    ema20: '#ffd166',
    ema50: '#4da3ff',
    ema200: '#bd93f9',
    bollinger: '#7986ff',
    crosshair: '#a8b7cc',
    candleWidth: 9,
    candleGap: 4,
    rightPadding: 90,
    topPadding: 25,
    bottomPadding: 30,
    volumeHeight: 85,
    indicatorHeight: 110
  },

  create(container, options = {}) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }

    if (!container) {
      throw new Error('Chart container not found.');
    }

    const id = options.id || (
      'chart-' + Math.random().toString(36).slice(2)
    );

    const wrapper = document.createElement('div');

    wrapper.className = 'cit-chart-wrapper';
    wrapper.style.cssText = [
      'position:relative',
      'width:100%',
      'height:' + (options.height || 560) + 'px',
      'overflow:hidden',
      'background:' + this.defaults.background,
      'border-radius:8px'
    ].join(';');

    const canvas = document.createElement('canvas');

    canvas.style.cssText = [
      'display:block',
      'width:100%',
      'height:100%',
      'cursor:crosshair',
      'touch-action:pan-y'
    ].join(';');

    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas is not supported.');
    }

    const chart = {
      id,
      container,
      wrapper,
      canvas,
      ctx,

      data: [],
      visibleData: [],

      symbol: options.symbol || 'BTCUSDT',
      timeframe: options.timeframe || '1d',

      offset: 0,
      zoom: 1,

      mouse: null,
      dragging: false,
      lastX: 0,

      indicators: {
        ema20: true,
        ema50: true,
        ema200: false,
        bollinger: false,
        volume: true,
        rsi: false,
        macd: false
      },

      indicatorData: {},

      callbacks: options.callbacks || {},

      destroyed: false,

      dimensions: {
        width: 0,
        height: 0,
        ratio: 1
      }
    };

    this.charts.set(id, chart);

    this.bindEvents(chart);
    this.resize(chart);

    if (typeof ResizeObserver !== 'undefined') {
      chart.observer = new ResizeObserver(() => {
        this.resize(chart);
      });

      chart.observer.observe(wrapper);
    }

    this.draw(chart);

    return {
      id,

      setData: data => this.setData(chart, data),

      setIndicators: settings =>
        this.setIndicators(chart, settings),

      setTimeframe: timeframe =>
        this.setTimeframe(chart, timeframe),

      setSymbol: symbol => {
        chart.symbol = symbol;
        this.draw(chart);
      },

      setCrosshair: enabled => {
        chart.crosshairEnabled = Boolean(enabled);
        this.draw(chart);
      },

      resize: () => this.resize(chart),

      destroy: () => this.destroy(chart),

      getChart: () => chart
    };
  },

  resize(chart) {
    if (chart.destroyed) return;

    const rect = chart.wrapper.getBoundingClientRect();

    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    const ratio = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    chart.canvas.width = Math.round(width * ratio);
    chart.canvas.height = Math.round(height * ratio);

    chart.dimensions = {
      width,
      height,
      ratio
    };

    chart.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.draw(chart);
  },

  setData(chart, data) {
    if (!Array.isArray(data)) {
      throw new Error('Chart data must be an array.');
    }

    chart.data = data
      .filter(c =>
        Number.isFinite(Number(c.open)) &&
        Number.isFinite(Number(c.high)) &&
        Number.isFinite(Number(c.low)) &&
        Number.isFinite(Number(c.close)) &&
        Number.isFinite(Number(c.time))
      )
      .map(c => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume) || 0
      }))
      .sort((a, b) => a.time - b.time);

    chart.data = chart.data.filter((c, i, arr) =>
      i === 0 || c.time > arr[i - 1].time
    );

    chart.offset = 0;

    this.calculateIndicators(chart);
    this.draw(chart);
  },

  setIndicators(chart, settings) {
    chart.indicators = {
      ...chart.indicators,
      ...settings
    };

    this.draw(chart);
  },

  setTimeframe(chart, timeframe) {
    chart.timeframe = timeframe;
    chart.offset = 0;

    if (chart.callbacks.onTimeframeChange) {
      chart.callbacks.onTimeframeChange(timeframe);
    }

    this.draw(chart);
  },

  calculateEMA(values, period) {
    const result = Array(values.length).fill(null);

    if (values.length < period) return result;

    let sum = 0;

    for (let i = 0; i < period; i++) {
      sum += values[i];
    }

    let previous = sum / period;

    result[period - 1] = previous;

    const multiplier = 2 / (period + 1);

    for (let i = period; i < values.length; i++) {
      previous =
        (values[i] - previous) * multiplier + previous;

      result[i] = previous;
    }

    return result;
  },

  calculateSMA(values, period) {
    const result = Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {
      let sum = 0;

      for (let j = i - period + 1; j <= i; j++) {
        sum += values[j];
      }

      result[i] = sum / period;
    }

    return result;
  },

  calculateBollinger(values, period = 20, multiplier = 2) {
    const middle = this.calculateSMA(values, period);

    const upper = Array(values.length).fill(null);
    const lower = Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);

      const mean = middle[i];

      const variance = slice.reduce(
        (sum, value) => sum + Math.pow(value - mean, 2),
        0
      ) / period;

      const deviation = Math.sqrt(variance);

      upper[i] = mean + multiplier * deviation;
      lower[i] = mean - multiplier * deviation;
    }

    return { upper, middle, lower };
  },

  calculateRSI(values, period = 14) {
    const result = Array(values.length).fill(null);

    if (values.length <= period) return result;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const difference = values[i] - values[i - 1];

      gains += Math.max(0, difference);
      losses += Math.max(0, -difference);
    }

    let averageGain = gains / period;
    let averageLoss = losses / period;

    const calculateValue = () => {
      if (averageLoss === 0) return 100;

      const rs = averageGain / averageLoss;

      return 100 - 100 / (1 + rs);
    };

    result[period] = calculateValue();

    for (let i = period + 1; i < values.length; i++) {
      const difference = values[i] - values[i - 1];

      averageGain = (
        averageGain * (period - 1) +
        Math.max(0, difference)
      ) / period;

      averageLoss = (
        averageLoss * (period - 1) +
        Math.max(0, -difference)
      ) / period;

      result[i] = calculateValue();
    }

    return result;
  },

  calculateMACD(values) {
    const fast = this.calculateEMA(values, 12);
    const slow = this.calculateEMA(values, 26);

    const macd = values.map((_, i) =>
      fast[i] !== null && slow[i] !== null
        ? fast[i] - slow[i]
        : null
    );

    const firstValid = macd.findIndex(v => v !== null);

    const signal = Array(values.length).fill(null);

    if (firstValid >= 0) {
      const valid = macd.slice(firstValid);
      const calculated = this.calculateEMA(valid, 9);

      calculated.forEach((value, i) => {
        signal[firstValid + i] = value;
      });
    }

    const histogram = macd.map((v, i) =>
      v !== null && signal[i] !== null
        ? v - signal[i]
        : null
    );

    return { macd, signal, histogram };
  },

  calculateIndicators(chart) {
    const closes = chart.data.map(c => c.close);

    chart.indicatorData = {
      ema20: this.calculateEMA(closes, 20),
      ema50: this.calculateEMA(closes, 50),
      ema200: this.calculateEMA(closes, 200),

      bollinger: this.calculateBollinger(closes),

      rsi: this.calculateRSI(closes),

      macd: this.calculateMACD(closes)
    };
  },

  getVisibleData(chart) {
    const { width } = chart.dimensions;

    const availableWidth =
      width - this.defaults.rightPadding;

    const candleStep =
      (this.defaults.candleWidth + this.defaults.candleGap) /
      chart.zoom;

    const count = Math.max(
      10,
      Math.floor(availableWidth / candleStep)
    );

    const end = Math.max(
      0,
      chart.data.length - chart.offset
    );

    const start = Math.max(0, end - count);

    chart.visibleStart = start;
    chart.visibleEnd = end;

    return chart.data.slice(start, end);
  },

  draw(chart) {
    if (chart.destroyed) return;

    const { width, height } = chart.dimensions;

    if (!width || !height) return;

    const ctx = chart.ctx;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = this.defaults.background;
    ctx.fillRect(0, 0, width, height);

    if (!chart.data.length) {
      this.drawMessage(chart, 'Waiting for market data...');
      return;
    }

    const data = this.getVisibleData(chart);

    if (!data.length) return;

    chart.visibleData = data;

    const hasRSI = chart.indicators.rsi;
    const hasMACD = chart.indicators.macd;

    const indicatorPanels =
      Number(hasRSI) + Number(hasMACD);

    const volumeHeight = chart.indicators.volume
      ? this.defaults.volumeHeight
      : 0;

    const indicatorHeight =
      indicatorPanels * this.defaults.indicatorHeight;

    const priceTop = this.defaults.topPadding;

    const priceBottom =
      height -
      this.defaults.bottomPadding -
      volumeHeight -
      indicatorHeight;

    const priceHeight = priceBottom - priceTop;

    const prices = [];

    data.forEach(c => {
      prices.push(c.high, c.low);
    });

    const globalStart = chart.visibleStart;
    const globalEnd = chart.visibleEnd;

    ['ema20', 'ema50', 'ema200'].forEach(name => {
      if (!chart.indicators[name]) return;

      const values = chart.indicatorData[name]
        .slice(globalStart, globalEnd);

      values.forEach(value => {
        if (Number.isFinite(value)) prices.push(value);
      });
    });

    if (chart.indicators.bollinger) {
      const bands = chart.indicatorData.bollinger;

      [bands.upper, bands.lower].forEach(values => {
        values.slice(globalStart, globalEnd).forEach(value => {
          if (Number.isFinite(value)) prices.push(value);
        });
      });
    }

    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);

    const padding = (maxPrice - minPrice) * 0.08 || maxPrice * 0.01;

    minPrice -= padding;
    maxPrice += padding;

    if (minPrice === maxPrice) {
      minPrice -= 1;
      maxPrice += 1;
    }

    chart.priceScale = {
      min: minPrice,
      max: maxPrice,
      top: priceTop,
      bottom: priceBottom
    };

    const y = value =>
      priceBottom -
      (value - minPrice) /
      (maxPrice - minPrice) *
      priceHeight;

    const candleStep = (
      width - this.defaults.rightPadding
    ) / data.length;

    chart.candleStep = candleStep;

    const x = index =>
      index * candleStep + candleStep / 2;

    this.drawGrid(
      chart,
      width,
      priceTop,
      priceBottom,
      minPrice,
      maxPrice,
      y
    );

    if (chart.indicators.bollinger) {
      this.drawLine(
        chart,
        chart.indicatorData.bollinger.upper.slice(globalStart, globalEnd),
        x,
        y,
        this.defaults.bollinger
      );

      this.drawLine(
        chart,
        chart.indicatorData.bollinger.lower.slice(globalStart, globalEnd),
        x,
        y,
        this.defaults.bollinger
      );
    }

    if (chart.indicators.ema20) {
      this.drawLine(
        chart,
        chart.indicatorData.ema20.slice(globalStart, globalEnd),
        x,
        y,
        this.defaults.ema20
      );
    }

    if (chart.indicators.ema50) {
      this.drawLine(
        chart,
        chart.indicatorData.ema50.slice(globalStart, globalEnd),
        x,
        y,
        this.defaults.ema50
      );
    }

    if (chart.indicators.ema200) {
      this.drawLine(
        chart,
        chart.indicatorData.ema200.slice(globalStart, globalEnd),
        x,
        y,
        this.defaults.ema200
      );
    }

    data.forEach((candle, index) => {
      const center = x(index);

      const openY = y(candle.open);
      const closeY = y(candle.close);
      const highY = y(candle.high);
      const lowY = y(candle.low);

      const bullish = candle.close >= candle.open;

      const color = bullish
        ? this.defaults.bullish
        : this.defaults.bearish;

      const candleWidth = Math.max(
        1,
        Math.min(18, candleStep * 0.72)
      );

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(center, highY);
      ctx.lineTo(center, lowY);
      ctx.stroke();

      ctx.fillRect(
        center - candleWidth / 2,
        Math.min(openY, closeY),
        candleWidth,
        Math.max(1, Math.abs(closeY - openY))
      );
    });

    if (chart.indicators.volume) {
      this.drawVolume(
        chart,
        data,
        priceBottom,
        volumeHeight,
        x
      );
    }

    let nextPanel = height - this.defaults.bottomPadding -
      volumeHeight;

    if (hasRSI) {
      nextPanel += this.defaults.indicatorHeight;

      this.drawRSI(
        chart,
        chart.indicatorData.rsi.slice(globalStart, globalEnd),
        nextPanel - this.defaults.indicatorHeight,
        this.defaults.indicatorHeight,
        x
      );
    }

    if (hasMACD) {
      nextPanel += this.defaults.indicatorHeight;

      this.drawMACD(
        chart,
        chart.indicatorData.macd,
        globalStart,
        globalEnd,
        nextPanel - this.defaults.indicatorHeight,
        this.defaults.indicatorHeight,
        x
      );
    }

    this.drawPriceAxis(chart, width, y, minPrice, maxPrice);

    this.drawTimeAxis(chart, data, x, priceBottom);

    if (chart.mouse && chart.crosshairEnabled !== false) {
      this.drawCrosshair(chart);
    }
  },

  drawGrid(chart, width, top, bottom, min, max, y) {
    const ctx = chart.ctx;

    ctx.strokeStyle = this.defaults.grid;
    ctx.lineWidth = 1;

    for (let i = 0; i <= 6; i++) {
      const value = min + (max - min) * i / 6;
      const position = y(value);

      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(width, position);
      ctx.stroke();
    }

    ctx.strokeStyle = this.defaults.grid;

    ctx.beginPath();
    ctx.moveTo(0, bottom);
    ctx.lineTo(width, bottom);
    ctx.stroke();
  },

  drawLine(chart, values, x, y, color) {
    const ctx = chart.ctx;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    let started = false;

    values.forEach((value, index) => {
      if (!Number.isFinite(value)) {
        started = false;
        return;
      }

      if (!started) {
        ctx.moveTo(x(index), y(value));
        started = true;
      } else {
        ctx.lineTo(x(index), y(value));
      }
    });

    ctx.stroke();
  },

  drawVolume(chart, data, priceBottom, volumeHeight, x) {
    const ctx = chart.ctx;

    const maxVolume = Math.max(
      1,
      ...data.map(c => c.volume)
    );

    const top = priceBottom + 8;

    ctx.fillStyle = this.defaults.text;
    ctx.font = '10px Arial';
    ctx.fillText('VOLUME', 10, top + 10);

    data.forEach((candle, index) => {
      const barHeight =
        candle.volume / maxVolume *
        (volumeHeight - 24);

      ctx.fillStyle = candle.close >= candle.open
        ? this.defaults.bullish
        : this.defaults.bearish;

      const barWidth = Math.max(
        1,
        chart.candleStep * 0.7
      );

      ctx.fillRect(
        x(index) - barWidth / 2,
        top + volumeHeight - barHeight - 5,
        barWidth,
        barHeight
      );
    });
  },

  drawRSI(chart, values, top, panelHeight, x) {
    const ctx = chart.ctx;

    const bottom = top + panelHeight - 15;
    const height = bottom - top - 20;

    const y = value =>
      bottom - value / 100 * height;

    ctx.fillStyle = this.defaults.text;
    ctx.font = '11px Arial';
    ctx.fillText('RSI 14', 10, top + 12);

    ctx.strokeStyle = this.defaults.grid;
    ctx.setLineDash([4, 4]);

    [30, 50, 70].forEach(value => {
      ctx.beginPath();
      ctx.moveTo(0, y(value));
      ctx.lineTo(chart.dimensions.width, y(value));
      ctx.stroke();
    });

    ctx.setLineDash([]);

    this.drawLine(
      chart,
      values,
      x,
      y,
      '#bd93f9'
    );
  },

  drawMACD(chart, macd, start, end, top, panelHeight, x) {
    const ctx = chart.ctx;

    const values = macd.macd.slice(start, end);
    const signals = macd.signal.slice(start, end);
    const histogram = macd.histogram.slice(start, end);

    const all = [...values, ...signals].filter(
      Number.isFinite
    );

    if (!all.length) return;

    const max = Math.max(...all.map(Math.abs)) || 1;

    const middle = top + panelHeight / 2;

    const y = value =>
      middle - value / max * (panelHeight * 0.35);

    ctx.fillStyle = this.defaults.text;
    ctx.font = '11px Arial';
    ctx.fillText('MACD 12 26 9', 10, top + 12);

    ctx.strokeStyle = this.defaults.grid;
    ctx.beginPath();
    ctx.moveTo(0, middle);
    ctx.lineTo(chart.dimensions.width, middle);
    ctx.stroke();

    histogram.forEach((value, index) => {
      if (!Number.isFinite(value)) return;

      ctx.fillStyle = value >= 0
        ? this.defaults.bullish
        : this.defaults.bearish;

      ctx.fillRect(
        x(index) - 2,
        y(Math.max(value, 0)),
        4,
        Math.abs(y(value) - middle)
      );
    });

    this.drawLine(
      chart,
      values,
      x,
      y,
      '#4da3ff'
    );

    this.drawLine(
      chart,
      signals,
      x,
      y,
      '#ffd166'
    );
  },

  drawPriceAxis(chart, width, y, min, max) {
    const ctx = chart.ctx;

    ctx.fillStyle = this.defaults.background;

    ctx.fillRect(
      width - this.defaults.rightPadding,
      0,
      this.defaults.rightPadding,
      chart.dimensions.height
    );

    ctx.fillStyle = this.defaults.text;
    ctx.font = '11px Arial';

    for (let i = 0; i <= 6; i++) {
      const value = max - (max - min) * i / 6;

      ctx.fillText(
        this.formatPrice(value),
        width - this.defaults.rightPadding + 8,
        y(value) + 4
      );
    }
  },

  drawTimeAxis(chart, data, x, bottom) {
    const ctx = chart.ctx;

    ctx.fillStyle = this.defaults.text;
    ctx.font = '10px Arial';

    const count = Math.min(6, data.length);

    for (let i = 0; i < count; i++) {
      const index = Math.floor(
        i * (data.length - 1) / Math.max(1, count - 1)
      );

      const candle = data[index];

      const date = new Date(candle.time);

      ctx.fillText(
        date.toLocaleDateString(),
        x(index) - 25,
        bottom + 17
      );
    }
  },

  drawCrosshair(chart) {
    const ctx = chart.ctx;

    const mouse = chart.mouse;

    if (!mouse) return;

    const { width, height } = chart.dimensions;

    const right = width - this.defaults.rightPadding;

    if (mouse.x < 0 || mouse.x > right) return;

    ctx.strokeStyle = this.defaults.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(mouse.x, 0);
    ctx.lineTo(mouse.x, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, mouse.y);
    ctx.lineTo(right, mouse.y);
    ctx.stroke();

    ctx.setLineDash([]);

    const index = Math.min(
      chart.visibleData.length - 1,
      Math.max(
        0,
        Math.floor(mouse.x / chart.candleStep)
      )
    );

    const candle = chart.visibleData[index];

    if (!candle) return;

    const scale = chart.priceScale;

    const price = scale.max -
      (mouse.y - scale.top) /
      (scale.bottom - scale.top) *
      (scale.max - scale.min);

    const priceText = this.formatPrice(price);

    ctx.font = '11px Arial';

    ctx.fillStyle = '#34445c';

    ctx.fillRect(
      right,
      mouse.y - 10,
      this.defaults.rightPadding,
      20
    );

    ctx.fillStyle = '#ffffff';

    ctx.fillText(
      priceText,
      right + 7,
      mouse.y + 4
    );

    const date = new Date(candle.time);

    const info = [
      chart.symbol,
      'O ' + this.formatPrice(candle.open),
      'H ' + this.formatPrice(candle.high),
      'L ' + this.formatPrice(candle.low),
      'C ' + this.formatPrice(candle.close),
      'V ' + candle.volume.toLocaleString()
    ].join('    ');

    ctx.fillStyle = '#d9e2f0';

    ctx.fillText(info, 10, 15);

    const dateText = date.toLocaleString();

    ctx.fillStyle = '#34445c';

    ctx.fillRect(
      Math.max(0, mouse.x - 45),
      height - 24,
      110,
      20
    );

    ctx.fillStyle = '#ffffff';

    ctx.fillText(
      dateText,
      Math.max(0, mouse.x - 42),
      height - 10
    );

    if (chart.callbacks.onCrosshairMove) {
      chart.callbacks.onCrosshairMove({
        candle,
        index,
        price,
        date,
        x: mouse.x,
        y: mouse.y
      });
    }
  },

  drawMessage(chart, message) {
    const ctx = chart.ctx;

    ctx.fillStyle = this.defaults.text;
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';

    ctx.fillText(
      message,
      chart.dimensions.width / 2,
      chart.dimensions.height / 2
    );

    ctx.textAlign = 'left';
  },

  formatPrice(value) {
    if (!Number.isFinite(value)) return '--';

    return value.toLocaleString(undefined, {
      maximumFractionDigits: value < 1 ? 8 : 2
    });
  },

  bindEvents(chart) {
    const canvas = chart.canvas;

    canvas.addEventListener('pointermove', event => {
      const rect = canvas.getBoundingClientRect();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (chart.dragging) {
        const delta = x - chart.lastX;

        chart.offset += Math.round(
          delta / Math.max(1, chart.candleStep)
        );

        chart.offset = Math.max(
          0,
          Math.min(chart.data.length, chart.offset)
        );

        chart.lastX = x;

        this.draw(chart);
        return;
      }

      chart.mouse = { x, y };

      this.draw(chart);
    });

    canvas.addEventListener('pointerleave', () => {
      if (!chart.dragging) {
        chart.mouse = null;
        this.draw(chart);
      }
    });

    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;

      chart.dragging = true;
      chart.lastX =
        event.clientX - canvas.getBoundingClientRect().left;

      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointerup', () => {
      chart.dragging = false;
    });

    canvas.addEventListener('pointercancel', () => {
      chart.dragging = false;
    });

    canvas.addEventListener('wheel', event => {
      event.preventDefault();

      const direction = event.deltaY > 0 ? -1 : 1;

      chart.zoom = Math.max(
        0.3,
        Math.min(5, chart.zoom + direction * 0.1)
      );

      this.draw(chart);

    }, { passive: false });

    canvas.addEventListener('dblclick', () => {
      chart.zoom = 1;
      chart.offset = 0;
      this.draw(chart);
    });
  },

  destroy(chart) {
    chart.destroyed = true;

    if (chart.observer) {
      chart.observer.disconnect();
    }

    chart.wrapper.remove();

    this.charts.delete(chart.id);
  }

};

window.CryptoChartEngine = CryptoChartEngine;

console.info('Crypto Intelligence Terminal chart engine loaded.');
