/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   PRICE ALERT ENGINE
   File: js/alerts.js
========================================================= */

'use strict';

const CryptoAlerts = {

  alerts: [],
  history: [],
  interval: null,
  initialized: false,

  config: {
    checkInterval: 15000,
    maxHistory: 200
  },

  init() {
    if (this.initialized) return;

    this.load();
    this.bindEvents();
    this.render();
    this.startMonitoring();

    this.initialized = true;

    console.info('Crypto alert engine initialized.');
  },

  create(options = {}) {
    const symbol = String(options.symbol || '').toUpperCase();
    const type = options.type || 'above';
    const price = Number(options.price);

    if (!symbol) {
      throw new Error('A cryptocurrency symbol is required.');
    }

    if (!['above', 'below', 'change_up', 'change_down'].includes(type)) {
      throw new Error('Invalid alert type.');
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('A valid positive target is required.');
    }

    const alert = {
      id: this.createId(),
      symbol,
      type,
      target: price,
      enabled: true,
      triggered: false,
      createdAt: Date.now(),
      lastTriggered: null
    };

    this.alerts.push(alert);

    this.save();
    this.render();

    return alert;
  },

  remove(id) {
    this.alerts = this.alerts.filter(
      alert => alert.id !== id
    );

    this.save();
    this.render();
  },

  toggle(id) {
    const alert = this.alerts.find(
      item => item.id === id
    );

    if (!alert) return;

    alert.enabled = !alert.enabled;

    this.save();
    this.render();
  },

  reset(id) {
    const alert = this.alerts.find(
      item => item.id === id
    );

    if (!alert) return;

    alert.triggered = false;
    alert.lastTriggered = null;
    alert.enabled = true;

    this.save();
    this.render();
  },

  async check() {
    if (typeof CryptoMarketData === 'undefined') return;

    const active = this.alerts.filter(
      alert => alert.enabled && !alert.triggered
    );

    const symbols = [...new Set(
      active.map(alert => alert.symbol)
    )];

    if (!symbols.length) return;

    const prices = new Map();

    await Promise.all(
      symbols.map(async symbol => {
        try {
          const result = await CryptoMarketData.getPrice(symbol);

          const price = Number(
            typeof result === 'object'
              ? result.price
              : result
          );

          if (Number.isFinite(price) && price > 0) {
            prices.set(symbol, price);
          }
        } catch (error) {
          console.warn('Alert price unavailable:', symbol);
        }
      })
    );

    active.forEach(alert => {
      const currentPrice = prices.get(alert.symbol);

      if (!Number.isFinite(currentPrice)) return;

      let triggered = false;

      switch (alert.type) {
        case 'above':
          triggered = currentPrice >= alert.target;
          break;

        case 'below':
          triggered = currentPrice <= alert.target;
          break;

        case 'change_up':
        case 'change_down':
          triggered = this.checkPercentage(
            alert,
            currentPrice
          );
          break;
      }

      if (triggered) {
        this.trigger(alert, currentPrice);
      }
    });
  },

  checkPercentage(alert, currentPrice) {
    if (
      typeof CryptoMarketData.get24HourChange !== 'function'
    ) {
      return false;
    }

    const change = Number(
      CryptoMarketData.get24HourChange(alert.symbol)
    );

    if (!Number.isFinite(change)) return false;

    if (alert.type === 'change_up') {
      return change >= alert.target;
    }

    return change <= -Math.abs(alert.target);
  },

  trigger(alert, currentPrice) {
    if (alert.triggered) return;

    alert.triggered = true;
    alert.lastTriggered = Date.now();

    const event = {
      id: alert.id,
      symbol: alert.symbol,
      type: alert.type,
      target: alert.target,
      currentPrice,
      timestamp: Date.now()
    };

    this.history.unshift(event);

    this.history.length = Math.min(
      this.history.length,
      this.config.maxHistory
    );

    const message =
      alert.symbol +
      ' reached your alert condition. Current price: ' +
      currentPrice.toLocaleString();

    if (window.CryptoNotifications) {
      CryptoNotifications.warning(message);
    } else if (window.showNotification) {
      window.showNotification(message, 'warning');
    }

    this.browserNotification(message);

    document.dispatchEvent(
      new CustomEvent('crypto:alert-triggered', {
        detail: event
      })
    );

    this.save();
    this.render();
  },

  async browserNotification(message) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification('Crypto Intelligence Terminal', {
        body: message
      });

      return;
    }

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Notification permission unavailable.');
      }
    }
  },

  startMonitoring() {
    this.stopMonitoring();

    this.interval = setInterval(() => {
      this.check();
    }, this.config.checkInterval);

    this.check();
  },

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },

  bindEvents() {
    document.addEventListener('click', event => {

      const removeButton = event.target.closest(
        '[data-alert-remove]'
      );

      if (removeButton) {
        this.remove(removeButton.dataset.alertRemove);
      }

      const toggleButton = event.target.closest(
        '[data-alert-toggle]'
      );

      if (toggleButton) {
        this.toggle(toggleButton.dataset.alertToggle);
      }

      const resetButton = event.target.closest(
        '[data-alert-reset]'
      );

      if (resetButton) {
        this.reset(resetButton.dataset.alertReset);
      }

    });

    const form = document.querySelector('#alert-form');

    if (form) {
      form.addEventListener('submit', event => {
        event.preventDefault();

        const symbol = form.querySelector(
          '[name="symbol"]'
        ).value;

        const type = form.querySelector(
          '[name="type"]'
        ).value;

        const price = form.querySelector(
          '[name="target"]'
        ).value;

        try {
          this.create({
            symbol,
            type,
            price
          });

          form.reset();

          if (window.showNotification) {
            window.showNotification(
              'Price alert created.',
              'success'
            );
          }

        } catch (error) {
          if (window.showNotification) {
            window.showNotification(
              error.message,
              'error'
            );
          }
        }
      });
    }
  },

  render() {
    const container = document.querySelector('#alerts-list');

    if (!container) return;

    const fragment = document.createDocumentFragment();

    this.alerts.forEach(alert => {
      const item = document.createElement('div');

      item.className = 'alert-item';

      const description = document.createElement('span');

      description.textContent =
        alert.symbol +
        ' | ' +
        alert.type +
        ' | ' +
        alert.target;

      const status = document.createElement('span');

      status.textContent = alert.triggered
        ? 'Triggered'
        : alert.enabled
          ? 'Active'
          : 'Disabled';

      const toggle = document.createElement('button');

      toggle.type = 'button';
      toggle.dataset.alertToggle = alert.id;
      toggle.textContent = alert.enabled ? 'Disable' : 'Enable';

      const remove = document.createElement('button');

      remove.type = 'button';
      remove.dataset.alertRemove = alert.id;
      remove.textContent = 'Delete';

      item.append(
        description,
        status,
        toggle,
        remove
      );

      if (alert.triggered) {
        const reset = document.createElement('button');

        reset.type = 'button';
        reset.dataset.alertReset = alert.id;
        reset.textContent = 'Reset';

        item.appendChild(reset);
      }

      fragment.appendChild(item);
    });

    container.replaceChildren(fragment);
  },

  save() {
    try {
      localStorage.setItem(
        'cit-alerts',
        JSON.stringify({
          alerts: this.alerts,
          history: this.history
        })
      );
    } catch (error) {
      console.warn('Could not save alerts.', error);
    }
  },

  load() {
    try {
      const stored = localStorage.getItem('cit-alerts');

      if (!stored) return;

      const data = JSON.parse(stored);

      if (Array.isArray(data.alerts)) {
        this.alerts = data.alerts;
      }

      if (Array.isArray(data.history)) {
        this.history = data.history;
      }

    } catch (error) {
      console.warn('Could not restore alerts.', error);
    }
  },

  getHistory() {
    return [...this.history];
  },

  createId() {
    return 'alert-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8);
  },

  destroy() {
    this.stopMonitoring();
    this.initialized = false;
  }

};

window.CryptoAlerts = CryptoAlerts;

document.addEventListener('DOMContentLoaded', () => {
  CryptoAlerts.init();
});

console.info('Crypto alert engine loaded.');
