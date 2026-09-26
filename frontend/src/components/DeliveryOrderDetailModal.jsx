import React, { useState } from 'react';
import { pickDeliveryOrder, packDeliveryOrder, validateDeliveryOrder } from '../services/api';

export default function DeliveryOrderDetailModal({ order, isOpen, onClose, onRefresh, notify }) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [actionError, setActionError] = useState('');
  const [fulfillmentResult, setFulfillmentResult] = useState(null);

  if (!isOpen || !order) return null;

  const handlePick = async () => {
    try {
      setLoadingAction('pick');
      setActionError('');
      const updated = await pickDeliveryOrder(order.id);
      notify(`Order ${order.order_number} successfully marked as PICKED!`, 'success');
      onRefresh();
    } catch (err) {
      setActionError(err.message || 'Pick action failed');
      notify(err.message || 'Pick failed', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePack = async () => {
    try {
      setLoadingAction('pack');
      setActionError('');
      const updated = await packDeliveryOrder(order.id);
      notify(`Order ${order.order_number} successfully marked as PACKED!`, 'success');
      onRefresh();
    } catch (err) {
      setActionError(err.message || 'Pack action failed');
      notify(err.message || 'Pack failed', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleValidate = async () => {
    try {
      setLoadingAction('validate');
      setActionError('');
      const result = await validateDeliveryOrder(order.id);
      setFulfillmentResult(result);
      notify(`Order ${order.order_number} successfully VALIDATED! Inventory updated and ledger entry recorded.`, 'success');
      onRefresh();
    } catch (err) {
      setActionError(err.message || 'Validation failed');
      notify(err.message || 'Validation failed', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  // Determine current pipeline state
  const isDraft = order.status === 'DRAFT';
  const isPicked = order.status === 'PICKED';
  const isPacked = order.status === 'PACKED';
  const isValidated = order.status === 'VALIDATED';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2>{order.order_number}</h2>
              <span className={`status-badge ${order.status.toLowerCase()}`}>
                {order.status}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
              Created on {new Date(order.created_at).toLocaleString()}
              {order.validated_at && ` • Validated on ${new Date(order.validated_at).toLocaleString()}`}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="modal-body">
          {actionError && (
            <div className="alert-banner alert-danger">
              <span>⚠️</span>
              <span>{actionError}</span>
            </div>
          )}

          {/* Workflow Step Tracker */}
          <div className="workflow-pipeline">
            <div className="step-line">
              <div 
                className="step-line-fill" 
                style={{ 
                  width: isValidated ? '100%' : isPacked ? '66%' : isPicked ? '33%' : '0%' 
                }}
              />
            </div>

            <div className={`workflow-step ${isDraft ? 'active' : 'completed'}`}>
              <div className="step-icon-circle">{isDraft ? '1' : '✓'}</div>
              <div className="step-title">1. Created</div>
              <div className="step-status">Order Drafted</div>
            </div>

            <div className={`workflow-step ${isPicked ? 'active' : isValidated || isPacked ? 'completed' : ''}`}>
              <div className="step-icon-circle">{isValidated || isPacked ? '✓' : '2'}</div>
              <div className="step-title">2. Pick</div>
              <div className="step-status">{isPicked ? 'Ready to Pack' : isValidated || isPacked ? 'Items Picked' : 'Awaiting Pick'}</div>
            </div>

            <div className={`workflow-step ${isPacked ? 'active' : isValidated ? 'completed' : ''}`}>
              <div className="step-icon-circle">{isValidated ? '✓' : '3'}</div>
              <div className="step-title">3. Pack</div>
              <div className="step-status">{isPacked ? 'Ready to Validate' : isValidated ? 'Packed' : 'Awaiting Pack'}</div>
            </div>

            <div className={`workflow-step ${isValidated ? 'completed' : ''}`}>
              <div className="step-icon-circle">{isValidated ? '✓' : '4'}</div>
              <div className="step-title">4. Validate</div>
              <div className="step-status">{isValidated ? 'Stock Decreased' : 'Final Step'}</div>
            </div>
          </div>

          {/* Customer & Destination Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            background: 'rgba(15, 23, 42, 0.7)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}>
            <div>
              <div className="stat-label">Customer Name</div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>{order.customer_name}</div>
            </div>
            <div>
              <div className="stat-label">Destination</div>
              <div style={{ color: 'var(--text-muted)' }}>{order.destination_address || 'Standard Dispatch Depot'}</div>
            </div>
            <div>
              <div className="stat-label">Fulfillment Status</div>
              <div style={{ fontWeight: 600, color: isValidated ? '#34d399' : '#fbbf24' }}>
                {isValidated ? 'Dispatched & Decreased' : `Pending (${order.status})`}
              </div>
            </div>
          </div>

          {order.notes && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
              Note: {order.notes}
            </div>
          )}

          {/* Items & Stock Impact Table */}
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#e2e8f0' }}>Order Line Items & Live Inventory Impact</h4>
            <table className="orders-table" style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Requested</th>
                  <th>Picked</th>
                  <th>Packed</th>
                  <th>Current Stock</th>
                  <th>Post-Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map(it => {
                  const currentStock = it.current_available_stock;
                  const postStock = isValidated ? currentStock : currentStock - it.requested_quantity;
                  const isStockWarning = !isValidated && it.requested_quantity > currentStock;

                  return (
                    <tr key={it.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>SKU: {it.product_sku}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{it.requested_quantity} {it.product_unit}</td>
                      <td>
                        <span style={{ color: it.picked_quantity > 0 ? '#34d399' : 'var(--text-subtle)' }}>
                          {it.picked_quantity}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: it.packed_quantity > 0 ? '#34d399' : 'var(--text-subtle)' }}>
                          {it.packed_quantity}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: currentStock > 0 ? '#38bdf8' : '#f87171', fontWeight: 600 }}>
                          {currentStock}
                        </span>
                      </td>
                      <td>
                        {isValidated ? (
                          <span style={{ color: '#10b981', fontWeight: 700 }}>
                            Fulfilled ({currentStock} in DB)
                          </span>
                        ) : (
                          <span style={{ color: isStockWarning ? '#f87171' : '#a5b4fc', fontWeight: 700 }}>
                            {postStock} ({isStockWarning ? 'Stock Shortage!' : `-${it.requested_quantity}`})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Validation Stock Ledger Output if just validated */}
          {(isValidated || fulfillmentResult) && (
            <div className="alert-banner alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <span>✅</span>
                <span>Stock Transaction Recorded in Stock Ledger</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#bbf7d0' }}>
                Stock levels decreased directly in SQLite database. A permanent audit entry with movement type <code>DELIVERY</code> was created in the <code>stock_ledger</code> table.
              </div>
            </div>
          )}
        </div>

        {/* Workflow Action Buttons */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {isDraft && (
              <button 
                className="btn btn-warning"
                onClick={handlePick}
                disabled={loadingAction === 'pick'}
                id="btn-pick-order"
              >
                {loadingAction === 'pick' ? 'Picking Items...' : '📦 Step 2: Confirm Pick Items'}
              </button>
            )}

            {isPicked && (
              <button 
                className="btn btn-info"
                onClick={handlePack}
                disabled={loadingAction === 'pack'}
                id="btn-pack-order"
              >
                {loadingAction === 'pack' ? 'Packing Items...' : '🎁 Step 3: Confirm Pack Items'}
              </button>
            )}

            {isPacked && (
              <button 
                className="btn btn-success"
                onClick={handleValidate}
                disabled={loadingAction === 'validate'}
                id="btn-validate-order"
              >
                {loadingAction === 'validate' ? 'Validating & Decreasing Stock...' : '⚡ Step 4: Validate Order & Deduct Stock'}
              </button>
            )}

            {isValidated && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 700, fontSize: '0.875rem' }}>
                <span>✓</span> Order Fully Validated & Stock Deducted
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
