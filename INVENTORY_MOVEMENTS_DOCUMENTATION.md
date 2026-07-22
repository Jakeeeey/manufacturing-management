# 📊 Inventory Movements Ledger — Architectural & Technical Documentation

> **System**: VOS Manufacturing Management ERP  
> **Core Architecture**: Double-Entry Style Transaction Ledger Model  
> **Database Table**: `inventory_movements`  
> **Primary Role**: Single Source of Truth for Real-Time Stock Balances, FEFO/FIFO Scheduling, and Batch Traceability

---

## 📑 1. Core Architecture & Concept

In the VOS Manufacturing Management system, inventory is managed using a **Transaction Ledger Model**. Rather than overwriting a static stock quantity column, every physical addition or deduction of inventory creates an immutable ledger row in **`inventory_movements`**.

### Stock Calculation Formula
Current stock on hand for any product, storage location, recipe version, or batch is derived dynamically by computing the sum of all movement quantities:

$$\text{Current Stock On Hand} = \sum_{i=1}^{n} \text{quantity}_i$$

- **Positive Quantity ($+ \text{qty}$)**: Stock Inflows (PO Receivings, Finished Goods Yields, Physical Inventory Surplus).
- **Negative Quantity ($- \text{qty}$)**: Stock Outflows (JO Material Consumage, Sales Issue Shipments, Deficits, Wastage/Scrap).

---

## 🗄️ 2. Database Schema Definition

```sql
CREATE TABLE `inventory_movements` (
	`movement_id` INT NOT NULL AUTO_INCREMENT,
	`product_id` INT NOT NULL COMMENT 'References products.product_id',
	`version_id` INT NULL DEFAULT NULL COMMENT 'References product_manufacturing_version.version_id',
	`lot_id` INT NOT NULL COMMENT 'References lots.lot_id (storage location/rack/bin)',
	`branch_id` INT NOT NULL COMMENT 'References branches.id',
	`transaction_type_id` INT NOT NULL COMMENT 'References inventory_transaction_types.transaction_type_id',
	`source_document_id` INT NOT NULL COMMENT 'Origin primary key value (e.g. purchase_order_receiving_id, detail_id)',
	`source_document_no` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Readable reference code (e.g. REC-2026-001, JO-660973, PH-20260721-1001)' COLLATE 'utf8mb4_unicode_ci',
	`batch_no` VARCHAR(100) NOT NULL COMMENT 'Batch / Lot Code' COLLATE 'utf8mb4_unicode_ci',
	`expiry_date` DATE NULL DEFAULT NULL COMMENT 'Target for FEFO scheduling',
	`manufacturing_date` DATE NULL DEFAULT NULL COMMENT 'Target for FIFO scheduling',
	`quantity` DECIMAL(15,4) NOT NULL COMMENT 'Positive (+) for additions, negative (-) for deductions',
	`created_by` INT NOT NULL COMMENT 'References user.user_id',
	`created_at` DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`remarks` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	PRIMARY KEY (`movement_id`) USING BTREE,
	INDEX `idx_fefo_allocation` (`product_id`, `branch_id`, `expiry_date`, `created_at`) USING BTREE,
	INDEX `idx_fifo_allocation` (`product_id`, `branch_id`, `manufacturing_date`, `created_at`) USING BTREE,
	INDEX `fk_movement_lot` (`lot_id`) USING BTREE,
	INDEX `fk_movement_transaction_type` (`transaction_type_id`) USING BTREE,
	INDEX `fk_movement_version` (`version_id`) USING BTREE,
	INDEX `FK_inventory_movements_user` (`created_by`) USING BTREE,
	CONSTRAINT `fk_movement_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_movement_lot` FOREIGN KEY (`lot_id`) REFERENCES `lots` (`lot_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_movement_transaction_type` FOREIGN KEY (`transaction_type_id`) REFERENCES `inventory_transaction_types` (`transaction_type_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `fk_movement_version` FOREIGN KEY (`version_id`) REFERENCES `product_manufacturing_version` (`version_id`) ON UPDATE CASCADE ON DELETE SET NULL,
	CONSTRAINT `FK_inventory_movements_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB;
```

---

## 🔁 3. Transaction Types Registry (`inventory_transaction_types`)

Every ledger entry is categorized by a `transaction_type_id` specifying its movement direction and originating module:

| Type ID | Type Name | Direction | Origin Table | Description |
|---|---|---|---|---|
| **1** | Job Order Consumage | **`OUT`** ($-$) | `manufacturing_job_order_yield_ledger_bom_consumage` | Material consumption during job order shop floor execution. |
| **2** | Job Order Finished Goods | **`IN`** ($+$) | `manufacturing_job_order_yield_ledger` | Finished goods yield output posted to stock. |
| **3** | Purchase Receiving QA | **`IN`** ($+$) | `purchase_order_receiving` | Raw/packaging materials received and accepted by QA. |
| **4** | Sales Issue | **`OUT`** ($-$) | `consolidator_details` | Finished goods shipped for sales orders. |
| **5** | QA Reject / Bad Order Receipt | **`IN`** / **`OUT`** | `purchase_order_receiving` | Defective material receipts. |
| **6** | Physical Inventory Surplus | **`IN`** ($+$) | `physical_inventory_details` | Adjustment entry when physical count > system snapshot. |
| **7** | Physical Inventory Deficit | **`OUT`** ($-$) | `physical_inventory_details` | Adjustment entry when physical count < system snapshot. |
| **8** | Job Order Wastage / Scrap | **`OUT`** ($-$) | `manufacturing_job_order_wastage` | Production floor scrap, spoilage, or material loss. |

---

## 🔍 4. Core Query Patterns & Calculations

### Pattern A: Real-Time Stock Balance per Storage Bin & Batch

```sql
SELECT 
    m.product_id,
    p.product_code,
    p.product_name,
    m.version_id,
    pmv.version_name,
    m.lot_id,
    l.lot_name AS storage_bin_name,
    m.batch_no,
    m.expiry_date,
    SUM(m.quantity) AS current_stock_on_hand
FROM inventory_movements m
INNER JOIN products p ON m.product_id = p.product_id
LEFT JOIN lots l ON m.lot_id = l.lot_id
LEFT JOIN product_manufacturing_version pmv ON m.version_id = pmv.version_id
WHERE m.branch_id = :branchId
GROUP BY 
    m.product_id,
    m.version_id,
    m.lot_id,
    m.batch_no,
    m.expiry_date
HAVING SUM(m.quantity) > 0;
```

---

### Pattern B: Cutoff Date Inventory Snapshot (Physical Inventory Module)

To query stock levels exactly as they were at a specific historical **Cutoff Date**:

```sql
SELECT 
    m.product_id,
    m.version_id,
    m.lot_id,
    m.batch_no,
    SUM(m.quantity) AS snapshot_system_count
FROM inventory_movements m
WHERE m.branch_id = :branchId
  AND m.created_at <= :cutoffDateTimestamp
GROUP BY 
    m.product_id,
    m.version_id,
    m.lot_id,
    m.batch_no
HAVING SUM(m.quantity) != 0;
```

---

### Pattern C: FEFO (First-Expired, First-Out) Pick Allocation

```sql
SELECT 
    m.product_id,
    m.lot_id,
    l.lot_name,
    m.batch_no,
    m.expiry_date,
    SUM(m.quantity) AS available_quantity
FROM inventory_movements m
LEFT JOIN lots l ON m.lot_id = l.lot_id
WHERE m.product_id = :productId
  AND m.branch_id = :branchId
GROUP BY 
    m.product_id,
    m.lot_id,
    m.batch_no,
    m.expiry_date
HAVING SUM(m.quantity) > 0
ORDER BY 
    m.expiry_date ASC,
    m.created_at ASC;
```

---

## ⚡ 5. Performance Indexing Strategy

To support high-throughput manufacturing operations, the table includes composite indexes for fast execution:

1. **`idx_fefo_allocation` (`product_id`, `branch_id`, `expiry_date`, `created_at`)**:
   - Accelerates FEFO material picking for job order allocation and sales order fulfillment.

2. **`idx_fifo_allocation` (`product_id`, `branch_id`, `manufacturing_date`, `created_at`)**:
   - Accelerates FIFO picking for items without expiry dates.

3. **`fk_movement_lot` (`lot_id`)**:
   - Speeds up location bin lookups (`lots.lot_name`).

4. **`fk_movement_version` (`version_id`)**:
   - Speeds up BOM recipe version lookups (`product_manufacturing_version.version_name`).

---

## 🌐 6. BFF API Endpoints (Schema-Aligned)

The system exposes Backend-for-Frontend (BFF) endpoints to manage and stream inventory movements. These endpoints act as a gateway to the Directus ledger collection and enforce schema validations (fully aligned with the new `version_id` schema updates).

### A. GET `/api/manufacturing/inventory/movements`
Retrieves a filtered, paginated list of movements.
*   **Query Parameters**:
    *   `productId` (optional): Filter by product.
    *   `branchId` (optional): Filter by branch.
    *   `lotId` (optional): Filter by storage lot.
    *   `batchNo` (optional): Partial match by batch code.
    *   `sinceId` (optional): Retrieve movements with `movement_id > sinceId` (cursor-pagination).
    *   `limit` (optional, default: 100): Maximum records to retrieve (capped at 500).
*   **Response Payload**:
    ```json
    {
      "success": true,
      "cursor": {
        "lastId": 254,
        "count": 1
      },
      "data": [
        {
          "movement_id": 254,
          "product_id": 12,
          "version_id": 3,
          "lot_id": 2,
          "branch_id": 1,
          "transaction_type_id": 1,
          "source_document_id": 994,
          "source_document_no": "JO-660973",
          "batch_no": "B-YLD-20260714",
          "expiry_date": "2027-07-14",
          "manufacturing_date": "2026-07-14",
          "quantity": -150.0000,
          "created_by": 24,
          "created_at": "2026-07-22T01:39:43.000Z",
          "remarks": "Raw flour consumption for Job Order yield logs."
        }
      ]
    }
    ```

### B. POST `/api/manufacturing/inventory/movements`
Bulk logs new inventory movements. Enforces Zod validation schemas.
*   **Request Payload**:
    ```json
    {
      "movements": [
        {
          "product_id": 12,
          "version_id": 3, // Optional: References recipe version_id (BOM tracking)
          "lot_id": 2,
          "branch_id": 1,
          "transaction_type_id": 1,
          "source_document_id": 994,
          "source_document_no": "JO-660973",
          "batch_no": "B-YLD-20260714",
          "expiry_date": "2027-07-14",
          "manufacturing_date": "2026-07-14",
          "quantity": -150.0000,
          "remarks": "Raw flour consumption for Job Order yield logs."
        }
      ]
    }
    ```
*   **Response Payload**:
    ```json
    {
      "success": true,
      "message": "Successfully posted 1 inventory movement(s)",
      "data": [
        {
          "movement_id": 255,
          "product_id": 12,
          "version_id": 3,
          "lot_id": 2,
          "branch_id": 1,
          "transaction_type_id": 1,
          "source_document_id": 994,
          "source_document_no": "JO-660973",
          "batch_no": "B-YLD-20260714",
          "expiry_date": "2027-07-14",
          "manufacturing_date": "2026-07-14",
          "quantity": -150.0000,
          "created_by": 24,
          "created_at": "2026-07-22T01:40:00.000Z",
          "remarks": "Raw flour consumption for Job Order yield logs."
        }
      ]
    }
    ```

### C. GET `/api/manufacturing/inventory/movements/stream` (Real-Time SSE)
Establishes a Server-Sent Events (SSE) connection that polls Directus for updates and streams new inventory movements to client-side dashboards automatically.
*   **Stream Event Types**:
    *   `event: initial` (Fires on initial connection to seed client cursor)
    *   `event: movement` (Fires whenever a new inventory movement is added with the serialized payload)
*   **Payload Format (`event: movement`)**:
    ```json
    {
      "movement_id": 255,
      "product_id": 12,
      "version_id": 3,
      "lot_id": 2,
      "branch_id": 1,
      "transaction_type_id": 1,
      "source_document_id": 994,
      "source_document_no": "JO-660973",
      "batch_no": "B-YLD-20260714",
      "expiry_date": "2027-07-14",
      "manufacturing_date": "2026-07-14",
      "quantity": -150.0000,
      "created_by": 24,
      "created_at": "2026-07-22T01:40:00.000Z",
      "remarks": "Raw flour consumption for Job Order yield logs."
    }
    ```
