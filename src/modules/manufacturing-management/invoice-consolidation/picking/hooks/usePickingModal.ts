"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { InvoiceConsolidation, PickingSavePayload } from "../../types";
import { PickingItem, PickingTotals } from "../types";

export function usePickingModal(
    consolidation: InvoiceConsolidation | null,
    submitting: boolean,
    onSaveQuantities: (payload: PickingSavePayload) => Promise<boolean>,
    onCompletePicking: (batchId: number) => Promise<boolean>,
    onClose: () => void,
) {
    const [localItems, setLocalItems] = useState<PickingItem[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (consolidation?.details) {
            setLocalItems(
                consolidation.details.map((d) => ({
                    detailId: d.id,
                    productId: d.productId,
                    productName: d.productName,
                    productCode: d.productCode,
                    orderedQuantity: d.orderedQuantity,
                    pickedQuantity: d.pickedQuantity,
                }))
            );
            setHasChanges(false);
            setEditingDetailId(null);
            setShowCompleteConfirm(false);
            setShowCloseConfirm(false);
        }
    }, [consolidation?.id, consolidation?.details]);

    const totals: PickingTotals = useMemo(() => {
        const ordered = localItems.reduce((s, i) => s + i.orderedQuantity, 0);
        const picked = localItems.reduce((s, i) => s + i.pickedQuantity, 0);
        const short = ordered - picked;
        const pct = ordered > 0 ? (picked / ordered) * 100 : 0;
        return { ordered, picked, short, pct };
    }, [localItems]);

    const shortProducts = useMemo(() => {
        return localItems.filter((i) => i.pickedQuantity < i.orderedQuantity);
    }, [localItems]);

    const updateItem = useCallback((detailId: number, newQty: number) => {
        setLocalItems((prev) =>
            prev.map((i) =>
                i.detailId === detailId
                    ? { ...i, pickedQuantity: Math.max(0, Math.min(newQty, i.orderedQuantity)) }
                    : i
            )
        );
        setHasChanges(true);
    }, []);

    const increment = useCallback((detailId: number) => {
        const item = localItems.find((i) => i.detailId === detailId);
        if (item && item.pickedQuantity < item.orderedQuantity) {
            updateItem(detailId, item.pickedQuantity + 1);
        }
    }, [localItems, updateItem]);

    const decrement = useCallback((detailId: number) => {
        const item = localItems.find((i) => i.detailId === detailId);
        if (item && item.pickedQuantity > 0) {
            updateItem(detailId, item.pickedQuantity - 1);
        }
    }, [localItems, updateItem]);

    const startEdit = useCallback((item: PickingItem) => {
        setEditingDetailId(item.detailId);
        setEditValue(String(item.pickedQuantity));
    }, []);

    const commitEdit = useCallback(() => {
        if (editingDetailId == null) return;
        const qty = parseInt(editValue, 10);
        if (!isNaN(qty) && qty >= 0) {
            updateItem(editingDetailId, qty);
        }
        setEditingDetailId(null);
        setEditValue("");
    }, [editingDetailId, editValue, updateItem]);

    const cancelEdit = useCallback(() => {
        setEditingDetailId(null);
        setEditValue("");
    }, []);

    const savingRef = useRef(false);

    useEffect(() => {
        savingRef.current = saving;
    }, [saving]);

    const doSave = useCallback(async (): Promise<boolean> => {
        if (!consolidation) return false;
        setSaving(true);
        try {
            const success = await onSaveQuantities({
                batchId: consolidation.id,
                quantities: localItems.map((i) => ({
                    detailId: i.detailId,
                    pickedQuantity: i.pickedQuantity,
                })),
            });
            if (success) {
                setHasChanges(false);
            }
            return success;
        } finally {
            setSaving(false);
        }
    }, [consolidation, localItems, onSaveQuantities]);

    const handleSave = useCallback(async () => {
        if (!consolidation || !hasChanges) return;
        await doSave();
    }, [consolidation, hasChanges, doSave]);

    const handleComplete = useCallback(async () => {
        if (!consolidation) return;
        if (shortProducts.length > 0) {
            setShowCompleteConfirm(true);
            return;
        }
        setSaving(true);
        try {
            if (hasChanges) {
                const saved = await doSave();
                if (!saved) return;
            }
            await onCompletePicking(consolidation.id);
            setShowCompleteConfirm(false);
        } finally {
            setSaving(false);
        }
    }, [consolidation, hasChanges, shortProducts, doSave, onCompletePicking]);

    const handleConfirmShortComplete = useCallback(async () => {
        if (!consolidation) return;
        setSaving(true);
        try {
            if (hasChanges) {
                const saved = await doSave();
                if (!saved) return;
            }
            await onCompletePicking(consolidation.id);
            setShowCompleteConfirm(false);
        } finally {
            setSaving(false);
        }
    }, [consolidation, hasChanges, doSave, onCompletePicking]);

    const handleClose = useCallback(() => {
        if (hasChanges) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    }, [hasChanges, onClose]);

    return {
        localItems,
        hasChanges,
        editingDetailId,
        editValue,
        showCompleteConfirm,
        showCloseConfirm,
        saving,
        totals,
        shortProducts,
        setEditValue,
        setEditingDetailId,
        setShowCompleteConfirm,
        setShowCloseConfirm,
        increment,
        decrement,
        startEdit,
        commitEdit,
        cancelEdit,
        handleSave,
        handleComplete,
        handleConfirmShortComplete,
        handleClose,
    };
}
