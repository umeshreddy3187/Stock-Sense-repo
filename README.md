# StockSense - Warehouse & Inventory Management Platform

StockSense is an enterprise-grade Inventory and Warehouse Management System (WMS) built to manage the end-to-end lifecycle of stock tracking, receipts, deliveries, internal transfers, adjustments, and the immutable stock ledger audit trail.

---

## Member Contribution

### Developer Role: **MEMBER 2**
- **Active Branch**: `feature/member2/deliveries`
- **Assigned Feature Modules**:
  - `feature/member2/deliveries` (Completed & Verified)
  - `feature/member2/transfers` (Pending)
  - `feature/member2/adjustments` (Pending)
  - `feature/member2/dashboard` (Pending)
- **Shared Modules**:
  - `feature/shared/stock-ledger` (Integrated with Delivery audit records)
  - `feature/shared/integration`

---

## Delivery Orders Fulfillment Workflow

```
Create Delivery Order (DRAFT)
           ↓
    Select Product(s)
           ↓
     Enter Quantity
           ↓
      Pick (PICKED)
           ↓
      Pack (PACKED)
           ↓
   Validate (VALIDATED)
           ↓
  Decrease Stock (SQLite DB)
           ↓
Create Stock Ledger Record
```

### Operational Rules & Validation
1. **Product & Quantity Selection**:
   - Customer name is strictly required.
   - At least one product item is required.
   - Quantities must be positive integers (`> 0`). Zero or negative quantities are rejected with HTTP 400.
   - Quantity cannot exceed real-time available warehouse stock (`requested_quantity <= product.current_stock`).
2. **State Transition Validation**:
   - Strict progression enforced: `DRAFT` &rarr; `PICKED` &rarr; `PACKED` &rarr; `VALIDATED`.
   - Skipping steps (e.g. attempting to pack before picking, or validating before packing) is rejected with HTTP 400.
3. **Database ACID Transactions**:
   - Validation runs inside a single atomic SQLite transaction (`BEGIN TRANSACTION` ... `COMMIT` / `ROLLBACK`).
   - If stock availability drops before validation completes, the transaction rolls back cleanly with HTTP 409 Conflict.
4. **Stock Decrement & Ledger Auditing**:
   - Stock is decremented directly in the database (`products` table). Stock is **never** subtracted only in frontend state.
   - For every line item, an immutable record is inserted into the `stock_ledger` table with:
     - `movement_type`: `DELIVERY`
     - `reference_type`: `DELIVERY_ORDER`
     - `reference_id`: Order ID
     - `quantity_change`: Negative requested quantity (`-N`)
     - `quantity_before`: Stock balance before decrement
     - `quantity_after`: Stock balance after decrement

---

## API Endpoints

### Deliveries (`/api/deliveries`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/deliveries` | List all delivery orders (supports `?status=` query filter) |
| `GET` | `/api/deliveries/:id` | Fetch complete delivery order details, line items, and stock status |
| `POST` | `/api/deliveries` | Create a new delivery order with line items & stock pre-check |
| `POST` | `/api/deliveries/:id/pick` | Transition order from `DRAFT` to `PICKED` |
| `POST` | `/api/deliveries/:id/pack` | Transition order from `PICKED` to `PACKED` |
| `POST` | `/api/deliveries/:id/validate` | Validate order, deduct inventory in DB, and create ledger entry |

### Products (`/api/products`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Retrieve all inventory products with real-time stock levels |
| `GET` | `/api/products/:id` | Retrieve single product details |

### Stock Ledger (`/api/stock-ledger`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stock-ledger` | Retrieve historical audit trail of all inventory movements |

---

## Database Schema (SQLite)

- **`products`**: `id`, `sku`, `name`, `category`, `current_stock`, `unit`, `created_at`, `updated_at`
- **`warehouses`**: `id`, `name`, `code`, `address`
- **`delivery_orders`**: `id`, `order_number`, `customer_name`, `destination_address`, `status`, `notes`, `created_at`, `updated_at`, `validated_at`
- **`delivery_order_items`**: `id`, `delivery_order_id`, `product_id`, `requested_quantity`, `picked_quantity`, `packed_quantity`
- **`stock_ledger`**: `id`, `product_id`, `movement_type`, `reference_type`, `reference_id`, `quantity_change`, `quantity_before`, `quantity_after`, `timestamp`, `notes`

---

## Running the Application Locally

### Prerequisites
- Node.js (v18+)

### 1. Run Automated Test Suite
```bash
npm test
# or: cd backend && npm test
```

### 2. Start Backend Server
```bash
npm run start
# Server listens on http://localhost:5000
```

### 3. Start Frontend Dev Server
```bash
npm run dev:frontend
# Vite dev server starts on http://localhost:3000
```