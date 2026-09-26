import React, { useState, useEffect } from 'react';
import { fetchReceipts, createReceipt, receiveReceipt, fetchProducts, fetchWarehouses } from '../services/api';

export default function ReceiptsView({ notify }) {
  const [receipts, setReceipts] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [warehouseId, setWarehouseId] = useState(1);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([
    { product_id: '', quantity_ordered: 10, unit_cost: 25.0 }
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recs, prods, whs] = await Promise.all([
        fetchReceipts(),
        fetchProducts(),
        fetchWarehouses()
      ]);
      setReceipts(recs || []);
      setProducts(prods || []);
      setWarehouses(whs || []);
      if (whs && whs.length > 0) setWarehouseId(whs[0].id);
      if (prods && prods.length > 0) {
        setLineItems([{ product_id: prods[0].id, quantity_ordered: 10, unit_cost: 25.0 }]);
      }
    } catch (err) {
      notify(err.message || 'Error loading receipts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReceipts = receipts.filter(r => {
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchSearch = !search ||
      r.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier_ref && r.supplier_ref.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const handleAddItem = () => {
    setLineItems([
      ...lineItems,
      { product_id: products[0]?.id || '', quantity_ordered: 5, unit_cost: 10.0 }
    ]);
  };

  const handleRemoveItem = (idx) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...lineItems];
    updated[idx][field] = val;
    setLineItems(updated);
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      notify('Supplier name is required', 'warning');
      return;
    }
    try {
      await createReceipt({
        supplier_name: supplierName,
        supplier_ref: supplierRef,
        warehouse_id: parseInt(warehouseId, 10),
        notes,
        items: lineItems.map(it => ({
          product_id: parseInt(it.product_id, 10),
          quantity_ordered: parseInt(it.quantity_ordered, 10),
          unit_cost: parseFloat(it.unit_cost) || 0
        }))
      });
      notify('Inbound purchase receipt created in DRAFT state', 'success');
      setIsModalOpen(false);
      setSupplierName('');
      setSupplierRef('');
      setNotes('');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleReceive = async (receipt) => {
    if (!confirm(`Confirm stock-in for receipt ${receipt.receipt_number}?\nThis will automatically increment inventory levels in SQLite.`)) return;
    try {
      await receiveReceipt(receipt.id);
      notify(`Receipt ${receipt.receipt_number} received! Inventory successfully incremented.`, 'success');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-title-area">
          <h1>Inbound Logistics & Supplier Receipts</h1>
          <p>Process incoming vendor purchase orders: Draft &rarr; Shipment Inspection &rarr; Receive &rarr; Stock Increment & Ledger movement.</p>
        </div>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={loadData}>
            <span>🔄</span> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <span>➕</span> New Inward Receipt
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Receipts</div>
          <div className="stat-val">{receipts.length}</div>
          <div className="stat-sub">Across all suppliers</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-label">Pending Inward</div>
          <div className="stat-val" style={{ color: '#fbbf24' }}>
            {receipts.filter(r => r.status === 'DRAFT').length}
          </div>
          <div className="stat-sub">Awaiting dock verification</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-label">Stocked In (Received)</div>
          <div className="stat-val" style={{ color: '#34d399' }}>
            {receipts.filter(r => r.status === 'RECEIVED').length}
          </div>
          <div className="stat-sub">Allocated to warehouse stock</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="filter-tabs">
          {['ALL', 'DRAFT', 'RECEIVED'].map(st => (
            <button
              key={st}
              className={`tab-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? 'All Receipts' : st}
            </button>
          ))}
        </div>

        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search by receipt #, supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="empty-state">
            <div className="empty-title">Loading receipts...</div>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📥</div>
            <div className="empty-title">No Receipts Found</div>
            <p>Create an inward receipt to receive stock from your suppliers.</p>
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Supplier</th>
                <th>Ref / PO #</th>
                <th>Destination Facility</th>
                <th>Items Ordered</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="sku-tag" style={{ color: '#38bdf8' }}>{r.receipt_number}</span>
                  </td>
                  <td>
                    <strong style={{ color: '#fff' }}>{r.supplier_name}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.supplier_ref || '—'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{r.warehouse_name || 'Central Facility'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {r.items?.length || 0} SKU item(s)
                    </span>
                  </td>
                  <td>
                    {r.status === 'RECEIVED' ? (
                      <span className="status-badge status-validated">RECEIVED</span>
                    ) : (
                      <span className="status-badge status-draft">DRAFT</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.status === 'DRAFT' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleReceive(r)}
                      >
                        ✓ Receive Stock
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>Stocked In</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2>New Inward Supplier Receipt</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateReceipt}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Supplier / Vendor Name</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Apex Semiconductor Inc."
                      value={supplierName}
                      onChange={e => setSupplierName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor PO / Invoice Ref</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. PO-2026-904"
                      value={supplierRef}
                      onChange={e => setSupplierRef(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Receiving Facility</label>
                  <select
                    className="form-select"
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Line Items to Receive</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
                      + Add Item
                    </button>
                  </div>
                  {lineItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={item.product_id}
                        onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        className="form-input"
                        value={item.quantity_ordered}
                        onChange={e => handleItemChange(idx, 'quantity_ordered', e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit $"
                        className="form-input"
                        value={item.unit_cost}
                        onChange={e => handleItemChange(idx, 'unit_cost', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#f87171' }}
                        disabled={lineItems.length === 1}
                        onClick={() => handleRemoveItem(idx)}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="form-label">Notes & Inspection Instructions</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Enter any notes..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Purchase Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
