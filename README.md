# StockSense - Warehouse & Inventory Management Platform

StockSense is an enterprise-grade Inventory and Warehouse Management System (WMS) built to manage the end-to-end lifecycle of stock tracking: product cataloging, inbound receipts, outbound delivery orders, internal location transfers, inventory adjustments, real-time analytics, and an immutable stock ledger audit trail.

---

## Architecture Overview

StockSense follows a modular full-stack architecture with a centralized backend API, transactional SQLite database with ACID guarantees, and a modern, responsive React frontend.

```
StockSense System
├── Core Inventory Engine
│   ├── Product Catalog & Stock Balances
│   ├── Warehouses & Storage Locations
│   └── Central Stock Movement Ledger
│
├── Inbound Logistics
│   └── Purchase Receipts (Draft → Check → Receive → Stock Increase)
│
├── Outbound Fulfillment
│   └── Delivery Orders (Draft → Pick → Pack → Validate → Stock Decrease)
│
├── Internal Inventory Operations
│   ├── Internal Transfers (Between Warehouses / Locations)
│   └── Stock Adjustments (Cycle Counts, Reconciliation, Discrepancies)
│
└── Platform Services
    ├── Authentication & Role-Based Access Control
    └── Analytics & Inventory Dashboard
```

---

## Team Members & Responsibilities

The StockSense platform is collaboratively engineered by two primary team members with dedicated feature ownership and shared integration modules:

### 👤 Member 1: Umesh Reddy
- **Core Domain**: Inbound Logistics, Product Catalog, Warehouse Infrastructure & System Security
- **Assigned Feature Branches & Work**:
  - `feature/member1/authentication`: User registration, login, JWT token issuance, session management, and protected API route middleware.
  - `feature/member1/products`: Product catalog management, SKU definitions, categories, unit measurements, and base product inventory attributes.
  - `feature/member1/receipts`: Inbound supplier receipts pipeline (`Draft` → `Check` → `Receive` → `Stock Increment` → `Stock Ledger Movement`).
  - `feature/member1/warehouse`: Multi-facility warehouse configuration, storage zones, location codes, and bin/shelf management.

---

### 👤 Member 2: Jishnu
- **Core Domain**: Outbound Fulfillment, Internal Relocations, Stock Reconciliation & Analytics
- **Assigned Feature Branches & Work**:
  - `feature/member2/deliveries`: Outbound delivery order workflow (`Draft` → `Pick` → `Pack` → `Validate` → `Stock Decrement` → `Stock Ledger Movement`), stock availability validation, and customer order management (*Implemented & Verified*).
  - `feature/member2/transfers`: Internal warehouse transfers, inter-facility relocation requests, dispatch in-transit status, and destination receipt verification.
  - `feature/member2/adjustments`: Inventory cycle counts, variance detection, damaged/lost goods write-offs, and reconciliation adjustments.
  - `feature/member2/dashboard`: Real-time warehouse analytics dashboard, KPI summary metrics, inventory turnover, low-stock warnings, and activity monitors.

---

### 🤝 Collaborative Shared Modules
- `feature/shared/stock-ledger`: Centralized immutable audit ledger recording every inventory delta with before/after balances.
- `feature/shared/integration`: End-to-end integration testing, unified routing, API gateway middleware, and deployment configuration.

---

## Feature Modules & Git Branch Matrix

| Feature Area | Assigned Developer | Git Branch | Operational Scope |
|---|---|---|---|
| **Authentication & Access** | **Umesh Reddy** (Member 1) | `feature/member1/authentication` | User login, JWT sessions, route guards |
| **Product Management** | **Umesh Reddy** (Member 1) | `feature/member1/products` | SKU catalog, product categories, pricing, unit definitions |
| **Inbound Receipts** | **Umesh Reddy** (Member 1) | `feature/member1/receipts` | Supplier purchase receipts, shipment inspection, stock increment |
| **Warehouse Infrastructure** | **Umesh Reddy** (Member 1) | `feature/member1/warehouse` | Multi-warehouse management, storage zones, locations, and aisle mapping |
| **Delivery Orders** | **Jishnu** (Member 2) | `feature/member2/deliveries` | Customer fulfillment: Pick, Pack, Validate, stock deduction *(Completed)* |
| **Internal Transfers** | **Jishnu** (Member 2) | `feature/member2/transfers` | Inter-warehouse stock relocations with transit tracking |
| **Stock Adjustments** | **Jishnu** (Member 2) | `feature/member2/adjustments` | Inventory cycle counting, physical audits, shrinkage write-offs |
| **Analytics Dashboard** | **Jishnu** (Member 2) | `feature/member2/dashboard` | Real-time KPI metrics, low-stock alerts, turnover rates, operational stats |
| **Stock Ledger (Shared)** | **Collaborative** | `feature/shared/stock-ledger` | Immutable audit log recording every inventory movement across all modules |
| **System Integration** | **Collaborative** | `feature/shared/integration` | End-to-end integration, unified routing, shared middleware, and deployment |

---

## Core Operational Workflows

### 1. Delivery Orders Fulfillment Workflow (Outbound)

Outbound shipments follow a strict multi-stage verification pipeline to ensure fulfillment accuracy before committing stock changes:

```
Create Delivery Order (DRAFT)
           ↓
    Select Product(s)
           ↓
   Enter & Verify Quantity (Stock Availability Pre-Check)
           ↓
      Pick Items (PICKED)
           ↓
      Pack Items (PACKED)
           ↓
  Validate Order (VALIDATED)
           ↓
  Transactional Stock Decrement (SQLite DB)
           ↓
Create Immutable Stock Ledger Record (DELIVERY)
```

**Key Rules & Invariants**:
- Customer name and line items are mandatory.
- Quantities must be positive integers (`> 0`).
- Orders cannot exceed real-time available warehouse stock (`requested_quantity <= product.current_stock`).
- Strict stage progression: `DRAFT` &rarr; `PICKED` &rarr; `PACKED` &rarr; `VALIDATED`. Skipping steps is prevented.
- Stock changes run in database ACID transactions (`BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK`).
- Ledger entries record `quantity_before`, `quantity_after`, and `quantity_change = -N`.

---

### 2. Inbound Receipts Workflow (Inbound)

Inbound supplier deliveries replenish warehouse inventory through a controlled inspection process:

```
Create Receipt (DRAFT)
           ↓
Select Supplier & Product(s)
           ↓
Receive & Inspect Items
           ↓
Validate Receipt
           ↓
Transactional Stock Increment (SQLite DB)
           ↓
Create Immutable Stock Ledger Record (RECEIPT)
```

---

### 3. Internal Transfers Workflow

Relocating stock between warehouses or storage zones:

```
Initiate Transfer (DRAFT)
           ↓
Select Source & Destination Warehouses
           ↓
Select Items & Quantities (Source Availability Verified)
           ↓
Dispatch (IN_TRANSIT)
           ↓
Receive at Destination (COMPLETED)
           ↓
Update Stock at Both Locations & Log Two Ledger Entries
```

---

### 4. Stock Adjustments Workflow

Reconciling physical counts with system records:

```
Create Adjustment Request
           ↓
Select Product & Location
           ↓
Enter Physical Counted Quantity
           ↓
Compute Variance (Positive / Negative Delta)
           ↓
Apply Adjustment & Record Stock Ledger Movement (ADJUSTMENT)
```

---

## Central Stock Ledger (Shared Audit Log)

The **Stock Ledger** is the single source of truth for all inventory movements. Every operation that alters stock levels creates a permanent, immutable record:

| Field | Type | Description |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY` | Auto-incrementing unique movement identifier |
| `product_id` | `INTEGER` | Reference to the product |
| `movement_type` | `TEXT` | `DELIVERY`, `RECEIPT`, `TRANSFER`, or `ADJUSTMENT` |
| `reference_type` | `TEXT` | Source entity (e.g. `DELIVERY_ORDER`, `PURCHASE_RECEIPT`) |
| `reference_id` | `INTEGER` | ID of the triggering document |
| `quantity_change` | `INTEGER` | Signed quantity delta (negative for deliveries, positive for receipts) |
| `quantity_before` | `INTEGER` | Stock balance immediately prior to movement |
| `quantity_after` | `INTEGER` | Stock balance immediately following movement |
| `timestamp` | `DATETIME` | Audit timestamp |
| `notes` | `TEXT` | Contextual notes and order numbers |

---

## Database Schema (SQLite)

```sql
-- Product Catalog
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  unit TEXT NOT NULL DEFAULT 'units',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Warehouses & Storage Facilities
CREATE TABLE warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT
);

-- Delivery Orders (Outbound)
CREATE TABLE delivery_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  destination_address TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PICKED', 'PACKED', 'VALIDATED', 'CANCELLED')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  validated_at DATETIME
);

-- Delivery Order Line Items
CREATE TABLE delivery_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  picked_quantity INTEGER NOT NULL DEFAULT 0,
  packed_quantity INTEGER NOT NULL DEFAULT 0
);

-- Immutable Stock Movement Ledger
CREATE TABLE stock_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('DELIVERY', 'RECEIPT', 'TRANSFER', 'ADJUSTMENT')),
  reference_type TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);
```

---

## API Reference

### Delivery Orders (`/api/deliveries`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/deliveries` | List all delivery orders (supports `?status=` filter) |
| `GET` | `/api/deliveries/:id` | Fetch full order details, line items, and stock status |
| `POST` | `/api/deliveries` | Create order with line items & real-time stock pre-check |
| `POST` | `/api/deliveries/:id/pick` | Transition order from `DRAFT` to `PICKED` |
| `POST` | `/api/deliveries/:id/pack` | Transition order from `PICKED` to `PACKED` |
| `POST` | `/api/deliveries/:id/validate` | Validate order, deduct inventory in DB, and create ledger entry |

### Products (`/api/products`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Retrieve all products with current available stock |
| `GET` | `/api/products/:id` | Retrieve single product details |

### Stock Ledger (`/api/stock-ledger`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stock-ledger` | Retrieve audit trail of all inventory movements |

---

## Local Development & Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

### 1. Installation
Clone the repository and install root and workspace dependencies:

```bash
git clone https://github.com/umeshreddy3187/Stock-Sense-repo.git
cd Stock-Sense-repo

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run Automated Tests
Execute the backend test suite covering API validations, workflow sequencing, database transactions, and stock ledger movements:

```bash
npm test
```

### 3. Start the Backend API Server
```bash
npm run start
# Server starts at http://localhost:5000
# Health check available at http://localhost:5000/api/health
```

### 4. Start the Frontend Application
```bash
npm run dev:frontend
# Vite development server starts at http://localhost:3000
```

---

## Tech Stack

- **Backend**: Node.js, Express, `node:sqlite` (Native synchronous SQLite engine with ACID transactions & WAL mode)
- **Frontend**: React 18, Vite, Vanilla CSS Design System (Glassmorphic dark theme, responsive layouts, micro-animations)
- **Database**: SQLite 3
- **Testing**: Node.js Test Runner (`node:test`, `node:assert`)