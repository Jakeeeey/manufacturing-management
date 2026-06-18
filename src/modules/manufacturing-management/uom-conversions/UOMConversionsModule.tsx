"use client";

import React from "react";
import { Scale, Save, X, Plus } from "lucide-react";
import { useUOMConversions } from "./hooks/useUOMConversions";
import DensityMatrixTable from "./components/DensityMatrixTable";
import ConversionCalculator from "./components/ConversionCalculator";
import UOMValidationLogs from "./components/UOMValidationLogs";

export default function UOMConversionsModule() {
    const {
        densities,
        logs,
        isAddOpen,
        setIsAddOpen,
        newDensity,
        setNewDensity,
        calcVal,
        setCalcVal,
        calcFrom,
        setCalcFrom,
        calcTo,
        setCalcTo,
        selectedOilId,
        setSelectedOilId,
        handleAddDensity,
        handleDeleteDensity,
        handleRunCalculation,
        clearLogs,
        activeOil,
        previewResult
    } = useUOMConversions();

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-1 sm:p-2 relative">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/10 p-5 border rounded-xl">
                <div className="space-y-1">
                    <h2 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                        <Scale className="h-4.5 w-4.5 text-primary" />
                        UOM Conversions & Density Matrix
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                        Configure volumetric-to-gravimetric density multipliers (specific gravity) and execute recipe weight conversions.
                    </p>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column: Density Matrix (Takes 2/3 of space on larger screens) */}
                <div className="lg:col-span-2 flex flex-col h-full">
                    <DensityMatrixTable
                        densities={densities}
                        onDelete={handleDeleteDensity}
                        onAddClick={() => setIsAddOpen(true)}
                    />
                </div>

                {/* Right Column: Calculator & Rules */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <ConversionCalculator
                        densities={densities}
                        calcVal={calcVal}
                        setCalcVal={setCalcVal}
                        calcFrom={calcFrom}
                        setCalcFrom={setCalcFrom}
                        calcTo={calcTo}
                        setCalcTo={setCalcTo}
                        selectedOilId={selectedOilId}
                        setSelectedOilId={setSelectedOilId}
                        onCalculate={handleRunCalculation}
                        activeOil={activeOil}
                        previewResult={previewResult}
                    />

                    <UOMValidationLogs
                        logs={logs}
                        onClear={clearLogs}
                    />
                </div>
            </div>

            {/* Premium Add Liquid Modal (Glassmorphism Overlay) */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="bg-card border w-full max-w-md rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b pb-3 mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                <Plus className="h-4 w-4 text-primary" />
                                Add Custom Liquid Profile
                            </h3>
                            <button
                                onClick={() => setIsAddOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAddDensity} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Liquid/Oil Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newDensity.name}
                                    onChange={(e) => setNewDensity(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Corn Oil, Coconut Fatty Acid"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Density Factor (kg per Liter)</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    required
                                    value={newDensity.density}
                                    onChange={(e) => setNewDensity(prev => ({ ...prev, density: e.target.value }))}
                                    placeholder="e.g. 0.920"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-semibold"
                                />
                                <span className="text-[9px] text-muted-foreground block leading-tight">
                                    Water is 1.0000. Most vegetable oils are between 0.8900 and 0.9250.
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Description</label>
                                <textarea
                                    value={newDensity.description}
                                    onChange={(e) => setNewDensity(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="e.g. Grade A raw palm kernel extract"
                                    rows={3}
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-none font-medium"
                                />
                            </div>

                            <div className="flex gap-3 justify-end pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsAddOpen(false)}
                                    className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted text-foreground transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save Profile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
