import React, { useState } from 'react';
import { createDeliveryOrder } from '../services/api';

export default function CreateDeliveryModal({ products, isOpen, onClose, onSuccess, notify }) {
  const [customerName, setCustomerName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: products[0]?.id || '', requested_quantity: 1 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const handleAddItem = () => {
    const availableProd = products.find(p => !items.some(item => Number(item.product_id) === p.id));
    const nextProdId = availableProd ? availableProd.id : products[0]?.id || '';
    setItems([...items, { product_id: nextProdId, requested_quantity: 1 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setValidationError('A delivery order must have at least one product item.');
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
    setValidationError('');
  };

  // Pre-validate stock and quantities
  const validateForm = () => {
    if (!customerName.trim()) {
      return 'Customer name is required.';
    }

    if (items.length === 0) {
      return 'At least one product item is required.';
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const prodId = Number(it.product_id);
      const qty = Number(it.requested_quantity);

      if (!prodId) {
        return `Please select a product for line ${i + 1}.`;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        return `Quantity for line ${i + 1} must be a positive integer greater than zero.`;
      }

      const product = products.find(p => p.id === prodId);
      if (!product) {
        return `Product for line ${i + 1} not found.`;
      }

      if (qty > product.current_stock) {
        return `Requested quantity (${qty}) for "${product.name}" exceeds available stock (${product.current_stock}).`;
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      setValidationError(errorMsg);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationError('');
      
      const payload = {
        customer_name: customerName.trim(),
        destination_address: destinationAddress.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          requested_quantity: Number(it.requested_quantity)
        }))
      };

      const created = await createDeliveryOrder(payload);
      notify(`Delivery order ${created.order_number} created successfully!`, 'success');
      onSuccess(created);
      onClose();
    } catch (err) {
      setValidationError(err.message || 'Failed to create order');
      notify(err.message || 'Creation error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentFormError = validateForm();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Delivery Order</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {validationError && (
              <div className="alert-banner alert-danger">
                <span>⚠️</span>
                <span>{validationError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="customer_name">Customer / Client Name *</label>
              <input 
                id="customer_name"
                className="form-input"
                type="text"
                required
                placeholder="e.g. Apex Global Logistics Corp"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setValidationError(''); }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="destination_address">Destination Delivery Address</label>
              <input 
                id="destination_address"
                className="form-input"
                type="text"
                placeholder="e.g. 742 Industrial Parkway, Building B"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label">Order Line Items *</label>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={handleAddItem}
                >
                  ➕ Add Product
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.map((item, idx) => {
                  const selectedProduct = products.find(p => p.id === Number(item.product_id));
                  const isStockWarning = selectedProduct && Number(item.requested_quantity) > selectedProduct.current_stock;
                  const isZeroOrNegative = Number(item.requested_quantity) <= 0;

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '3fr 1.5fr 1fr auto', 
                        gap: '0.75rem', 
                        alignItems: 'center',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: isStockWarning || isZeroOrNegative ? '1px solid var(--danger-border)' : '1px solid var(--border-color)'
                      }}
                    >
                      <div>
                        <select 
                          className="form-select"
                          value={item.product_id}
                          onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name} ({p.current_stock} in stock)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input 
                          type="number" 
                          min="1"
                          step="1"
                          className="form-input"
                          value={item.requested_quantity}
                          onChange={(e) => handleItemChange(idx, 'requested_quantity', e.target.value)}
                          placeholder="Qty"
                        />
                      </div>

                      <div style={{ fontSize: '0.75rem' }}>
                        {selectedProduct ? (
                          <div>
                            <span style={{ 
                              color: isStockWarning ? '#f87171' : '#34d399', 
                              fontWeight: 700 
                            }}>
                              {selectedProduct.current_stock} avail.
                            </span>
                            <div style={{ color: 'var(--text-subtle)' }}>
                              Rem: {selectedProduct.current_stock - Number(item.requested_quantity || 0)}
                            </div>
                          </div>
                        ) : 'Select'}
                      </div>

                      <div>
                        <button 
                          type="button" 
                          className="btn btn-danger"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="order_notes">Fulfillment Instructions / Notes</label>
              <textarea 
                id="order_notes"
                className="form-textarea"
                placeholder="Special handling instructions, priority status, packaging requirements..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting || !!currentFormError}
              id="btn-submit-delivery"
            >
              {isSubmitting ? 'Creating Order...' : 'Create Delivery Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
