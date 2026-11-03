/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   NOTIFICATION CENTER
   File: js/notifications.js
========================================================= */

'use strict';

const CryptoNotifications = {

  history: [],

  maxHistory: 100,

  container: null,

  initialized: false,

  init() {
    if (this.initialized) return;

    this.container = document.querySelector(
      '#notifications'
    );

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notifications';
      this.container.className = 'notification-container';

      document.body.appendChild(this.container);
    }

    this.container.setAttribute(
      'aria-live',
      'polite'
    );

    this.bindEvents();

    this.initialized = true;

    console.info('Notification center initialized.');
  },

  bindEvents() {
    document.addEventListener(
      'cryptoapp:ready',
      () => this.success('Terminal initialized.')
    );

    document.addEventListener(
      'crypto:signal',
      event => {
        const data = event.detail || {};

        this.signal(
          data.symbol,
          data.action,
          data.reason
        );
      }
    );

    document.addEventListener(
      'crypto:price-alert',
      event => {
        const data = event.detail || {};

        this.priceAlert(
          data.symbol,
          data.price,
          data.condition
        );
      }
    );

    document.addEventListener(
      'crypto:risk-alert',
      event => {
        const data = event.detail || {};

        this.warning(
          data.message || 'Risk alert detected.',
          data.symbol || ''
        );
      }
    );
  },

  show(message, type = 'info', options = {}) {
    if (!this.initialized) {
      this.init();
    }

    const notification = {
      id: this.createId(),
      message: String(message),
      type,
      timestamp: new Date(),
      read: false,
      persistent: Boolean(options.persistent)
    };

    this.history.unshift(notification);

    if (this.history.length > this.maxHistory) {
      this.history.length = this.maxHistory;
    }

    const element = document.createElement('div');

    element.className =
      'notification notification-' + type;

    element.dataset.notificationId = notification.id;

    const content = document.createElement('div');
    content.className = 'notification-content';

    const title = document.createElement('strong');

    const titles = {
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Information',
      buy: 'BUY Signal',
      sell: 'SELL Signal',
      hold: 'HOLD Signal',
      price: 'Price Alert'
    };

    title.textContent = titles[type] || 'Notification';

    const text = document.createElement('p');
    text.textContent = notification.message;

    const time = document.createElement('small');
    time.textContent = notification.timestamp.toLocaleTimeString();

    content.append(title, text, time);

    const close = document.createElement('button');

    close.type = 'button';
    close.textContent = '×';
    close.className = 'notification-close';
    close.setAttribute('aria-label', 'Dismiss notification');

    close.addEventListener('click', () => {
      this.dismiss(notification.id);
    });

    element.append(content, close);

    this.container.prepend(element);

    if (!notification.persistent) {
      notification.timer = setTimeout(() => {
        this.dismiss(notification.id);
      }, options.duration || 5000);
    }

    document.dispatchEvent(
      new CustomEvent('crypto:notification', {
        detail: notification
      })
    );

    return notification.id;
  },

  success(message, options) {
    return this.show(message, 'success', options);
  },

  error(message, options) {
    return this.show(message, 'error', options);
  },

  warning(message, options) {
    return this.show(message, 'warning', options);
  },

  info(message, options) {
    return this.show(message, 'info', options);
  },

  signal(symbol, action, reason = '') {
    const normalized = String(action || 'HOLD').toUpperCase();

    if (!['BUY', 'SELL', 'HOLD'].includes(normalized)) {
      return;
    }

    const type = normalized.toLowerCase();

    const message = [
      symbol || 'Market',
      normalized,
      reason ? '- ' + reason : ''
    ].filter(Boolean).join(' ');

    return this.show(message, type);
  },

  priceAlert(symbol, price, condition = '') {
    const message =
      (symbol || 'Asset') +
      ' price alert: ' +
      Number(price).toLocaleString();

    return this.show(
      message + (condition ? ' (' + condition + ')' : ''),
      'price'
    );
  },

  dismiss(id) {
    const notification = this.history.find(
      item => item.id === id
    );

    if (notification && notification.timer) {
      clearTimeout(notification.timer);
    }

    const element = this.container.querySelector(
      '[data-notification-id="' + id + '"]'
    );

    if (element) {
      element.remove();
    }

    if (notification) {
      notification.read = true;
    }
  },

  clearAll() {
    this.history.forEach(item => {
      if (item.timer) {
        clearTimeout(item.timer);
      }
    });

    this.history = [];

    if (this.container) {
      this.container.replaceChildren();
    }
  },

  getHistory() {
    return this.history.map(item => ({
      id: item.id,
      message: item.message,
      type: item.type,
      timestamp: item.timestamp,
      read: item.read
    }));
  },

  getUnreadCount() {
    return this.history.filter(
      item => !item.read
    ).length;
  },

  createId() {
    return 'notification-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 9);
  }

};

window.CryptoNotifications = CryptoNotifications;

window.showNotification = (message, type = 'info') => {
  return CryptoNotifications.show(message, type);
};

document.addEventListener('DOMContentLoaded', () => {
  CryptoNotifications.init();
});

console.info('Crypto notification module loaded.');
