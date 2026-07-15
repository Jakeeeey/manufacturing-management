# 🍜 ERP Configuration Tutorial: Registering PROD-001 Canton Noodles 300g

This tutorial provides step-by-step instructions on how to register **PROD-001 (Canton Noodles 300g)** in the **VOS ERP Manufacturing Management System** based on the Standard Operating Procedure (S.O.P.) file: [PROD-001_SOP_CANTON _300g.docx](file:///C:/Users/Admin/Downloads/PROD-001_SOP_CANTON _300g.docx).

---

## 🏛️ System Architecture: Multi-Level BOM Structure

The ERP models noodle manufacturing using a **Multi-Level Bill of Materials (BOM)**. Rather than listing all ingredients and operations in a single flat list, the product is split into two relational levels to separate the core processing stages from the final packaging:

```mermaid
graph TD
    %% Node definitions
    Parent[Parent Product: PROD-001-BOX<br>UOM: BOX | Case of 18 Packs]
    Base[Base Product: PROD-001<br>UOM: PCS | Single Retail Pack]
    BoxMaterial[Packaging Material:<br>Canton 300g Master Shipping Box]
    Flour[Raw Material:<br>Wheat Flour Canton Grade]
    Oil[Raw Material:<br>Refined Frying Palm Oil]
    Bag[Packaging Material:<br>Printed Canton 300g Polybag]
    Additives[Additives & Water:<br>Mamanen, Papaporon, Salt, etc.]

    %% Relational flows
    Parent -->|Consumes 18x| Base
    Parent -->|Consumes 1x| BoxMaterial
    Base -->|Consumes 0.220 kg| Flour
    Base -->|Consumes 0.090 kg| Oil
    Base -->|Consumes 1.000 PC| Bag
    Base -->|Consumes| Additives
```

1. **The Base Product (The Pack/Piece - `PROD-001`)**: Models the single retail 300g pack. It handles processing steps 1 to 7 (Mixing, Blanching, Cooling, Fixing, Frying, Drying, Weighing, and Packaging) and its core raw materials.
2. **The Parent Product (The Box/Case - `PROD-001-BOX`)**: Models the master shipping box containing 18 retail packs. It handles step 8 (Boxing & Palletizing) and consumes the base pack as a sub-assembly component.

---

## 📁 Part 1: Registering the Base Product (Pack/Piece)

Navigate to the Finished Goods module at `/mm/finished-goods` (implemented in [FinishedGoodsModule.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/FinishedGoodsModule.tsx)) and click **Register Product**.

### 1. Product Details Configuration
Under the [ProductDetailsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/ProductDetailsTab.tsx), enter:

*   **Product Title**: `PROD-001 Canton Noodles 300g Pack`
*   **SKU / Code**: `PROD-001`
*   **Parent Product (Optional)**: `None (This is a parent product)`
*   **Base UOM**: `PCS` (or `PACK`)
*   **UOM Count (Pack Multiplier)**: `1`
*   **Density Factor (KG/L)**: `1.000`
*   **Expected Yield %**: `98.0` (accounts for normal product loss)
*   **Shelf Life (Days)**: `365`

---

### 2. Bill of Materials (BOM) Recipe Ingredients
In the [BOMRecipeTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/BOMRecipeTab.tsx), add the ingredients. 

> [!NOTE]
> The S.O.P. lists mixing quantities for a batch of 3 sacks of flour (75kg). Since the ERP tracks BOMs **per retail pack**, we divide the batch quantities by the estimated batch yield of **340 packs** (75kg flour / 0.220kg flour per pack) to scale the micro-ingredients.

| Material Name | Type | Qty Required | UOM | Wastage % | Step Association | Notes / Calculation |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **Wheat Flour (Canton Grade)** | Raw Mat | `0.2200` | KG | `1.50%` | 1. Mixing | 75kg / 340 packs |
| **Refined Frying Palm Oil** | Raw Mat | `0.0900` | KG | `3.00%` | 4. Frying | Absorbed weight per unit |
| **Water (Pure)** | Raw Mat | `0.0246` | KG | `0.00%` | 1. Mixing | 8,350g water / 340 packs |
| **Iodized Salt** | Raw Mat | `0.0011` | KG | `0.00%` | 1. Mixing | 385g salt / 340 packs |
| **Lye Water** | Raw Mat | `0.0004` | KG | `0.00%` | 1. Mixing | 125g lye / 340 packs |
| **Egg Yellow** | Raw Mat | `0.0001` | KG | `0.00%` | 1. Mixing | 6g color / 340 packs |
| **Mamanen** | Raw Mat | `0.000007` | KG | `0.00%` | 1. Mixing | 2.5g / 340 packs |
| **Papaporon** | Raw Mat | `0.000007` | KG | `0.00%` | 1. Mixing | 2.5g / 340 packs |
| **Printed Canton 300g Polybag** | Packaging | `1.0000` | PC | `2.00%` | 7. Packaging | Individual polybag wrap |

---

### 3. Production Stages & Routings
In the [RoutingsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/RoutingsTab.tsx), add the processing stages sequencially. 

> [!IMPORTANT]
> To enforce quality gates on the shop floor, check the **Requires QA** box on the Weighing and Packaging steps. This dynamically prompts operators for a QA Inspector pass before locking/advancing the job order.

| Seq | Step Name (Operation) | Labor Flat Rate | OH / Hr | Run Time (per Unit) | Setup Time | Requires QA | S.O.P. Instructions & Machine Settings |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `Mixing & Extruding` | ₱10.00 | ₱50.00 | `00:00:04` | `00:20:00` | `No` | Mix additives in pail. Add flour & additives. Mix: 10m, Rest: 10m. Roll noodle loops (150g - 155g). |
| **2** | `Blanching & Cooling` | ₱5.00 | ₱30.00 | `00:00:45` | `00:15:00` | `No` | 20 pcs/molder. Boil Tub 1 (w/ 1.5 - 2L Oil). Tub 1: 25s (shake side-to-side). Tub 2: 10s. Drain: 10s. |
| **3** | `Noodle Fixing & Prep` | ₱3.00 | ₱0.00 | `00:00:15` | `00:05:00` | `No` | Move blanched noodles to 10-pc frying molder on fixing table. Align pockets to prevent sticking. Lock molder. |
| **4** | `Canton Frying` | ₱8.00 | ₱60.00 | `00:02:00` | `00:30:00` | `No` | 5 tubs w/ 17 Gal oil @ 140-160°C. 2 molders per tub. Shake up & down. Fry: 1m. Drain: 30s. Dry: 30s. |
| **5** | `Tunnel Drying` | ₱2.00 | ₱40.00 | `00:00:30` | `00:10:00` | `No` | Run through blower conveyor at **speed 381**. Dry sides. |
| **6** | `Weighing & Quality Inspection` | ₱4.00 | ₱0.00 | `00:00:10` | `00:00:00` | **`Yes`** | Combine 2 cantons (300g). Inspect defects (Deform, Broken, Overcooked, Oily, Discolored, Foreign Material). |
| **7** | `Automated Packing & Cutting` | ₱3.00 | ₱45.00 | `00:00:03` | `00:20:00` | **`Yes`** | **Sealer: 165°C \| Cutter: 180°C**. Inspect seals, stickers, cuts, and overweight/underweight wrappers. |

---

## 📦 Part 2: Registering the Parent Product (Box/Case)

Once `PROD-001` is saved, click **Register Product** again to create the parent box variant.

### 1. Product Details Configuration
Under the [ProductDetailsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/ProductDetailsTab.tsx), enter:

*   **Product Title**: `PROD-001-BOX Canton Noodles 300g Box (18 Packs)`
*   **SKU / Code**: `PROD-001-BOX`
*   **Parent Product (Optional)**: Select `PROD-001 Canton Noodles 300g Pack` from the dropdown list.
*   **Base UOM**: `BOX` (or `CASE`)
*   **UOM Count (Pack Multiplier)**: `18` (this automatically multiplies base cost and price by 18)
*   **Expected Yield %**: `100.0`
*   **Shelf Life (Days)**: `365`

### 2. Bill of Materials (BOM) Recipe Ingredients
In the [BOMRecipeTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/BOMRecipeTab.tsx), add the parent box assembly materials:

| Material Name | Type | Qty Required | UOM | Wastage % | Step Association | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **PROD-001 Canton Noodles 300g Pack** | Sub-Assy | `18.0000` | PCS | `0.00%` | 1. Boxing | Child product packs |
| **Canton 300g Master Shipping Box** | Packaging | `1.0000` | PC | `0.50%` | 1. Boxing | Master cardboard box |

### 3. Production Stages & Routings
In the [RoutingsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/RoutingsTab.tsx), configure the final assembly step:

| Seq | Step Name (Operation) | Labor Flat Rate | OH / Hr | Run Time (per Unit) | Setup Time | Requires QA | S.O.P. Instructions & Machine Settings |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `Boxing & Pallet Stacking` | ₱15.00 | ₱10.00 | `00:01:30` | `00:05:00` | **`Yes`** | Pack 18 bags/box. Tape box securely (no detach). Palletize **25 boxes/pallet** in alternating layers. |

> [!TIP]
> **Pallet Layer Orientations** from S.O.P. must be maintained during palletizing:
> *   **Layer 1 Orientation**: Standard vertical pattern.
> *   **Layer 2 Orientation**: Alternate perpendicular alignment to cross-lock boxes.

---

## 📈 Part 3: Cost Rollup & Margin Simulation

Once registered, navigate to the [CostRollupTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/CostRollupTab.tsx) for `PROD-001-BOX`:

1.  **Dynamic Cost Aggregation**: The ERP automatically calculates the total materials cost of the 18 child packs (Flour, Oil, Bags) and rolls them up with the shipping box.
2.  **Conversion Overhead**: The system adds up labor rates and machine overhead costs across the 7 base workstation steps (multiplied by 18) plus the Boxing & Palletizing labor.
3.  **Margin Simulation**: Planners can simulate target selling prices (e.g. ₱600.00 per Box) to view gross profit margins and break-even batch volumes in real time.

---

## 🛠️ Troubleshooting & Shop Floor Execution

*   **Active Status**: Ensure both `PROD-001` and `PROD-001-BOX` have their versions set to **Active Status (v1.0)** to make them visible in the scheduling and dispatch planning dashboards.
*   **QA Gates Enforcement**: If an operator attempts to complete step 6 (Weighing) or step 7 (Packaging) without QA verification, the shop floor tablet will lock the task. The QA Inspector must review the checklists (e.g. verifying there are no deforms, broken, oily, or unsealed packs) and sign off via the [ProductionWorkflowModule.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/production-workflow/ProductionWorkflowModule.tsx) checklist panel.
