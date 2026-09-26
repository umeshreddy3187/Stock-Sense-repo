import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchDashboardSummary,
  fetchInventoryOverview,
  fetchWarehouseOverview,
  fetchMovementAnalytics,
  fetchLowStockProducts,
  fetchWarehouses
} from '../services/api';
import { DonutChart, WarehouseBarChart, MovementTrendChart } from './DashboardCharts';

export default function InventoryDashboard({ notify }) {
  // Filters state
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [timeRange, setTimeRange] = useState('30d');
  const [movementFilterType, setMovementFilterType] = useState('ALL');
  const [lowStockStatusFilter, setLowStockStatusFilter] = useState('ALL');

  // Data states
  const [warehousesList, setWarehousesList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [inventoryOverview, setInventoryOverview] = useState(null);
  const [warehouseStats, setWarehouseStats] = useState([]);
  const [movementAnalytics, setMovementAnalytics] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination for movements
  const [movementsPage, setMovementsPage] = useState(0);
  const movementsLimit = 10;

  // Load warehouse dropdown options on mount
  useEffect(() => {
    fetchWarehouses()
      .then(data => setWarehousesList(data || []))
      .catch(() => {});
  }, []);

  // Fetch all dashboard data
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const filterPayload = {
        warehouseId: selectedWarehouse || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        timeRange,
        movementType: movementFilterType !== 'ALL' ? movementFilterType : undefined,
        status: lowStockStatusFilter !== 'ALL' ? lowStockStatusFilter : undefined,
        limit: movementsLimit,
        offset: movementsPage * movementsLimit
      };

      const [sumData, invData, whData, movData, lowData] = await Promise.all([
        fetchDashboardSummary(filterPayload),
        fetchInventoryOverview(filterPayload),
        fetchWarehouseOverview(filterPayload),
        fetchMovementAnalytics(filterPayload),
        fetchLowStockProducts(filterPayload)
      ]);

      setSummary(sumData);
      setInventoryOverview(invData);
      setWarehouseStats(whData || []);
      setMovementAnalytics(movData);
      setLowStockItems(lowData || []);
    } catch (err) {
      console.error('[Dashboard Error]', err);
      setError(err.message || 'Failed to load dashboard data. Please try again.');
      if (notify) notify(err.message || 'Dashboard data error', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedWarehouse, selectedCategory, timeRange, movementFilterType, lowStockStatusFilter, movementsPage, notify]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleResetFilters = () => {
    setSelectedWarehouse('');
    setSelectedCategory('ALL');
    setTimeRange('30d');
    setMovementFilterType('ALL');
    setLowStockStatusFilter('ALL');
    setMovementsPage(0);
  };

  if (loading && !summary) {
    return (
      <div className="empty-state" style={{ padding: '6rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
        <div className="empty-title">Loading Inventory Dashboard...</div>
        <p>Querying real-time stock levels, warehouse metrics, and movement logs.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Dashboard Top Header & Filter Controls */}
      <div className="page-header" style={{ marginBottom: '0.5rem' }}>
        <div className="header-title-area">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1>Inventory Intelligence Dashboard</h1>
            <span className="member-chip" style={{ fontSize: '0.75rem' }}>Real-time SQLite Balances</span>
          </div>
          <p>Comprehensive overview of product catalogs, multi-warehouse stock allocations, and audit movements.</p>
        </div>

        <div className="header-buttons">
          <button 
            className="btn btn-secondary"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            id="btn-refresh-dashboard"
          >
            <span>{refreshing ? '⌛' : '🔄'}</span>
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          {/* Warehouse Filter */}
          <div className="form-group" style={{ minWidth: '200px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Warehouse</label>
            <select
              className="form-select"
              value={selectedWarehouse}
              onChange={(e) => { setSelectedWarehouse(e.target.value); setMovementsPage(0); }}
              id="filter-warehouse"
            >
              <option value="">All Warehouses ({warehousesList.length})</option>
              {warehousesList.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="form-group" style={{ minWidth: '170px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Category</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setMovementsPage(0); }}
              id="filter-category"
            >
              <option value="ALL">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Audio">Audio</option>
              <option value="Furniture">Furniture</option>
              <option value="Accessories">Accessories</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Time Range</label>
            <div className="filter-tabs">
              {[
                { label: 'Today', val: 'today' },
                { label: 'Last 7 Days', val: '7d' },
                { label: 'Last 30 Days', val: '30d' },
                { label: 'All Time', val: 'all' }
              ].map(t => (
                <button
                  key={t.val}
                  type="button"
                  className={`tab-btn ${timeRange === t.val ? 'active' : ''}`}
                  onClick={() => { setTimeRange(t.val); setMovementsPage(0); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(selectedWarehouse || selectedCategory !== 'ALL' || timeRange !== '30d') && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={handleResetFilters}
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Error Alert with Retry */}
      {error && (
        <div className="alert-banner alert-danger" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => loadDashboardData()}>
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="stats-grid">
        {/* Total Products */}
        <div className="stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="stat-label">Total Catalog Products</div>
          <div className="stat-val">{summary?.total_products ?? 0}</div>
          <div className="stat-sub">Across active categories</div>
        </div>

        {/* Total Stock Quantity */}
        <div className="stat-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div className="stat-label">Total Stock Quantity</div>
          <div className="stat-val" style={{ color: '#38bdf8' }}>
            {summary?.total_stock_quantity?.toLocaleString() ?? 0}
          </div>
          <div className="stat-sub">Physical units stored</div>
        </div>

        {/* Total Warehouses */}
        <div className="stat-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div className="stat-label">Storage Facilities</div>
          <div className="stat-val">{summary?.total_warehouses ?? 0}</div>
          <div className="stat-sub">Operating distribution hubs</div>
        </div>

        {/* Low Stock Items */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-val" style={{ color: summary?.low_stock_items > 0 ? '#fbbf24' : '#fff' }}>
            {summary?.low_stock_items ?? 0}
          </div>
          <div className="stat-sub">At or below reorder point</div>
        </div>

        {/* Out of Stock Items */}
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-label">Out of Stock Items</div>
          <div className="stat-val" style={{ color: summary?.out_of_stock_items > 0 ? '#f87171' : '#fff' }}>
            {summary?.out_of_stock_items ?? 0}
          </div>
          <div className="stat-sub">Depleted inventory (0 units)</div>
        </div>

        {/* Movement Activity */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-label">Audit Movements</div>
          <div className="stat-val" style={{ color: '#34d399' }}>
            {summary?.recent_movements_count ?? 0}
          </div>
          <div className="stat-sub">Transactions in {timeRange === 'today' ? 'today' : timeRange}</div>
        </div>
      </div>

      {/* Inventory Overview Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Category Breakdown Donut */}
        <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Category Distribution</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>By units in stock</span>
          </div>

          <DonutChart 
            data={inventoryOverview?.category_distribution || []}
            totalUnits={inventoryOverview?.total_inventory_units || 0}
          />
        </div>

        {/* Stock by Warehouse Bar Chart */}
        <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Stock by Warehouse</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Capacity allocation</span>
          </div>

          <WarehouseBarChart 
            data={inventoryOverview?.stock_by_warehouse || []}
          />
        </div>

        {/* Inventory Health Ratio Card */}
        <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Stock Health Distribution</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Catalog status</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>Healthy Stock</span>
                  <strong>{inventoryOverview?.status_breakdown?.healthy ?? 0} SKUs</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${summary?.total_products > 0 ? (inventoryOverview?.status_breakdown?.healthy / summary.total_products) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#10b981', 
                    borderRadius: '9999px' 
                  }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>Low Stock Alert</span>
                  <strong>{inventoryOverview?.status_breakdown?.low_stock ?? 0} SKUs</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${summary?.total_products > 0 ? (inventoryOverview?.status_breakdown?.low_stock / summary.total_products) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#f59e0b', 
                    borderRadius: '9999px' 
                  }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>Out of Stock</span>
                  <strong>{inventoryOverview?.status_breakdown?.out_of_stock ?? 0} SKUs</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${summary?.total_products > 0 ? (inventoryOverview?.status_breakdown?.out_of_stock / summary.total_products) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#ef4444', 
                    borderRadius: '9999px' 
                  }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            marginTop: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            Deliveries validated through the Outbound Delivery workflow directly decrement available units and trigger stock ledger movements.
          </div>
        </div>
      </div>

      {/* Stock Movement Analytics Section */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Stock Movement Trend & Analytics</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Historical inventory flows derived from the immutable Stock Ledger.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-subtle)' }}>Stock In: </span>
              <strong style={{ color: '#34d399' }}>+{movementAnalytics?.summary?.stock_in || 0} units</strong>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-subtle)' }}>Stock Out: </span>
              <strong style={{ color: '#f87171' }}>-{movementAnalytics?.summary?.stock_out || 0} units</strong>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-subtle)' }}>Net Flow: </span>
              <strong style={{ color: (movementAnalytics?.summary?.net_change || 0) >= 0 ? '#34d399' : '#f87171' }}>
                {(movementAnalytics?.summary?.net_change || 0) >= 0 ? `+${movementAnalytics?.summary?.net_change || 0}` : movementAnalytics?.summary?.net_change} units
              </strong>
            </div>
          </div>
        </div>

        <MovementTrendChart timeline={movementAnalytics?.timeline || []} />
      </div>

      {/* Warehouse Facilities Detailed Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Warehouse Facility Summary</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status across all operating distribution locations.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {warehouseStats.map(wh => (
            <div 
              key={wh.id}
              className="stat-card"
              style={{
                cursor: 'pointer',
                borderColor: selectedWarehouse === String(wh.id) ? 'var(--primary)' : 'var(--border-color)',
                boxShadow: selectedWarehouse === String(wh.id) ? '0 0 15px var(--primary-glow)' : 'none'
              }}
              onClick={() => setSelectedWarehouse(selectedWarehouse === String(wh.id) ? '' : String(wh.id))}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{wh.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Code: {wh.code} &bull; {wh.address || 'Central'}</div>
                </div>
                <span className="member-chip" style={{ fontSize: '0.7rem' }}>
                  {wh.product_count} SKUs
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Stock:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{wh.total_quantity} units</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                  Healthy: {wh.healthy_count}
                </span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                  Low: {wh.low_stock_count}
                </span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Out: {wh.out_of_stock_count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      <div className="table-card">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>⚠️ Low Stock & Depleted Inventory</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Items requiring immediate replenishment or purchase orders.</p>
          </div>

          <div className="filter-tabs">
            {['ALL', 'LOW_STOCK', 'OUT_OF_STOCK'].map(st => (
              <button
                key={st}
                type="button"
                className={`tab-btn ${lowStockStatusFilter === st ? 'active' : ''}`}
                onClick={() => setLowStockStatusFilter(st)}
              >
                {st === 'ALL' ? 'All Alerts' : st === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
            <div className="empty-title">All Stock Levels Healthy!</div>
            <p>No products are currently at or below minimum threshold.</p>
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Warehouse</th>
                <th>Current Stock</th>
                <th>Min Reorder Level</th>
                <th>Status</th>
                <th>Deficit</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{item.category}</div>
                  </td>
                  <td><code style={{ color: '#a5b4fc' }}>{item.sku}</code></td>
                  <td>{item.warehouse_name || 'Central'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: item.current_stock === 0 ? '#ef4444' : '#f59e0b' }}>
                      {item.current_stock} {item.unit}
                    </span>
                  </td>
                  <td>{item.min_stock} {item.unit}</td>
                  <td>
                    <span className={`status-badge ${item.status === 'OUT_OF_STOCK' ? 'draft' : 'picked'}`} style={{
                      background: item.status === 'OUT_OF_STOCK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: item.status === 'OUT_OF_STOCK' ? '#f87171' : '#fbbf24',
                      borderColor: item.status === 'OUT_OF_STOCK' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                    }}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#f87171' }}>
                      +{item.deficit} {item.unit}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Stock Movements Table Section */}
      <div className="table-card">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Recent Stock Movements Activity</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Latest audit log transactions across all warehouses.</p>
          </div>

          <div className="filter-tabs">
            {['ALL', 'DELIVERY', 'RECEIPT', 'TRANSFER', 'ADJUSTMENT'].map(mType => (
              <button
                key={mType}
                type="button"
                className={`tab-btn ${movementFilterType === mType ? 'active' : ''}`}
                onClick={() => { setMovementFilterType(mType); setMovementsPage(0); }}
              >
                {mType}
              </button>
            ))}
          </div>
        </div>

        {!movementAnalytics?.movements || movementAnalytics.movements.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 2rem' }}>
            <div className="empty-icon">📜</div>
            <div className="empty-title">No Movements Logged</div>
            <p>No inventory operations match the current filter selection.</p>
          </div>
        ) : (
          <div>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Quantity Delta</th>
                  <th>Before / After</th>
                  <th>Reference & Notes</th>
                </tr>
              </thead>
              <tbody>
                {movementAnalytics.movements.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                      {new Date(m.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className="status-badge" style={{
                        background: m.movement_type === 'DELIVERY' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: m.movement_type === 'DELIVERY' ? '#f87171' : '#34d399',
                        border: `1px solid ${m.movement_type === 'DELIVERY' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{m.product_sku}</div>
                    </td>
                    <td>{m.warehouse_name || 'Main WH'}</td>
                    <td>
                      <span style={{ 
                        fontWeight: 800, 
                        color: m.quantity_change > 0 ? '#34d399' : '#f87171' 
                      }}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change} {m.product_unit}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.825rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{m.quantity_before}</span>
                      <span style={{ color: 'var(--text-subtle)', margin: '0 0.35rem' }}>&rarr;</span>
                      <strong style={{ color: '#38bdf8' }}>{m.quantity_after}</strong>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
                      <div>{m.reference_type} #{m.reference_id}</div>
                      {m.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{m.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {movementAnalytics.pagination && movementAnalytics.pagination.total > movementsLimit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {movementsPage * movementsLimit + 1} - {Math.min((movementsPage + 1) * movementsLimit, movementAnalytics.pagination.total)} of {movementAnalytics.pagination.total} movements
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    disabled={movementsPage === 0}
                    onClick={() => setMovementsPage(p => Math.max(p - 1, 0))}
                  >
                    &larr; Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    disabled={(movementsPage + 1) * movementsLimit >= movementAnalytics.pagination.total}
                    onClick={() => setMovementsPage(p => p + 1)}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
