// StockSense Receipts & Inward Stock Movement Module
const Receipts = {
  activeLineItems: [],

  init() {
    this.bindEvents();
    this.renderWarehouseOptions();
    this.renderTable();
  },

  getAll() {
    return DataStore.get(STORAGE_KEYS.RECEIPTS, []);
  },

  getById(id) {
    return this.getAll().find(r => r.id === id);
  },

  renderWarehouseOptions() {
    const warehouses = DataStore.get(STORAGE_KEYS.WAREHOUSES, []);
    const select = document.getElementById('receipt-warehouse');
    const locSelect = document.getElementById('receipt-location');

    if (select) {
      select.innerHTML = warehouses.map(w => `<option value="${w.id}">${w.name} (${w.code})</option>`).join('');
      
      const updateLocs = () => {
        const wh = warehouses.find(w => w.id === select.value);
        if (locSelect && wh && wh.locations) {
          locSelect.innerHTML = wh.locations.map(l => `<option value="${l.id}">${l.code} - ${l.name}</option>`).join('');
        }
      };

      select.onchange = updateLocs;
      updateLocs();
    }
  },

  openCreateModal() {
    document.getElementById('receipt-form').reset();
    document.getElementById('receipt-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('receipt-number').value = 'REC-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900);
    
    this.activeLineItems = [];
    this.addLineItem(); // Add one initial row
    this.renderWarehouseOptions();
    App.openModal('receipt-modal');
  },

  openCreateModalForProduct(productId, whId, locId) {
    this.openCreateModal();
    if (whId) {
      document.getElementById('receipt-warehouse').value = whId;
      document.getElementById('receipt-warehouse').dispatchEvent(new Event('change'));
    }
    if (locId) {
      document.getElementById('receipt-location').value = locId;
    }
    // Set first line item product
    setTimeout(() => {
      const prodSelect = document.querySelector('.line-item-prod');
      if (prodSelect) {
        prodSelect.value = productId;
        prodSelect.dispatchEvent(new Event('change'));
      }
    }, 50);
  },

  addLineItem() {
    const products = Products.getAll();
    if (products.length === 0) {
      App.showToast('No products available. Please create products first.', 'error');
      return;
    }

    const defaultProd = products[0];
    const newItem = {
      productId: defaultProd.id,
      productName: defaultProd.name,
      sku: defaultProd.sku,
      qtyOrdered: 10,
      qtyReceived: 10,
      unitCost: defaultProd.unitCost,
      lineTotal: 10 * defaultProd.unitCost
    };

    this.activeLineItems.push(newItem);
    this.renderLineItems();
  },

  removeLineItem(index) {
    if (this.activeLineItems.length <= 1) {
      App.showToast('A receipt must have at least one line item.', 'warning');
      return;
    }
    this.activeLineItems.splice(index, 1);
    this.renderLineItems();
  },

  updateLineItem(index, field, value) {
    const item = this.activeLineItems[index];
    if (!item) return;

    if (field === 'productId') {
      const prod = Products.getById(value);
      if (prod) {
        item.productId = prod.id;
        item.productName = prod.name;
        item.sku = prod.sku;
        item.unitCost = prod.unitCost;
      }
    } else if (field === 'qtyReceived') {
      item.qtyReceived = Math.max(1, parseInt(value, 10) || 1);
      item.qtyOrdered = item.qtyReceived;
    } else if (field === 'unitCost') {
      item.unitCost = Math.max(0, parseFloat(value) || 0);
    }

    item.lineTotal = item.qtyReceived * item.unitCost;
    this.renderLineItems();
  },

  renderLineItems() {
    const tbody = document.getElementById('receipt-line-items-body');
    if (!tbody) return;

    const products = Products.getAll();

    tbody.innerHTML = this.activeLineItems.map((item, idx) => {
      return `
        <tr>
          <td>
            <select class="form-select line-item-prod" onchange="Receipts.updateLineItem(${idx}, 'productId', this.value)">
              ${products.map(p => `<option value="${p.id}" ${p.id === item.productId ? 'selected' : ''}>${p.sku} - ${p.name}</option>`).join('')}
            </select>
          </td>
          <td style="width: 120px;">
            <input type="number" class="form-input" min="1" value="${item.qtyReceived}" onchange="Receipts.updateLineItem(${idx}, 'qtyReceived', this.value)">
          </td>
          <td style="width: 140px;">
            <input type="number" step="0.01" class="form-input" min="0" value="${item.unitCost}" onchange="Receipts.updateLineItem(${idx}, 'unitCost', this.value)">
          </td>
          <td class="line-total-cell" style="width: 120px;">
            $${item.lineTotal.toFixed(2)}
          </td>
          <td style="width: 40px; text-align: center;">
            <button type="button" class="btn-tbl-action delete" onclick="Receipts.removeLineItem(${idx})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Update Totals
    const totalQty = this.activeLineItems.reduce((acc, it) => acc + it.qtyReceived, 0);
    const totalAmt = this.activeLineItems.reduce((acc, it) => acc + it.lineTotal, 0);

    const qtyEl = document.getElementById('receipt-summary-qty');
    const amtEl = document.getElementById('receipt-summary-amt');
    if (qtyEl) qtyEl.textContent = totalQty.toLocaleString();
    if (amtEl) amtEl.textContent = '$' + totalAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  },

  saveReceipt(formData) {
    const receipts = this.getAll();
    const totalAmount = this.activeLineItems.reduce((acc, it) => acc + it.lineTotal, 0);

    const newReceipt = {
      id: 'rec-' + Date.now(),
      receiptNumber: formData.receiptNumber.trim(),
      supplier: formData.supplier.trim(),
      supplierRef: formData.supplierRef.trim() || 'N/A',
      warehouseId: formData.warehouseId,
      locationId: formData.locationId,
      receiptDate: formData.receiptDate,
      status: formData.status || 'Draft',
      notes: formData.notes || '',
      items: [...this.activeLineItems],
      totalAmount: totalAmount,
      receivedAt: formData.status === 'Received' ? new Date().toISOString() : null,
      receivedBy: formData.status === 'Received' ? (Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Warehouse Receiving Lead') : null
    };

    receipts.unshift(newReceipt);
    DataStore.set(STORAGE_KEYS.RECEIPTS, receipts);

    // If status is Received immediately upon creation, trigger automatic stock increase!
    if (newReceipt.status === 'Received') {
      this.processAutomaticStockIncrease(newReceipt);
    }

    this.renderTable();
    App.updateDashboardCounters();
    return newReceipt;
  },

  /**
   * CORE INVENTORY FEATURE: Automatic Stock Increase on Receipt Completion
   * When receipt is marked Received:
   * 1. Updates product stock counts in database
   * 2. Adjusts warehouse stock balances
   * 3. Appends audit log entries to Stock Ledger
   */
  processAutomaticStockIncrease(receipt) {
    const products = Products.getAll();
    const wh = Warehouses.getById(receipt.warehouseId);
    const loc = wh ? wh.locations.find(l => l.id === receipt.locationId) : null;
    let totalItemsAdded = 0;

    receipt.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.productId);
      if (prodIndex !== -1) {
        const oldStock = products[prodIndex].stock;
        const newStock = oldStock + item.qtyReceived;
        
        products[prodIndex].stock = newStock;
        // Optionally update warehouse location if unassigned
        if (!products[prodIndex].warehouseId) {
          products[prodIndex].warehouseId = receipt.warehouseId;
          products[prodIndex].locationId = receipt.locationId;
        }

        totalItemsAdded += item.qtyReceived;

        // Record into Stock Ledger
        Ledger.record({
          referenceNumber: receipt.receiptNumber,
          type: 'STOCK_IN',
          productId: products[prodIndex].id,
          productName: products[prodIndex].name,
          sku: products[prodIndex].sku,
          warehouse: wh ? wh.name : 'Unknown Hub',
          location: loc ? loc.code : 'Dock',
          quantityChange: +item.qtyReceived,
          balanceAfter: newStock,
          user: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Warehouse Receiving Lead',
          remarks: `Incoming stock from ${receipt.supplier} (PO: ${receipt.supplierRef})`
        });
      }
    });

    DataStore.set(STORAGE_KEYS.PRODUCTS, products);

    // Refresh UI modules
    Products.renderTable();
    Warehouses.renderWarehouses();
    Warehouses.renderLocationView();
    Ledger.renderTable();
    App.updateDashboardCounters();

    App.showToast(`Stock updated! +${totalItemsAdded} units automatically added to inventory.`, 'success');
  },

  markAsReceived(receiptId) {
    const receipts = this.getAll();
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    if (receipt.status === 'Received') {
      App.showToast('This receipt has already been processed and stocked in.', 'warning');
      return;
    }

    if (!confirm(`Mark receipt ${receipt.receiptNumber} as RECEIVED?\nThis will automatically increase stock levels for all products in this order.`)) {
      return;
    }

    receipt.status = 'Received';
    receipt.receivedAt = new Date().toISOString();
    receipt.receivedBy = Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Warehouse Receiving Lead';

    DataStore.set(STORAGE_KEYS.RECEIPTS, receipts);
    this.processAutomaticStockIncrease(receipt);
    this.renderTable();
  },

  renderTable() {
    const receipts = this.getAll();
    const tbody = document.getElementById('receipts-table-body');
    if (!tbody) return;

    const filterStatus = document.getElementById('filter-receipt-status')?.value || '';
    const searchVal = (document.getElementById('search-receipts')?.value || '').toLowerCase().trim();

    const filtered = receipts.filter(r => {
      const matchSearch = r.receiptNumber.toLowerCase().includes(searchVal) ||
                          r.supplier.toLowerCase().includes(searchVal) ||
                          (r.supplierRef && r.supplierRef.toLowerCase().includes(searchVal));
      const matchStatus = !filterStatus || r.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No receipts found matching your criteria.
          </td>
        </tr>
      `;
      return;
    }

    const warehouses = Warehouses.getAll();

    tbody.innerHTML = filtered.map(r => {
      const wh = warehouses.find(w => w.id === r.warehouseId);
      let badgeClass = 'badge-draft';
      if (r.status === 'Received') badgeClass = 'badge-received';
      else if (r.status === 'Pending Inspection') badgeClass = 'badge-pending';

      const itemCount = r.items ? r.items.length : 0;
      const totalQty = r.items ? r.items.reduce((s, i) => s + (i.qtyReceived || i.qtyOrdered || 0), 0) : 0;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-family: var(--font-mono);">${r.receiptNumber}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">PO Ref: ${r.supplierRef || 'N/A'}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${r.supplier}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${r.receiptDate}</div>
          </td>
          <td>
            <span style="font-size: 0.85rem; font-weight: 500;">${wh ? wh.code : 'Central'}</span>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${itemCount} product SKU(s)</div>
          </td>
          <td>
            <strong style="color: #fff;">${totalQty.toLocaleString()} units</strong>
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-weight: 600; color: var(--emerald);">$${(r.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </td>
          <td>
            <span class="badge ${badgeClass}">${r.status}</span>
          </td>
          <td>
            <div class="table-actions">
              ${r.status !== 'Received' ? `
                <button class="btn btn-success btn-sm" onclick="Receipts.markAsReceived('${r.id}')" title="Accept & Increase Stock">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Receive Stock
                </button>
              ` : `
                <span style="font-size: 0.75rem; color: var(--emerald); font-weight: 600;">✓ Inward Complete</span>
              `}
              <button class="btn-tbl-action" onclick="Receipts.showSlipModal('${r.id}')" title="View Inward Slip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  showSlipModal(receiptId) {
    const r = this.getById(receiptId);
    if (!r) return;

    const wh = Warehouses.getById(r.warehouseId);
    const content = document.getElementById('slip-modal-content');
    if (!content) return;

    content.innerHTML = `
      <div class="receipt-slip-view">
        <div class="slip-header">
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; color: #fff;">STOCKSENSE</h3>
            <p style="font-size: 0.75rem; color: var(--text-dim);">Warehouse Inward Goods Receipt Note</p>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-mono); font-size: 1.15rem; font-weight: 800; color: var(--primary);">${r.receiptNumber}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Date: ${r.receiptDate}</div>
          </div>
        </div>

        <div class="slip-meta-grid">
          <div>
            <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Supplier / Vendor</div>
            <div style="font-size: 0.95rem; font-weight: 600; color: #fff; margin-top: 0.2rem;">${r.supplier}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Purchase Order: ${r.supplierRef || 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700;">Destination Facility</div>
            <div style="font-size: 0.95rem; font-weight: 600; color: #fff; margin-top: 0.2rem;">${wh ? wh.name : 'Central Warehouse'} (${wh ? wh.code : 'WH-01'})</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${wh ? wh.city : ''}</div>
          </div>
        </div>

        <table class="data-table" style="margin: 1.5rem 0;">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Qty Inward</th>
              <th>Unit Cost</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${r.items.map(item => `
              <tr>
                <td><span class="sku-code">${item.sku}</span></td>
                <td><strong>${item.productName}</strong></td>
                <td>${item.qtyReceived} units</td>
                <td>$${item.unitCost.toFixed(2)}</td>
                <td style="font-family: var(--font-mono); font-weight: 600; color: var(--emerald);">$${item.lineTotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; border-top: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Status: <strong style="color: #fff;">${r.status.toUpperCase()}</strong></div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Received By: <strong style="color: #fff;">${r.receivedBy || 'Warehouse Receiving Staff'}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Total Inward Valuation</div>
            <div style="font-size: 1.5rem; font-weight: 800; font-family: var(--font-mono); color: var(--emerald);">$${r.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>
      </div>
    `;

    App.openModal('slip-modal');
  },

  bindEvents() {
    const form = document.getElementById('receipt-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          receiptNumber: document.getElementById('receipt-number').value,
          supplier: document.getElementById('receipt-supplier').value,
          supplierRef: document.getElementById('receipt-ref').value,
          warehouseId: document.getElementById('receipt-warehouse').value,
          locationId: document.getElementById('receipt-location').value,
          receiptDate: document.getElementById('receipt-date').value,
          status: document.getElementById('receipt-status').value,
          notes: document.getElementById('receipt-notes').value
        };

        try {
          this.saveReceipt(data);
          App.closeModal('receipt-modal');
          App.showToast('Receipt registered successfully!', 'success');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // Add item button
    const btnAddItem = document.getElementById('btn-add-line-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => this.addLineItem());
    }

    // Filters
    const search = document.getElementById('search-receipts');
    if (search) {
      search.addEventListener('input', () => this.renderTable());
    }

    const filterStatus = document.getElementById('filter-receipt-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', () => this.renderTable());
    }
  }
};
