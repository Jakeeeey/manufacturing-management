"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Building2, Anchor, Landmark, Layers, Briefcase, Plus, Loader2 } from "lucide-react";
import SuppliersDirectory from "./components/SuppliersDirectory";
import IncomingShipments from "./components/IncomingShipments";
import ShipmentExpenses from "./components/ShipmentExpenses";
import RawMaterialsMaster from "./components/RawMaterialsMaster";
import { useProcurement } from "./hooks/useProcurement";
import { CreatableSelect } from "../finished-goods/components/CreatableSelect";

interface ProcurementModuleProps {
    initialTab?: string;
}

export default function ProcurementModule({ initialTab = "suppliers" }: ProcurementModuleProps) {

    const {
        activeTab,
        loading,
        suppliers,
        shipments,
        rawMaterials,
        supplierLinkedProducts,
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
        handleRegisterRawMaterial,
        handleToggleSupplierActive
    } = useProcurement(initialTab);

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
                        onToggleSupplierActive={handleToggleSupplierActive}
                        rawMaterials={rawMaterials}
                    />
                )}

                {activeTab === "incoming-shipments" && (
                    <IncomingShipments
                        shipments={shipments}
                        suppliers={suppliers}
                        rawMaterials={rawMaterials}
                        supplierLinkedProducts={supplierLinkedProducts}
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
                                <div className="space-y-1.5 max-w-sm flex flex-col">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Active Cargo Shipment</label>
                                    <CreatableSelect
                                        options={shipments.map(s => ({
                                            value: String(s.shipment_id),
                                            label: `BL/PO: ${s.reference_number} (${s.status})`
                                        }))}
                                        value=""
                                        onValueChange={(val) => {
                                            const match = shipments.find(s => String(s.shipment_id) === val);
                                            if (match) setSelectedShipment(match);
                                        }}
                                        placeholder="Choose Cargo Shipment..."
                                        className="h-9 text-xs w-full bg-background font-semibold"
                                    />
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
