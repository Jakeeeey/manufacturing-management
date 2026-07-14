# 🧪 End-to-End Verification Guide: Lot Management & Inventory Ledger

This guide details the step-by-step procedures to verify that the **Planning**, **Shop Floor Workflow**, **Quality Assurance**, and **Database Ledger** are fully integrated, aligned, and serving fresh, uncached data.

---

## 📋 Prerequisites
1.  **Start the Next.js Dev Server**:
    Run `npm run dev` in your terminal to start the server at `http://localhost:3000`.
2.  **Verify Directus API Status**:
    Ensure the Directus instance is running at `http://vtc:8074` and the environment token matches the one in `.env.local`.

---

## 🧪 E2E Verification Workflow

### Step 1: Schedule & Dispatch a Job Order (Planning Page)
*   **Target Page**: `http://localhost:3000/mm/planning-engineering`
*   **Objective**: Confirm the planner reads fresh stock values and dispatches jobs.

1.  Open the **Planning & Engineering** module.
2.  Review the **Net Requirements Table** to verify that safety stocks and current available quantities are displayed without delays or stale values.
3.  Choose a finished good SKU, configure its target production volume, select an active BOM recipe version, and assign shop floor operators to the routing steps.
4.  Click the **Release** button (or dispatch trigger).
5.  **Success Indicator**: The Job Order is created with status `Proceed` (released).

---

### Step 2: Shop Floor Routing & Yield Closure (Production Page)
*   **Target Page**: `http://localhost:3000/mm/production-workflow`
*   **Objective**: Verify operator task progression, intermediate QA checkpoint gates, and yield/consumption logging.

1.  Open the **Production Workflow** module.
2.  Verify the dispatched Job Order from Step 1 appears in the active run queue.
3.  Have an operator clock into the first routing step. Log setup hours, actual run hours, and any scrap.
4.  **Verify intermediate QA gates**: Try to start the second routing step *before* checking off the first step's QA verification. The system should block progression. Log an inspector sign-off to pass the gate, then proceed.
5.  Complete all routing tasks until you reach the final step, then click **Log Shift / Close Job**.
6.  Inside the yield closure modal, fill in:
    *   **Yield Quantity**: e.g., `1,500 packs` (finished output).
    *   **Batch/Lot Code**: e.g., `B-YLD-E2E-TEST` (custom batch).
    *   **Warehouse Location**: Select a target bin/rack (maps to `lots.lot_id` reference).
    *   **Actual Raw Consumed**: Enter the raw material weights used.
7.  Click **Submit**.
8.  **Success Indicator**: Toast notification confirms shift closure, yield logging, and material deduction.

---

### Step 3: Transaction Ledger Verification (Database Verification)
*   **Objective**: Confirm the transaction ledger records movements correctly and places the yielded batch under QA quarantine.

1.  Query the **`inventory_movements`** database collection or inspect logs.
2.  Verify that **Negative Movements** (quantity OUT) are logged for each consumed raw material (using transaction type `1` - Consumage).
3.  Verify that a **Positive Movement** (quantity IN) is logged for the yielded batch `B-YLD-E2E-TEST` (using transaction type `2` - Finished Goods).
4.  Query the **`inventory_lots`** database collection.
5.  Verify a new row exists for `B-YLD-E2E-TEST` with `qa_status: "Pending"`.

---

### Step 4: Quarantine Inspection & Lot Release (QA Page)
*   **Target Page**: `http://localhost:3000/mm/manufacturing-qa`
*   **Objective**: Verify microbiological checklist audits and batch release updates.

1.  Open the **Manufacturing QA** module and navigate to the **Final QA Releases** tab.
2.  Verify that batch `B-YLD-E2E-TEST` appears in the quarantine list with status `QA Hold` / `Pending`.
3.  Click the lot row to open the QA release inspection modal.
4.  Log test values: check packaging seals, check label compliance, select **Approved** as the overall disposition, and input a Certificate of Analysis (COA) reference number.
5.  Click **Submit Final Lot Release**.
6.  **Success Indicator**: System updates lot records, and a success toast appears.

---

### Step 5: Freshness & Loop Closure Verification (Reconciliation)
*   **Target Page**: `http://localhost:3000/mm/planning-engineering` (or query endpoint `GET /api/manufacturing/planning-engineering?action=net-requirements`)
*   **Objective**: Confirm the newly released lot is immediately available for allocation.

1.  Open the **Planning & Engineering** module (or refresh the net requirements list).
2.  Find the finished product SKU from Step 1.
3.  **Freshness Check**: Verify that the `1,500 packs` from `B-YLD-E2E-TEST` are immediately added to the on-hand stock count.
4.  Because API routes and helper fetches are configured with `cache: "no-store"` and `dynamic = "force-dynamic"`, **you should see the new inventory balance instantly without needing server restarts or encountering stale page cache errors**.
