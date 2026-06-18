"use client";

import React, { useState, useMemo } from "react";
import { Sliders, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Re-using mock product model internally
interface BOMItem {
    id: string;
    name: string;
    quantity: number;
    uom: string;
    wastagePercent: number;
    landedCost: number;
    foreignSourced?: boolean; // Flag to simulate forex spikes
}

interface Product {
    id: string;
    sku: string;
    title: string;
    baseUom: string;
    expectedYieldPercent: number;
    targetSellingPrice: number;
    bom: BOMItem[];
    routingCost: number;
}

const SIMULATOR_PRODUCTS: Product[] = [
    {
        id: "prod-1",
        sku: "BVO-1L-01",
        title: "1L Blended Vegetable Oil",
        baseUom: "L",
        expectedYieldPercent: 95.0,
        targetSellingPrice: 75.0,
        routingCost: 2.90, // Sum of standard routings
        bom: [
            { id: "bom-1-1", name: "Refined Palm Oil (Imported)", quantity: 0.65, uom: "L", wastagePercent: 2.0, landedCost: 58.20, foreignSourced: true },
            { id: "bom-1-2", name: "Refined Coconut Oil (Local)", quantity: 0.35, uom: "L", wastagePercent: 1.0, landedCost: 72.50 },
            { id: "bom-1-3", name: "PET Bottle 1L", quantity: 1.0, uom: "pc", wastagePercent: 1.0, landedCost: 3.80 },
            { id: "bom-1-4", name: "Screw Cap (Blue)", quantity: 1.0, uom: "pc", wastagePercent: 0.0, landedCost: 0.45 },
            { id: "bom-1-5", name: "Front Label", quantity: 1.0, uom: "pc", wastagePercent: 3.0, landedCost: 0.85 }
        ]
    },
    {
        id: "prod-2",
        sku: "RPO-2L-02",
        title: "2L Refined Palm Oil",
        baseUom: "L",
        expectedYieldPercent: 98.0,
        targetSellingPrice: 140.0,
        routingCost: 3.70,
        bom: [
            { id: "bom-2-1", name: "Refined Palm Oil (Imported)", quantity: 2.02, uom: "L", wastagePercent: 1.5, landedCost: 58.20, foreignSourced: true },
            { id: "bom-2-2", name: "PET Handle Bottle 2L", quantity: 1.0, uom: "pc", wastagePercent: 1.0, landedCost: 6.20 },
            { id: "bom-2-3", name: "Handle Cap", quantity: 1.0, uom: "pc", wastagePercent: 0.0, landedCost: 0.80 },
            { id: "bom-2-4", name: "Sleeve Label", quantity: 1.0, uom: "pc", wastagePercent: 2.0, landedCost: 1.20 }
        ]
    },
    {
        id: "prod-3",
        sku: "RCO-500-03",
        title: "500ml Refined Canola Oil",
        baseUom: "L",
        expectedYieldPercent: 94.0,
        targetSellingPrice: 68.0,
        routingCost: 5.50,
        bom: [
            { id: "bom-3-1", name: "Canola Crude Oil (Imported)", quantity: 0.51, uom: "L", wastagePercent: 2.5, landedCost: 78.40, foreignSourced: true },
            { id: "bom-3-2", name: "Glass Bottle 500ml", quantity: 1.0, uom: "pc", wastagePercent: 4.0, landedCost: 11.20 },
            { id: "bom-3-3", name: "Metal Lug Cap", quantity: 1.0, uom: "pc", wastagePercent: 1.0, landedCost: 1.60 },
            { id: "bom-3-4", name: "Paper Label", quantity: 1.0, uom: "pc", wastagePercent: 2.0, landedCost: 0.95 }
        ]
    }
];

export default function MarginSimulatorModule() {
    const [selectedId, setSelectedId] = useState("prod-1");
    
    const product = useMemo(() => {
        return SIMULATOR_PRODUCTS.find(p => p.id === selectedId) || SIMULATOR_PRODUCTS[0];
    }, [selectedId]);

    const initialProduct = SIMULATOR_PRODUCTS[0];

    // Simulator states
    const [simYield, setSimYield] = useState(initialProduct.expectedYieldPercent);
    const [forexMultiplier, setForexMultiplier] = useState(1.0); // Forex inflation e.g. 1.15 (+15% USD strength)
    const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(() => {
        const initialPrices: Record<string, number> = {};
        initialProduct.bom.forEach(item => {
            initialPrices[item.id] = item.landedCost;
        });
        return initialPrices;
    });
    const [targetPrice, setTargetPrice] = useState(initialProduct.targetSellingPrice);

    const handleProductChange = (productId: string) => {
        setSelectedId(productId);
        const nextProd = SIMULATOR_PRODUCTS.find(p => p.id === productId) || SIMULATOR_PRODUCTS[0];
        if (nextProd) {
            setSimYield(nextProd.expectedYieldPercent);
            setTargetPrice(nextProd.targetSellingPrice);
            setForexMultiplier(1.0);
            const initialPrices: Record<string, number> = {};
            nextProd.bom.forEach(item => {
                initialPrices[item.id] = item.landedCost;
            });
            setPriceOverrides(initialPrices);
        }
    };

    // Baseline calculation (Unmodified standard)
    const baseMaterialCost = useMemo(() => {
        return product.bom.reduce((sum, item) => {
            const factor = 1 - (item.wastagePercent / 100);
            return sum + ((item.quantity * item.landedCost) / (factor > 0 ? factor : 1));
        }, 0);
    }, [product]);

    const baseUnitCost = useMemo(() => {
        const yieldFactor = product.expectedYieldPercent / 100;
        return (baseMaterialCost + product.routingCost) / (yieldFactor > 0 ? yieldFactor : 1);
    }, [baseMaterialCost, product]);

    const baseMarginPhp = product.targetSellingPrice - baseUnitCost;
    const baseMarginPercent = product.targetSellingPrice > 0 ? (baseMarginPhp / product.targetSellingPrice) * 100 : 0;

    // Simulated calculations
    const simulatedMaterialCost = useMemo(() => {
        return product.bom.reduce((sum, item) => {
            const factor = 1 - (item.wastagePercent / 100);
            let unitCost = priceOverrides[item.id] !== undefined ? priceOverrides[item.id] : item.landedCost;
            
            // Apply Forex rate fluctuation to foreign-sourced materials
            if (item.foreignSourced) {
                unitCost = unitCost * forexMultiplier;
            }
            
            return sum + ((item.quantity * unitCost) / (factor > 0 ? factor : 1));
        }, 0);
    }, [product, priceOverrides, forexMultiplier]);

    const simulatedUnitCost = useMemo(() => {
        const yieldFactor = simYield / 100;
        return (simulatedMaterialCost + product.routingCost) / (yieldFactor > 0 ? yieldFactor : 1);
    }, [simulatedMaterialCost, product, simYield]);

    const simulatedMarginPhp = targetPrice - simulatedUnitCost;
    const simulatedMarginPercent = targetPrice > 0 ? (simulatedMarginPhp / targetPrice) * 100 : 0;

    const resetSimulation = () => {
        setSimYield(product.expectedYieldPercent);
        setTargetPrice(product.targetSellingPrice);
        setForexMultiplier(1.0);
        const initialPrices: Record<string, number> = {};
        product.bom.forEach(item => {
            initialPrices[item.id] = item.landedCost;
        });
        setPriceOverrides(initialPrices);
        toast.success("Simulation parameters reset successfully");
    };

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 sm:p-6 bg-background rounded-xl border">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Sliders className="h-5.5 w-5.5 text-primary" />
                        Cost & Margin What-If Simulator
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Interactive sandbox to stress-test margins against yield drops, forex spikes, and individual raw material price surges.
                    </p>
                </div>
                <button 
                    onClick={resetSimulation}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-muted text-xs font-semibold text-foreground hover:bg-accent transition-all"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset Simulator
                </button>
            </div>

            {/* Selector Grid */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Simulator Inputs Sidebar */}
                <div className="md:col-span-1 space-y-5 border-r pr-0 md:pr-6 border-b md:border-b-0 pb-6 md:pb-0">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground">Select Product to Simulate</label>
                        <select 
                            value={selectedId} 
                            onChange={e => handleProductChange(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background"
                        >
                            {SIMULATOR_PRODUCTS.map(p => (
                                <option key={p.id} value={p.id}>{p.title} ({p.sku})</option>
                            ))}
                        </select>
                    </div>

                    {/* Yield loss override */}
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-muted-foreground">Simulate Yield Drop</span>
                            <span className="font-bold text-amber-600">{simYield.toFixed(1)}%</span>
                        </div>
                        <input 
                            type="range"
                            min="60"
                            max="100"
                            step="0.5"
                            value={simYield}
                            onChange={e => setSimYield(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Severe Loss (60%)</span>
                            <span>Standard Yield ({product.expectedYieldPercent}%)</span>
                        </div>
                    </div>

                    {/* Global Forex Override */}
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-muted-foreground">Global Forex Shift (USD/PHP)</span>
                            <span className="font-bold text-primary">
                                {forexMultiplier === 1.0 ? "Standard (1.0x)" : `+${((forexMultiplier - 1) * 100).toFixed(0)}% PHP weakening`}
                            </span>
                        </div>
                        <input 
                            type="range"
                            min="1.0"
                            max="1.3"
                            step="0.01"
                            value={forexMultiplier}
                            onChange={e => setForexMultiplier(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Stable</span>
                            <span>+30% Inflation</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground bg-primary/5 p-1.5 rounded border border-primary/15">
                            Note: Applies only to ingredients flagged as <strong className="text-primary font-bold">Imported</strong> in the recipe tree.
                        </p>
                    </div>

                    {/* Target Price */}
                    <div className="space-y-1.5 pt-2 border-t">
                        <label className="text-xs font-bold text-muted-foreground">Simulated Selling Price (PHP)</label>
                        <div className="relative">
                            <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-semibold">₱</span>
                            <input 
                                type="number" 
                                step="0.50"
                                value={targetPrice}
                                onChange={e => setTargetPrice(parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border pl-6 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Ingredients & Margins Output */}
                <div className="md:col-span-2 space-y-6">
                    {/* Material overrides table */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold tracking-tight">Override Recipe Ingredients Landed Costs</h3>
                        <div className="border rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-muted/40 border-b font-semibold text-muted-foreground">
                                        <th className="p-3">Ingredient</th>
                                        <th className="p-3 text-center">UOM</th>
                                        <th className="p-3">Standard Cost</th>
                                        <th className="p-3">Simulated Price Override</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {product.bom.map(item => {
                                        const overrideVal = priceOverrides[item.id] !== undefined ? priceOverrides[item.id] : item.landedCost;
                                        return (
                                            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/5">
                                                <td className="p-3 font-medium">
                                                    {item.name}
                                                    {item.foreignSourced && (
                                                        <span className="ml-2 bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                            Imported
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center text-muted-foreground">{item.uom}</td>
                                                <td className="p-3 font-medium">₱{item.landedCost.toFixed(2)}</td>
                                                <td className="p-3 w-40">
                                                    <div className="relative">
                                                        <span className="absolute left-1.5 top-1.5 text-[10px] text-muted-foreground">₱</span>
                                                        <input 
                                                            type="number"
                                                            step="0.1"
                                                            value={overrideVal}
                                                            onChange={e => setPriceOverrides(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                                            className="w-full rounded border pl-4 pr-1.5 py-1 text-xs bg-background text-right"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Margin Results Comparative Board */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Standard Baseline */}
                        <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Baseline (Standard Cost)</span>
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">Base Unit Cost</p>
                                <p className="text-xl font-extrabold text-foreground">₱{baseUnitCost.toFixed(2)}</p>
                            </div>
                            <div className="border-t pt-2 space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Selling Price:</span>
                                    <span className="font-semibold">₱{product.targetSellingPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-1">
                                    <span className="font-bold text-foreground">Gross Margin %:</span>
                                    <span className="font-bold text-foreground">{baseMarginPercent.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Simulated Result */}
                        {(() => {
                            const isLow = simulatedMarginPercent < 15;
                            const isLoss = simulatedMarginPercent < 0;
                            return (
                                <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
                                    isLoss 
                                        ? "bg-destructive/5 border-destructive/30 text-destructive-foreground" 
                                        : isLow 
                                        ? "bg-amber-500/5 border-amber-500/30" 
                                        : "bg-emerald-500/5 border-emerald-500/30"
                                }`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Simulated What-If</span>
                                        {isLoss && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground">Simulated Unit Cost</p>
                                        <p className={`text-xl font-extrabold ${isLoss ? "text-destructive" : isLow ? "text-amber-600" : "text-emerald-600"}`}>
                                            ₱{simulatedUnitCost.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="border-t pt-2 space-y-1 text-foreground">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">Simulated Price:</span>
                                            <span className="font-semibold">₱{targetPrice.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed mt-1">
                                            <span className="font-bold">Simulated Gross Margin %:</span>
                                            <span className={`font-bold text-sm ${isLoss ? "text-destructive" : isLow ? "text-amber-600" : "text-emerald-600"}`}>
                                                {simulatedMarginPercent.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
