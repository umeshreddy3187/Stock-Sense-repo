// StockSense Outbound Fulfillment: Delivery Orders Module
const Deliveries = {
  activeLineItems: [],

  init() {
    this.bindEvents();
    this.renderTable();
  },

  getAll() {
    return DataStore.get(STORAGE_KEYS.DELIVERIES, []);
  },

  getById(id) {
    return this.getAll().find(d => d.id === id);
  },

  openCreateModal() {
    document.getElementById('delivery-form').reset();
    document.getElementById('del-number').value = 'DO-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    this.activeLineItems = [];
    this.addLineItem();
    App.openModal('delivery-modal');
  },

  addLineItem() {
    const products = Products.getAll();
    if (products.length === 0) {
      App.showToast('No products available for delivery.', 'error');
      return;
    }

    const availableProd = products.find(p => p.stock > 0) || products[0];
    this.activeLineItems.push({
      productId: availableProd.id,
      productName: availableProd.name,
      sku: availableProd.sku,
      requestedQuantity: Math.min(5, availableProd.stock || 1),
      pickedQuantity: 0,
      packedQuantity: 0,
      unitPrice: availableProd.unitPrice || availableProd.unitCost * 1.5,
      availableStock: availableProd.stock
    });

    this.renderLineItems();
  },

  removeLineItem(idx) {
    if (this.activeLineItems.length <= 1) {
      App.showToast('A delivery order must have at least one line item.', 'warning');
      return;
    }
    this.activeLineItems.splice(idx, 1);
    this.renderLineItems();
  },

  updateLineItem(idx, field, value) {
    const item = this.activeLineItems[idx];
    if (!item) return;

    if (field === 'productId') {
      const prod = Products.getById(value);
      if (prod) {
        item.productId = prod.id;
        item.productName = prod.name;
        item.sku = prod.sku;
        item.availableStock = prod.stock;
        item.unitPrice = prod.unitPrice || prod.unitCost * 1.5;
        if (item.requestedQuantity > prod.stock) {
          item.requestedQuantity = Math.max(1, prod.stock);
        }
      }
    } else if (field === 'requestedQuantity') {
      const qty = parseInt(value, 10) || 1;
      const prod = Products.getById(item.productId);
      if (prod && qty > prod.stock) {
        App.showToast(`Warning: Requested quantity (${qty}) exceeds available stock (${prod.stock})`, 'warning');
        item.requestedQuantity = prod.stock;
      } else {
        item.requestedQuantity = Math.max(1, qty);
      }
    }

    this.renderLineItems();
  },

  renderLineItems() {
    const tbody = document.getElementById('delivery-line-items-body');
    if (!tbody) return;

    const products = Products.getAll();

    tbody.innerHTML = this.activeLineItems.map((item, idx) => {
      const lineTotal = item.requestedQuantity * item.unitPrice;
      const isStockLow = item.requestedQuantity > item.availableStock;

      return `
        <tr>
          <td>
            <select class="form-select" onchange="Deliveries.updateLineItem(${idx}, 'productId', this.value)">
              ${products.map(p => `
                <option value="${p.id}" ${p.id === item.productId ? 'selected' : ''}>
                  ${p.sku} - ${p.name} (Stock: ${p.stock} ${p.unit})
                </option>
              `).join('')}
            </select>
          </td>
          <td style="width: 140px;">
            <input type="number" class="form-input" min="1" max="${item.availableStock}" value="${item.requestedQuantity}" onchange="Deliveries.updateLineItem(${idx}, 'requestedQuantity', this.value)">
            ${isStockLow ? `<div style="font-size: 0.7rem; color: var(--rose);">Max: ${item.availableStock}</div>` : ''}
          </td>
          <td style="width: 120px; font-family: var(--font-mono); color: var(--text-muted);">
            $${item.unitPrice.toFixed(2)}
          </td>
          <td class="line-total-cell" style="width: 120px;">
            $${lineTotal.toFixed(2)}
          </td>
          <td style="width: 40px; text-align: center;">
            <button type="button" class="btn-tbl-action delete" onclick="Deliveries.removeLineItem(${idx})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const totalQty = this.activeLineItems.reduce((acc, it) => acc + it.requestedQuantity, 0);
    const totalAmt = this.activeLineItems.reduce((acc, it) => acc + (it.requestedQuantity * it.unitPrice), 0);

    const qtyEl = document.getElementById('del-summary-qty');
    const amtEl = document.getElementById('del-summary-amt');
    if (qtyEl) qtyEl.textContent = totalQty.toLocaleString();
    if (amtEl) amtEl.textContent = '$' + totalAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  },

  saveDelivery(formData) {
    const deliveries = this.getAll();
    const products = Products.getAll();

    // Verify stock availability
    for (const item of this.activeLineItems) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod || prod.stock < item.requestedQuantity) {
        throw new Error(`Insufficient stock for "${item.productName}". Available: ${prod ? prod.stock : 0}, Requested: ${item.requestedQuantity}`);
      }
    }

    const totalAmount = this.activeLineItems.reduce((acc, it) => acc + (it.requestedQuantity * it.unitPrice), 0);

    const newDelivery = {
      id: 'del-' + Date.now(),
      orderNumber: formData.orderNumber.trim(),
      customerName: formData.customerName.trim(),
      destinationAddress: formData.destinationAddress.trim(),
      warehouseId: formData.warehouseId || 'wh-blr-01',
      status: 'DRAFT',
      notes: formData.notes || '',
      items: [...this.activeLineItems],
      totalAmount: totalAmount,
      createdAt: new Date().toISOString().split('T')[0],
      validatedAt: null
    };

    deliveries.unshift(newDelivery);
    DataStore.set(STORAGE_KEYS.DELIVERIES, deliveries);
    this.renderTable();
    App.updateDashboardCounters();
    App.showToast(`Delivery Order "${newDelivery.orderNumber}" created in DRAFT stage.`, 'success');
    return newDelivery;
  },

  advanceStage(id, targetStage) {
    const deliveries = this.getAll();
    const del = deliveries.find(d => d.id === id);
    if (!del) return;

    if (targetStage === 'PICKED') {
      del.status = 'PICKED';
      del.items.forEach(it => it.pickedQuantity = it.requestedQuantity);
      App.showToast(`Order ${del.orderNumber} items picked from warehouse bins!`, 'info');
    } else if (targetStage === 'PACKED') {
      del.status = 'PACKED';
      del.items.forEach(it => it.packedQuantity = it.requestedQuantity);
      App.showToast(`Order ${del.orderNumber} packed and verified for dispatch!`, 'info');
    } else if (targetStage === 'VALIDATED') {
      // Deduct stock and commit to stock ledger
      this.validateAndDeductStock(del);
    }

    DataStore.set(STORAGE_KEYS.DELIVERIES, deliveries);
    this.renderTable();
    App.updateDashboardCounters();
  },

  validateAndDeductStock(del) {
    const products = Products.getAll();
    const wh = Warehouses.getById(del.warehouseId);
    let totalDeducted = 0;

    for (const item of del.items) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) continue;

      if (prod.stock < item.requestedQuantity) {
        throw new Error(`Cannot validate: stock has dropped below requested quantity for ${prod.name}! Available: ${prod.stock}`);
      }

      const beforeStock = prod.stock;
      prod.stock -= item.requestedQuantity;
      totalDeducted += item.requestedQuantity;

      // Immutable Stock Ledger Record
      Ledger.record({
        referenceNumber: del.orderNumber,
        type: 'STOCK_OUT',
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        warehouse: wh ? wh.name : 'Central Warehouse',
        location: prod.locationId || 'Dispatch Bay',
        quantityChange: -item.requestedQuantity,
        balanceAfter: prod.stock,
        user: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Fulfillment Operations Lead',
        remarks: `Outbound delivery order fulfillment for ${del.customerName}`
      });
    }

    del.status = 'VALIDATED';
    del.validatedAt = new Date().toISOString();

    DataStore.set(STORAGE_KEYS.PRODUCTS, products);
    Products.renderTable();
    Warehouses.renderWarehouses();
    Warehouses.renderLocationView();
    Ledger.renderTable();

    App.showToast(`Order ${del.orderNumber} VALIDATED! -${totalDeducted} units dispatched and stock updated.`, 'success');
  },

  renderTable() {
    const deliveries = this.getAll();
    const tbody = document.getElementById('deliveries-table-body');
    if (!tbody) return;

    const filterStatus = document.getElementById('filter-delivery-status')?.value || '';
    const searchVal = (document.getElementById('search-deliveries')?.value || '').toLowerCase().trim();

    const filtered = deliveries.filter(d => {
      const matchSearch = d.orderNumber.toLowerCase().includes(searchVal) ||
                          d.customerName.toLowerCase().includes(searchVal) ||
                          d.destinationAddress.toLowerCase().includes(searchVal);
      const matchStatus = !filterStatus || d.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No delivery orders found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      let badgeClass = 'badge-draft';
      if (d.status === 'PICKED') badgeClass = 'badge-picked';
      else if (d.status === 'PACKED') badgeClass = 'badge-packed';
      else if (d.status === 'VALIDATED') badgeClass = 'badge-validated';

      const totalUnits = d.items ? d.items.reduce((s, i) => s + (i.requestedQuantity || 0), 0) : 0;

      // Action button based on stage progression
      let actionBtn = '';
      if (d.status === 'DRAFT') {
        actionBtn = `
          <button class="btn btn-secondary btn-sm" onclick="Deliveries.advanceStage('${d.id}', 'PICKED')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            Pick Items
          </button>
        `;
      } else if (d.status === 'PICKED') {
        actionBtn = `
          <button class="btn btn-secondary btn-sm" style="border-color: #fbbf24; color: #fbbf24;" onclick="Deliveries.advanceStage('${d.id}', 'PACKED')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
            Pack Box
          </button>
        `;
      } else if (d.status === 'PACKED') {
        actionBtn = `
          <button class="btn btn-success btn-sm" onclick="Deliveries.advanceStage('${d.id}', 'VALIDATED')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Validate & Deduct
          </button>
        `;
      } else {
        actionBtn = `<span style="color: var(--emerald); font-size: 0.75rem; font-weight: 600;">✓ Dispatched</span>`;
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-family: var(--font-mono);">${d.orderNumber}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${d.createdAt}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${d.customerName}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${d.destinationAddress}</div>
          </td>
          <td>
            <strong>${totalUnits} units</strong>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${d.items.length} product(s)</div>
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--emerald);">$${(d.totalAmount || 0).toFixed(2)}</span>
          </td>
          <td>
            <span class="badge ${badgeClass}">${d.status}</span>
          </td>
          <td>
            <div class="stage-stepper">
              <span class="stage-step ${d.status === 'DRAFT' ? 'active' : 'done'}">Draft</span>
              <span class="stage-arrow">&rarr;</span>
              <span class="stage-step ${d.status === 'PICKED' ? 'active' : (d.status === 'PACKED' || d.status === 'VALIDATED' ? 'done' : '')}">Pick</span>
              <span class="stage-arrow">&rarr;</span>
              <span class="stage-step ${d.status === 'PACKED' ? 'active' : (d.status === 'VALIDATED' ? 'done' : '')}">Pack</span>
              <span class="stage-arrow">&rarr;</span>
              <span class="stage-step ${d.status === 'VALIDATED' ? 'done' : ''}">Validate</span>
            </div>
          </td>
          <td>
            <div class="table-actions">
              ${actionBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  bindEvents() {
    const form = document.getElementById('delivery-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          orderNumber: document.getElementById('del-number').value,
          customerName: document.getElementById('del-customer').value,
          destinationAddress: document.getElementById('del-address').value,
          warehouseId: document.getElementById('del-warehouse').value,
          notes: document.getElementById('del-notes').value
        };

        try {
          this.saveDelivery(data);
          App.closeModal('delivery-modal');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    const btnAddItem = document.getElementById('btn-add-del-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => this.addLineItem());
    }

    const searchInput = document.getElementById('search-deliveries');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }

    const filterStatus = document.getElementById('filter-delivery-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', () => this.renderTable());
    }
  }
};
