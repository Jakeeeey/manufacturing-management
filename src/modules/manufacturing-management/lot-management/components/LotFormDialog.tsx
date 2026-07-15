import React from "react";
import { Loader2 } from "lucide-react";
import { Lot, InventoryType } from "../types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface LotFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    editingLot: Lot | null;
    formData: {
        lotName: string;
        inventoryTypeId: number | "";
        maxBatchCapacity: string;
    };
    onFormChange: (field: string, value: string | number) => void;
    inventoryTypes: InventoryType[];
    saving: boolean;
}

export default function LotFormDialog({
    isOpen,
    onClose,
    onSubmit,
    editingLot,
    formData,
    onFormChange,
    inventoryTypes,
    saving
}: LotFormDialogProps) {
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{editingLot ? "Edit Lot" : "Add New Lot"}</DialogTitle>
                        <DialogDescription>
                            {editingLot
                                ? "Update the storage lot details."
                                : "Register a new warehouse storage location."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Lot Name */}
                        <div className="space-y-1">
                            <Label htmlFor="lotName">
                                Lot Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="lotName"
                                placeholder="e.g. Rack A-1, Bin B"
                                autoComplete="off"
                                value={formData.lotName}
                                onChange={(e) => onFormChange("lotName", e.target.value)}
                                required
                                disabled={saving}
                            />
                        </div>

                        {/* Inventory Type */}
                        <div className="space-y-1">
                            <Label htmlFor="inventoryType">
                                Inventory Type <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={formData.inventoryTypeId === "" ? undefined : String(formData.inventoryTypeId)}
                                onValueChange={(val) => onFormChange("inventoryTypeId", Number(val))}
                                disabled={saving}
                            >
                                <SelectTrigger id="inventoryType" className="w-full">
                                    <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent position="popper" sideOffset={4}>
                                    {inventoryTypes.map((type) => (
                                        <SelectItem
                                            key={type.inventoryTypeId}
                                            value={String(type.inventoryTypeId)}
                                        >
                                            {type.typeName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Max Batch Capacity */}
                        <div className="space-y-1">
                            <Label htmlFor="maxBatchCapacity">
                                Max Batch Capacity (Batches) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="maxBatchCapacity"
                                type="number"
                                min="1"
                                step="1"
                                placeholder="e.g. 50"
                                value={formData.maxBatchCapacity}
                                onChange={(e) => onFormChange("maxBatchCapacity", e.target.value)}
                                onKeyDown={(e) => {
                                    if (["-", "e", "E", "+", "."].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                onPaste={(e) => {
                                    const pasted = e.clipboardData.getData("text");
                                    if (/[^0-9]/.test(pasted)) {
                                        e.preventDefault();
                                    }
                                }}
                                required
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingLot ? "Save Changes" : "Create Lot"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
