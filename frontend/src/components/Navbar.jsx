import React from 'react';

export default function Navbar({ onOpenCreate, onOpenLedger, backendStatus }) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="logo-badge">SS</div>
        <div className="brand-text">
          <div className="brand-title">StockSense</div>
          <div className="brand-subtitle">Warehouse & Inventory Management</div>
        </div>
      </div>

      <div className="nav-actions">
        <div className="member-chip" title="Active developer branch">
          <span className="pulse-dot"></span>
          <span>MEMBER 2 &bull; feature/member2/deliveries</span>
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
          <span>New Delivery Order</span>
        </button>
      </div>
    </header>
  );
}
