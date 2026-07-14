# Inventory Architecture Analysis: Snapshot vs. Ledger-Based Models

This document compares the current snapshot-based inventory model with your proposed **Transaction Ledger Model** (querying `inventory_movements` directly), highlighting design patterns, database performance, and implementation paths.

---

## 1. Comparing the Architectures

### Option A: Snapshot-Based Model (Current)
Queries current stock levels from state tables like `inventory_lots` and `purchase_order_receiving`.

```
[Transaction Event] ──> Write to inventory_movements (Ledger)
                     └─> UPDATE inventory_lots (Snapshot)
```

*   **Pros**:
    *   **Extremely Fast Reads**: Direct primary key or index lookups of `quantity` columns.
    *   **Simpler Queries**: Status fields (like `qa_status`) reside in the same record.
*   **Cons**:
    *   **Data Drift Risk**: If a process halts halfway, the snapshot and the ledger will fall out of sync.
    *   **Schema Redundancy**: Multiple tables track quantity separately.

### Option B: Transaction Ledger Model (Proposed)
Aggregates the transaction history in `inventory_movements` to compute stock in real time.

```
[Transaction Event] ──> Write to inventory_movements (Ledger)
[Inventory Query]   ──> SUM(quantity) GROUP BY product_id, batch_no
```

*   **Pros**:
    *   **Single Source of Truth**: Eliminates drift. The ledger is the stock.
    *   **Perfect Auditability**: Every change to stock is backed by a transaction row.
*   **Cons**:
    *   **Query Performance**: As the transaction table grows (millions of rows), summing columns can slow down.
    *   **Missing Status Fields**: `inventory_movements` logs change events, but doesn't store state details like `qa_status` (requires joining lot/item definitions).

---

## 2. Implementing the Ledger Model

To fetch available stock using your `inventory_movements` schema, the BFF endpoint would use the following SQL query pattern:

```sql
SELECT 
    m.product_id,
    m.batch_no,
    m.expiry_date,
    m.manufacturing_date,
    SUM(m.quantity) AS current_stock
FROM inventory_movements m
JOIN inventory_lots l ON l.lot_number = m.batch_no AND l.product_id = m.product_id
WHERE 
    m.product_id = :productId 
    AND m.branch_id = :branchId
    AND l.qa_status = 'Passed'
GROUP BY 
    m.product_id, 
    m.batch_no, 
    m.expiry_date, 
    m.manufacturing_date
HAVING 
    SUM(m.quantity) > 0
ORDER BY 
    m.expiry_date ASC; -- FEFO Allocation
```

### Key Performance Guardrails
To prevent performance degradation on large tables, the following indexes in your schema are critical:
1.  **`idx_fefo_allocation`** (`product_id`, `branch_id`, `expiry_date`, `created_at`): Ensures the FEFO engine can resolve and sort lots instantly without scanning the entire table.
2.  **`idx_fifo_allocation`** (`product_id`, `branch_id`, `manufacturing_date`, `created_at`): Handles standard FIFO routing.

---

## 3. Recommendation: The Hybrid Pattern

For enterprise-grade ERPs, a **Hybrid Ledger-Snapshot Pattern** is typically the best solution:

1.  **Ledger as Truth**: All inventory queries resolve stock levels by aggregating `inventory_movements`.
2.  **Read Cache / Materialized View**: Create a PostgreSQL trigger or database View that automatically compiles `inventory_movements` into a virtual `inventory_lots` view on write.
    *   *Example*:
        ```sql
        CREATE VIEW v_available_stock AS
        SELECT product_id, batch_no, SUM(quantity) as qty
        FROM inventory_movements
        GROUP BY product_id, batch_no;
        ```
    This gives you the read speed of a snapshot table with the integrity guarantees of a ledger.
