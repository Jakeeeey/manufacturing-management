# 📊 Inventory Data Mapping Reference

This document maps each inventory-related feature in the planning, production, and QA modules to its corresponding **API Endpoint**, **Directus Database Collections**, and **Business Logic**.

---

## 1. Net Requirements Calculator
Calculates available-to-promise inventory levels by factoring in ledger balances, quarantine statuses, and existing scheduled reservations.

*   **API Endpoint**: `GET /api/manufacturing/planning-engineering?action=net-requirements&productIds={csv_ids}&branchId={id}`
*   **Directus Database Collections**:
    *   `products` (resolves safety stock target threshold via `maintaining_quantity`)
    *   `inventory_lots` (filters physical lot locations by `qa_status: "Passed"` and `branch_id`)
    *   `inventory_movements` (sums ledger balances `quantity` grouped by product and batch)
    *   `purchase_order_receiving` (incoming PO receipts filtered by `qa_status: "Passed"`, `is_reverted: 0`)
    *   `manufacturing_job_order_materials_reservations` (subtracts materials already reserved by ongoing job orders)
*   **Business Logic**:
    1.  Calculates physical on-hand stock by summing `inventory_movements` records that map to `inventory_lots` marked as `Passed`.
    2.  Fetches incoming PO receipts and subtracts active reservations (`status: Proceed, Ongoing, On Hold`) to calculate **Net Available Raw Stock**.
    3.  Calculates **Net Shortfall** = `Gross Demand - (On Hand - Safety Stock)`.

---

## 2. Batch Consolidation Panel: Available Version Stock
Determines the current stock level of a manufactured sub-assembly product matching a specific recipe version.

*   **API Endpoint**: `GET /api/manufacturing/planning-engineering?action=version-stock&productId={id}&recipeVersionId={id}&branchId={id}`
*   **Directus Database Collections**:
    *   `product_manufacturing_version` (resolves active recipe version)
    *   `inventory_lots` (fetches lots matching version and `qa_status: "Passed"`)
    *   `inventory_movements` (sums quantities in the ledger for those lots)
*   **Business Logic**:
    1.  Identifies all passed lots in `inventory_lots` associated with the target sub-assembly product and version.
    2.  Sums all ledger transaction records in `inventory_movements` for those lots to return the real-time dynamic quantity available for consolidation.

---

## 3. Release Production Run: Component Sufficiency Checklist
Validates if sufficient raw materials and sub-assemblies exist before transitioning a Job Order status from `Draft` to `Released`.

*   **API Endpoint**: `POST /api/manufacturing/planning-engineering` (triggers during `release-draft` or Job Order creation)
*   **Directus Database Collections**:
    *   `purchase_order_receiving` (raw material stock checks)
    *   `inventory_lots` (sub-assembly stock checks & physical lot matching)
    *   `inventory_movements` (ledger stock queries)
    *   `manufacturing_job_order_materials_reservations` (other ongoing reservations to subtract)
*   **Business Logic**:
    1.  Performs a dry-run BOM explosion for the target quantity.
    2.  For **sub-assemblies**: queries physical lot balances in `inventory_movements` and matches them against `inventory_lots`.
    3.  For **raw materials**: queries active PO receipts in `purchase_order_receiving` and subtracts existing reservations.
    4.  If a component's net available stock is lower than required, a shortfall is flagged, and the Job Order is saved as `Draft` (unless force-released).

---

## 4. Planning & Allocation Details: BOM Materials Allocation Worksheet
Displays the raw materials required for a routing step and suggestions for FIFO/FEFO allocations.

*   **API Endpoint**: `GET /api/manufacturing/planning-engineering?action=mats-bom&joRouteId={id}&routeId={id}`
*   **Directus Database Collections**:
    *   `manufacturing_routes_bom` (BOM ingredients required for the routing step)
    *   `products` (ingredient details and UOMs)
    *   `purchase_order_receiving` (PO receipts sorted by oldest `expiry_date` first)
    *   `inventory_lots` (matches physical storage locations)
*   **Business Logic**:
    1.  Fetches step-specific recipe requirements.
    2.  Performs a FEFO (First-Expired, First-Out) search on active `purchase_order_receiving` records for the branch.
    3.  Suggests specific batches and quantities to allocate to the job.

---

## 5. Daily Run & End-of-Shift Closure: Raw Material Consumption Reconciliation
Subtracts raw materials and yields finished goods in the ledger when closing a shift run.

*   **API Endpoint**: `POST /api/manufacturing/production/shift-run-log`
*   **Directus Database Collections**:
    *   `manufacturing_job_order_materials` (reads allocated quantities)
    *   `manufacturing_job_order_materials_reservations` (reads and releases allocations)
    *   `purchase_order_receiving` (tracks source receipts)
    *   `inventory_lots` (updates raw material lot quantities and creates the new finished yield lot in quarantine)
    *   `inventory_movements` (writes ledger transaction rows)
*   **Business Logic**:
    1.  **Deduct Raw Materials**: Inserts negative movements (`quantity < 0`, Transaction Type `1` - Consumage) in `inventory_movements` for raw materials, decreases the quantities in matching `inventory_lots` records, and releases/updates reservations.
    2.  **Add Yield output**: Inserts a new lot in `inventory_lots` with `qa_status: "Pending"` (quarantine status) and records a positive movement (`quantity > 0`, Transaction Type `2` - Finished Goods) in `inventory_movements` for the yielded batch.
