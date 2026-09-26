// StockSense Initial Mock Data & Persistence Engine
const STORAGE_KEYS = {
  USERS: 'stocksense_users',
  CURRENT_USER: 'stocksense_current_user',
  PRODUCTS: 'stocksense_products',
  WAREHOUSES: 'stocksense_warehouses',
  RECEIPTS: 'stocksense_receipts',
  DELIVERIES: 'stocksense_deliveries',
  TRANSFERS: 'stocksense_transfers',
  ADJUSTMENTS: 'stocksense_adjustments',
  STOCK_LEDGER: 'stocksense_stock_ledger',
  CATEGORIES: 'stocksense_categories',
  UNITS: 'stocksense_units'
};

const DEFAULT_USERS = [
  {
    id: 'usr_1',
    name: 'Alex Morgan',
    email: 'alex@stocksense.io',
    password: 'password123',
    role: 'Inventory Manager',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    joined: '2026-01-15'
  },
  {
    id: 'usr_2',
    name: 'Sarah Chen',
    email: 'sarah@stocksense.io',
    password: 'password123',
    role: 'Operations Lead',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    joined: '2026-02-01'
  },
  {
    id: 'usr_3',
    name: 'Sarah Connor',
    email: 'sarah@stocksense.io',
    password: 'password123',
    role: 'Warehouse Supervisor',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    joined: '2026-03-10'
  }
];

const DEFAULT_CATEGORIES = [
  'Electronics & Sensors',
  'Mechanical Components',
  'Packaging Materials',
  'Raw Materials & Chemicals',
  'Safety & Equipment',
  'Office Supplies'
];

const DEFAULT_UNITS = [
  { id: 'pcs', name: 'Pieces (pcs)', short: 'pcs' },
  { id: 'box', name: 'Boxes (box)', short: 'box' },
  { id: 'kg', name: 'Kilograms (kg)', short: 'kg' },
  { id: 'ltr', name: 'Liters (ltr)', short: 'ltr' },
  { id: 'roll', name: 'Rolls (roll)', short: 'roll' },
  { id: 'm', name: 'Meters (m)', short: 'm' }
];

const DEFAULT_WAREHOUSES = [
  {
    id: 'wh-blr-01',
    code: 'WH-BLR-01',
    name: 'Central Bangalore Hub',
    city: 'Bangalore, KA',
    address: 'Plot 42, Electronic City Phase 2',
    manager: 'Alex Morgan',
    capacityTotal: 15000,
    type: 'Primary Logistics Hub',
    locations: [
      { id: 'loc-blr-a1', code: 'ZONE-A-R1', name: 'Zone A - High Density Electronics Rack 1', capacity: 3000 },
      { id: 'loc-blr-a2', code: 'ZONE-A-R2', name: 'Zone A - Electronics Micro-Components Rack 2', capacity: 2500 },
      { id: 'loc-blr-b1', code: 'ZONE-B-COLD', name: 'Zone B - Climate Controlled Unit', capacity: 2000 },
      { id: 'loc-blr-c1', code: 'ZONE-C-PALLET', name: 'Zone C - Heavy Pallet Racks', capacity: 5500 },
      { id: 'loc-blr-dock', code: 'DOCK-INWARD', name: 'Receiving Dock & Inspection Bay', capacity: 2000 }
    ]
  },
  {
    id: 'wh-del-02',
    code: 'WH-DEL-02',
    name: 'Northern Distribution Depot',
    city: 'New Delhi, DL',
    address: 'Sector 18, Industrial Area, Okhla',
    manager: 'Sarah Connor',
    capacityTotal: 10000,
    type: 'Regional Distribution Center',
    locations: [
      { id: 'loc-del-n1', code: 'RACK-NORTH-01', name: 'North Rack 01 (General Goods)', capacity: 3500 },
      { id: 'loc-del-n2', code: 'RACK-NORTH-02', name: 'North Rack 02 (Packaging & Spares)', capacity: 4500 },
      { id: 'loc-del-stage', code: 'STAGING-BAY', name: 'Dispatch Staging Bay', capacity: 2000 }
    ]
  },
  {
    id: 'wh-mum-03',
    code: 'WH-MUM-03',
    name: 'Western Transit Terminal',
    city: 'Mumbai, MH',
    address: 'JNPT Maritime Port Zone, Navi Mumbai',
    manager: 'Sarah Chen',
    capacityTotal: 25000,
    type: 'Port Transit Terminal',
    locations: [
      { id: 'loc-mum-d1', code: 'PORT-DOCK-A', name: 'Container Offload Dock A', capacity: 10000 },
      { id: 'loc-mum-h1', code: 'HIGH-BAY-01', name: 'High-Bay Automated Racks 1', capacity: 8000 },
      { id: 'loc-mum-h2', code: 'HIGH-BAY-02', name: 'High-Bay Automated Racks 2', capacity: 7000 }
    ]
  }
];

const DEFAULT_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Industrial Controller Pi 4G',
    sku: 'ELEC-RPI-4G',
    category: 'Electronics & Sensors',
    unit: 'pcs',
    unitCost: 85.00,
    unitPrice: 135.00,
    stock: 145,
    reorderLevel: 30,
    warehouseId: 'wh-blr-01',
    locationId: 'loc-blr-a1',
    description: 'Quad-core DIN-rail mounted controller with 4G LTE cellular telemetry.',
    barcode: '8901234567890',
    createdAt: '2026-01-20'
  },
  {
    id: 'prod-002',
    name: 'Brushless Servo Motor 750W',
    sku: 'MECH-MOT-750',
    category: 'Mechanical Components',
    unit: 'pcs',
    unitCost: 210.00,
    unitPrice: 320.00,
    stock: 14,
    reorderLevel: 25, // LOW STOCK
    warehouseId: 'wh-blr-01',
    locationId: 'loc-blr-c1',
    description: 'Precision AC servo motor with 2500 PPR optical incremental encoder.',
    barcode: '8901234567891',
    createdAt: '2026-02-05'
  },
  {
    id: 'prod-003',
    name: 'LiDAR Optical Ranging Sensor',
    sku: 'SENS-LID-500',
    category: 'Electronics & Sensors',
    unit: 'pcs',
    unitCost: 145.00,
    unitPrice: 220.00,
    stock: 62,
    reorderLevel: 20,
    warehouseId: 'wh-blr-01',
    locationId: 'loc-blr-a2',
    description: 'Solid-state 360-degree LiDAR sensor for AGVs and autonomous carts.',
    barcode: '8901234567892',
    createdAt: '2026-02-12'
  },
  {
    id: 'prod-004',
    name: 'Anti-Static Poly Bubble Wrap (100m)',
    sku: 'PACK-BUB-100',
    category: 'Packaging Materials',
    unit: 'roll',
    unitCost: 24.50,
    unitPrice: 38.00,
    stock: 310,
    reorderLevel: 50,
    warehouseId: 'wh-del-02',
    locationId: 'loc-del-n2',
    description: 'Pink dissipative protective film roll for sensitive PCB packaging.',
    barcode: '8901234567893',
    createdAt: '2026-02-18'
  },
  {
    id: 'prod-005',
    name: 'HDPE Granules Injection Grade',
    sku: 'CHEM-HDP-50K',
    category: 'Raw Materials & Chemicals',
    unit: 'kg',
    unitCost: 3.80,
    unitPrice: 6.20,
    stock: 4800,
    reorderLevel: 1000,
    warehouseId: 'wh-mum-03',
    locationId: 'loc-mum-d1',
    description: 'High-density polyethylene pellets for precision casing molding.',
    barcode: '8901234567894',
    createdAt: '2026-03-01'
  },
  {
    id: 'prod-006',
    name: 'Heavy Corrugated Shipping Cartons (XL)',
    sku: 'PACK-BOX-XL',
    category: 'Packaging Materials',
    unit: 'box',
    unitCost: 4.20,
    unitPrice: 7.50,
    stock: 8,
    reorderLevel: 100, // CRITICAL LOW STOCK
    warehouseId: 'wh-del-02',
    locationId: 'loc-del-n2',
    description: 'Double-walled export quality carton box 600x400x400mm.',
    barcode: '8901234567895',
    createdAt: '2026-03-10'
  }
];

const DEFAULT_RECEIPTS = [
  {
    id: 'rec-2026-001',
    receiptNumber: 'REC-2026-001',
    supplier: 'Apex Semiconductor Technologies Ltd',
    supplierRef: 'PO-APX-8831',
    warehouseId: 'wh-blr-01',
    locationId: 'loc-blr-a1',
    receiptDate: '2026-09-18',
    status: 'Received',
    notes: 'Initial Q3 replenishment batch for central hub.',
    items: [
      { productId: 'prod-001', productName: 'Industrial Controller Pi 4G', sku: 'ELEC-RPI-4G', qtyOrdered: 50, qtyReceived: 50, unitCost: 85.00, lineTotal: 4250.00 }
    ],
    totalAmount: 4250.00,
    receivedAt: '2026-09-18T14:30:00Z',
    receivedBy: 'Alex Morgan'
  },
  {
    id: 'rec-2026-002',
    receiptNumber: 'REC-2026-002',
    supplier: 'Global Dynamic Packaging Corp',
    supplierRef: 'PO-GDP-1102',
    warehouseId: 'wh-del-02',
    locationId: 'loc-del-n2',
    receiptDate: '2026-09-21',
    status: 'Received',
    notes: 'Roll inventory replenished for North fulfillment center.',
    items: [
      { productId: 'prod-004', productName: 'Anti-Static Poly Bubble Wrap (100m)', sku: 'PACK-BUB-100', qtyOrdered: 100, qtyReceived: 100, unitCost: 24.50, lineTotal: 2450.00 }
    ],
    totalAmount: 2450.00,
    receivedAt: '2026-09-21T11:15:00Z',
    receivedBy: 'Sarah Connor'
  },
  {
    id: 'rec-2026-003',
    receiptNumber: 'REC-2026-003',
    supplier: 'Precision Drive Systems Corp',
    supplierRef: 'PO-PDS-4520',
    warehouseId: 'wh-blr-01',
    locationId: 'loc-blr-c1',
    receiptDate: '2026-09-25',
    status: 'Pending Inspection',
    notes: 'Critical servo motors shipment arriving at gate 3.',
    items: [
      { productId: 'prod-002', productName: 'Brushless Servo Motor 750W', sku: 'MECH-MOT-750', qtyOrdered: 30, qtyReceived: 30, unitCost: 210.00, lineTotal: 6300.00 }
    ],
    totalAmount: 6300.00,
    receivedAt: null,
    receivedBy: null
  },
  {
    id: 'rec-2026-004',
    receiptNumber: 'REC-2026-004',
    supplier: 'Titan Industrial Packaging Supplies',
    supplierRef: 'PO-TITAN-901',
    warehouseId: 'wh-del-02',
    locationId: 'loc-del-n2',
    receiptDate: '2026-09-26',
    status: 'Draft',
    notes: 'Urgent restocking order for shipping boxes.',
    items: [
      { productId: 'prod-006', productName: 'Heavy Corrugated Shipping Cartons (XL)', sku: 'PACK-BOX-XL', qtyOrdered: 200, qtyReceived: 0, unitCost: 4.20, lineTotal: 840.00 }
    ],
    totalAmount: 840.00,
    receivedAt: null,
    receivedBy: null
  }
];

const DEFAULT_DELIVERIES = [
  {
    id: 'del-2026-001',
    orderNumber: 'DO-2026-001',
    customerName: 'Tesla Gigafactory India',
    destinationAddress: 'Hosur Industrial Zone, Phase 3',
    warehouseId: 'wh-blr-01',
    status: 'VALIDATED',
    notes: 'Priority manufacturing assembly delivery',
    items: [
      { productId: 'prod-001', productName: 'Industrial Controller Pi 4G', sku: 'ELEC-RPI-4G', requestedQuantity: 15, pickedQuantity: 15, packedQuantity: 15, unitPrice: 135.00 }
    ],
    totalAmount: 2025.00,
    createdAt: '2026-09-20',
    validatedAt: '2026-09-20T16:00:00Z'
  },
  {
    id: 'del-2026-002',
    orderNumber: 'DO-2026-002',
    customerName: 'ABB Robotics Automation Ltd',
    destinationAddress: 'Peenya Industrial Estate, Bangalore',
    warehouseId: 'wh-blr-01',
    status: 'PACKED',
    notes: 'Sensor package awaiting carrier pickup',
    items: [
      { productId: 'prod-003', productName: 'LiDAR Optical Ranging Sensor', sku: 'SENS-LID-500', requestedQuantity: 8, pickedQuantity: 8, packedQuantity: 8, unitPrice: 220.00 }
    ],
    totalAmount: 1760.00,
    createdAt: '2026-09-23',
    validatedAt: null
  },
  {
    id: 'del-2026-003',
    orderNumber: 'DO-2026-003',
    customerName: 'Schneider Electric Systems',
    destinationAddress: 'Electronic City Gate 2, Bangalore',
    warehouseId: 'wh-blr-01',
    status: 'PICKED',
    notes: 'Line item picked from Zone A Rack 1',
    items: [
      { productId: 'prod-001', productName: 'Industrial Controller Pi 4G', sku: 'ELEC-RPI-4G', requestedQuantity: 5, pickedQuantity: 5, packedQuantity: 0, unitPrice: 135.00 }
    ],
    totalAmount: 675.00,
    createdAt: '2026-09-25',
    validatedAt: null
  },
  {
    id: 'del-2026-004',
    orderNumber: 'DO-2026-004',
    customerName: 'Foxconn Electronics Logistics',
    destinationAddress: 'Sriperumbudur Tech Park, Chennai',
    warehouseId: 'wh-del-02',
    status: 'DRAFT',
    notes: 'New purchase requisition order',
    items: [
      { productId: 'prod-004', productName: 'Anti-Static Poly Bubble Wrap (100m)', sku: 'PACK-BUB-100', requestedQuantity: 20, pickedQuantity: 0, packedQuantity: 0, unitPrice: 38.00 }
    ],
    totalAmount: 760.00,
    createdAt: '2026-09-26',
    validatedAt: null
  }
];

const DEFAULT_TRANSFERS = [
  {
    id: 'trf-2026-001',
    transferNumber: 'TRF-2026-001',
    sourceWarehouseId: 'wh-blr-01',
    sourceWarehouseName: 'Central Bangalore Hub',
    destWarehouseId: 'wh-del-02',
    destWarehouseName: 'Northern Distribution Depot',
    status: 'COMPLETED',
    notes: 'Stock rebalance of controllers to north region',
    items: [
      { productId: 'prod-001', productName: 'Industrial Controller Pi 4G', sku: 'ELEC-RPI-4G', quantity: 20 }
    ],
    createdAt: '2026-09-19',
    dispatchedAt: '2026-09-19T10:00:00Z',
    completedAt: '2026-09-21T18:00:00Z'
  },
  {
    id: 'trf-2026-002',
    transferNumber: 'TRF-2026-002',
    sourceWarehouseId: 'wh-blr-01',
    sourceWarehouseName: 'Central Bangalore Hub',
    destWarehouseId: 'wh-mum-03',
    destWarehouseName: 'Western Transit Terminal',
    status: 'IN_TRANSIT',
    notes: 'Maritime container consolidation batch',
    items: [
      { productId: 'prod-003', productName: 'LiDAR Optical Ranging Sensor', sku: 'SENS-LID-500', quantity: 10 }
    ],
    createdAt: '2026-09-24',
    dispatchedAt: '2026-09-25T08:30:00Z',
    completedAt: null
  },
  {
    id: 'trf-2026-003',
    transferNumber: 'TRF-2026-003',
    sourceWarehouseId: 'wh-del-02',
    sourceWarehouseName: 'Northern Distribution Depot',
    destWarehouseId: 'wh-blr-01',
    destWarehouseName: 'Central Bangalore Hub',
    status: 'DRAFT',
    notes: 'Return of excess packaging rolls',
    items: [
      { productId: 'prod-004', productName: 'Anti-Static Poly Bubble Wrap (100m)', sku: 'PACK-BUB-100', quantity: 50 }
    ],
    createdAt: '2026-09-26',
    dispatchedAt: null,
    completedAt: null
  }
];

const DEFAULT_ADJUSTMENTS = [
  {
    id: 'adj-2026-001',
    adjustmentNumber: 'ADJ-2026-001',
    productId: 'prod-002',
    productName: 'Brushless Servo Motor 750W',
    sku: 'MECH-MOT-750',
    warehouseId: 'wh-blr-01',
    warehouseName: 'Central Bangalore Hub',
    systemQuantity: 15,
    countedQuantity: 14,
    variance: -1,
    reason: 'Damaged motor casing during internal relocation',
    status: 'APPLIED',
    createdAt: '2026-09-22T15:20:00Z',
    user: 'Sarah Chen'
  },
  {
    id: 'adj-2026-002',
    adjustmentNumber: 'ADJ-2026-002',
    productId: 'prod-001',
    productName: 'Industrial Controller Pi 4G',
    sku: 'ELEC-RPI-4G',
    warehouseId: 'wh-blr-01',
    warehouseName: 'Central Bangalore Hub',
    systemQuantity: 140,
    countedQuantity: 145,
    variance: +5,
    reason: 'Found unrecorded box in Zone A Rack 1 aisle',
    status: 'APPLIED',
    createdAt: '2026-09-24T10:45:00Z',
    user: 'Alex Morgan'
  }
];

const DEFAULT_LEDGER = [
  {
    id: 'led-1',
    timestamp: '2026-09-18T14:30:00Z',
    referenceNumber: 'REC-2026-001',
    type: 'STOCK_IN',
    productId: 'prod-001',
    productName: 'Industrial Controller Pi 4G',
    sku: 'ELEC-RPI-4G',
    warehouse: 'Central Bangalore Hub',
    location: 'ZONE-A-R1',
    quantityChange: +50,
    balanceAfter: 145,
    user: 'Alex Morgan',
    remarks: 'Supplier Receipt from Apex Semiconductor'
  },
  {
    id: 'led-2',
    timestamp: '2026-09-20T16:00:00Z',
    referenceNumber: 'DO-2026-001',
    type: 'STOCK_OUT',
    productId: 'prod-001',
    productName: 'Industrial Controller Pi 4G',
    sku: 'ELEC-RPI-4G',
    warehouse: 'Central Bangalore Hub',
    location: 'ZONE-A-R1',
    quantityChange: -15,
    balanceAfter: 130,
    user: 'Sarah Chen',
    remarks: 'Delivery Order fulfillment for Tesla Gigafactory'
  },
  {
    id: 'led-3',
    timestamp: '2026-09-21T11:15:00Z',
    referenceNumber: 'REC-2026-002',
    type: 'STOCK_IN',
    productId: 'prod-004',
    productName: 'Anti-Static Poly Bubble Wrap (100m)',
    sku: 'PACK-BUB-100',
    warehouse: 'Northern Distribution Depot',
    location: 'RACK-NORTH-02',
    quantityChange: +100,
    balanceAfter: 310,
    user: 'Sarah Connor',
    remarks: 'Supplier Receipt from Global Dynamic Packaging'
  },
  {
    id: 'led-4',
    timestamp: '2026-09-22T15:20:00Z',
    referenceNumber: 'ADJ-2026-001',
    type: 'ADJUSTMENT',
    productId: 'prod-002',
    productName: 'Brushless Servo Motor 750W',
    sku: 'MECH-MOT-750',
    warehouse: 'Central Bangalore Hub',
    location: 'ZONE-C-PALLET',
    quantityChange: -1,
    balanceAfter: 14,
    user: 'Sarah Chen',
    remarks: 'Cycle Count reconciliation: Damaged motor casing'
  }
];

// LocalStorage Helper Engine
const DataStore = {
  get(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.warn(`DataStore load error for ${key}:`, e);
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`DataStore write error for ${key}:`, e);
    }
  },
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      this.set(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      this.set(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WAREHOUSES)) {
      this.set(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.RECEIPTS)) {
      this.set(STORAGE_KEYS.RECEIPTS, DEFAULT_RECEIPTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.DELIVERIES)) {
      this.set(STORAGE_KEYS.DELIVERIES, DEFAULT_DELIVERIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSFERS)) {
      this.set(STORAGE_KEYS.TRANSFERS, DEFAULT_TRANSFERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS)) {
      this.set(STORAGE_KEYS.ADJUSTMENTS, DEFAULT_ADJUSTMENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.STOCK_LEDGER)) {
      this.set(STORAGE_KEYS.STOCK_LEDGER, DEFAULT_LEDGER);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      this.set(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.UNITS)) {
      this.set(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
    }
    // Default logged in user if not set
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      this.set(STORAGE_KEYS.CURRENT_USER, DEFAULT_USERS[0]);
    }
  },
  resetToDefaults() {
    this.set(STORAGE_KEYS.USERS, DEFAULT_USERS);
    this.set(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    this.set(STORAGE_KEYS.WAREHOUSES, DEFAULT_WAREHOUSES);
    this.set(STORAGE_KEYS.RECEIPTS, DEFAULT_RECEIPTS);
    this.set(STORAGE_KEYS.DELIVERIES, DEFAULT_DELIVERIES);
    this.set(STORAGE_KEYS.TRANSFERS, DEFAULT_TRANSFERS);
    this.set(STORAGE_KEYS.ADJUSTMENTS, DEFAULT_ADJUSTMENTS);
    this.set(STORAGE_KEYS.STOCK_LEDGER, DEFAULT_LEDGER);
    this.set(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    this.set(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
    this.set(STORAGE_KEYS.CURRENT_USER, DEFAULT_USERS[0]);
  }
};
