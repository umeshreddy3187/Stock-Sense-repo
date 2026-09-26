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
        <nav style={{ display: 'flex', gap: '0.4rem', marginLeft: '1.5rem' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onSelectTab('dashboard')}
            id="nav-tab-dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📊</span>
            <span>Inventory Dashboard</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'deliveries' ? 'active' : ''}`}
            onClick={() => onSelectTab('deliveries')}
            id="nav-tab-deliveries"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📦</span>
            <span>Delivery Orders</span>
          </button>
        </nav>
      </div>

      <div className="nav-actions">
        <div className="member-chip" title="Active developer branch">
          <span className="pulse-dot"></span>
          <span>MEMBER 2 (Jishnu) &bull; feature/member2/dashboard</span>
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
