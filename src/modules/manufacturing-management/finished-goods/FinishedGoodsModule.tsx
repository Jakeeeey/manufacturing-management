"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
    Search, 
    Plus, 
    Save, 
    Layers, 
    Activity, 
    FileText, 
    Sliders,
    AlertCircle,
    Loader2,
    Briefcase,
    ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { ProductDetailsTab } from "./components/ProductDetailsTab";
import { BOMRecipeTab } from "./components/BOMRecipeTab";
import { RoutingsTab } from "./components/RoutingsTab";
import { CostRollupTab } from "./components/CostRollupTab";
import { ImportationTab } from "./components/ImportationTab";
import { useFinishedGoods } from "./hooks/useFinishedGoods";
import { Product, BOMItem, RoutingStep } from "./types";
import { CreatableSelect } from "./components/CreatableSelect";

export default function FinishedGoodsModule() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const {
        handleCreateBrand,
        handleCreateCategory,
        activeTab,
        setActiveTab,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        brands,
        categories,
        units,
        loadingProducts,
        loadingBOM,
        savingBOM,
        products,
        allCatalogProducts,
        selectedProductId,
        setSelectedProductId,
        selectedProduct,
        searchQuery,
        setSearchQuery,
        versions,
        versionCosts,
        selectedVersionId,
        setSelectedVersionId,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        registerForm,
        setRegisterForm,
        editedDetails,
        setEditedDetails,
        editedBOM,
        setEditedBOM,
        editedRoutings,
        setEditedRoutings,
        editedOverheads,
        setEditedOverheads,
        overheadTypes,
        operationTypes,
        setOperationTypes,
        simulatedForexRate,
        setSimulatedForexRate,
        handleRegisterProduct,
        handleRegisterNewVersion,
        handleSave
    } = useFinishedGoods(searchParams.get("tab") || "details");

    // Local Simulation States
    const [simulationYield, setSimulationYield] = useState<number>(100);
    const [simulationPriceOverrides, setSimulationPriceOverrides] = useState<Record<string, number>>({});
    const [simulationTargetPrice, setSimulationTargetPrice] = useState<number>(0);

    // Importation / Landed Cost Calculator States
    const [importNetWeight, setImportNetWeight] = useState<number>(21500);
    const [importPriceUsd, setImportPriceUsd] = useState<number>(1.355);
    const [importFxRate, setImportFxRate] = useState<number>(62.00);
    const [importThcFee, setImportThcFee] = useState<number>(42510);
    const [importStorageFee, setImportStorageFee] = useState<number>(2846.23);
    const [importCustomSop, setImportCustomSop] = useState<number>(20000);
    const [importTruckingFee, setImportTruckingFee] = useState<number>(42000);
    const [importOtherPortFees, setImportOtherPortFees] = useState<number>(11898.21);
    const [importCustomDuty, setImportCustomDuty] = useState<number>(13394.85);
    const [importIpf, setImportIpf] = useState<number>(2000);
    const [importVat, setImportVat] = useState<number>(253684.78);
    const [importDensityFactor, setImportDensityFactor] = useState<number>(0.880);
    const [automateCustoms, setAutomateCustoms] = useState<boolean>(true);

    // Sync tab param on load
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && ["details", "bom", "routings", "costing", "importation", "quotes"].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams, setActiveTab]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.replace(`/mm/finished-goods?tab=${tab}`);
    };

    // Sync simulation defaults when active details or ingredients load
    useEffect(() => {
        if (selectedProduct) {
            setSimulationTargetPrice(selectedProduct.targetSellingPrice);
        }
    }, [selectedProduct]);

    useEffect(() => {
        if (editedDetails.expectedYieldPercent !== undefined) {
            setSimulationYield(Number(editedDetails.expectedYieldPercent) || 100);
        }
    }, [editedDetails.expectedYieldPercent]);

    useEffect(() => {
        const initialPrices: Record<string, number> = {};
        editedBOM.forEach(item => {
            initialPrices[item.id] = item.landedCost;
        });
        setSimulationPriceOverrides(initialPrices);
    }, [editedBOM]);

    // Local form change forwarders to hook setters
    const handleDetailChange = (field: keyof Product, value: unknown) => {
        setEditedDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleBOMChange = <K extends keyof BOMItem>(itemId: string, field: K, value: BOMItem[K]) => {
        setEditedBOM(prev => prev.map(item => 
            item.id === itemId ? { ...item, [field]: value } : item
        ));
    };

    const handleRoutingChange = <K extends keyof RoutingStep>(stepId: string, field: K, value: RoutingStep[K]) => {
        setEditedRoutings(prev => prev.map(step => 
            step.id === stepId ? { ...step, [field]: value } : step
        ));
    };

    // Importation Derived Calculations
    const importForeignPeso = importNetWeight * importPriceUsd * importFxRate;

    // Dynamic Bureau of Customs (BOC) Formulations
    let finalCustomDuty = importCustomDuty;
    let finalIpf = importIpf;
    let finalVat = importVat;
    let finalOtherPortFees = importOtherPortFees;

    if (automateCustoms) {
        // 1. Insurance in freight (typically 2% of invoice custom value)
        const insurance = importForeignPeso * 0.02;
        const cud = importForeignPeso + insurance;

        // 2. Customs Duty (e.g. 3% standard rate on Canola/Soya)
        finalCustomDuty = cud * 0.03;

        // 3. Brokerage Fee slide-rate schedule
        let brokerage = 2000;
        if (cud <= 10000) brokerage = 500;
        else if (cud <= 50000) brokerage = 1000;
        else if (cud <= 200000) brokerage = 2000;
        else if (cud <= 500000) brokerage = 3500;
        else if (cud <= 1000000) brokerage = 5000;
        else if (cud <= 2000000) brokerage = 7500;
        else brokerage = 10000;

        // 4. Import Processing Fee (IPF) slide-rate schedule
        let ipf = 250;
        if (cud <= 250000) ipf = 250;
        else if (cud <= 500000) ipf = 500;
        else if (cud <= 750000) ipf = 750;
        else if (cud <= 1000000) ipf = 1000;
        else ipf = 1500;

        // 5. Fixed CDS (Doc Stamp) & CSF (Container Security)
        const cds = 280;
        const csf = 277;

        // Combined CSF & IPF field
        finalIpf = ipf + csf;

        // Formulate other port fees with Arrastre (₱5,888.23) + Wharfage (₱581.67) + CDS (₱280)
        finalOtherPortFees = 5888.23 + 581.67 + cds;

        // 6. 12% Import VAT Formula
        finalVat = (cud + finalCustomDuty + brokerage + 5888.23 + 581.67 + cds + ipf + csf) * 0.12;
    }

    const importTotalShippingPort = importThcFee + importStorageFee + importCustomSop + importTruckingFee + finalOtherPortFees;
    const importTotalDutiesTaxes = finalCustomDuty + finalIpf + finalVat;
    const importTotalLandedCost = importForeignPeso + importTotalShippingPort + importTotalDutiesTaxes;
    const importLandedCostPerKg = importTotalLandedCost / (importNetWeight > 0 ? importNetWeight : 1);
    const importLandedCostPerL = importLandedCostPerKg * importDensityFactor;
    const importTotalForCogs = importTotalLandedCost - finalVat;
    const importCogsPerKg = importTotalForCogs / (importNetWeight > 0 ? importNetWeight : 1);
    const importCogsPerL = importCogsPerKg * importDensityFactor;

    const handleApplyImportLandedCost = () => {
        const updatedOverrides = { ...simulationPriceOverrides };
        let count = 0;
        editedBOM.forEach(item => {
            if (item.name.toLowerCase().includes("oil") || item.name.toLowerCase().includes("olein")) {
                updatedOverrides[item.id] = parseFloat(importCogsPerL.toFixed(4));
                count++;
            }
        });
        setSimulationPriceOverrides(updatedOverrides);
        toast.success(`Applied computed COGS cost (₱${importCogsPerL.toFixed(4)}/L) to ${count} oil ingredients in simulator sandbox!`);
    };

    // Live standard cost calculations
    const baseMaterialCost = useMemo(() => {
        return editedBOM.reduce((sum, item) => {
            const costFactor = 1 - (item.wastagePercent / 100);
            const itemCost = (item.quantity * item.landedCost) / (costFactor > 0 ? costFactor : 1);
            if (item.type === "by_product") {
                return sum - itemCost;
            }
            return sum + itemCost;
        }, 0);
    }, [editedBOM]);

    const baseRoutingCost = useMemo(() => {
        return editedRoutings.reduce((sum, step) => {
            const stepCost = step.laborFlatRate + (step.machineHourlyRate * step.durationHours);
            return sum + stepCost;
        }, 0);
    }, [editedRoutings]);

    // Simulation Cost calculations
    const simulatedMaterialCost = useMemo(() => {
        return editedBOM.reduce((sum, item) => {
            const costFactor = 1 - (item.wastagePercent / 100);
            const overridePrice = simulationPriceOverrides[item.id] !== undefined ? simulationPriceOverrides[item.id] : item.landedCost;
            const itemCost = (item.quantity * overridePrice) / (costFactor > 0 ? costFactor : 1);
            if (item.type === "by_product") {
                return sum - itemCost;
            }
            return sum + itemCost;
        }, 0);
    }, [editedBOM, simulationPriceOverrides]);

    const simulatedTotalUnitCost = useMemo(() => {
        const simYieldFactor = simulationYield / 100;
        return (simulatedMaterialCost + baseRoutingCost) / (simYieldFactor > 0 ? simYieldFactor : 1);
    }, [simulatedMaterialCost, baseRoutingCost, simulationYield]);

    const standardPrice = editedDetails.targetSellingPrice || 0;

    const totalCustomOverheads = useMemo(() => {
        return editedOverheads.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [editedOverheads]);

    const standardTotalUnitCost = useMemo(() => {
        const yieldFactor = (editedDetails.expectedYieldPercent || 100) / 100;
        return (baseMaterialCost + baseRoutingCost) / (yieldFactor > 0 ? yieldFactor : 1);
    }, [baseMaterialCost, baseRoutingCost, editedDetails.expectedYieldPercent]);

    const standardOverheads = useMemo(() => {
        return {
            totalOverheads: totalCustomOverheads,
            items: editedOverheads
        };
    }, [totalCustomOverheads, editedOverheads]);

    const standardNetProfit = useMemo(() => {
        return standardPrice - standardTotalUnitCost - standardOverheads.totalOverheads;
    }, [standardPrice, standardTotalUnitCost, standardOverheads]);

    const standardNetMarginPercent = useMemo(() => {
        return standardPrice > 0 ? (standardNetProfit / standardPrice) * 100 : 0;
    }, [standardPrice, standardNetProfit]);

    const simulatedOverheads = useMemo(() => {
        return {
            totalOverheads: totalCustomOverheads,
            items: editedOverheads
        };
    }, [totalCustomOverheads, editedOverheads]);

    const simulatedNetProfit = useMemo(() => {
        return simulationTargetPrice - simulatedTotalUnitCost - simulatedOverheads.totalOverheads;
    }, [simulationTargetPrice, simulatedTotalUnitCost, simulatedOverheads]);

    const simulatedNetMarginPercent = useMemo(() => {
        return simulationTargetPrice > 0 ? (simulatedNetProfit / simulationTargetPrice) * 100 : 0;
    }, [simulationTargetPrice, simulatedNetProfit]);

    const addBOMItem = () => {
        const defaultProd = allCatalogProducts[0];
        const newItem: BOMItem = {
            id: `bom-new-${Date.now()}`,
            productId: defaultProd ? defaultProd.product_id : undefined,
            name: defaultProd ? defaultProd.product_name : "New Ingredient/Packaging",
            type: "raw_material",
            quantity: 0.1,
            uom: defaultProd ? (defaultProd.unit_of_measurement?.unit_shortcut || "L") : "L",
            uomId: defaultProd?.unit_of_measurement?.unit_id || undefined,
            wastagePercent: 0,
            landedCost: defaultProd ? Number(defaultProd.cost_per_unit || defaultProd.price_per_unit || 0) : 10.0,
            densityFactor: 1.0
        };
        setEditedBOM(prev => [...prev, newItem]);
        setSimulationPriceOverrides(prev => ({ ...prev, [newItem.id]: newItem.landedCost }));
        toast.success("New raw material added to recipe");
    };

    const deleteBOMItem = (id: string) => {
        setEditedBOM(prev => prev.filter(item => item.id !== id));
        toast.info("Material slot removed");
    };

    const addRoutingStep = () => {
        const nextSeq = editedRoutings.length > 0 
            ? Math.max(...editedRoutings.map(r => r.sequence)) + 10 
            : 10;
        const newStep: RoutingStep = {
            id: `rt-new-${Date.now()}`,
            sequence: nextSeq,
            name: "New Production Step",
            laborFlatRate: 0.0,
            machineHourlyRate: 0.0,
            durationHours: 0.01
        };
        setEditedRoutings(prev => [...prev, newStep]);
        toast.success("New manufacturing routing step added");
    };

    const deleteRoutingStep = (id: string) => {
        setEditedRoutings(prev => prev.filter(step => step.id !== id));
        toast.info("Routing step removed");
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => 
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            p.sku.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [products, searchQuery]);

    const existingRoutingNames = useMemo(() => {
        const names = new Set<string>();
        products.forEach(p => {
            if (p.routings) {
                p.routings.forEach(r => {
                    if (r.name) {
                        names.add(r.name.trim());
                    }
                });
            }
        });
        return Array.from(names);
    }, [products]);

    // Searchable Select Option Maps
    const brandOptions = useMemo(() => {
        return brands.map(b => ({
            value: String(b.brand_id),
            label: b.brand_name
        }));
    }, [brands]);

    const categoryOptions = useMemo(() => {
        return categories.map(c => ({
            value: String(c.category_id),
            label: c.category_name
        }));
    }, [categories]);

    return (
        <div className="flex h-full min-h-[calc(100vh-120px)] flex-1 flex-col overflow-hidden bg-background">
            {/* Topbar */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 bg-muted/10 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg border bg-background hover:bg-muted text-muted-foreground transition-all mr-1.5"
                        title={isSidebarCollapsed ? "Expand Product Catalog" : "Collapse Product Catalog"}
                    >
                        <ChevronLeft className={`h-4 w-4 transform transition-transform duration-200 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
                    </button>
                    <Layers className="h-5 w-5 text-primary" />
                    <h1 className="text-base font-bold tracking-tight">Finished Goods Master</h1>
                    {(loadingBOM || savingBOM) && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Register Product
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={savingBOM || !selectedProduct || (versions.length === 0 && !isNaN(Number(selectedProductId)))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {savingBOM ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        {savingBOM ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden border rounded-b-xl">
                {!isSidebarCollapsed && (
                    <div className="w-80 shrink-0 border-r flex flex-col bg-muted/20 animate-in slide-in-from-left duration-200">
                        {/* Product Search Box */}
                        <div className="p-3 border-b">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input 
                                    type="text"
                                    placeholder="Search products or SKUs..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                        
                        {/* Products list items */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loadingProducts ? (
                                <div className="flex flex-col items-center justify-center p-8 gap-1.5 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-xs">Loading products...</span>
                                </div>
                            ) : (
                                filteredProducts.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedProductId(p.id)}
                                        className={`w-full flex flex-col text-left p-3 rounded-lg border transition-all ${
                                            selectedProductId === p.id 
                                                ? "bg-card border-primary shadow-sm ring-1 ring-primary/20" 
                                                : "bg-transparent border-transparent hover:bg-muted"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between w-full gap-2 min-w-0">
                                            <span className="text-sm font-semibold truncate flex-1 min-w-0">{p.title}</span>
                                            {p.parentProduct && (
                                                <span className="shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tracking-wider uppercase border border-blue-500/20">
                                                    Parent
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between w-full text-xs text-muted-foreground">
                                            <span className="truncate pr-1">SKU: {p.sku || "N/A"} [{p.baseUom}]</span>
                                            <span className="font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground shrink-0">
                                                ₱{p.targetSellingPrice.toFixed(2)}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                            {!loadingProducts && filteredProducts.length === 0 && (
                                <div className="p-8 text-center text-xs text-muted-foreground">
                                    No products found
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Right Side: Product Detail Tabs */}
                <div className="flex-1 overflow-hidden flex flex-col bg-background">
                    {selectedProduct && (
                        <div className="px-6 py-4 border-b bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 shadow-sm">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base font-bold text-foreground truncate">{selectedProduct.title}</h2>
                                    {selectedProduct.parentProduct && (
                                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-500/20 shrink-0">
                                            Parent Good
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                                    <span>SKU: <strong className="text-foreground font-semibold">{selectedProduct.sku || "N/A"}</strong></span>
                                    <span>Base UOM: <strong className="text-foreground font-semibold">{selectedProduct.baseUom}</strong></span>
                                    {selectedProduct.barcode && (
                                        <span>Barcode: <strong className="text-foreground font-semibold">{selectedProduct.barcode}</strong></span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 self-start sm:self-center shrink-0 border-l pl-4 border-muted">
                                {versions.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Active Version</label>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedVersionId || ""}
                                                onChange={e => setSelectedVersionId(Number(e.target.value) || null)}
                                                className="rounded border px-2 py-1 bg-background text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                {versions.map(v => {
                                                    const cost = versionCosts[v.id];
                                                    const costStr = cost !== undefined && cost > 0 ? ` (Est: ₱${cost.toFixed(2)})` : "";
                                                    return (
                                                        <option key={v.id} value={v.id}>
                                                            {v.version_name}{costStr}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <button
                                                onClick={handleRegisterNewVersion}
                                                className="inline-flex items-center gap-1 rounded bg-muted border px-2 py-1 text-xs font-semibold hover:bg-accent transition-colors text-foreground"
                                                title="Register New Version"
                                            >
                                                <Plus className="h-3 w-3" /> New
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="text-right">
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Target Selling Price</span>
                                    <span className="text-sm font-extrabold text-foreground">₱{selectedProduct.targetSellingPrice.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div className="flex border-b px-4 bg-muted/10 shrink-0">
                        {[
                            { id: "details", label: "Product Details", icon: FileText },
                            { id: "bom", label: "Bill of Materials (BOM)", icon: Layers },
                            { id: "routings", label: "Manufacturing Routings", icon: Activity },
                            { id: "costing", label: "Live Costing & Simulator", icon: Sliders },
                            { id: "importation", label: "Importation & Landed Cost", icon: Briefcase }
                        ].map((t) => {
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handleTabChange(t.id)}
                                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all -mb-[1px] ${
                                        activeTab === t.id 
                                            ? "border-primary text-primary" 
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Contents */}
                    <div className="flex-1 overflow-y-auto p-6 min-h-0 relative">
                        {selectedProduct ? (
                            <>
                                {activeTab === "details" && (
                                    <ProductDetailsTab
                                        editedDetails={editedDetails}
                                        handleDetailChange={handleDetailChange}
                                        selectedProduct={selectedProduct}
                                        units={units}
                                        brands={brands}
                                        categories={categories}
                                        handleCreateBrand={handleCreateBrand}
                                        handleCreateCategory={handleCreateCategory}
                                    />
                                )}

                                {activeTab !== "details" && versions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-20 text-center max-w-md mx-auto my-auto h-full">
                                        <Layers className="h-16 w-16 mb-4 text-muted-foreground/30" />
                                        <h3 className="text-base font-bold mb-2 text-foreground">No Registered Versions</h3>
                                        <p className="text-xs text-muted-foreground mb-6">
                                            To start configuring the Bill of Materials (BOM) and manufacturing routings for <strong>{selectedProduct.title}</strong>, please register an initial version.
                                        </p>
                                        <button
                                            onClick={handleRegisterNewVersion}
                                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all text-xs"
                                        >
                                            <Plus className="h-4 w-4" /> Register Initial Version
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {activeTab === "bom" && (
                                            <BOMRecipeTab
                                                editedBOM={editedBOM}
                                                handleBOMChange={handleBOMChange}
                                                addBOMItem={addBOMItem}
                                                deleteBOMItem={deleteBOMItem}
                                                units={units}
                                                baseMaterialCost={baseMaterialCost}
                                            />
                                        )}

                                        {activeTab === "routings" && (
                                            <RoutingsTab
                                                editedRoutings={editedRoutings}
                                                handleRoutingChange={handleRoutingChange}
                                                addRoutingStep={addRoutingStep}
                                                deleteRoutingStep={deleteRoutingStep}
                                                baseRoutingCost={baseRoutingCost}
                                                editedOverheads={editedOverheads}
                                                setEditedOverheads={setEditedOverheads}
                                                overheadTypes={overheadTypes}
                                                operationTypes={operationTypes}
                                                setOperationTypes={setOperationTypes}
                                            />
                                        )}

                                        {activeTab === "costing" && (
                                            <CostRollupTab
                                                standardPrice={standardPrice}
                                                baseMaterialCost={standardTotalUnitCost}
                                                standardOverheads={standardOverheads}
                                                standardNetProfit={standardNetProfit}
                                                standardNetMarginPercent={standardNetMarginPercent}
                                                simulationYield={simulationYield}
                                                setSimulationYield={setSimulationYield}
                                                simulationTargetPrice={simulationTargetPrice}
                                                setSimulationTargetPrice={setSimulationTargetPrice}
                                                simulationPriceOverrides={simulationPriceOverrides}
                                                setSimulationPriceOverrides={setSimulationPriceOverrides}
                                                editedBOM={editedBOM}
                                                selectedProduct={selectedProduct}
                                                simulatedNetProfit={simulatedNetProfit}
                                                simulatedMaterialCost={simulatedTotalUnitCost}
                                                simulatedOverheads={simulatedOverheads}
                                                simulatedNetMarginPercent={simulatedNetMarginPercent}
                                                simulatedForexRate={simulatedForexRate}
                                                setSimulatedForexRate={setSimulatedForexRate}
                                            />
                                        )}

                                        {activeTab === "importation" && (
                                            <ImportationTab
                                                importNetWeight={importNetWeight}
                                                setImportNetWeight={setImportNetWeight}
                                                importPriceUsd={importPriceUsd}
                                                setImportPriceUsd={setImportPriceUsd}
                                                importFxRate={importFxRate}
                                                setImportFxRate={setImportFxRate}
                                                importDensityFactor={importDensityFactor}
                                                setImportDensityFactor={setImportDensityFactor}
                                                importThcFee={importThcFee}
                                                setImportThcFee={setImportThcFee}
                                                importStorageFee={importStorageFee}
                                                setImportStorageFee={setImportStorageFee}
                                                importCustomSop={importCustomSop}
                                                setImportCustomSop={setImportCustomSop}
                                                importTruckingFee={importTruckingFee}
                                                setImportTruckingFee={setImportTruckingFee}
                                                importOtherPortFees={automateCustoms ? finalOtherPortFees : importOtherPortFees}
                                                setImportOtherPortFees={setImportOtherPortFees}
                                                importCustomDuty={automateCustoms ? finalCustomDuty : importCustomDuty}
                                                setImportCustomDuty={setImportCustomDuty}
                                                importVat={automateCustoms ? finalVat : importVat}
                                                setImportVat={setImportVat}
                                                importIpf={automateCustoms ? finalIpf : importIpf}
                                                setImportIpf={setImportIpf}
                                                importForeignPeso={importForeignPeso}
                                                importTotalShippingPort={importTotalShippingPort}
                                                importTotalDutiesTaxes={importTotalDutiesTaxes}
                                                importTotalLandedCost={importTotalLandedCost}
                                                importLandedCostPerKg={importLandedCostPerKg}
                                                importLandedCostPerL={importLandedCostPerL}
                                                importTotalForCogs={importTotalForCogs}
                                                importCogsPerKg={importCogsPerKg}
                                                importCogsPerL={importCogsPerL}
                                                handleApplyImportLandedCost={handleApplyImportLandedCost}
                                                automateCustoms={automateCustoms}
                                                setAutomateCustoms={setAutomateCustoms}
                                            />
                                        )}
                                    </>
                                )}
                                {savingBOM && (
                                    <div className="absolute inset-0 bg-background/55 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-150">
                                        <div className="bg-card border rounded-xl shadow-lg p-5 flex flex-col items-center gap-2 max-w-xs text-center border-primary/20">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <h4 className="text-xs font-bold text-foreground">Saving Changes...</h4>
                                            <p className="text-[10px] text-muted-foreground">Uploading ingredients, routing configurations and updating cost rollups.</p>
                                        </div>
                                    </div>
                                )}
                                {loadingBOM && (
                                    <div className="absolute inset-0 bg-background/55 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-150">
                                        <div className="bg-card border rounded-xl shadow-lg p-5 flex flex-col items-center gap-2 max-w-xs text-center border-primary/20">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <h4 className="text-xs font-bold text-foreground">Loading Version Recipe...</h4>
                                            <p className="text-[10px] text-muted-foreground">Fetching bill of materials, routing sequences, and overhead variables from database.</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                                <AlertCircle className="h-10 w-10 mb-2 text-muted" />
                                <span>No product selected</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Registration Modal Popup */}
            {isRegisterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-3 border-b">
                            <h3 className="text-base font-bold text-foreground">Register Product & BOM</h3>
                            <button
                                onClick={() => setIsRegisterModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                        <form onSubmit={handleRegisterProduct} className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Product Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Mama Pina's Soya Oil 2L x 6"
                                        value={registerForm.title}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">SKU / Code</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. FG-SOYA-2L"
                                        value={registerForm.sku}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, sku: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Barcode</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 4800110229..."
                                        value={registerForm.barcode}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, barcode: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Brand</label>
                                    <CreatableSelect
                                        options={brandOptions}
                                        value={registerForm.brandId}
                                        onValueChange={(val) => setRegisterForm(prev => ({ ...prev, brandId: val }))}
                                        placeholder="Select brand..."
                                        onCreateOption={async (name) => {
                                            const newId = await handleCreateBrand(name);
                                            if (newId) setRegisterForm(prev => ({ ...prev, brandId: String(newId) }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Category</label>
                                    <CreatableSelect
                                        options={categoryOptions}
                                        value={registerForm.categoryId}
                                        onValueChange={(val) => setRegisterForm(prev => ({ ...prev, categoryId: val }))}
                                        placeholder="Select category..."
                                        onCreateOption={async (name) => {
                                            const newId = await handleCreateCategory(name);
                                            if (newId) setRegisterForm(prev => ({ ...prev, categoryId: String(newId) }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Base UOM</label>
                                    <select
                                        value={registerForm.baseUom}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, baseUom: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        {units.map(u => (
                                            <option key={u.unit_id} value={u.unit_shortcut}>
                                                {u.unit_name} ({u.unit_shortcut})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Target Selling Price (₱)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 150.00"
                                        value={registerForm.targetSellingPrice}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, targetSellingPrice: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Density Factor</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        placeholder="1.0"
                                        value={registerForm.densityFactor}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, densityFactor: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Initial Version Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. OIL 1ST VERSION"
                                        value={registerForm.versionName}
                                        onChange={e => setRegisterForm(prev => ({ ...prev, versionName: e.target.value }))}
                                        className="w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsRegisterModalOpen(false)}
                                    className="px-4 py-2 border rounded text-xs font-semibold hover:bg-muted transition-colors text-muted-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingBOM}
                                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {savingBOM ? "Registering..." : "Register"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
