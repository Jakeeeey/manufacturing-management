import { PhysicalCountSheet } from "./types";

export const INITIAL_BRANCHES = [
    { id: "1", name: "Main Warehouse (Manila)" },
    { id: "2", name: "Urdaneta Processing Plant" },
    { id: "3", name: "Subic Central Logistics Hub" },
    { id: "4", name: "Cebu Regional Depot" }
];

export const STOCK_TYPES = [
    "Raw Materials",
    "Finished Goods",
    "Packaging Materials",
    "Work in Progress (WIP)",
    "Spare Parts & Hardware"
];

export const PRICE_TYPES = [
    "FIFO Landed Cost",
    "Standard Cost",
    "Moving Average Cost"
];

export const CATEGORIES = [
    "All Categories",
    "Chemical Resins & Compounds",
    "Corrugated & Paper Packaging",
    "Finished Beverages & Syrups",
    "Precision Valves & Fittings",
    "Bulk Raw Ingredients"
];

export const VENDORS = [
    "All Vendors",
    "Apex Industrial Chemicals Corp",
    "Packaging Solutions Inc",
    "Global Polymer Trading Ltd",
    "San Miguel Yamamura Packaging",
    "Universal Flavors Philippines"
];

export const INITIAL_COUNT_SHEETS: PhysicalCountSheet[] = [
    {
        id: "pcs-101",
        sheet_no: "PCS-2026-07-001",
        branch_id: "1",
        branch_name: "Main Warehouse (Manila)",
        cutoff_date: "2026-07-20T18:00:00.000Z",
        stock_type: "Raw Materials",
        price_type: "FIFO Landed Cost",
        category: "Chemical Resins & Compounds",
        vendor: "Apex Industrial Chemicals Corp",
        status: "Draft",
        created_by: "Maria Santos (Auditor)",
        created_at: "2026-07-20T09:30:00.000Z",
        total_amount: 512343.75,
        notes: "Monthly Q3 Raw Material Stock Take - Bay 3 & Bay 4",
        line_items: [
            {
                id: "item-1",
                sku_code: "RM-POLY-001",
                sku_name: "High-Density Polyethylene (HDPE) Resin Granules",
                version_id: "v2.1",
                lot_id: "BIN-A-104",
                batch_no: "BAT-2026-0612",
                unit_price: 185.50,
                system_count: 1250,
                physical_count: 1240, // -10 Deficit (-1,855 PHP)
                unit_of_measure: "kg",
                category_name: "Chemical Resins & Compounds",
                vendor_name: "Apex Industrial Chemicals Corp",
                remarks: "Minor bag puncture on Pallet 4"
            },
            {
                id: "item-2",
                sku_code: "RM-POLY-002",
                sku_name: "Polypropylene (PP) Polymer Pellets",
                version_id: "v1.0",
                lot_id: "BIN-A-108",
                batch_no: "BAT-2026-0618",
                unit_price: 210.00,
                system_count: 800,
                physical_count: 815, // +15 Surplus (+3,150 PHP)
                unit_of_measure: "kg",
                category_name: "Chemical Resins & Compounds",
                vendor_name: "Apex Industrial Chemicals Corp",
                remarks: "Unrecorded transfer returned from Lab"
            },
            {
                id: "item-3",
                sku_code: "RM-SOLV-015",
                sku_name: "Industrial Solvent Ethanol 99.8% Pure",
                version_id: "v3.0",
                lot_id: "RACK-B-02",
                batch_no: "BAT-2026-0701",
                unit_price: 340.25,
                system_count: 450,
                physical_count: 450, // 0 Matched
                unit_of_measure: "Liters",
                category_name: "Chemical Resins & Compounds",
                vendor_name: "Apex Industrial Chemicals Corp",
                remarks: "Sealed drums verified"
            },
            {
                id: "item-4",
                sku_code: "RM-CAT-088",
                sku_name: "Titanium Dioxide White Pigment Powder",
                version_id: "v1.4",
                lot_id: "BIN-C-301",
                batch_no: "BAT-2026-0520",
                unit_price: 495.00,
                system_count: 300,
                physical_count: 292, // -8 Deficit (-3,960 PHP)
                unit_of_measure: "kg",
                category_name: "Chemical Resins & Compounds",
                vendor_name: "Apex Industrial Chemicals Corp",
                remarks: "Spill damage noted during staging"
            },
            {
                id: "item-5",
                sku_code: "RM-STAB-042",
                sku_name: "Thermal Stabilizer Compound Grade B",
                version_id: "v2.0",
                lot_id: "RACK-D-12",
                batch_no: "BAT-2026-0630",
                unit_price: 620.75,
                system_count: 180,
                physical_count: 185, // +5 Surplus (+3,103.75 PHP)
                unit_of_measure: "kg",
                category_name: "Chemical Resins & Compounds",
                vendor_name: "Apex Industrial Chemicals Corp",
                remarks: "Found extra unopened bag"
            },
            {
                id: "item-6",
                sku_code: "RM-WAX-009",
                sku_name: "Microcrystalline Lubricant Wax",
                version_id: "v1.1",
                lot_id: "BIN-E-005",
                batch_no: "BAT-2026-0710",
                unit_price: 145.00,
                system_count: 600,
                physical_count: 600, // 0 Matched
                unit_of_measure: "kg",
                category_name: "Chemical Resins & Compounds",
                vendor_name: "Apex Industrial Chemicals Corp",
                remarks: "Full pallet count verified"
            }
        ]
    },
    {
        id: "pcs-102",
        sheet_no: "PCS-2026-07-002",
        branch_id: "2",
        branch_name: "Urdaneta Processing Plant",
        cutoff_date: "2026-07-18T17:00:00.000Z",
        stock_type: "Finished Goods",
        price_type: "Standard Cost",
        category: "Finished Beverages & Syrups",
        vendor: "All Vendors",
        status: "Committed",
        created_by: "Juan Dela Cruz (Supervisor)",
        created_at: "2026-07-18T08:00:00.000Z",
        committed_at: "2026-07-18T16:45:00.000Z",
        committed_by: "Elena Reyes (Plant Mgr)",
        total_amount: 1671700.00,
        notes: "End-of-Week FG Inventory Audit",
        line_items: [
            {
                id: "item-201",
                sku_code: "FG-SYR-500ML",
                sku_name: "Premix Beverage Syrup 500ml Bottle",
                version_id: "v4.0",
                lot_id: "FG-BAY-1",
                batch_no: "LOT-FG-991",
                unit_price: 120.00,
                system_count: 5000,
                physical_count: 5000,
                unit_of_measure: "Bottles",
                category_name: "Finished Beverages & Syrups",
                remarks: "Audit confirmed 100% match"
            },
            {
                id: "item-202",
                sku_code: "FG-CONC-1L",
                sku_name: "Concentrated Fruit Extract Base 1L",
                version_id: "v2.0",
                lot_id: "FG-BAY-2",
                batch_no: "LOT-FG-995",
                unit_price: 380.00,
                system_count: 1200,
                physical_count: 1195, // -5 Deficit
                unit_of_measure: "Bottles",
                category_name: "Finished Beverages & Syrups",
                remarks: "5 damaged bottles disposed during transit check"
            },
            {
                id: "item-203",
                sku_code: "FG-POW-25KG",
                sku_name: "Instant Premix Powder 25kg Sack",
                version_id: "v1.2",
                lot_id: "FG-BAY-4",
                batch_no: "LOT-FG-1002",
                unit_price: 2450.00,
                system_count: 250,
                physical_count: 252, // +2 Surplus
                unit_of_measure: "Sacks",
                category_name: "Finished Beverages & Syrups",
                remarks: "2 sacks overlooked in previous staging area"
            }
        ]
    },
    {
        id: "pcs-103",
        sheet_no: "PCS-2026-07-003",
        branch_id: "3",
        branch_name: "Subic Central Logistics Hub",
        cutoff_date: "2026-07-15T12:00:00.000Z",
        stock_type: "Packaging Materials",
        price_type: "FIFO Landed Cost",
        category: "Corrugated & Paper Packaging",
        vendor: "San Miguel Yamamura Packaging",
        status: "Committed",
        created_by: "Roberto Gomez (Warehouse Mgr)",
        created_at: "2026-07-15T09:00:00.000Z",
        committed_at: "2026-07-15T14:30:00.000Z",
        committed_by: "Roberto Gomez (Warehouse Mgr)",
        total_amount: 548550.00,
        notes: "Bi-weekly packaging materials count",
        line_items: [
            {
                id: "item-301",
                sku_code: "PKG-BOX-MED",
                sku_name: "Heavy-Duty Corrugated Master Carton Medium",
                version_id: "v1.0",
                lot_id: "RACK-P1",
                batch_no: "BAT-PKG-882",
                unit_price: 45.00,
                system_count: 10000,
                physical_count: 9980,
                unit_of_measure: "Pcs",
                category_name: "Corrugated & Paper Packaging",
                remarks: "20 crushed boxes rejected"
            },
            {
                id: "item-302",
                sku_code: "PKG-CAP-28MM",
                sku_name: "Tamper-Evident Plastic Caps 28mm Blue",
                version_id: "v2.0",
                lot_id: "BIN-CAP-04",
                batch_no: "BAT-PKG-901",
                unit_price: 1.80,
                system_count: 55000,
                physical_count: 55250,
                unit_of_measure: "Pcs",
                category_name: "Corrugated & Paper Packaging",
                remarks: "Over-shipment bonus bag included"
            }
        ]
    },
    {
        id: "pcs-104",
        sheet_no: "PCS-2026-07-004",
        branch_id: "1",
        branch_name: "Main Warehouse (Manila)",
        cutoff_date: "2026-07-10T18:00:00.000Z",
        stock_type: "Spare Parts & Hardware",
        price_type: "Moving Average Cost",
        category: "Precision Valves & Fittings",
        vendor: "Global Tech Corp",
        status: "Cancelled",
        created_by: "Ana Reyes (Auditor)",
        created_at: "2026-07-10T10:15:00.000Z",
        total_amount: 0.00,
        notes: "Cancelled due to emergency plant maintenance lockdown",
        line_items: [
            {
                id: "item-401",
                sku_code: "SP-VALVE-02",
                sku_name: "Stainless Steel Ball Valve 2-Inch",
                version_id: "v1.0",
                lot_id: "TOOL-ROOM-1",
                batch_no: "BAT-SP-044",
                unit_price: 1850.00,
                system_count: 45,
                physical_count: null,
                unit_of_measure: "Pcs",
                category_name: "Precision Valves & Fittings",
                remarks: "Count suspended"
            }
        ]
    }
];
