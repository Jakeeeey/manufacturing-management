# 🍜 ERP Configuration Tutorial: Registering PROD-002 Bihon 454g

This tutorial provides step-by-step instructions on how to register **PROD-002 (Bihon 454g)** in the **VOS ERP Manufacturing Management System** based on the Standard Operating Procedure (S.O.P.) file: [PROD-002_SOP_BIHON_454g.docx](file:///C:/Users/Admin/Downloads/PROD-002_SOP_BIHON_454g.docx).

---

## 🏛️ System Architecture: Multi-Level BOM Structure

The ERP models Bihon manufacturing using a **Multi-Level Bill of Materials (BOM)**. The production flow splits the processing stages from the master grouping:

```mermaid
graph TD
    %% Node definitions
    Parent[Parent Product: PROD-002-BAG<br>UOM: BAG | Mother Bag of 20 Packs]
    Base[Base Product: PROD-002<br>UOM: PCS | Single Retail Pack]
    BagMaterial[Packaging Material:<br>Bihon 454g Mother Bag Plastic]
    Starch[Raw Material:<br>Cornstarch Canton/Bihon Grade]
    Bag[Packaging Material:<br>Printed Bihon 454g Polybag]
    Additives[Additives & Water:<br>CMC, Poryrin C, Nenkyo, Water]

    %% Relational flows
    Parent -->|Consumes 20x| Base
    Parent -->|Consumes 1x| BagMaterial
    Base -->|Consumes 0.450 kg| Starch
    Base -->|Consumes 1.000 PC| Bag
    Base -->|Consumes| Additives
```

1. **The Base Product (The Pack/Piece - `PROD-002`)**: Models the single retail 454g pack. It handles processing steps 1 to 9 (Mixing, Extruding/Controlling, Steaming, Fixing, Pre-Drying, Cutting, Post-Drying, Receiving/Weighing, and Packaging) and raw material contents.
2. **The Parent Product (The Mother Bag - `PROD-002-BAG`)**: Models the master shipping bag containing 20 retail packs. It handles step 10 (Mother Bagging & Palletizing) and consumes the base pack.

---

## 📁 Part 1: Registering the Base Product (Pack/Piece)

Navigate to the Finished Goods module at `/mm/finished-goods` (implemented in [FinishedGoodsModule.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/FinishedGoodsModule.tsx)) and click **Register Product**.

### 1. Product Details Configuration
Under the [ProductDetailsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/ProductDetailsTab.tsx), enter:

*   **Product Title**: `PROD-002 Bihon 454g Pack`
*   **SKU / Code**: `PROD-002`
*   **Parent Product (Optional)**: `None (This is a parent product)`
*   **Base UOM**: `PCS` (or `PACK`)
*   **UOM Count (Pack Multiplier)**: `1`
*   **Density Factor (KG/L)**: `1.000`
*   **Expected Yield %**: `97.0` (accounts for starch/noodle scrap)
*   **Shelf Life (Days)**: `365`

---

### 2. Bill of Materials (BOM) Recipe Ingredients
In the [BOMRecipeTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/BOMRecipeTab.tsx), add the ingredients. 

> [!NOTE]
> The S.O.P. lists mixing quantities for additives and liquid water per mixing machine cycle. Assuming a standard **25kg bag of Cornstarch** is used per batch, the batch will yield approximately **55 packs** of dry Bihon (accounting for water absorption, steaming moisture, and drying losses). We scale the batch ingredients down per individual pack by dividing by **55**.

| Material Name | Type | Qty Required | UOM | Wastage % | Step Association | Notes / Calculation |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **Cornstarch (Bihon Grade)** | Raw Mat | `0.4500` | KG | `2.00%` | 1. Mixing | 25kg / 55 packs |
| **Water (Pure)** | Raw Mat | `0.0272` | KG | `0.00%` | 1. Mixing | 1.5 Liters water / 55 packs |
| **Poryrin C** | Raw Mat | `0.0045` | KG | `0.00%` | 1. Mixing | 250g binder / 55 packs |
| **CMC (Carboxymethyl Cellulose)** | Raw Mat | `0.0036` | KG | `0.00%` | 1. Mixing | 200g additive / 55 packs |
| **Nenkyo** | Raw Mat | `0.0022` | KG | `0.00%` | 1. Mixing | 120g thickener / 55 packs |
| **Printed Bihon 454g Polybag** | Packaging | `1.0000` | PC | `1.50%` | 9. Packaging | Individual polybag wrap |

---

### 3. Production Stages & Routings
In the [RoutingsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/RoutingsTab.tsx), add the processing stages sequencially.

> [!IMPORTANT]
> To enforce strict quality gates on the shop floor, check the **Requires QA** box on the Weighing and Packaging steps. This prevents operators from advancing the Job Order until a QA Inspector verifies weight parameters and signs off on the quality inspection check list.

| Seq | Step Name (Operation) | Labor Flat Rate | OH / Hr | Run Time (per Unit) | Setup Time | Requires QA | S.O.P. Instructions & Machine Settings |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `Mixing & Steaming Additives` | ₱12.00 | ₱50.00 | `00:00:08` | `00:10:00` | `No` | Mix CMC (200g), Poryrin C (250g), Nenkyo (120g). Lock mixing cover side-by-side. Mixer ON (3m). Add 1.5L water after 1m. Gently rotate steam valves 15° for <5s. Press STEAM START (250s). Spatula clean edges. Final mix (10s). |
| **2** | `Extrusion Controller` | ₱8.00 | ₱45.00 | `00:00:12` | `00:15:00` | `No` | Spindle rotate to Extruder #1. Check fullness, transfer to Extruder #2 -> Spiral -> Final Extruder. Avoid floor spills. **Set conveyor speed to 13.30**. Check for tangled bihon. |
| **3** | `Tunnel Steaming` | ₱4.00 | ₱40.00 | `00:00:15` | `00:10:00` | `No` | Switch steamer valves 15 degrees. Maintain tunnel temperature at **90°C - 95°C**. |
| **4** | `Fixing & Stretching` | ₱6.00 | ₱0.00 | `00:00:20` | `00:05:00` | `No` | Run through rollers to stretch bihon and avoid bump areas, thick/deformed/tangled parts. Clean rollers regularly. Check for grease/dirt. |
| **5** | `Pre-Drying Tunnel` | ₱3.00 | ₱35.00 | `00:00:15` | `00:10:00` | `No` | Switch pre-drying valve to 90 degrees. Maintain tunnel temperature at **85°C - 90°C**. |
| **6** | `Cutter Control` | ₱5.00 | ₱40.00 | `00:00:05` | `00:05:00` | `No` | Turn ON cutter/conveyor. Set **conveyor speed to 21.77** and **cutter speed to 26.07**. |
| **7** | `Post-Drying Tunnel` | ₱3.00 | ₱35.00 | `00:00:25` | `00:10:00` | `No` | Switch valve 90 degrees. Set **conveyor speed to 18.07** to complete drying. |
| **8** | `Receiving & Weight Audit` | ₱6.00 | ₱0.00 | `00:00:10` | `00:00:00` | **`Yes`** | Pick bihon on conveyor. Combine 5-6 pieces. Weigh to **450g - 460g** (454g target). Audit defects (Underfill, Grease, Broken, Discolored, Uncut, Deformed). Cool in cage. |
| **9** | `Automated Packaging` | ₱4.00 | ₱45.00 | `00:00:03` | `00:15:00` | **`Yes`** | Put on packaging conveyor. Inspect seals, tears, cuts. |

---

## 📦 Part 2: Registering the Parent Product (Mother Bag)

Once `PROD-002` is saved, click **Register Product** again to create the parent shipping bag.

### 1. Product Details Configuration
Under the [ProductDetailsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/ProductDetailsTab.tsx), enter:

*   **Product Title**: `PROD-002-BAG Bihon 454g Mother Bag (20 Packs)`
*   **SKU / Code**: `PROD-002-BAG`
*   **Parent Product (Optional)**: Select `PROD-002 Bihon 454g Pack` from the dropdown list.
*   **Base UOM**: `BAG` (or `BNDL` / `CASE`)
*   **UOM Count (Pack Multiplier)**: `20` (automatically scales the base cost and target selling price by 20)
*   **Expected Yield %**: `100.0`
*   **Shelf Life (Days)**: `365`

### 2. Bill of Materials (BOM) Recipe Ingredients
In the [BOMRecipeTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/BOMRecipeTab.tsx), add the bundle components:

| Material Name | Type | Qty Required | UOM | Wastage % | Step Association | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **PROD-002 Bihon 454g Pack** | Sub-Assy | `20.0000` | PCS | `0.00%` | 1. Mother Bagging | Child product packs |
| **Bihon 454g Mother Bag Polybag** | Packaging | `1.0000` | PC | `0.50%` | 1. Mother Bagging | Master bundle outer bag |

### 3. Production Stages & Routings
In the [RoutingsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/RoutingsTab.tsx), configure the final bundling step:

| Seq | Step Name (Operation) | Labor Flat Rate | OH / Hr | Run Time (per Unit) | Setup Time | Requires QA | S.O.P. Instructions & Machine Settings |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `Mother Bagging & Palletizing` | ₱12.00 | ₱8.00 | `00:02:00` | `00:05:00` | **`Yes`** | Insert mother bag on holder. Pack exactly **20 packs/bag**. Seal with tape. Palletize **50 mother bags/pallet**. |

> [!TIP]
> **Pallet Layer Orientations** from S.O.P. must be strictly enforced when loading finished mother bags on pallets. Check bag sealing quality, ensuring tape is not detached and bag is not teared/dirty before palletizing.

---

## 📈 Part 3: Cost Rollup & Margin Simulation

Once registered, navigate to the [CostRollupTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/CostRollupTab.tsx) for `PROD-002-BAG`:

1.  **Multi-Level Cost Rollup**: The system automatically aggregates the raw material costs of the 20 packs (Cornstarch, additives, water, polybags) and adds the mother bag packaging cost.
2.  **Labor & Machine Overhead (OH)**: The system sums the conversion costs of the 9 base workstation steps (multiplied by 20) and adds the flat labor rate and overhead of the Mother Bagging operation.
3.  **Simulation & Margin Tracking**: Planners can input a Target Selling Price per Mother Bag to view standard gross profit margins and calculate break-even volumes for production batches.

---

## 🛠️ Troubleshooting & Shop Floor Execution

*   **Active Status**: Ensure both `PROD-002` and `PROD-002-BAG` versions are flagged **Active (v1.0)** to make them selectable in scheduling dashboards.
*   **QA Inspections**: Checking the **Requires QA** box triggers the QA inspection gates. Floor operators will be blocked from completing step 8 (Weight Audit), step 9 (Packaging), and the mother bag assembly if inspections are pending. QA Inspectors must verify the weight parameters (**450g - 460g**), count (**20 packs**), and quality criteria in the [ProductionWorkflowModule.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/production-workflow/ProductionWorkflowModule.tsx) dashboard.
