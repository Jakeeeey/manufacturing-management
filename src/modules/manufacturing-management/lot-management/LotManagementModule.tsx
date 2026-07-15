"use client";

import React, { useState } from "react";
import { useLotManagement } from "./hooks/useLotManagement";
import LotTable from "./components/LotTable";
import LotFormDialog from "./components/LotFormDialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction
} from "@/components/ui/alert-dialog";

export default function LotManagementModule() {
    const {
        filteredLots,
        loading,
        saving,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        inventoryTypes,
        isFormOpen,
        editingLot,
        formData,
        openCreateDialog,
        openEditDialog,
        closeDialog,
        handleFormChange,
        handleCreate,
        handleUpdate,
        handleDelete,
        loadLots
    } = useLotManagement();

    const [deletingLotId, setDeletingLotId] = useState<number | null>(null);

    const confirmDelete = async () => {
        if (deletingLotId !== null) {
            await handleDelete(deletingLotId);
            setDeletingLotId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Lot Table */}
            <LotTable
                filteredLots={filteredLots}
                loading={loading}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                inventoryTypes={inventoryTypes}
                onEdit={openEditDialog}
                onDelete={(id) => setDeletingLotId(id)}
                onRefresh={loadLots}
                onAddClick={openCreateDialog}
            />

            {/* Lot Form Dialog */}
            <LotFormDialog
                isOpen={isFormOpen}
                onClose={closeDialog}
                onSubmit={editingLot ? handleUpdate : handleCreate}
                editingLot={editingLot}
                formData={formData}
                onFormChange={handleFormChange}
                inventoryTypes={inventoryTypes}
                saving={saving}
            />

            {/* Two-step Delete Confirmation Dialog */}
            <AlertDialog
                open={deletingLotId !== null}
                onOpenChange={(open) => {
                    if (!open) setDeletingLotId(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Storage Lot</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. Are you sure you want to delete this lot?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingLotId(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/95"
                        >
                            Delete Lot
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
