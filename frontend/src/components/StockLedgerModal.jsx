import React, { useState, useEffect } from 'react';
import { fetchStockLedger } from '../services/api';

export default function StockLedgerModal({ isOpen, onClose }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadLedger();
    }
  }, [isOpen]);

  const loadLedger = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchStockLedger();
      setLedger(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch ledger movements');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2>Stock Ledger & Movement Audit Trail</h2>
            <span className="member-chip" style={{ fontSize: '0.7rem' }}>Immutable Audit Ledger</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time immutable audit records generated whenever delivery orders (or receipts/adjustments) modify inventory in the database.
          </p>

          {error && (
            <div className="alert-banner alert-danger">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <div className="empty-title">Loading Ledger Records...</div>
            </div>
          ) : ledger.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📜</div>
              <div className="empty-title">No Ledger Movements Yet</div>
              <p>Validate a Delivery Order to create your first stock movement record!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="orders-table" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Product</th>
                    <th>Change</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                        {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: row.movement_type === 'DELIVERY' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: row.movement_type === 'DELIVERY' ? '#f87171' : '#34d399',
                          border: `1px solid ${row.movement_type === 'DELIVERY' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}>
                          {row.movement_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {row.reference_type} #{row.reference_id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{row.product_sku}</div>
                      </td>
                      <td style={{ 
                        fontWeight: 800, 
                        color: row.quantity_change < 0 ? '#f87171' : '#34d399' 
                      }}>
                        {row.quantity_change > 0 ? `+${row.quantity_change}` : row.quantity_change}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.quantity_before}</td>
                      <td style={{ fontWeight: 700, color: '#38bdf8' }}>{row.quantity_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={loadLedger}>
            🔄 Refresh Ledger
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
