/* =========================================================
   CRYPTO INTELLIGENCE TERMINAL
   APPLICATION ENTRY POINT
   File: js/app.js
========================================================= */

'use strict';

const CryptoApp = {

  version: '1.0.0',

  initialized: false,

  modules: [
    'CryptoChartEngine',
    'CryptoDashboard',
    'CryptoSignalEngine',
    'CryptoMarketScanner',
    'CryptoMarketData'
  ],

  init() {
    if (this.initialized) return;

    console.info('======================================');
    console.info('CRYPTO INTELLIGENCE TERMINAL');
    console.info('Version:', this.version);
    console.info('Starting application...');
    console.info('======================================');

    this.checkModules();
    this.bindGlobalEvents();
    this.initializeTheme();
    this.initializeNavigation();
    this.initializeControls();
    this.initializeClock();

    this.initialized = true;

    document.documentElement.classList.add('app-ready');

    this.dispatch('cryptoapp:ready', {
      version: this.version
    });

    console.info('Crypto Intelligence Terminal ready.');
  },

  checkModules() {
    const missing = this.modules.filter(
      name => typeof window[name] === 'undefined'
    );

    if (missing.length) {
      console.warn(
        'Some modules are not available:',
        missing
      );
    } else {
      console.info('All application modules detected.');
    }
  },

  bindGlobalEvents() {

    window.addEventListener('error', event => {
      console.error(
        'Application error:',
        event.message
      );
    });

    window.addEventListener(
      'unhandledrejection',
      event => {
        console.error(
          'Unhandled application rejection:',
          event.reason
        );
      }
    );

    window.addEventListener('online', () => {
      this.notify('Internet connection restored.', 'success');
    });

    window.addEventListener('offline', () => {
      this.notify('Internet connection lost.', 'warning');
    });

    window.addEventListener('beforeunload', () => {
      if (window.CryptoDashboard) {
        CryptoDashboard.stopAutoRefresh();
      }
    });

  },

  initializeTheme() {
    const themeButton = document.querySelector(
      '#theme-toggle'
    );

    const savedTheme = 'dark';

    document.documentElement.dataset.theme = savedTheme;

    if (themeButton) {
      themeButton.addEventListener('click', () => {
        const current =
          document.documentElement.dataset.theme;

        const next = current === 'dark'
          ? 'light'
          : 'dark';

        document.documentElement.dataset.theme = next;

        this.notify(
          next.toUpperCase() + ' theme enabled.',
          'info'
        );
      });
    }
  },

  initializeNavigation() {
    const links = document.querySelectorAll(
      '[data-page]'
    );

    links.forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();

        const page = link.dataset.page;

        if (!page) return;

        this.showPage(page);

        links.forEach(item => {
          item.classList.toggle(
            'active',
            item === link
          );
        });
      });
    });
  },

  showPage(page) {
    const sections = document.querySelectorAll(
      '[data-section]'
    );

    let found = false;

    sections.forEach(section => {
      const active =
        section.dataset.section === page;

      section.hidden = !active;

      if (active) found = true;
    });

    if (!found) {
      console.warn('Page not found:', page);
      return;
    }

    this.dispatch('cryptoapp:pagechange', {
      page
    });
  },

  initializeControls() {
    document.querySelectorAll(
      '[data-refresh]'
    ).forEach(button => {
      button.addEventListener('click', () => {
        if (window.CryptoDashboard) {
          CryptoDashboard.refreshMarket();
        }
      });
    });

    document.querySelectorAll(
      '[data-scroll-top]'
    ).forEach(button => {
      button.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    });
  },

  initializeClock() {
    const clock = document.querySelector(
      '#terminal-clock'
    );

    if (!clock) return;

    const update = () => {
      clock.textContent = new Date().toLocaleTimeString(
        undefined,
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      );
    };

    update();

    this.clockTimer = setInterval(update, 1000);
  },

  notify(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }

    const container = document.querySelector(
      '#notifications'
    );

    if (!container) {
      console.info(message);
      return;
    }

    const notification = document.createElement('div');

    notification.className =
      'notification notification-' + type;

    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 4000);
  },

  dispatch(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent(name, {
        detail
      })
    );
  },

  destroy() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (window.CryptoDashboard) {
      CryptoDashboard.destroy();
    }

    this.initialized = false;

    console.info('Application stopped.');
  }

};

window.CryptoApp = CryptoApp;

document.addEventListener('DOMContentLoaded', () => {
  CryptoApp.init();
});

console.info('CryptoApp entry point loaded.');
