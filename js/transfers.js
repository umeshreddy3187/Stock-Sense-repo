// StockSense Internal Transfers Module
const Transfers = {
  activeLineItems: [],

  init() {
    this.bindEvents();
    this.renderWarehouseSelects();
    this.renderTable();
  },

  getAll() {
    return DataStore.get(STORAGE_KEYS.TRANSFERS, []);
  },

  getById(id) {
    return this.getAll().find(t => t.id === id);
  },

  renderWarehouseSelects() {
    const warehouses = Warehouses.getAll();
    const sourceSelect = document.getElementById('transfer-source-wh');
    const destSelect = document.getElementById('transfer-dest-wh');

    if (sourceSelect && destSelect) {
      sourceSelect.innerHTML = warehouses.map(w => `<option value="${w.id}">${w.name} (${w.code})</option>`).join('');
      destSelect.innerHTML = warehouses.map((w, i) => `<option value="${w.id}" ${i === 1 ? 'selected' : ''}>${w.name} (${w.code})</option>`).join('');
    }
  },

  openCreateModal() {
    document.getElementById('transfer-form').reset();
    document.getElementById('transfer-number').value = 'TRF-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    this.renderWarehouseSelects();
    this.activeLineItems = [];
    this.addLineItem();
    App.openModal('transfer-modal');
  },

  addLineItem() {
    const products = Products.getAll();
    if (products.length === 0) return;

    const prod = products[0];
    this.activeLineItems.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      quantity: 5
    });

    this.renderLineItems();
  },

  removeLineItem(idx) {
    if (this.activeLineItems.length <= 1) {
      App.showToast('Transfer requires at least one product item.', 'warning');
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
      }
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, parseInt(value, 10) || 1);
    }

    this.renderLineItems();
  },

  renderLineItems() {
    const tbody = document.getElementById('transfer-line-items-body');
    if (!tbody) return;

    const products = Products.getAll();

    tbody.innerHTML = this.activeLineItems.map((item, idx) => {
      return `
        <tr>
          <td>
            <select class="form-select" onchange="Transfers.updateLineItem(${idx}, 'productId', this.value)">
              ${products.map(p => `
                <option value="${p.id}" ${p.id === item.productId ? 'selected' : ''}>
                  ${p.sku} - ${p.name} (Stock: ${p.stock})
                </option>
              `).join('')}
            </select>
          </td>
          <td style="width: 140px;">
            <input type="number" class="form-input" min="1" value="${item.quantity}" onchange="Transfers.updateLineItem(${idx}, 'quantity', this.value)">
          </td>
          <td style="width: 40px; text-align: center;">
            <button type="button" class="btn-tbl-action delete" onclick="Transfers.removeLineItem(${idx})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  saveTransfer(formData) {
    if (formData.sourceWarehouseId === formData.destWarehouseId) {
      throw new Error('Source warehouse and destination warehouse cannot be the same facility.');
    }

    const transfers = this.getAll();
    const sourceWh = Warehouses.getById(formData.sourceWarehouseId);
    const destWh = Warehouses.getById(formData.destWarehouseId);

    const newTransfer = {
      id: 'trf-' + Date.now(),
      transferNumber: formData.transferNumber.trim(),
      sourceWarehouseId: formData.sourceWarehouseId,
      sourceWarehouseName: sourceWh ? sourceWh.name : 'Source Hub',
      destWarehouseId: formData.destWarehouseId,
      destWarehouseName: destWh ? destWh.name : 'Destination Hub',
      status: 'DRAFT',
      notes: formData.notes || '',
      items: [...this.activeLineItems],
      createdAt: new Date().toISOString().split('T')[0],
      dispatchedAt: null,
      completedAt: null
    };

    transfers.unshift(newTransfer);
    DataStore.set(STORAGE_KEYS.TRANSFERS, transfers);
    this.renderTable();
    App.showToast(`Internal Transfer ${newTransfer.transferNumber} created in DRAFT stage.`, 'success');
    return newTransfer;
  },

  dispatchTransfer(id) {
    const transfers = this.getAll();
    const trf = transfers.find(t => t.id === id);
    if (!trf) return;

    trf.status = 'IN_TRANSIT';
    trf.dispatchedAt = new Date().toISOString();

    DataStore.set(STORAGE_KEYS.TRANSFERS, transfers);
    this.renderTable();
    App.showToast(`Transfer ${trf.transferNumber} DISPATCHED! Status is now IN_TRANSIT.`, 'info');
  },

  completeTransfer(id) {
    const transfers = this.getAll();
    const trf = transfers.find(t => t.id === id);
    if (!trf) return;

    trf.status = 'COMPLETED';
    trf.completedAt = new Date().toISOString();

    // Record transfer in Stock Ledger
    trf.items.forEach(it => {
      const prod = Products.getById(it.productId);
      if (prod) {
        Ledger.record({
          referenceNumber: trf.transferNumber,
          type: 'TRANSFER',
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          warehouse: `${trf.sourceWarehouseName} → ${trf.destWarehouseName}`,
          location: 'Inter-Facility Relocation',
          quantityChange: 0,
          balanceAfter: prod.stock,
          user: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Logistics Coordinator',
          remarks: `Internal stock transfer of ${it.quantity} units from ${trf.sourceWarehouseName} to ${trf.destWarehouseName}`
        });
      }
    });

    DataStore.set(STORAGE_KEYS.TRANSFERS, transfers);
    this.renderTable();
    Warehouses.renderWarehouses();
    Warehouses.renderLocationView();
    Ledger.renderTable();
    App.showToast(`Transfer ${trf.transferNumber} COMPLETED and verified at destination!`, 'success');
  },

  renderTable() {
    const transfers = this.getAll();
    const tbody = document.getElementById('transfers-table-body');
    if (!tbody) return;

    const filterStatus = document.getElementById('filter-transfer-status')?.value || '';
    const searchVal = (document.getElementById('search-transfers')?.value || '').toLowerCase().trim();

    const filtered = transfers.filter(t => {
      const matchSearch = t.transferNumber.toLowerCase().includes(searchVal) ||
                          t.sourceWarehouseName.toLowerCase().includes(searchVal) ||
                          t.destWarehouseName.toLowerCase().includes(searchVal);
      const matchStatus = !filterStatus || t.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No internal transfers found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(t => {
      let badgeClass = 'badge-draft';
      if (t.status === 'IN_TRANSIT') badgeClass = 'badge-in-transit';
      else if (t.status === 'COMPLETED') badgeClass = 'badge-completed';

      let actionBtn = '';
      if (t.status === 'DRAFT') {
        actionBtn = `
          <button class="btn btn-secondary btn-sm" onclick="Transfers.dispatchTransfer('${t.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Dispatch In-Transit
          </button>
        `;
      } else if (t.status === 'IN_TRANSIT') {
        actionBtn = `
          <button class="btn btn-success btn-sm" onclick="Transfers.completeTransfer('${t.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Complete Transfer
          </button>
        `;
      } else {
        actionBtn = `<span style="color: var(--emerald); font-size: 0.75rem; font-weight: 600;">✓ Delivered</span>`;
      }

      const totalQty = t.items.reduce((s, i) => s + (i.quantity || 0), 0);

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-family: var(--font-mono);">${t.transferNumber}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${t.createdAt}</div>
          </td>
          <td>
            <div class="transfer-route-box" style="margin: 0; padding: 0.4rem 0.6rem;">
              <div class="route-node">
                <span class="route-node-title">From</span>
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff;">${t.sourceWarehouseName}</div>
              </div>
              <div class="route-arrow-icon">&rarr;</div>
              <div class="route-node">
                <span class="route-node-title">To</span>
                <div style="font-size: 0.8rem; font-weight: 600; color: #fff;">${t.destWarehouseName}</div>
              </div>
            </div>
          </td>
          <td>
            <strong>${totalQty} units</strong>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${t.items.map(i => `${i.sku} (${i.quantity})`).join(', ')}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}">${t.status}</span>
          </td>
          <td>
            <div style="font-size: 0.775rem; color: var(--text-dim);">${t.notes || 'Routine stock rebalance'}</div>
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
    const form = document.getElementById('transfer-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          transferNumber: document.getElementById('transfer-number').value,
          sourceWarehouseId: document.getElementById('transfer-source-wh').value,
          destWarehouseId: document.getElementById('transfer-dest-wh').value,
          notes: document.getElementById('transfer-notes').value
        };

        try {
          this.saveTransfer(data);
          App.closeModal('transfer-modal');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    const btnAddItem = document.getElementById('btn-add-transfer-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => this.addLineItem());
    }

    const searchInput = document.getElementById('search-transfers');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }

    const filterStatus = document.getElementById('filter-transfer-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', () => this.renderTable());
    }
  }
};
