import React, { useState, useEffect, useMemo } from 'react';
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchWarehouses } from '../services/api';

export default function ProductsView({ notify }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Electronics',
    current_stock: 0,
    min_stock: 15,
    warehouse_id: 1,
    unit: 'units'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, whs] = await Promise.all([fetchProducts(), fetchWarehouses()]);
      setProducts(prods || []);
      setWarehouses(whs || []);
    } catch (err) {
      notify(err.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, categoryFilter, search]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      sku: 'PROD-' + Math.floor(100 + Math.random() * 900),
      name: '',
      category: 'Electronics',
      current_stock: 10,
      min_stock: 15,
      warehouse_id: warehouses[0]?.id || 1,
      unit: 'units'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      category: p.category,
      current_stock: p.current_stock,
      min_stock: p.min_stock,
      warehouse_id: p.warehouse_id || warehouses[0]?.id || 1,
      unit: p.unit || 'units'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formData.name,
          category: formData.category,
          min_stock: parseInt(formData.min_stock, 10),
          warehouse_id: parseInt(formData.warehouse_id, 10),
          unit: formData.unit
        });
        notify(`Product "${formData.name}" updated successfully`, 'success');
      } else {
        await createProduct(formData);
        notify(`Product "${formData.name}" cataloged successfully`, 'success');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;
    try {
      await deleteProduct(id);
      notify(`Product "${name}" deleted`, 'info');
      loadData();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="header-title-area">
          <h1>Product Catalog & Master Inventory</h1>
          <p>Maintain SKU definitions, stock thresholds, unit measurements, and facility assignments.</p>
        </div>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={loadData}>
            <span>🔄</span> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <span>➕</span> Add New Product
          </button>
        </div>
      </div>

      {/* KPI stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total SKUs</div>
          <div className="stat-val">{products.length}</div>
          <div className="stat-sub">Active in catalog</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-label">In Stock</div>
          <div className="stat-val" style={{ color: '#34d399' }}>
            {products.filter(p => p.current_stock > p.min_stock).length}
          </div>
          <div className="stat-sub">Healthy stock levels</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-val" style={{ color: '#fbbf24' }}>
            {products.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock).length}
          </div>
          <div className="stat-sub">At or below reorder threshold</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-label">Out of Stock</div>
          <div className="stat-val" style={{ color: '#f87171' }}>
            {products.filter(p => p.current_stock === 0).length}
          </div>
          <div className="stat-sub">Requires replenishment</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="filter-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`tab-btn ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search by SKU, product name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="empty-state">
            <div className="empty-title">Loading catalog...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No Products Found</div>
            <p>Try adjusting your search query or add a new SKU.</p>
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Min Reorder</th>
                <th>Facility</th>
                <th>Health Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const isOutOfStock = p.current_stock === 0;
                const isLowStock = p.current_stock > 0 && p.current_stock <= p.min_stock;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="sku-tag">{p.sku}</span>
                    </td>
                    <td>
                      <strong style={{ color: '#fff' }}>{p.name}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.category}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.05rem', color: isOutOfStock ? '#ef4444' : isLowStock ? '#fbbf24' : '#34d399' }}>
                        {p.current_stock}
                      </span>{' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{p.unit}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)' }}>{p.min_stock} {p.unit}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>{p.warehouse_name || 'Central Facility'}</span>
                    </td>
                    <td>
                      {isOutOfStock ? (
                        <span className="status-badge status-draft" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="status-badge status-picked" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                          Low Stock
                        </span>
                      ) : (
                        <span className="status-badge status-validated" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                          Optimal
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: '0.4rem' }}
                        onClick={() => handleOpenEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#f87171' }}
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product Details' : 'Catalog New Product'}</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">SKU Code</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      disabled={!!editingProduct}
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Electronics, Audio"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Mechanical Ergonomic Keyboard"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {!editingProduct && (
                    <div className="form-group">
                      <label className="form-label">Initial Stock</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        required
                        value={formData.current_stock}
                        onChange={e => setFormData({ ...formData, current_stock: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Min Stock Threshold</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      required
                      value={formData.min_stock}
                      onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit of Measure</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="units, pcs, kg"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Facility</label>
                  <select
                    className="form-select"
                    value={formData.warehouse_id}
                    onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
