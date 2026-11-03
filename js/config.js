/* =====================================================
   CRYPTO INTELLIGENCE TERMINAL
   RESPONSIVE DESIGN
   File: css/responsive.css
===================================================== */

/* LARGE DESKTOP */

@media (min-width: 1600px) {
  .main-content {
    padding-left: 38px;
    padding-right: 38px;
  }

  .coin-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .main-chart {
    height: 520px;
  }

  .section-block {
    padding: 25px;
  }
}

/* LAPTOPS */

@media (max-width: 1250px) {
  :root {
    --sidebar-width: 210px;
  }

  .main-content {
    padding-left: 22px;
    padding-right: 22px;
  }

  .coin-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .market-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .market-stat > strong {
    font-size: 18px;
  }

  .main-chart {
    height: 390px;
  }
}

/* TABLETS AND SMALL LAPTOPS */

@media (max-width: 900px) {
  :root {
    --sidebar-width: 0px;
    --header-height: 68px;
  }

  .sidebar {
    width: 245px;
    transform: translateX(-100%);
    transition: transform .25s ease;
    box-shadow: 10px 0 30px rgba(0,0,0,.3);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .main-content {
    margin-left: 0;
    padding: 0 20px 30px;
  }

  .mobile-menu {
    display: block;
    color: var(--text);
    margin-right: 12px;
    flex-shrink: 0;
  }

  .topbar {
    justify-content: flex-start;
  }

  .topbar > div:first-of-type {
    flex: 1;
  }

  .topbar-right {
    gap: 12px;
  }

  .coin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .subchart-grid {
    grid-template-columns: 1fr;
  }

  .signal-layout {
    grid-template-columns: 1fr;
  }

  .analysis-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .main-chart {
    height: 360px;
  }

  .footer {
    line-height: 1.8;
  }
}

/* MOBILE PHONES */

@media (max-width: 600px) {
  body {
    font-size: 12px;
  }

  .main-content {
    padding: 0 12px 20px;
  }

  .topbar {
    height: 65px;
    margin-bottom: 16px;
  }

  .page-heading {
    font-size: 15px;
  }

  .breadcrumb {
    font-size: 8px;
  }

  .topbar-right {
    gap: 7px;
  }

  .live-indicator {
    font-size: 8px;
  }

  .clock {
    display: none;
  }

  .market-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 18px;
  }

  .market-stat {
    padding: 12px;
  }

  .market-stat > span {
    font-size: 8px;
  }

  .market-stat > strong {
    font-size: 15px;
    margin: 7px 0 3px;
  }

  .market-stat > small {
    font-size: 9px;
  }

  .section-block {
    padding: 13px;
    margin-bottom: 15px;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
  }

  .section-heading h2 {
    font-size: 14px;
  }

  .section-heading p {
    font-size: 9px;
  }

  .section-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .section-actions select {
    max-width: 100%;
    min-width: 0;
  }

  .coin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .coin-card {
    padding: 10px;
  }

  .coin-card-header {
    margin-bottom: 11px;
  }

  .coin-icon {
    width: 27px;
    height: 27px;
    font-size: 11px;
  }

  .coin-name strong {
    font-size: 10px;
  }

  .coin-name small {
    font-size: 8px;
  }

  .coin-price {
    font-size: 13px;
  }

  .coin-change {
    font-size: 9px;
  }

  .coin-card-footer {
    margin-top: 10px;
    padding-top: 8px;
  }

  .coin-card-footer span,
  .coin-card-footer strong {
    font-size: 8px;
  }

  /* CHARTS */

  .chart-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .timeframe-controls,
  .chart-range {
    width: 100%;
    gap: 2px;
  }

  .timeframe-controls button,
  .chart-range button {
    flex: 1;
    min-width: 0;
    padding: 7px 3px;
    font-size: 8px;
  }

  .main-chart {
    height: 300px;
    min-height: 260px;
  }

  .chart-price-info {
    gap: 7px;
    padding-top: 12px;
  }

  .chart-price-info strong {
    font-size: 11px;
  }

  .chart-price-info > span {
    font-size: 9px;
  }

  .chart-price-info .chart-data-note {
    display: none;
  }

  .indicator-toolbar {
    gap: 9px;
    padding: 10px 0;
  }

  .indicator-toolbar > span {
    width: 100%;
  }

  .indicator-toolbar label {
    font-size: 9px;
  }

  .subchart-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .sub-chart {
    height: 120px;
  }

  .chart-crosshair-info {
    padding: 9px;
    font-size: 8px;
  }

  /* SIGNALS */

  .signal-layout {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .signal-main {
    padding: 16px;
  }

  .signal-result {
    font-size: 25px;
  }

  .signal-score {
    font-size: 13px;
  }

  .signal-details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .signal-details > div {
    min-height: 65px;
    padding: 11px;
  }

  .signal-details span {
    font-size: 9px;
  }

  .signal-details strong {
    font-size: 10px;
  }

  /* SCANNER */

  .table-container {
    margin: 0 -3px;
    width: calc(100% + 6px);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .market-table {
    min-width: 650px;
  }

  .market-table th,
  .market-table td {
    padding: 11px 9px;
    font-size: 9px;
  }

  .search-input {
    width: 100%;
  }

  /* ANALYSIS */

  .analysis-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .analysis-card {
    padding: 12px;
  }

  .analysis-card > strong {
    font-size: 17px;
  }

  /* FOOTER */

  .footer {
    flex-direction: column;
    gap: 7px;
    padding: 15px 2px;
    font-size: 8px;
  }
}

/* VERY SMALL PHONES */

@media (max-width: 360px) {
  .main-content {
    padding-left: 8px;
    padding-right: 8px;
  }

  .coin-grid {
    grid-template-columns: 1fr;
  }

  .market-stat > strong {
    font-size: 13px;
  }

  .main-chart {
    height: 260px;
  }

  .signal-details {
    grid-template-columns: 1fr;
  }

  .timeframe-controls button,
  .chart-range button {
    font-size: 7px;
  }
}

/* TOUCH DEVICES */

@media (hover: none) and (pointer: coarse) {
  .nav-item,
  .timeframe-controls button,
  .chart-range button,
  .secondary-button {
    min-height: 36px;
  }

  .indicator-toolbar label {
    min-height: 32px;
  }

  .coin-card:hover,
  .analysis-card:hover {
    transform: none;
  }
}

/* REDUCED MOTION */

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .coin-card,
  .analysis-card {
    transition: none !important;
  }
}
