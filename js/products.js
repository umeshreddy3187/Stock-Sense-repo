// StockSense Product Management Module
const Products = {
  currentEditId: null,

  init() {
    this.bindEvents();
    this.renderCategoryOptions();
    this.renderUnitOptions();
    this.renderWarehouseSelectOptions();
    this.renderTable();
  },

  getAll() {
    return DataStore.get(STORAGE_KEYS.PRODUCTS, []);
  },

  getById(id) {
    return this.getAll().find(p => p.id === id);
  },

  saveProduct(productData) {
    const products = this.getAll();
    const isNew = !productData.id;

    if (isNew) {
      // Validate SKU uniqueness
      if (products.some(p => p.sku.toUpperCase() === productData.sku.toUpperCase())) {
        throw new Error(`SKU "${productData.sku}" is already in use by another product.`);
      }

      const newProduct = {
        id: 'prod-' + Date.now(),
        name: productData.name.trim(),
        sku: productData.sku.toUpperCase().trim(),
        category: productData.category,
        unit: productData.unit,
        unitCost: parseFloat(productData.unitCost) || 0,
        unitPrice: parseFloat(productData.unitPrice) || 0,
        stock: parseInt(productData.stock, 10) || 0,
        reorderLevel: parseInt(productData.reorderLevel, 10) || 10,
        warehouseId: productData.warehouseId,
        locationId: productData.locationId || null,
        description: productData.description || '',
        barcode: productData.barcode || this.generateBarcode(),
        createdAt: new Date().toISOString().split('T')[0]
      };

      products.unshift(newProduct);

      // Record initial stock to Stock Ledger if stock > 0
      if (newProduct.stock > 0) {
        const wh = Warehouses.getById(newProduct.warehouseId);
        const loc = wh ? wh.locations.find(l => l.id === newProduct.locationId) : null;
        Ledger.record({
          referenceNumber: 'INIT-STOCK',
          type: 'INITIAL_STOCK',
          productId: newProduct.id,
          productName: newProduct.name,
          sku: newProduct.sku,
          warehouse: wh ? wh.name : 'Unknown Hub',
          location: loc ? loc.code : 'General',
          quantityChange: newProduct.stock,
          balanceAfter: newProduct.stock,
          user: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'System',
          remarks: 'Initial stock intake on product creation'
        });
      }
    } else {
      const index = products.findIndex(p => p.id === productData.id);
      if (index === -1) throw new Error('Product not found for update.');

      // Check SKU uniqueness on edit
      const duplicateSku = products.some(p => p.id !== productData.id && p.sku.toUpperCase() === productData.sku.toUpperCase());
      if (duplicateSku) {
        throw new Error(`SKU "${productData.sku}" already belongs to another product.`);
      }

      products[index] = {
        ...products[index],
        name: productData.name.trim(),
        sku: productData.sku.toUpperCase().trim(),
        category: productData.category,
        unit: productData.unit,
        unitCost: parseFloat(productData.unitCost) || 0,
        unitPrice: parseFloat(productData.unitPrice) || 0,
        reorderLevel: parseInt(productData.reorderLevel, 10) || 10,
        warehouseId: productData.warehouseId,
        locationId: productData.locationId || null,
        description: productData.description || ''
      };
    }

    DataStore.set(STORAGE_KEYS.PRODUCTS, products);
    this.renderTable();
    App.updateDashboardCounters();
    return true;
  },

  deleteProduct(id) {
    const products = this.getAll();
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    if (!confirm(`Are you sure you want to delete product "${prod.name}" (${prod.sku})?`)) {
      return;
    }

    const filtered = products.filter(p => p.id !== id);
    DataStore.set(STORAGE_KEYS.PRODUCTS, filtered);
    this.renderTable();
    App.updateDashboardCounters();
    App.showToast(`Product "${prod.name}" deleted.`, 'info');
  },

  generateSku(categoryName = '') {
    let prefix = 'GEN';
    if (categoryName.includes('Electronics')) prefix = 'ELEC';
    else if (categoryName.includes('Mechanical')) prefix = 'MECH';
    else if (categoryName.includes('Packaging')) prefix = 'PACK';
    else if (categoryName.includes('Chemical')) prefix = 'CHEM';
    else if (categoryName.includes('Safety')) prefix = 'SAFE';
    else if (categoryName.includes('Office')) prefix = 'OFFC';

    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${rand}`;
  },

  generateBarcode() {
    return '890' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
  },

  renderCategoryOptions() {
    const categories = DataStore.get(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    const select = document.getElementById('prod-category');
    const filterSelect = document.getElementById('filter-product-category');

    if (select) {
      select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Categories</option>' + 
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  },

  renderUnitOptions() {
    const units = DataStore.get(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
    const select = document.getElementById('prod-unit');
    if (select) {
      select.innerHTML = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }
  },

  renderWarehouseSelectOptions(selectedWhId = null, selectedLocId = null) {
    const warehouses = DataStore.get(STORAGE_KEYS.WAREHOUSES, []);
    const whSelect = document.getElementById('prod-warehouse');
    const locSelect = document.getElementById('prod-location');

    if (whSelect) {
      whSelect.innerHTML = warehouses.map(w => 
        `<option value="${w.id}" ${w.id === selectedWhId ? 'selected' : ''}>${w.name} (${w.code})</option>`
      ).join('');

      const updateLocations = () => {
        const currentWh = warehouses.find(w => w.id === whSelect.value);
        if (locSelect && currentWh && currentWh.locations) {
          locSelect.innerHTML = currentWh.locations.map(l => 
            `<option value="${l.id}" ${l.id === selectedLocId ? 'selected' : ''}>${l.code} - ${l.name}</option>`
          ).join('');
        }
      };

      whSelect.onchange = updateLocations;
      updateLocations();
    }
  },

  renderTable() {
    const products = this.getAll();
    const tableBody = document.getElementById('products-table-body');
    if (!tableBody) return;

    // Filters
    const searchVal = (document.getElementById('search-products')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('filter-product-category')?.value || '';
    const stockStatusVal = document.getElementById('filter-product-stock')?.value || '';

    const filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || 
                          p.sku.toLowerCase().includes(searchVal) || 
                          (p.barcode && p.barcode.includes(searchVal));
      const matchCat = !catVal || p.category === catVal;
      
      let matchStock = true;
      if (stockStatusVal === 'low') {
        matchStock = p.stock > 0 && p.stock <= p.reorderLevel;
      } else if (stockStatusVal === 'out') {
        matchStock = p.stock === 0;
      } else if (stockStatusVal === 'healthy') {
        matchStock = p.stock > p.reorderLevel;
      }

      return matchSearch && matchCat && matchStock;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-dim);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <p>No products found matching your filter criteria.</p>
          </td>
        </tr>
      `;
      return;
    }

    const warehouses = DataStore.get(STORAGE_KEYS.WAREHOUSES, []);

    tableBody.innerHTML = filtered.map(p => {
      const wh = warehouses.find(w => w.id === p.warehouseId);
      const loc = wh && p.locationId ? wh.locations.find(l => l.id === p.locationId) : null;
      
      // Stock Status
      let badgeClass = 'badge-in-stock';
      let statusText = 'In Stock';
      let progressClass = 'healthy';
      const pct = Math.min(100, Math.round((p.stock / (p.reorderLevel * 2 || 100)) * 100));

      if (p.stock === 0) {
        badgeClass = 'badge-out-of-stock';
        statusText = 'Out of Stock';
        progressClass = 'critical';
      } else if (p.stock <= p.reorderLevel) {
        badgeClass = 'badge-low-stock';
        statusText = 'Low Stock';
        progressClass = 'warning';
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #fff;">${p.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${p.description || 'No description'}</div>
          </td>
          <td>
            <span class="sku-code">${p.sku}</span>
          </td>
          <td>
            <span class="category-pill">${p.category}</span>
          </td>
          <td>
            <div class="stock-level-cell">
              <strong>${p.stock.toLocaleString()} ${p.unit}</strong>
              <div class="stock-progress-bar">
                <div class="stock-progress-fill ${progressClass}" style="width: ${pct}%"></div>
              </div>
            </div>
            <span style="font-size: 0.7rem; color: var(--text-dim);">Reorder at ${p.reorderLevel}</span>
          </td>
          <td>
            <div style="font-size: 0.825rem; font-weight: 600;">$${p.unitCost.toFixed(2)}</div>
            <div style="font-size: 0.725rem; color: var(--text-muted);">Retail: $${p.unitPrice.toFixed(2)}</div>
          </td>
          <td>
            <div style="font-size: 0.8rem;">${wh ? wh.code : 'Unassigned'}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${loc ? loc.code : 'General'}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}">${statusText}</span>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-tbl-action" title="View Barcode" onclick="Products.showBarcodeModal('${p.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>
              </button>
              <button class="btn-tbl-action edit" title="Edit Product" onclick="Products.openEditModal('${p.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-tbl-action delete" title="Delete Product" onclick="Products.deleteProduct('${p.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddModal() {
    this.currentEditId = null;
    document.getElementById('product-modal-title').textContent = 'Add New Product';
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = '';
    
    // Enable initial stock input for new product
    const stockInput = document.getElementById('prod-stock');
    if (stockInput) {
      stockInput.disabled = false;
      stockInput.value = 0;
    }

    // Auto generate a SKU
    const cat = document.getElementById('prod-category').value;
    document.getElementById('prod-sku').value = this.generateSku(cat);

    this.renderWarehouseSelectOptions();
    App.openModal('product-modal');
  },

  openEditModal(id) {
    const prod = this.getById(id);
    if (!prod) return;

    this.currentEditId = id;
    document.getElementById('product-modal-title').textContent = `Edit Product: ${prod.name}`;
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-name').value = prod.name;
    document.getElementById('prod-sku').value = prod.sku;
    document.getElementById('prod-category').value = prod.category;
    document.getElementById('prod-unit').value = prod.unit;
    document.getElementById('prod-cost').value = prod.unitCost;
    document.getElementById('prod-price').value = prod.unitPrice;
    document.getElementById('prod-reorder').value = prod.reorderLevel;
    document.getElementById('prod-desc').value = prod.description || '';

    // Stock count is adjusted via Receipts or Adjustments to preserve audit integrity
    const stockInput = document.getElementById('prod-stock');
    if (stockInput) {
      stockInput.value = prod.stock;
      stockInput.disabled = true;
    }

    this.renderWarehouseSelectOptions(prod.warehouseId, prod.locationId);
    App.openModal('product-modal');
  },

  showBarcodeModal(id) {
    const prod = this.getById(id);
    if (!prod) return;

    const modalBody = document.getElementById('barcode-modal-content');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 0;">
          <h4 style="margin-bottom: 0.25rem;">${prod.name}</h4>
          <p style="color: var(--text-dim); font-size: 0.8rem; margin-bottom: 1.5rem;">SKU: <span class="sku-code">${prod.sku}</span> | Cat: ${prod.category}</p>
          
          <div class="barcode-box" style="box-shadow: 0 4px 20px rgba(0,0,0,0.4); margin: 0 auto; display: inline-flex;">
            <div class="barcode-lines">
              <span class="b-bar w2"></span><span class="b-bar sp"></span>
              <span class="b-bar w1"></span><span class="b-bar w3"></span><span class="b-bar sp"></span>
              <span class="b-bar w2"></span><span class="b-bar w1"></span><span class="b-bar sp"></span>
              <span class="b-bar w3"></span><span class="b-bar w2"></span><span class="b-bar sp"></span>
              <span class="b-bar w1"></span><span class="b-bar w2"></span><span class="b-bar sp"></span>
              <span class="b-bar w2"></span><span class="b-bar w3"></span><span class="b-bar sp"></span>
              <span class="b-bar w1"></span><span class="b-bar w2"></span><span class="b-bar sp"></span>
              <span class="b-bar w3"></span><span class="b-bar w1"></span>
            </div>
            <div class="barcode-text">${prod.barcode || prod.sku}</div>
          </div>

          <div style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--text-muted);">
            Warehouse Location: <strong>${prod.warehouseId}</strong>
          </div>
        </div>
      `;
    }
    App.openModal('barcode-modal');
  },

  exportCsv() {
    const products = this.getAll();
    const headers = ['ID', 'Name', 'SKU', 'Category', 'Unit', 'Stock', 'ReorderLevel', 'UnitCost', 'UnitPrice', 'WarehouseID'];
    const rows = products.map(p => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      `"${p.category}"`,
      p.unit,
      p.stock,
      p.reorderLevel,
      p.unitCost,
      p.unitPrice,
      p.warehouseId
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stocksense_products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast('Product inventory exported to CSV', 'success');
  },

  bindEvents() {
    // Form submit
    const form = document.getElementById('product-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const productData = {
          id: document.getElementById('prod-id').value || null,
          name: document.getElementById('prod-name').value,
          sku: document.getElementById('prod-sku').value,
          category: document.getElementById('prod-category').value,
          unit: document.getElementById('prod-unit').value,
          unitCost: document.getElementById('prod-cost').value,
          unitPrice: document.getElementById('prod-price').value,
          stock: document.getElementById('prod-stock').value,
          reorderLevel: document.getElementById('prod-reorder').value,
          warehouseId: document.getElementById('prod-warehouse').value,
          locationId: document.getElementById('prod-location').value,
          description: document.getElementById('prod-desc').value
        };

        try {
          this.saveProduct(productData);
          App.closeModal('product-modal');
          App.showToast(`Product saved successfully!`, 'success');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // SKU Auto-generator button
    const btnGenSku = document.getElementById('btn-generate-sku');
    if (btnGenSku) {
      btnGenSku.addEventListener('click', () => {
        const cat = document.getElementById('prod-category').value;
        document.getElementById('prod-sku').value = this.generateSku(cat);
      });
    }

    // Search and filter triggers
    const searchInput = document.getElementById('search-products');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }

    const catFilter = document.getElementById('filter-product-category');
    if (catFilter) {
      catFilter.addEventListener('change', () => this.renderTable());
    }

    const stockFilter = document.getElementById('filter-product-stock');
    if (stockFilter) {
      stockFilter.addEventListener('change', () => this.renderTable());
    }

    // Export CSV
    const btnExport = document.getElementById('btn-export-products');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCsv());
    }
  }
};
