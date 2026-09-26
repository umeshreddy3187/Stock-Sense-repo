// StockSense Inventory Adjustments Module
const Adjustments = {
  init() {
    this.bindEvents();
    this.renderProductSelect();
    this.renderWarehouseSelect();
    this.renderTable();
  },

  getAll() {
    return DataStore.get(STORAGE_KEYS.ADJUSTMENTS, []);
  },

  renderProductSelect() {
    const products = Products.getAll();
    const select = document.getElementById('adj-product');
    if (!select) return;

    select.innerHTML = products.map(p => `
      <option value="${p.id}" data-stock="${p.stock}">
        ${p.sku} - ${p.name} (Current System Stock: ${p.stock} ${p.unit})
      </option>
    `).join('');

    const onProductChange = () => {
      const selectedOption = select.options[select.selectedIndex];
      const stock = selectedOption ? parseInt(selectedOption.getAttribute('data-stock'), 10) : 0;
      const sysQtyEl = document.getElementById('adj-system-qty');
      const countedInput = document.getElementById('adj-counted-qty');
      if (sysQtyEl) sysQtyEl.value = stock;
      if (countedInput) {
        countedInput.value = stock;
        this.calculateVariance();
      }
    };

    select.onchange = onProductChange;
    onProductChange();
  },

  renderWarehouseSelect() {
    const warehouses = Warehouses.getAll();
    const select = document.getElementById('adj-warehouse');
    if (select) {
      select.innerHTML = warehouses.map(w => `<option value="${w.id}">${w.name} (${w.code})</option>`).join('');
    }
  },

  calculateVariance() {
    const sysQty = parseInt(document.getElementById('adj-system-qty')?.value, 10) || 0;
    const countedQty = parseInt(document.getElementById('adj-counted-qty')?.value, 10) || 0;
    const variance = countedQty - sysQty;
    const varEl = document.getElementById('adj-variance-display');

    if (varEl) {
      if (variance > 0) {
        varEl.className = 'variance-positive';
        varEl.textContent = `+${variance} (Surplus Gain)`;
      } else if (variance < 0) {
        varEl.className = 'variance-negative';
        varEl.textContent = `${variance} (Shrinkage / Discrepancy)`;
      } else {
        varEl.className = 'variance-zero';
        varEl.textContent = `0 (Exact Match)`;
      }
    }
  },

  openCreateModal() {
    document.getElementById('adjustment-form').reset();
    document.getElementById('adj-number').value = 'ADJ-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    this.renderProductSelect();
    this.renderWarehouseSelect();
    this.calculateVariance();
    App.openModal('adjustment-modal');
  },

  saveAdjustment(formData) {
    const adjustments = this.getAll();
    const products = Products.getAll();
    const prod = products.find(p => p.id === formData.productId);
    if (!prod) throw new Error('Product not found.');

    const wh = Warehouses.getById(formData.warehouseId);
    const systemQty = prod.stock;
    const countedQty = Math.max(0, parseInt(formData.countedQuantity, 10) || 0);
    const variance = countedQty - systemQty;

    const newAdj = {
      id: 'adj-' + Date.now(),
      adjustmentNumber: formData.adjustmentNumber.trim(),
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      warehouseId: formData.warehouseId,
      warehouseName: wh ? wh.name : 'Central Warehouse',
      systemQuantity: systemQty,
      countedQuantity: countedQty,
      variance: variance,
      reason: formData.reason.trim(),
      status: 'APPLIED',
      createdAt: new Date().toISOString(),
      user: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Inventory Auditor'
    };

    // Update Product Stock to physical count
    prod.stock = countedQty;
    DataStore.set(STORAGE_KEYS.PRODUCTS, products);

    // Save adjustment record
    adjustments.unshift(newAdj);
    DataStore.set(STORAGE_KEYS.ADJUSTMENTS, adjustments);

    // Record in immutable Stock Ledger
    Ledger.record({
      referenceNumber: newAdj.adjustmentNumber,
      type: 'ADJUSTMENT',
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      warehouse: newAdj.warehouseName,
      location: 'Cycle Count Audit',
      quantityChange: variance,
      balanceAfter: countedQty,
      user: newAdj.user,
      remarks: `Stock reconciliation audit: ${newAdj.reason}`
    });

    // Refresh UI
    Products.renderTable();
    Warehouses.renderWarehouses();
    Warehouses.renderLocationView();
    Ledger.renderTable();
    this.renderTable();
    App.updateDashboardCounters();

    const sign = variance > 0 ? `+${variance}` : `${variance}`;
    App.showToast(`Adjustment applied: ${prod.name} stock updated to ${countedQty} (${sign} variance).`, 'success');
    return newAdj;
  },

  renderTable() {
    const adjustments = this.getAll();
    const tbody = document.getElementById('adjustments-table-body');
    if (!tbody) return;

    const searchVal = (document.getElementById('search-adjustments')?.value || '').toLowerCase().trim();

    const filtered = adjustments.filter(a => {
      return a.adjustmentNumber.toLowerCase().includes(searchVal) ||
             a.productName.toLowerCase().includes(searchVal) ||
             a.sku.toLowerCase().includes(searchVal) ||
             a.reason.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No stock adjustments recorded.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(a => {
      let varClass = 'variance-zero';
      let varText = '0';
      if (a.variance > 0) {
        varClass = 'variance-positive';
        varText = `+${a.variance}`;
      } else if (a.variance < 0) {
        varClass = 'variance-negative';
        varText = `${a.variance}`;
      }

      const dateStr = new Date(a.createdAt).toLocaleString();

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-family: var(--font-mono);">${a.adjustmentNumber}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${dateStr}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${a.productName}</div>
            <span class="sku-code">${a.sku}</span>
          </td>
          <td>
            <span style="font-size: 0.85rem;">${a.warehouseName}</span>
          </td>
          <td style="font-family: var(--font-mono); color: var(--text-muted);">
            ${a.systemQuantity}
          </td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: #fff;">
            ${a.countedQuantity}
          </td>
          <td>
            <span class="${varClass}">${varText}</span>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: var(--text-main);">${a.reason}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">Audited by: ${a.user}</div>
          </td>
        </tr>
      `;
    }).join('');
  },

  bindEvents() {
    const form = document.getElementById('adjustment-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          adjustmentNumber: document.getElementById('adj-number').value,
          productId: document.getElementById('adj-product').value,
          warehouseId: document.getElementById('adj-warehouse').value,
          countedQuantity: document.getElementById('adj-counted-qty').value,
          reason: document.getElementById('adj-reason').value
        };

        try {
          this.saveAdjustment(data);
          App.closeModal('adjustment-modal');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    const countedInput = document.getElementById('adj-counted-qty');
    if (countedInput) {
      countedInput.addEventListener('input', () => this.calculateVariance());
    }

    const searchInput = document.getElementById('search-adjustments');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }
  }
};
