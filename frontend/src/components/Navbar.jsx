import React from 'react';

export default function Navbar({ activeTab, onSelectTab, onOpenCreate, onOpenLedger, backendStatus }) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="logo-badge">SS</div>
        <div className="brand-text">
          <div className="brand-title">StockSense</div>
          <div className="brand-subtitle">Warehouse & Inventory Management</div>
        </div>

        {/* View Switcher Tabs */}
        <nav style={{ display: 'flex', gap: '0.4rem', marginLeft: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onSelectTab('dashboard')}
            id="nav-tab-dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📊</span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'deliveries' ? 'active' : ''}`}
            onClick={() => onSelectTab('deliveries')}
            id="nav-tab-deliveries"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📦</span>
            <span>Deliveries</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => onSelectTab('products')}
            id="nav-tab-products"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🏷️</span>
            <span>Products</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'receipts' ? 'active' : ''}`}
            onClick={() => onSelectTab('receipts')}
            id="nav-tab-receipts"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📥</span>
            <span>Receipts</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
            onClick={() => onSelectTab('transfers')}
            id="nav-tab-transfers"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🚚</span>
            <span>Transfers & Audits</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'warehouses' ? 'active' : ''}`}
            onClick={() => onSelectTab('warehouses')}
            id="nav-tab-warehouses"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🏢</span>
            <span>Warehouses</span>
          </button>
        </nav>
      </div>

      <div className="nav-actions">
        <div className="member-chip" title="System Status: Connected">
          <span className="pulse-dot"></span>
          <span>StockSense Platform &bull; Production v1.0.0</span>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={onOpenLedger}
          title="Inspect stock ledger movements"
          id="btn-open-ledger"
        >
          <span>📜</span>
          <span>Stock Ledger</span>
        </button>

        <button 
          className="btn btn-primary"
          onClick={onOpenCreate}
          id="btn-create-delivery"
        >
          <span>➕</span>
          <span>New Delivery</span>
        </button>
      </div>
    </header>
  );
}
