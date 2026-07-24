import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { ItemClassification } from "../types";

interface ItemClassificationFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => Promise<boolean>;
    itemClassification?: ItemClassification;
}

export default function ItemClassificationFormModal({
    isOpen,
    onClose,
    onSave,
    itemClassification
}: ItemClassificationFormModalProps) {
    const [classificationName, setClassificationName] = useState(itemClassification?.classification_name || "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(false);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = classificationName.trim();
        if (!trimmed) {
            setError(true);
            toast.error("Classification Name is required.");
            return;
        }

        setSubmitting(true);
        const success = await onSave(trimmed);
        setSubmitting(false);

        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0 bg-muted/10">
                    <h3 className="text-sm font-bold text-foreground">
                        {itemClassification ? "Edit Item Classification" : "Register New Item Classification"}
                    </h3>
                </div>

                {/* Form */}
                <form 
                    onSubmit={handleSubmit} 
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                        }
                    }}
                    className="p-5 space-y-4 text-xs"
                >
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Classification Name <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Asset & Equipment"
                            value={classificationName}
                            onChange={(e) => {
                                setClassificationName(e.target.value);
                                if (e.target.value.trim()) {
                                    setError(false);
                                }
                            }}
                            disabled={submitting}
                            className={`w-full rounded-lg border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 transition-all ${
                                error
                                    ? "border-destructive focus:ring-destructive"
                                    : "border-border focus:ring-primary"
                            }`}
                        />
                    </div>

                    {/* Footer */}
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
                                    {itemClassification ? "Saving..." : "Registering..."}
                                </>
                            ) : (
                                itemClassification ? "Save Changes" : "Register Classification"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
