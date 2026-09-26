import React, { useState, useEffect } from 'react';
import {
  fetchTransfers,
  createTransfer,
  dispatchTransfer,
  completeTransfer,
  fetchAdjustments,
  createAdjustment,
  fetchProducts,
  fetchWarehouses
} from '../services/api';

export default function TransfersView({ notify }) {
  const [activeSubTab, setActiveSubTab] = useState('transfers'); // 'transfers' or 'adjustments'
  const [transfers, setTransfers] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);

  // Transfer Form
  const [sourceWh, setSourceWh] = useState('');
  const [destWh, setDestWh] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState([{ product_id: '', quantity: 5 }]);

  // Adjustment Form
  const [adjProdId, setAdjProdId] = useState('');
  const [adjWhId, setAdjWhId] = useState('');
  const [adjCountedQty, setAdjCountedQty] = useState(0);
  const [adjReason, setAdjReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [trfs, adjs, prods, whs] = await Promise.all([
        fetchTransfers(),
        fetchAdjustments(),
        fetchProducts(),
        fetchWarehouses()
      ]);
      setTransfers(trfs || []);
      setAdjustments(adjs || []);
      setProducts(prods || []);
      setWarehouses(whs || []);

      if (whs && whs.length >= 2) {
        setSourceWh(whs[0].id);
        setDestWh(whs[1].id);
        setAdjWhId(whs[0].id);
      }
      if (prods && prods.length > 0) {
        setTransferItems([{ product_id: prods[0].id, quantity: 5 }]);
        setAdjProdId(prods[0].id);
        setAdjCountedQty(prods[0].current_stock);
      }
    } catch (err) {
      notify(err.message || 'Error loading transfer data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (sourceWh === destWh) {
      notify('Source and destination facilities cannot be identical', 'warning');
      return;
    }
    try {
      await createTransfer({
        source_warehouse_id: parseInt(sourceWh, 10),
        destination_warehouse_id: parseInt(destWh, 10),
        notes: transferNotes,
        items: transferItems.map(it => ({
          product_id: parseInt(it.product_id, 10),
          quantity: parseInt(it.quantity, 10)
        }))
      });
      notify('Internal transfer requested successfully (DRAFT)', 'success');
      setIsTransferModalOpen(false);
      setTransferNotes('');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDispatch = async (id) => {
    try {
      await dispatchTransfer(id);
      notify('Transfer dispatched into transit!', 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleComplete = async (id) => {
    try {
      await completeTransfer(id);
      notify('Transfer completed and verified at destination facility', 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateAdjustment = async (e) => {
    e.preventDefault();
    if (!adjReason.trim()) {
      notify('Reason is required for cycle count variance audit', 'warning');
      return;
    }
    try {
      await createAdjustment({
        product_id: parseInt(adjProdId, 10),
        warehouse_id: parseInt(adjWhId, 10),
        counted_quantity: parseInt(adjCountedQty, 10),
        reason: adjReason
      });
      notify('Stock adjustment applied and ledger audit recorded', 'success');
      setIsAdjModalOpen(false);
      setAdjReason('');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-title-area">
          <h1>Internal Warehouse Relocations & Stock Reconciliation</h1>
          <p>Coordinate inter-facility transfers and conduct physical cycle-count inventory adjustments.</p>
        </div>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={loadData}>
            <span>🔄</span> Refresh
          </button>
          {activeSubTab === 'transfers' ? (
            <button className="btn btn-primary" onClick={() => setIsTransferModalOpen(true)}>
              <span>➕</span> New Transfer Order
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsAdjModalOpen(true)}>
              <span>➕</span> New Cycle Adjustment
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="toolbar" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-tabs">
          <button
            className={`tab-btn ${activeSubTab === 'transfers' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('transfers')}
          >
            🚚 Internal Transfers ({transfers.length})
          </button>
          <button
            className={`tab-btn ${activeSubTab === 'adjustments' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('adjustments')}
          >
            ⚖️ Cycle Adjustments & Variances ({adjustments.length})
          </button>
        </div>
      </div>

      {/* Transfers Table */}
      {activeSubTab === 'transfers' && (
        <div className="table-card">
          {loading ? (
            <div className="empty-state"><div className="empty-title">Loading transfers...</div></div>
          ) : transfers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🚚</div>
              <div className="empty-title">No Transfers Found</div>
              <p>Relocate inventory between your distribution hubs.</p>
            </div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Source Facility</th>
                  <th>Destination Facility</th>
                  <th>SKUs / Items</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Lifecycle Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t.id}>
                    <td><span className="sku-tag" style={{ color: '#a78bfa' }}>{t.transfer_number}</span></td>
                    <td><strong>{t.source_warehouse_name}</strong></td>
                    <td><strong>{t.dest_warehouse_name}</strong></td>
                    <td>{t.items?.length || 0} item(s)</td>
                    <td>
                      {t.status === 'COMPLETED' ? (
                        <span className="status-badge status-validated">COMPLETED</span>
                      ) : t.status === 'IN_TRANSIT' ? (
                        <span className="status-badge status-packed">IN TRANSIT</span>
                      ) : (
                        <span className="status-badge status-draft">DRAFT</span>
                      )}
                    </td>
                    <td><span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{new Date(t.created_at).toLocaleDateString()}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {t.status === 'DRAFT' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDispatch(t.id)}>
                          Dispatch 🚀
                        </button>
                      )}
                      {t.status === 'IN_TRANSIT' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleComplete(t.id)}>
                          ✓ Confirm Receipt
                        </button>
                      )}
                      {t.status === 'COMPLETED' && (
                        <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Adjustments Table */}
      {activeSubTab === 'adjustments' && (
        <div className="table-card">
          {loading ? (
            <div className="empty-state"><div className="empty-title">Loading adjustments...</div></div>
          ) : adjustments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚖️</div>
              <div className="empty-title">No Adjustments Found</div>
              <p>Perform physical cycle counts and log write-offs or surplus stock.</p>
            </div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Adjustment #</th>
                  <th>Product</th>
                  <th>Facility</th>
                  <th>System Count</th>
                  <th>Physical Count</th>
                  <th>Variance</th>
                  <th>Audit Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map(a => (
                  <tr key={a.id}>
                    <td><span className="sku-tag" style={{ color: '#f43f5e' }}>{a.adjustment_number}</span></td>
                    <td><strong style={{ color: '#fff' }}>{a.product_name}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>({a.sku})</span></td>
                    <td>{a.warehouse_name}</td>
                    <td>{a.system_quantity}</td>
                    <td><strong style={{ color: '#38bdf8' }}>{a.counted_quantity}</strong></td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: a.variance > 0 ? '#34d399' : a.variance < 0 ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {a.variance > 0 ? `+${a.variance}` : a.variance}
                      </span>
                    </td>
                    <td><span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{a.reason}</span></td>
                    <td><span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{new Date(a.created_at).toLocaleDateString()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTransferModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2>Request Inter-Facility Transfer</h2>
              <button className="modal-close-btn" onClick={() => setIsTransferModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateTransfer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Source Facility</label>
                    <select className="form-select" value={sourceWh} onChange={e => setSourceWh(e.target.value)}>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination Facility</label>
                    <select className="form-select" value={destWh} onChange={e => setDestWh(e.target.value)}>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product to Relocate</label>
                  <select
                    className="form-select"
                    value={transferItems[0].product_id}
                    onChange={e => setTransferItems([{ ...transferItems[0], product_id: e.target.value }])}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Transfer Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={transferItems[0].quantity}
                    onChange={e => setTransferItems([{ ...transferItems[0], quantity: e.target.value }])}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dispatch Notes</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="E.g., expedited courier, pallet count..."
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsTransferModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {isAdjModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdjModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Inventory Cycle Count Adjustment</h2>
              <button className="modal-close-btn" onClick={() => setIsAdjModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateAdjustment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Product</label>
                  <select
                    className="form-select"
                    value={adjProdId}
                    onChange={e => {
                      setAdjProdId(e.target.value);
                      const prod = products.find(p => p.id === parseInt(e.target.value, 10));
                      if (prod) setAdjCountedQty(prod.current_stock);
                    }}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (System Stock: {p.current_stock})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Audited Facility</label>
                  <select className="form-select" value={adjWhId} onChange={e => setAdjWhId(e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Physical Counted Quantity</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={adjCountedQty}
                    onChange={e => setAdjCountedQty(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Audit Reason / Discrepancy Note</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shrinkage write-off, unrecorded inward box"
                    className="form-input"
                    value={adjReason}
                    onChange={e => setAdjReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdjModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Physical Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
