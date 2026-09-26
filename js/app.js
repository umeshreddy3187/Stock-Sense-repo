// StockSense Core Application & Shared Ledger Engine
const Ledger = {
  getAll() {
    return DataStore.get(STORAGE_KEYS.STOCK_LEDGER, []);
  },

  record(entry) {
    const ledger = this.getAll();
    const newEntry = {
      id: 'led-' + Date.now() + '-' + Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString(),
      referenceNumber: entry.referenceNumber,
      type: entry.type || 'STOCK_IN',
      productId: entry.productId,
      productName: entry.productName,
      sku: entry.sku,
      warehouse: entry.warehouse,
      location: entry.location || 'General',
      quantityChange: entry.quantityChange,
      balanceAfter: entry.balanceAfter,
      user: entry.user || 'System',
      remarks: entry.remarks || ''
    };

    ledger.unshift(newEntry);
    DataStore.set(STORAGE_KEYS.STOCK_LEDGER, ledger);
    this.renderTable();
    return newEntry;
  },

  renderTable() {
    const tbody = document.getElementById('ledger-table-body');
    if (!tbody) return;

    const entries = this.getAll();
    const searchVal = (document.getElementById('search-ledger')?.value || '').toLowerCase().trim();

    const filtered = entries.filter(e => {
      return e.productName.toLowerCase().includes(searchVal) ||
             e.sku.toLowerCase().includes(searchVal) ||
             e.referenceNumber.toLowerCase().includes(searchVal) ||
             e.warehouse.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No ledger entries found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(e => {
      const isPositive = e.quantityChange > 0;
      const dateFormatted = new Date(e.timestamp).toLocaleString();

      return `
        <tr>
          <td style="font-size: 0.775rem; color: var(--text-dim); white-space: nowrap;">
            ${dateFormatted}
          </td>
          <td>
            <span class="sku-code">${e.referenceNumber}</span>
          </td>
          <td>
            <div style="font-weight: 600;">${e.productName}</div>
            <span class="sku-code" style="font-size: 0.7rem;">${e.sku}</span>
          </td>
          <td>
            <div style="font-size: 0.8rem;">${e.warehouse}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${e.location}</div>
          </td>
          <td>
            <span style="font-weight: 700; font-family: var(--font-mono); color: ${isPositive ? 'var(--emerald)' : 'var(--rose)'};">
              ${isPositive ? '+' : ''}${e.quantityChange}
            </span>
          </td>
          <td>
            <strong style="color: #fff; font-family: var(--font-mono);">${e.balanceAfter.toLocaleString()}</strong>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: var(--text-main);">${e.remarks || 'Stock movement'}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">By: ${e.user}</div>
          </td>
        </tr>
      `;
    }).join('');
  }
};

const App = {
  currentView: 'dashboard',

  init() {
    // Initialize LocalStorage Data Store
    DataStore.init();

    // Initialize Modules
    Auth.init();
    Products.init();
    Warehouses.init();
    Receipts.init();
    Deliveries.init();
    Transfers.init();
    Adjustments.init();
    Ledger.renderTable();

    this.bindGlobalEvents();
    this.updateDashboardCounters();
    this.switchView('dashboard');
  },

  onAuthChanged(user) {
    this.updateDashboardCounters();
  },

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle View Panels
    document.querySelectorAll('.page-view').forEach(panel => {
      panel.classList.add('hidden');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('hidden');
    }

    // Update Nav Active state
    document.querySelectorAll('.nav-item button').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      }
    });

    // Update Topbar Title
    const titles = {
      dashboard: { title: 'Executive Overview', sub: 'Real-time stock analytics, inventory health & KPI turnover' },
      products: { title: 'Product Catalog & Inventory', sub: 'Manage products, SKUs, categories, units & reorder levels' },
      warehouses: { title: 'Warehouse & Facility Management', sub: 'Multi-hub locations, zone layout & capacity metrics' },
      receipts: { title: 'Receipts & Stock Inward', sub: 'Purchase orders, supplier shipments & automatic inventory increment' },
      deliveries: { title: 'Outbound Delivery Orders', sub: 'Pick, pack & validate fulfillment pipeline with automated stock deduction' },
      transfers: { title: 'Internal Warehouse Transfers', sub: 'Relocate stock between facilities with in-transit tracking & verification' },
      adjustments: { title: 'Inventory Adjustments & Audits', sub: 'Physical cycle counts, variance detection & stock reconciliation' },
      ledger: { title: 'Audit Trail & Stock Ledger', sub: 'Historical records of all stock in/out adjustments across all modules' }
    };

    const currentTitle = titles[viewName] || { title: 'StockSense', sub: '' };
    document.getElementById('topbar-page-title').textContent = currentTitle.title;
    document.getElementById('topbar-page-sub').textContent = currentTitle.sub;

    // Refresh view specific data
    if (viewName === 'products') Products.renderTable();
    if (viewName === 'warehouses') { Warehouses.renderWarehouses(); Warehouses.renderLocationView(); }
    if (viewName === 'receipts') Receipts.renderTable();
    if (viewName === 'deliveries') Deliveries.renderTable();
    if (viewName === 'transfers') Transfers.renderTable();
    if (viewName === 'adjustments') Adjustments.renderTable();
    if (viewName === 'ledger') Ledger.renderTable();
    if (viewName === 'dashboard') this.updateDashboardCounters();
  },

  updateDashboardCounters() {
    const products = Products.getAll();
    const warehouses = Warehouses.getAll();
    const receipts = Receipts.getAll();
    const deliveries = Deliveries.getAll();
    const transfers = Transfers.getAll();

    // Badges in sidebar
    const badgeProd = document.getElementById('nav-badge-products');
    if (badgeProd) badgeProd.textContent = products.length.toString();

    const badgeReceipts = document.getElementById('nav-badge-receipts');
    if (badgeReceipts) {
      const pendingRec = receipts.filter(r => r.status !== 'Received').length;
      badgeReceipts.textContent = pendingRec.toString();
    }

    const badgeDeliveries = document.getElementById('nav-badge-deliveries');
    if (badgeDeliveries) {
      const pendingDel = deliveries.filter(d => d.status !== 'VALIDATED').length;
      badgeDeliveries.textContent = pendingDel.toString();
    }

    // Populate dashboard category filter options if not yet populated
    const dashCatFilter = document.getElementById('dash-filter-category');
    if (dashCatFilter && dashCatFilter.options.length <= 1) {
      const categories = DataStore.get(STORAGE_KEYS.CATEGORIES, []);
      dashCatFilter.innerHTML = '<option value="">All Product Categories</option>' +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const filterWh = document.getElementById('dash-filter-warehouse')?.value || '';
    const filterCat = document.getElementById('dash-filter-category')?.value || '';

    let filteredProducts = products;
    if (filterWh) filteredProducts = filteredProducts.filter(p => p.warehouseId === filterWh);
    if (filterCat) filteredProducts = filteredProducts.filter(p => p.category === filterCat);

    // 1. Total Products
    const elTotalProducts = document.getElementById('metric-total-products');
    if (elTotalProducts) elTotalProducts.textContent = filteredProducts.length.toString();

    // 2. Low Stock Count
    const lowStockItems = filteredProducts.filter(p => p.stock <= p.reorderLevel);
    const elLowStock = document.getElementById('metric-low-stock');
    if (elLowStock) {
      elLowStock.textContent = lowStockItems.length.toString();
      elLowStock.style.color = lowStockItems.length > 0 ? 'var(--amber)' : 'var(--text-main)';
    }

    // 3. Total Warehouses
    const elTotalWh = document.getElementById('metric-total-warehouses');
    if (elTotalWh) elTotalWh.textContent = warehouses.length.toString();

    // 4. Pending Receipts
    const pendingReceipts = receipts.filter(r => r.status !== 'Received');
    const elPendingReceipts = document.getElementById('metric-pending-receipts');
    if (elPendingReceipts) elPendingReceipts.textContent = pendingReceipts.length.toString();

    // 5. Active Outbound Deliveries
    const activeDeliveries = deliveries.filter(d => d.status !== 'VALIDATED');
    const elActiveDeliveries = document.getElementById('metric-active-deliveries');
    if (elActiveDeliveries) elActiveDeliveries.textContent = activeDeliveries.length.toString();

    // 6. Total Inventory Valuation
    const totalVal = filteredProducts.reduce((sum, p) => sum + (p.stock * p.unitCost), 0);
    const elTotalVal = document.getElementById('metric-total-value');
    if (elTotalVal) elTotalVal.textContent = '$' + totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Dashboard Recent Inward Receipts Table
    const recentInwardTbody = document.getElementById('dash-recent-receipts');
    if (recentInwardTbody) {
      recentInwardTbody.innerHTML = receipts.slice(0, 4).map(r => `
        <tr>
          <td><span class="sku-code">${r.receiptNumber}</span></td>
          <td><strong>${r.supplier}</strong></td>
          <td>${r.items ? r.items.length : 0} items</td>
          <td><span class="badge ${r.status === 'Received' ? 'badge-received' : 'badge-pending'}">${r.status}</span></td>
          <td style="font-family: var(--font-mono); color: var(--emerald); font-weight: 600;">$${(r.totalAmount || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // Dashboard Recent Outbound Deliveries Table
    const recentDelTbody = document.getElementById('dash-recent-deliveries');
    if (recentDelTbody) {
      recentDelTbody.innerHTML = deliveries.slice(0, 4).map(d => `
        <tr>
          <td><span class="sku-code">${d.orderNumber}</span></td>
          <td><strong>${d.customerName}</strong></td>
          <td>${d.items ? d.items.length : 0} items</td>
          <td><span class="badge ${d.status === 'VALIDATED' ? 'badge-validated' : (d.status === 'PACKED' ? 'badge-packed' : (d.status === 'PICKED' ? 'badge-picked' : 'badge-draft'))}">${d.status}</span></td>
          <td style="font-family: var(--font-mono); color: var(--emerald); font-weight: 600;">$${(d.totalAmount || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // Dashboard Low Stock Critical Table
    const lowStockTbody = document.getElementById('dash-critical-stock');
    if (lowStockTbody) {
      if (lowStockItems.length === 0) {
        lowStockTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--emerald); padding: 1rem;">All product inventory levels are healthy!</td></tr>`;
      } else {
        lowStockTbody.innerHTML = lowStockItems.map(p => `
          <tr>
            <td>
              <strong>${p.name}</strong>
              <div style="font-size: 0.725rem; color: var(--text-dim);">${p.sku}</div>
            </td>
            <td><strong style="color: var(--rose);">${p.stock}</strong> / ${p.reorderLevel} ${p.unit}</td>
            <td><span class="badge badge-low-stock">Action Required</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="App.switchView('receipts'); Receipts.openCreateModalForProduct('${p.id}', '${p.warehouseId}', '${p.locationId}')">
                Reorder
              </button>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--emerald); flex-shrink: 0;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--rose); flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary); flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  bindGlobalEvents() {
    // Navigation items
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Close modals on overlay click or esc
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });

    // Search in ledger
    const searchLedger = document.getElementById('search-ledger');
    if (searchLedger) {
      searchLedger.addEventListener('input', () => Ledger.renderTable());
    }

    // Reset Demo Data
    const btnResetData = document.getElementById('btn-reset-demo-data');
    if (btnResetData) {
      btnResetData.addEventListener('click', () => {
        if (confirm('Reset StockSense database back to factory demo state?')) {
          DataStore.resetToDefaults();
          location.reload();
        }
      });
    }
  }
};

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
