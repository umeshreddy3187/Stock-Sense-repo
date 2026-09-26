const API_BASE = '/api';

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const data = await res.json();
  return data.data;
}

export async function fetchDeliveries(status) {
  const url = status && status !== 'ALL' 
    ? `${API_BASE}/deliveries?status=${encodeURIComponent(status)}`
    : `${API_BASE}/deliveries`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch delivery orders');
  const data = await res.json();
  return data.data;
}

export async function fetchDeliveryById(id) {
  const res = await fetch(`${API_BASE}/deliveries/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch delivery #${id}`);
  const data = await res.json();
  return data.data;
}

export async function createDeliveryOrder(payload) {
  const res = await fetch(`${API_BASE}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create delivery order');
  }
  return data.data;
}

export async function pickDeliveryOrder(id, itemPicks) {
  const res = await fetch(`${API_BASE}/deliveries/${id}/pick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_picks: itemPicks })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to pick delivery items');
  }
  return data.data;
}

export async function packDeliveryOrder(id, itemPacks) {
  const res = await fetch(`${API_BASE}/deliveries/${id}/pack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_packs: itemPacks })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to pack delivery items');
  }
  return data.data;
}

export async function validateDeliveryOrder(id) {
  const res = await fetch(`${API_BASE}/deliveries/${id}/validate`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to validate delivery order');
  }
  return data.data;
}

export async function fetchStockLedger(filters = {}) {
  let url = `${API_BASE}/stock-ledger`;
  const params = new URLSearchParams();
  if (filters.productId) params.append('productId', filters.productId);
  if (filters.referenceType) params.append('referenceType', filters.referenceType);
  if (filters.referenceId) params.append('referenceId', filters.referenceId);
  const queryStr = params.toString();
  if (queryStr) url += `?${queryStr}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch stock ledger movements');
  const data = await res.json();
  return data.data;
}

export async function fetchWarehouses() {
  const res = await fetch(`${API_BASE}/warehouses`);
  if (!res.ok) throw new Error('Failed to fetch warehouses');
  const data = await res.json();
  return data.data;
}

export async function fetchDashboardSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.timeRange) params.append('timeRange', filters.timeRange);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/dashboard/summary${queryStr}`);
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  const data = await res.json();
  return data.data;
}

export async function fetchInventoryOverview(filters = {}) {
  const params = new URLSearchParams();
  if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/dashboard/inventory${queryStr}`);
  if (!res.ok) throw new Error('Failed to fetch inventory overview');
  const data = await res.json();
  return data.data;
}

export async function fetchWarehouseOverview(filters = {}) {
  const params = new URLSearchParams();
  if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/dashboard/warehouses${queryStr}`);
  if (!res.ok) throw new Error('Failed to fetch warehouse overview');
  const data = await res.json();
  return data.data;
}

export async function fetchMovementAnalytics(filters = {}) {
  const params = new URLSearchParams();
  if (filters.timeRange) params.append('timeRange', filters.timeRange);
  if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
  if (filters.movementType && filters.movementType !== 'ALL') params.append('movementType', filters.movementType);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/dashboard/movements${queryStr}`);
  if (!res.ok) throw new Error('Failed to fetch movement analytics');
  const data = await res.json();
  return data.data;
}

export async function fetchLowStockProducts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/dashboard/low-stock${queryStr}`);
  if (!res.ok) throw new Error('Failed to fetch low stock products');
  const data = await res.json();
  return data.data;
}

export async function createProduct(payload) {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create product');
  return data.data;
}

export async function updateProduct(id, payload) {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update product');
  return data.data;
}

export async function deleteProduct(id) {
  const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete product');
  return data;
}

export async function createWarehouse(payload) {
  const res = await fetch(`${API_BASE}/warehouses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create warehouse');
  return data.data;
}

export async function fetchReceipts() {
  const res = await fetch(`${API_BASE}/receipts`);
  if (!res.ok) throw new Error('Failed to fetch receipts');
  const data = await res.json();
  return data.data;
}

export async function createReceipt(payload) {
  const res = await fetch(`${API_BASE}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create receipt');
  return data.data;
}

export async function receiveReceipt(id) {
  const res = await fetch(`${API_BASE}/receipts/${id}/receive`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to receive order');
  return data.data;
}

export async function fetchTransfers() {
  const res = await fetch(`${API_BASE}/transfers`);
  if (!res.ok) throw new Error('Failed to fetch transfers');
  const data = await res.json();
  return data.data;
}

export async function createTransfer(payload) {
  const res = await fetch(`${API_BASE}/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create transfer');
  return data.data;
}

export async function dispatchTransfer(id) {
  const res = await fetch(`${API_BASE}/transfers/${id}/dispatch`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to dispatch transfer');
  return data.data;
}

export async function completeTransfer(id) {
  const res = await fetch(`${API_BASE}/transfers/${id}/complete`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to complete transfer');
  return data.data;
}

export async function fetchAdjustments() {
  const res = await fetch(`${API_BASE}/adjustments`);
  if (!res.ok) throw new Error('Failed to fetch adjustments');
  const data = await res.json();
  return data.data;
}

export async function createAdjustment(payload) {
  const res = await fetch(`${API_BASE}/adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create adjustment');
  return data.data;
}
