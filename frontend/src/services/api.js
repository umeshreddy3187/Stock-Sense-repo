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
