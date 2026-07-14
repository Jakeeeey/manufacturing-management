# 🧴 ERP Configuration Tutorial: Registering PROD-003 Palm Oil SWAK (350ml, 500ml, 1L)

This tutorial provides step-by-step instructions on how to register the **PROD-003 Palm Oil SWAK Family** in the **VOS ERP Manufacturing Management System** based on the S.O.P. file [PROD-003_SOP_OIL.docx](file:///C:/Users/Admin/Downloads/PROD-003_SOP_OIL.docx) and the costing parameters inside [Oil Costingv2 (2) (1).xlsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/Oil%20Costingv2%20(2)%20(1).xlsx).

---

## 🏛️ System Architecture: Multi-Level BOM Structure

The ERP models oil manufacturing using a **Multi-Level Bill of Materials (BOM)**. Because the filling and packaging line processes individual bottles before bundling them into shipping cartons, we split each size variant into two relational levels:

```mermaid
graph TD
    %% Node definitions
    Parent350[Parent Product: PROD-003-350-BOX<br>UOM: BOX | Case of 36 Bottles]
    Base350[Base Product: PROD-003-350<br>UOM: PCS | 350ml SWAK Bottle]
    Cardboard350[Packaging Material:<br>350ml Cardboard Box]
    Oil[Raw Material:<br>RBD Palm Olein bulk oil]
    Bottle350[Raw Material:<br>PET Bottle 350ml SWAK]
    Cap[Raw Material:<br>Yellow Bottle Cap]
    Label350[Raw Material:<br>350ml Palm Oil Label]

    %% Relational flows
    Parent350 -->|Consumes 36x| Base350
    Parent350 -->|Consumes 1x| Cardboard350
    Base350 -->|Consumes 0.315 kg| Oil
    Base350 -->|Consumes 1x| Bottle350
    Base350 -->|Consumes 1x| Cap
    Base350 -->|Consumes 1x| Label350
```

1. **The Base Product (The Bottle - `PROD-003-[Size]`)**: Models the individual filled bottle (350ml, 500ml, or 1L). It tracks the bottle components (oil, cap, label, bottle PET) and the filling line routings.
2. **The Parent Product (The Box - `PROD-003-[Size]-BOX`)**: Models the cardboard shipping box containing the retail units. It consumes the base bottles as sub-assemblies.
   * **350ml Box**: Contains **36** bottles.
   * **500ml Box**: Contains **24** bottles.
   * **1L Box**: Contains **12** bottles.

---

## 📁 Part 1: Registering the Base Products (Individual Bottles)

Navigate to the Finished Goods module at `/mm/finished-goods` (implemented in [FinishedGoodsModule.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/FinishedGoodsModule.tsx)) and click **Register Product** to register each of the three sizes.

### 1. Product Details Configuration
Under the [ProductDetailsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/ProductDetailsTab.tsx), configure each variant:

| Parameter | 350ml SWAK Bottle | 500ml SWAK Bottle | 1L SWAK Bottle |
| :--- | :--- | :--- | :--- |
| **Product Title** | `PROD-003 Palm Oil 350ml SWAK` | `PROD-003 Palm Oil 500ml SWAK` | `PROD-003 Palm Oil 1L SWAK` |
| **SKU / Code** | `PROD-003-350` | `PROD-003-500` | `PROD-003-1L` |
| **Parent Product** | `None` (Is a Parent itself) | `None` (Is a Parent itself) | `None` (Is a Parent itself) |
| **Base UOM** | `PCS` (or `BTL`) | `PCS` (or `BTL`) | `PCS` (or `BTL`) |
| **UOM Count** | `1` | `1` | `1` |
| **Density Factor** | `0.900` (Palm oil density) | `0.900` | `0.900` |
| **Expected Yield** | `99.0%` | `99.0%` | `99.0%` |
| **Shelf Life (Days)** | `365` | `365` | `365` |

---

### 2. Bill of Materials (BOM) Recipe Ingredients
In the [BOMRecipeTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/BOMRecipeTab.tsx), add raw materials for each size:

#### A. Mama Pina's 350ml SWAK (`PROD-003-350`)
*   **RBD Palm Olein**: `0.3150` KG (0.350 L * 0.900 density) | Wastage: `1.00%` | Step: `3. Oil Filling`
*   **350ml SWAK PET Bottle**: `1.000` PC (Landed cost: ₱3.35) | Wastage: `0.50%` | Step: `1. Labeling`
*   **Yellow Cap (1810)**: `1.000` PC (Landed cost: ₱0.70) | Wastage: `0.50%` | Step: `1. Labeling`
*   **350ml SWAK Label**: `1.000` PC (Landed cost: ₱0.30) | Wastage: `1.00%` | Step: `1. Labeling`

#### B. Mama Pina's 500ml SWAK (`PROD-003-500`)
*   **RBD Palm Olein**: `0.4500` KG (0.500 L * 0.900 density) | Wastage: `1.00%` | Step: `3. Oil Filling`
*   **500ml SWAK PET Bottle**: `1.000` PC (Landed cost: ₱3.65) | Wastage: `0.50%` | Step: `1. Labeling`
*   **Yellow Cap (1810)**: `1.000` PC (Landed cost: ₱0.70) | Wastage: `0.50%` | Step: `1. Labeling`
*   **500ml SWAK Label**: `1.000` PC (Landed cost: ₱0.45) | Wastage: `1.00%` | Step: `1. Labeling`

#### C. Mama Pina's 1L SWAK (`PROD-003-1L`)
*   **RBD Palm Olein**: `0.9000` KG (1.000 L * 0.900 density) | Wastage: `1.00%` | Step: `3. Oil Filling`
*   **1L SWAK PET Bottle**: `1.000` PC (Landed cost: ₱7.90) | Wastage: `0.50%` | Step: `1. Labeling`
*   **Yellow Cap (1810)**: `1.000` PC (Landed cost: ₱0.70) | Wastage: `0.50%` | Step: `1. Labeling`
*   **1L SWAK Label**: `1.000` PC (Landed cost: ₱0.55) | Wastage: `1.00%` | Step: `1. Labeling`

---

### 3. Production Stages & Routings (Base Bottles)
In the [RoutingsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/RoutingsTab.tsx), add the filling line sequence:

| Seq | Step Name (Operation) | Labor Flat Rate | OH / Hr | Run Time | Setup Time | Requires QA | S.O.P. Instructions & Machine Settings |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `Bottle Labeling & Cap Prep` | ₱1.50 | ₱0.00 | `00:00:10` | `00:05:00` | `No` | Check centered labels. Ensure printed batch caps are readable. |
| **2** | `Line Valve & Compressor Start` | ₱2.00 | ₱20.00 | `00:00:02` | `00:10:00` | `No` | Fully open the panel knob. Open gate valve, verify pressure gauge to control flow. Switch ON panel breaker. Close panel and rotate compressor knob downward. |
| **3** | `Oil Filling Operation` | ₱4.00 | ₱40.00 | `00:00:05` | `00:05:00` | `No` | Open filler gate valve downward. Run trial filling to check nozzle alignment. Green button = ON, Red button = OFF. |
| **4** | `Label Heat Shrinking` | ₱0.00 | ₱0.00 | `00:00:00` | `00:00:00` | `No` | **Bypassed Step**: Not required for 350ml, 500ml, and 1L SWAK bottles. Leave durations as 0. |
| **5** | `Quality Inspection Gate` | ₱3.00 | ₱0.00 | `00:00:08` | `00:00:00` | **`Yes`** | **QA Gate**: Aligned labels check, no wet bottles, well-capped, zero leaks. |

---

## 📦 Part 2: Registering the Parent Products (Cardboard Boxes)

Click **Register Product** again to create the parent box variants which consume the base bottles.

### 1. Product Details Configuration
Under the [ProductDetailsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/ProductDetailsTab.tsx), enter:

*   **350ml Box**: Title: `PROD-003-350-BOX Palm Oil 350ml Box (36 Bottles)` | SKU: `PROD-003-350-BOX` | Parent Product: `PROD-003-350` | UOM: `BOX` | UOM Count: `36`
*   **500ml Box**: Title: `PROD-003-500-BOX Palm Oil 500ml Box (24 Bottles)` | SKU: `PROD-003-500-BOX` | Parent Product: `PROD-003-500` | UOM: `BOX` | UOM Count: `24`
*   **1L Box**: Title: `PROD-003-1L-BOX Palm Oil 1L Box (12 Bottles)` | SKU: `PROD-003-1L-BOX` | Parent Product: `PROD-003-1L` | UOM: `BOX` | UOM Count: `12`

### 2. Bill of Materials (BOM) Recipe Ingredients
In the [BOMRecipeTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/BOMRecipeTab.tsx), add the packaging components:

#### A. 350ml Box (`PROD-003-350-BOX`)
*   `PROD-003-350` (Child Bottle): `36.0000` PCS | Wastage: `0.00%` | Type: `sub_assembly`
*   **350ml Box Cardboard**: `1.0000` PC (Landed cost: ₱29.00) | Wastage: `0.50%` | Type: `packaging`

#### B. 500ml Box (`PROD-003-500-BOX`)
*   `PROD-003-500` (Child Bottle): `24.0000` PCS | Wastage: `0.00%` | Type: `sub_assembly`
*   **500ml Box Cardboard**: `1.0000` PC (Landed cost: ₱20.70) | Wastage: `0.50%` | Type: `packaging`

#### C. 1L Box (`PROD-003-1L-BOX`)
*   `PROD-003-1L` (Child Bottle): `12.0000` PCS | Wastage: `0.00%` | Type: `sub_assembly`
*   **1L Box Cardboard**: `1.0000` PC (Landed cost: ₱31.00) | Wastage: `0.50%` | Type: `packaging`

### 3. Production Stages & Routings (Parent Boxes)
In the [RoutingsTab.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/finished-goods/components/RoutingsTab.tsx), configure the packing step:

| Seq | Step Name (Operation) | Labor Flat Rate | OH / Hr | Run Time | Setup Time | Requires QA | S.O.P. Instructions & Machine Settings |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `Boxing & Palletizing` | ₱10.00 | ₱10.00 | `00:01:00` | `00:05:00` | **`Yes`** | Pack bottles in box (36/24/12). Seal securely with tape. Stack on empty pallet. |

---

## 📈 Part 3: Cost Rollup & Margin Simulation

1.  **Cost Rollup**: The system aggregates the child bottle components (Palm oil, bottle, cap, label) multiplied by the box count, and adds the Cardboard Box cost to calculate the final standard Cost of Goods Sold (COGS).
2.  **Overhead & Labor**: The system sums the filling routings (Seq 1-5 multiplied by the box count) and adds the Boxing operation.
3.  **Active Status**: Set the product versions to **Active (v1.0)** to release them for job orders and invoicing.
