import React, { useState, useEffect } from 'react';
import { fetchWarehouses, createWarehouse, fetchProducts } from '../services/api';

export default function WarehousesView({ notify }) {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whAddress, setWhAddress] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [whList, prodList] = await Promise.all([fetchWarehouses(), fetchProducts()]);
      setWarehouses(whList || []);
      setProducts(prodList || []);
    } catch (err) {
      notify(err.message || 'Failed to load warehouses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createWarehouse({
        name: whName,
        code: whCode,
        address: whAddress
      });
      notify(`Warehouse facility "${whName}" registered successfully`, 'success');
      setIsModalOpen(false);
      setWhName('');
      setWhCode('');
      setWhAddress('');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-title-area">
          <h1>Warehouses & Multi-Facility Logistics Infrastructure</h1>
          <p>Manage physical distribution centers, cargo depots, transit terminals, and regional storage facilities.</p>
        </div>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={loadData}>
            <span>🔄</span> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <span>➕</span> Register New Facility
          </button>
        </div>
      </div>

      {/* Grid of Warehouses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
        {warehouses.map(wh => {
          const whProducts = products.filter(p => p.warehouse_id === wh.id);
          const totalUnits = whProducts.reduce((sum, p) => sum + (p.current_stock || 0), 0);

          return (
            <div key={wh.id} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.2rem' }}>{wh.name}</h3>
                  <span className="sku-tag" style={{ color: '#818cf8' }}>{wh.code}</span>
                </div>
                <span className="status-badge status-validated">ACTIVE</span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minHeight: '2.5rem' }}>
                📍 {wh.address || 'Address on file with logistics dispatch'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Catalog SKUs</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{whProducts.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Stored Units</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{totalUnits}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Register Logistics Facility</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Facility Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Central Airfreight Hub"
                    className="form-input"
                    value={whName}
                    onChange={e => setWhName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Facility Code (Unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WH-AIR-04"
                    className="form-input"
                    value={whCode}
                    onChange={e => setWhCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Physical Address</label>
                  <textarea
                    rows="2"
                    placeholder="Industrial logistics park, suite, postal code..."
                    className="form-input"
                    value={whAddress}
                    onChange={e => setWhAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Facility</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
