// StockSense Warehouse Management Module
const Warehouses = {
  selectedWarehouseId: 'wh-blr-01',
  selectedLocationId: 'all',

  init() {
    this.bindEvents();
    this.renderWarehouses();
    this.renderLocationView();
  },

  getAll() {
    return DataStore.get(STORAGE_KEYS.WAREHOUSES, []);
  },

  getById(id) {
    return this.getAll().find(w => w.id === id);
  },

  saveWarehouse(warehouseData) {
    const warehouses = this.getAll();
    const isNew = !warehouseData.id;

    if (isNew) {
      if (warehouses.some(w => w.code.toUpperCase() === warehouseData.code.toUpperCase())) {
        throw new Error(`Warehouse Code "${warehouseData.code}" already exists.`);
      }

      const newWh = {
        id: 'wh-' + Date.now(),
        code: warehouseData.code.toUpperCase().trim(),
        name: warehouseData.name.trim(),
        city: warehouseData.city.trim(),
        address: warehouseData.address || '',
        manager: warehouseData.manager || (Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'Warehouse Admin'),
        capacityTotal: parseInt(warehouseData.capacityTotal, 10) || 5000,
        type: warehouseData.type || 'Standard Warehouse',
        locations: [
          { id: 'loc-' + Date.now() + '-1', code: 'MAIN-A1', name: 'Main Receiving Rack A1', capacity: 2500 },
          { id: 'loc-' + Date.now() + '-2', code: 'MAIN-B1', name: 'Storage Bay B1', capacity: 2500 }
        ]
      };

      warehouses.push(newWh);
      this.selectedWarehouseId = newWh.id;
    } else {
      const idx = warehouses.findIndex(w => w.id === warehouseData.id);
      if (idx === -1) throw new Error('Warehouse not found.');

      warehouses[idx] = {
        ...warehouses[idx],
        name: warehouseData.name.trim(),
        city: warehouseData.city.trim(),
        address: warehouseData.address || '',
        manager: warehouseData.manager,
        capacityTotal: parseInt(warehouseData.capacityTotal, 10) || warehouses[idx].capacityTotal
      };
    }

    DataStore.set(STORAGE_KEYS.WAREHOUSES, warehouses);
    this.renderWarehouses();
    this.renderLocationView();
    App.updateDashboardCounters();
    Products.renderWarehouseSelectOptions();
    Receipts.renderWarehouseOptions();
    return true;
  },

  addLocationToWarehouse(whId, locationData) {
    const warehouses = this.getAll();
    const wh = warehouses.find(w => w.id === whId);
    if (!wh) throw new Error('Warehouse not found.');

    if (wh.locations.some(l => l.code.toUpperCase() === locationData.code.toUpperCase())) {
      throw new Error(`Location code "${locationData.code}" already exists in this warehouse.`);
    }

    const newLoc = {
      id: 'loc-' + Date.now(),
      code: locationData.code.toUpperCase().trim(),
      name: locationData.name.trim(),
      capacity: parseInt(locationData.capacity, 10) || 1000
    };

    wh.locations.push(newLoc);
    DataStore.set(STORAGE_KEYS.WAREHOUSES, warehouses);
    this.renderLocationView();
    Products.renderWarehouseSelectOptions();
    Receipts.renderWarehouseOptions();
    App.showToast(`Location "${newLoc.code}" added to ${wh.name}`, 'success');
  },

  selectWarehouse(whId) {
    this.selectedWarehouseId = whId;
    this.selectedLocationId = 'all';
    this.renderWarehouses();
    this.renderLocationView();
  },

  selectLocation(locId) {
    this.selectedLocationId = locId;
    this.renderLocationChips();
    this.renderStockByLocationTable();
  },

  // Calculate current stock utilization
  getWarehouseStockUsage(whId) {
    const products = Products.getAll();
    const whProducts = products.filter(p => p.warehouseId === whId);
    return whProducts.reduce((sum, p) => sum + p.stock, 0);
  },

  renderWarehouses() {
    const warehouses = this.getAll();
    const grid = document.getElementById('warehouses-grid');
    if (!grid) return;

    grid.innerHTML = warehouses.map(w => {
      const isSelected = w.id === this.selectedWarehouseId;
      const currentStock = this.getWarehouseStockUsage(w.id);
      const capPercent = Math.min(100, Math.round((currentStock / (w.capacityTotal || 1)) * 100));

      return `
        <div class="warehouse-card ${isSelected ? 'active' : ''}" onclick="Warehouses.selectWarehouse('${w.id}')">
          <div class="warehouse-card-header">
            <div>
              <span class="warehouse-code-badge">${w.code}</span>
              <div class="warehouse-title" style="margin-top: 0.4rem;">${w.name}</div>
              <div class="warehouse-city">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${w.city}
              </div>
            </div>
            <div style="text-align: right;">
              <span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.7rem;">
                ${w.locations ? w.locations.length : 0} Zones
              </span>
            </div>
          </div>

          <div class="capacity-container">
            <div class="capacity-stats">
              <span style="color: var(--text-muted);">Occupancy Utilization</span>
              <strong style="color: ${capPercent > 80 ? 'var(--amber)' : 'var(--cyan)'}; font-family: var(--font-mono);">${capPercent}%</strong>
            </div>
            <div class="capacity-bar-track">
              <div class="capacity-bar-fill" style="width: ${capPercent}%; ${capPercent > 85 ? 'background: linear-gradient(90deg, #f59e0b, #ef4444);' : ''}"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-dim); margin-top: 0.35rem;">
              <span>${currentStock.toLocaleString()} units stored</span>
              <span>Cap: ${w.capacityTotal.toLocaleString()}</span>
            </div>
          </div>

          <div class="warehouse-card-footer">
            <span>Mgr: <strong style="color: var(--text-main);">${w.manager}</strong></span>
            <span style="color: var(--primary); font-weight: 600; font-size: 0.75rem;">
              ${isSelected ? 'Active Selection ✓' : 'Click to View Stock →'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderLocationView() {
    const wh = this.getById(this.selectedWarehouseId);
    if (!wh) return;

    const titleEl = document.getElementById('selected-wh-name');
    const codeEl = document.getElementById('selected-wh-code');
    const addrEl = document.getElementById('selected-wh-address');

    if (titleEl) titleEl.textContent = wh.name;
    if (codeEl) codeEl.textContent = wh.code;
    if (addrEl) addrEl.textContent = `${wh.address}, ${wh.city}`;

    this.renderLocationChips();
    this.renderStockByLocationTable();
  },

  renderLocationChips() {
    const wh = this.getById(this.selectedWarehouseId);
    const chipContainer = document.getElementById('location-chips');
    if (!chipContainer || !wh) return;

    let html = `
      <div class="location-chip ${this.selectedLocationId === 'all' ? 'active' : ''}" onclick="Warehouses.selectLocation('all')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span>All Locations in ${wh.code}</span>
      </div>
    `;

    (wh.locations || []).forEach(loc => {
      const isAct = this.selectedLocationId === loc.id;
      html += `
        <div class="location-chip ${isAct ? 'active' : ''}" onclick="Warehouses.selectLocation('${loc.id}')">
          <span class="location-chip-badge">${loc.code}</span>
          <span>${loc.name}</span>
        </div>
      `;
    });

    chipContainer.innerHTML = html;
  },

  renderStockByLocationTable() {
    const tableBody = document.getElementById('stock-location-table-body');
    if (!tableBody) return;

    const wh = this.getById(this.selectedWarehouseId);
    if (!wh) return;

    const allProducts = Products.getAll();
    let whProducts = allProducts.filter(p => p.warehouseId === this.selectedWarehouseId);

    if (this.selectedLocationId !== 'all') {
      whProducts = whProducts.filter(p => p.locationId === this.selectedLocationId);
    }

    if (whProducts.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No stock currently residing in this location zone.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = whProducts.map(p => {
      const loc = wh.locations.find(l => l.id === p.locationId);
      const inventoryVal = (p.stock * p.unitCost).toFixed(2);

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #fff;">${p.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${p.category}</div>
          </td>
          <td>
            <span class="sku-code">${p.sku}</span>
          </td>
          <td>
            <span class="location-chip-badge" style="font-size: 0.8rem;">${loc ? loc.code : 'General Bay'}</span>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${loc ? loc.name : ''}</div>
          </td>
          <td>
            <strong style="font-size: 0.95rem; color: #fff;">${p.stock.toLocaleString()}</strong> ${p.unit}
          </td>
          <td>
            <div style="font-size: 0.85rem; font-family: var(--font-mono); color: var(--emerald); font-weight: 600;">$${parseFloat(inventoryVal).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <div style="font-size: 0.7rem; color: var(--text-dim);">$${p.unitCost.toFixed(2)}/unit</div>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="Receipts.openCreateModalForProduct('${p.id}', '${wh.id}', '${p.locationId}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Receive Stock
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddModal() {
    document.getElementById('warehouse-form').reset();
    document.getElementById('wh-id').value = '';
    document.getElementById('warehouse-modal-title').textContent = 'Add New Warehouse Facility';
    App.openModal('warehouse-modal');
  },

  openAddLocationModal() {
    const wh = this.getById(this.selectedWarehouseId);
    if (!wh) return;

    document.getElementById('location-form').reset();
    document.getElementById('loc-wh-title').textContent = `${wh.name} (${wh.code})`;
    App.openModal('location-modal');
  },

  bindEvents() {
    // Warehouse form submit
    const form = document.getElementById('warehouse-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          id: document.getElementById('wh-id').value || null,
          code: document.getElementById('wh-code').value,
          name: document.getElementById('wh-name').value,
          city: document.getElementById('wh-city').value,
          address: document.getElementById('wh-address').value,
          capacityTotal: document.getElementById('wh-capacity').value,
          manager: document.getElementById('wh-manager').value
        };

        try {
          this.saveWarehouse(data);
          App.closeModal('warehouse-modal');
          App.showToast(`Warehouse facility saved successfully!`, 'success');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // Location form submit
    const locForm = document.getElementById('location-form');
    if (locForm) {
      locForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const locData = {
          code: document.getElementById('loc-code').value,
          name: document.getElementById('loc-name').value,
          capacity: document.getElementById('loc-capacity').value
        };

        try {
          this.addLocationToWarehouse(this.selectedWarehouseId, locData);
          App.closeModal('location-modal');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }
  }
};
