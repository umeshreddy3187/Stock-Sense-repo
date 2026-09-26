import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import CreateDeliveryModal from './components/CreateDeliveryModal';
import DeliveryOrderDetailModal from './components/DeliveryOrderDetailModal';
import StockLedgerModal from './components/StockLedgerModal';
import { fetchDeliveries, fetchProducts, fetchDeliveryById } from './services/api';

export default function App() {
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [delList, prodList] = await Promise.all([
        fetchDeliveries(),
        fetchProducts()
      ]);
      setDeliveries(delList);
      setProducts(prodList);
    } catch (err) {
      addToast(err.message || 'Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectOrder = async (orderId) => {
    try {
      const fullOrder = await fetchDeliveryById(orderId);
      setSelectedOrderDetails(fullOrder);
      setSelectedOrderId(orderId);
    } catch (err) {
      addToast(err.message || 'Failed to load order details', 'error');
    }
  };

  const handleOrderRefreshed = async () => {
    loadData();
    if (selectedOrderId) {
      try {
        const refreshed = await fetchDeliveryById(selectedOrderId);
        setSelectedOrderDetails(refreshed);
      } catch (err) {
        // ignore
      }
    }
  };

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(order => {
      const matchesFilter = activeFilter === 'ALL' || order.status === activeFilter;
      const matchesSearch = !searchQuery || 
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.destination_address && order.destination_address.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [deliveries, activeFilter, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    return {
      total: deliveries.length,
      draft: deliveries.filter(d => d.status === 'DRAFT').length,
      picked: deliveries.filter(d => d.status === 'PICKED').length,
      packed: deliveries.filter(d => d.status === 'PACKED').length,
      validated: deliveries.filter(d => d.status === 'VALIDATED').length,
    };
  }, [deliveries]);

  return (
    <div className="app-container">
      <Navbar 
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenLedger={() => setIsLedgerOpen(true)}
      />

      <main className="main-content">
        {/* Page Title & Quick Actions */}
        <div className="page-header">
          <div className="header-title-area">
            <h1>Delivery Orders Fulfillment</h1>
            <p>Manage outbound delivery fulfillment lifecycle: Draft &rarr; Pick &rarr; Pack &rarr; Validate &rarr; Stock Ledger Decrement.</p>
          </div>
          <div className="header-buttons">
            <button className="btn btn-secondary" onClick={loadData}>
              <span>🔄</span> Refresh
            </button>
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <span>➕</span> New Delivery Order
            </button>
          </div>
        </div>

        {/* Real-time KPI Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Delivery Orders</div>
            <div className="stat-val">{stats.total}</div>
            <div className="stat-sub">Across all statuses</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #94a3b8' }}>
            <div className="stat-label">Draft Orders</div>
            <div className="stat-val" style={{ color: '#cbd5e1' }}>{stats.draft}</div>
            <div className="stat-sub">Ready to be picked</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-label">Picked Items</div>
            <div className="stat-val" style={{ color: '#fbbf24' }}>{stats.picked}</div>
            <div className="stat-sub">Ready to be packed</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
            <div className="stat-label">Packed Containers</div>
            <div className="stat-val" style={{ color: '#22d3ee' }}>{stats.packed}</div>
            <div className="stat-sub">Awaiting validation</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-label">Validated & Fulfilled</div>
            <div className="stat-val" style={{ color: '#34d399' }}>{stats.validated}</div>
            <div className="stat-sub">Stock deducted & moved</div>
          </div>
        </div>

        {/* Toolbar: Filters & Search */}
        <div className="toolbar">
          <div className="filter-tabs">
            {['ALL', 'DRAFT', 'PICKED', 'PACKED', 'VALIDATED'].map(status => (
              <button
                key={status}
                className={`tab-btn ${activeFilter === status ? 'active' : ''}`}
                onClick={() => setActiveFilter(status)}
              >
                {status === 'ALL' ? 'All Deliveries' : status}
              </button>
            ))}
          </div>

          <div className="search-input-wrapper">
            <input 
              type="text"
              className="search-input"
              placeholder="Search by order #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Delivery Orders List Table */}
        <div className="table-card">
          {loading ? (
            <div className="empty-state">
              <div className="empty-title">Loading deliveries...</div>
              <p>Fetching real-time records from backend database.</p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">No Delivery Orders Found</div>
              <p>{searchQuery || activeFilter !== 'ALL' ? 'No orders match your filter criteria.' : 'Get started by creating your first delivery order.'}</p>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '1rem' }}
                onClick={() => setIsCreateOpen(true)}
              >
                Create Delivery Order
              </button>
            </div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Destination</th>
                  <th>Items</th>
                  <th>Units</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map(order => (
                  <tr key={order.id}>
                    <td>
                      <span 
                        className="order-link" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSelectOrder(order.id)}
                      >
                        {order.order_number}
                      </span>
                    </td>
                    <td>
                      <div className="customer-name">{order.customer_name}</div>
                    </td>
                    <td>
                      <div className="destination-sub">{order.destination_address || 'Warehouse Dispatch'}</div>
                    </td>
                    <td>{order.total_items} items</td>
                    <td style={{ fontWeight: 600 }}>{order.total_requested_quantity} units</td>
                    <td>
                      <span className={`status-badge ${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleSelectOrder(order.id)}
                      >
                        Manage &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Create Delivery Modal */}
      <CreateDeliveryModal 
        products={products}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          loadData();
        }}
        notify={addToast}
      />

      {/* Order Detail & Workflow Modal */}
      <DeliveryOrderDetailModal 
        order={selectedOrderDetails}
        isOpen={!!selectedOrderId}
        onClose={() => {
          setSelectedOrderId(null);
          setSelectedOrderDetails(null);
        }}
        onRefresh={handleOrderRefreshed}
        notify={addToast}
      />

      {/* Stock Ledger History Modal */}
      <StockLedgerModal 
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
      />

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
