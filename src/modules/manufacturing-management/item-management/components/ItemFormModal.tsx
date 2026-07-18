import React, { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { ItemType, ItemClassification } from "../types";
import { Button } from "@/components/ui/button";
import { CreatableSelect } from "../../finished-goods/components/CreatableSelect";
import { toast } from "sonner";

interface ItemFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, typeId: number, classId: number) => Promise<boolean>;
    itemTypes: ItemType[];
    itemClassifications: ItemClassification[];
}

export default function ItemFormModal({
    isOpen,
    onClose,
    onSave,
    itemTypes,
    itemClassifications
}: ItemFormModalProps) {
    const [itemName, setItemName] = useState("");
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [selectedClassId, setSelectedClassId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const typeOptions = useMemo(() => {
        return itemTypes.map((t) => ({
            value: String(t.id),
            label: t.type_name
        }));
    }, [itemTypes]);

    const classificationOptions = useMemo(() => {
        return itemClassifications.map((c) => ({
            value: String(c.id),
            label: c.classification_name
        }));
    }, [itemClassifications]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = itemName.trim();
        if (!trimmed) {
            toast.error("Item Name is required.");
            return;
        }
        if (!selectedTypeId) {
            toast.error("Item Type is required.");
            return;
        }
        if (!selectedClassId) {
            toast.error("Item Classification is required.");
            return;
        }

        setSubmitting(true);
        const success = await onSave(trimmed, Number(selectedTypeId), Number(selectedClassId));
        setSubmitting(false);

        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-muted/10">
                    <h3 className="text-sm font-bold text-foreground">Register New Catalog Item</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground text-xs font-semibold px-2 py-1 hover:bg-muted rounded transition-colors"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                    {/* Item Name */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Item Name <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Soya Press Machine Model X"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            disabled={submitting}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    {/* Item Type */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Item Type <span className="text-destructive">*</span>
                        </label>
                        <CreatableSelect
                            variant="inline"
                            options={typeOptions}
                            value={selectedTypeId}
                            onValueChange={setSelectedTypeId}
                            placeholder="Select Item Type..."
                            disabled={submitting}
                            popoverClassName="z-[70]"
                        />
                    </div>

                    {/* Item Classification */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Item Classification <span className="text-destructive">*</span>
                        </label>
                        <CreatableSelect
                            variant="inline"
                            options={classificationOptions}
                            value={selectedClassId}
                            onValueChange={setSelectedClassId}
                            placeholder="Select Item Classification..."
                            disabled={submitting}
                            popoverClassName="z-[70]"
                        />
                    </div>


                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={submitting}
                            className="h-8 px-3 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="h-8 px-3 text-xs bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded shadow transition-all"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                    Registering...
                                </>
                            ) : (
                                "Register Item"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
