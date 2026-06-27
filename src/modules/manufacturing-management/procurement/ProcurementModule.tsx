"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useSearchParams, useRouter } from "next/navigation";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Building2, Anchor, Landmark, Layers, Briefcase, Plus, Loader2 } from "lucide-react";
import SuppliersDirectory from "./components/SuppliersDirectory";
import IncomingShipments from "./components/IncomingShipments";
import ShipmentExpenses from "./components/ShipmentExpenses";
import RawMaterialsMaster from "./components/RawMaterialsMaster";
import { useProcurement } from "./hooks/useProcurement";

interface ProcurementModuleProps {
    initialTab?: string;
}

export default function ProcurementModule({ initialTab = "suppliers" }: ProcurementModuleProps) {
    const router = useRouter();
    const {
        activeTab,
        setActiveTab,
        loading,
        suppliers,
        shipments,
        rawMaterials,
        selectedShipment,
        setSelectedShipment,
        selectedShipmentLines,
        selectedShipmentExpenses,
        isSupplierModalOpen,
        setIsSupplierModalOpen,
        isShipmentModalOpen,
        setIsShipmentModalOpen,
        isExpenseModalOpen,
        setIsExpenseModalOpen,
        supplierForm,
        setSupplierForm,
        supplierError,
        isEditingSupplier,
        handleStartEditSupplier,
        shipmentForm,
        setShipmentForm,
        shipmentLinesForm,
        setShipmentLinesForm,
        expenseAllocationForm,
        setExpenseAllocationForm,
        handleCreateSupplier,
        handleCreateShipment,
        handleAllocateExpenses,
        handleUpdateShipmentStatus,
        handleRegisterRawMaterial
    } = useProcurement(initialTab);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        // Seamlessly update route URL
        router.push(`/mm/${tabId}`);
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTriggerExpenseAllocation = (shipment: any) => {
        setSelectedShipment(shipment);
        setIsExpenseModalOpen(true);
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden space-y-4">
            {/* Tab Content window */}
            <div className="flex-1 overflow-y-auto min-h-0 relative">
                {loading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {activeTab === "suppliers" && (
                    <SuppliersDirectory
                        suppliers={suppliers}
                        isModalOpen={isSupplierModalOpen}
                        setIsModalOpen={setIsSupplierModalOpen}
                        supplierForm={supplierForm}
                        setSupplierForm={setSupplierForm}
                        supplierError={supplierError}
                        isEditingSupplier={isEditingSupplier}
                        onStartEditSupplier={handleStartEditSupplier}
                        onCreateSupplier={handleCreateSupplier}
                        rawMaterials={rawMaterials}
                    />
                )}

                {activeTab === "incoming-shipments" && (
                    <IncomingShipments
                        shipments={shipments}
                        suppliers={suppliers}
                        rawMaterials={rawMaterials}
                        selectedShipment={selectedShipment}
                        setSelectedShipment={setSelectedShipment}
                        lines={selectedShipmentLines}
                        isModalOpen={isShipmentModalOpen}
                        setIsModalOpen={setIsShipmentModalOpen}
                        shipmentForm={shipmentForm}
                        setShipmentForm={setShipmentForm}
                        linesForm={shipmentLinesForm}
                        setLinesForm={setShipmentLinesForm}
                        onCreateShipment={handleCreateShipment}
                        onTriggerAllocation={handleTriggerExpenseAllocation}
                        onUpdateShipmentStatus={handleUpdateShipmentStatus}
                        loading={loading}
                    />
                )}

                {activeTab === "shipment-expenses" && (
                    <div className="border rounded-xl p-6 bg-card shadow-sm h-full overflow-y-auto">
                        {selectedShipment ? (
                            <ShipmentExpenses
                                shipment={selectedShipment}
                                lines={selectedShipmentLines}
                                expenses={selectedShipmentExpenses}
                                isModalOpen={isExpenseModalOpen}
                                setIsModalOpen={setIsExpenseModalOpen}
                                allocationForm={expenseAllocationForm}
                                setAllocationForm={setExpenseAllocationForm}
                                onAllocate={handleAllocateExpenses}
                            />
                        ) : shipments.length > 0 ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs text-amber-600 font-semibold">
                                    Please select a shipment from the dropdown below to calculate and allocate landed costs.
                                </div>
                                <div className="space-y-1.5 max-w-xs">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Active Cargo Shipment</label>
                                    <select
                                        onChange={(e) => {
                                            const match = shipments.find(s => String(s.shipment_id) === e.target.value);
                                            if (match) setSelectedShipment(match);
                                        }}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                    >
                                        <option value="">-- Choose Cargo Shipment --</option>
                                        {shipments.map(s => (
                                            <option key={s.shipment_id} value={s.shipment_id}>
                                                BL/PO: {s.reference_number} ({s.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground">
                                <Landmark className="h-16 w-16 mb-4 text-muted-foreground/30" />
                                No logged shipments available for expense allocation. Go to &quot;Incoming Shipments&quot; to record cargo first.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "raw-materials" && (
                    <RawMaterialsMaster 
                        rawMaterials={rawMaterials} 
                        suppliers={suppliers}
                        onRegisterRawMaterial={handleRegisterRawMaterial}
                    />
                )}
            </div>
        </div>
    );
}
