"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Loader2, DollarSign, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { CreatableSelect } from "../../finished-goods/components/CreatableSelect";

interface CreateSalesOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit: (payload: any) => Promise<any>;
}

export function CreateSalesOrderModal({
    isOpen,
    onClose,
    onSubmit
}: CreateSalesOrderModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const poInputRef = useRef<HTMLInputElement>(null);

    // Lookups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [customers, setCustomers] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [products, setProducts] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branches, setBranches] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [salesmen, setSalesmen] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [suppliers, setSuppliers] = useState<any[]>([]);

    const [loadingLookups, setLoadingLookups] = useState(false);

    // Form fields
    const [customerId, setCustomerId] = useState("");
    const [poNo, setPoNo] = useState("");
    const [branchId, setBranchId] = useState("");
    const [paymentTermId, setPaymentTermId] = useState("");
    const [salesmanId, setSalesmanId] = useState("");
    const [supplierId, setSupplierId] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [discountAmount, setDiscountAmount] = useState(0);
    const [remarks, setRemarks] = useState("");

    // Detail Items
    const [items, setItems] = useState<{ product_id: number; quantity: number; unit_price: number }[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        // Fetch lookups
        const loadLookups = async () => {
            setLoadingLookups(true);
            try {
                const [custRes, prodRes, branchRes, termsRes, salesRes, suppRes] = await Promise.all([
                    fetch("/api/manufacturing/finished-goods/customers?all=true").then(r => r.ok ? r.json() : []),
                    fetch("/api/manufacturing/finished-goods/products?limit=250").then(r => r.ok ? r.json() : []),
                    fetch("/api/manufacturing/procurement/qa-receiving?action=branches").then(r => r.ok ? r.json() : []),
                    fetch("/api/manufacturing/payment-terms").then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch("/api/manufacturing/salesman").then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch("/api/manufacturing/procurement/suppliers").then(r => r.ok ? r.json() : []).catch(() => [])
                ]);

                setCustomers(Array.isArray(custRes) ? custRes : (custRes.data || []));
                // Only finished goods (type 388)
                const allProds = Array.isArray(prodRes) ? prodRes : (prodRes.data || []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setProducts(allProds.filter((p: any) => Number(p.product_type) === 388));
                
                setBranches(Array.isArray(branchRes) ? branchRes : (branchRes.data || []));
                setPaymentTerms(Array.isArray(termsRes) ? termsRes : (termsRes.data || []));
                setSalesmen(Array.isArray(salesRes) ? salesRes : (salesRes.data || []));
                setSuppliers(Array.isArray(suppRes) ? suppRes : (suppRes.data || []));
            } catch (err) {
                console.error("Failed to load lookups:", err);
                toast.error("Failed to load required setup directories.");
            } finally {
                setLoadingLookups(false);
            }
        };

        loadLookups();
        // Reset state
        setCustomerId("");
        setPoNo("");
        setBranchId("");
        setPaymentTermId("");
        setSalesmanId("");
        setSupplierId("");
        setDeliveryDate("");
        setDueDate("");
        setDiscountAmount(0);
        setRemarks("");
        setItems([]);

        // Focus PO Number input on open
        setTimeout(() => {
            poInputRef.current?.focus();
        }, 150);
    }, [isOpen]);

    const handleAddItem = () => {
        setItems(prev => [...prev, { product_id: 0, quantity: 1, unit_price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, idx) => idx !== index));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleItemChange = (index: number, field: string, value: any) => {
        setItems(prev => prev.map((item, idx) => {
            if (idx === index) {
                const updated = { ...item, [field]: value };
                // If product changed, we can autofill standard price if available
                if (field === "product_id") {
                    const prod = products.find(p => Number(p.product_id) === Number(value));
                    updated.unit_price = prod ? Number(prod.price_per_unit || prod.cost_per_unit || 0) : 0;
                }
                return updated;
            }
            return item;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId) return toast.warning("Please select a customer.");
        if (!poNo.trim()) return toast.warning("Please input a PO number.");
        if (items.length === 0) return toast.warning("Please add at least one item.");
        if (items.some(it => !it.product_id || it.quantity <= 0 || it.unit_price < 0)) {
            return toast.warning("Please configure all item products, quantities, and prices correctly.");
        }

        setSubmitting(true);
        try {
            await onSubmit({
                customerId: Number(customerId),
                poNo,
                branchId: branchId ? Number(branchId) : null,
                paymentTerms: paymentTermId ? Number(paymentTermId) : null,
                salesmanId: salesmanId ? Number(salesmanId) : null,
                supplierId: supplierId ? Number(supplierId) : null,
                deliveryDate: deliveryDate || null,
                dueDate: dueDate || null,
                discountAmount,
                remarks,
                items
            });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleFormKeyDown = (e: React.KeyboardEvent) => {
        // Prevent form submission on hitting Enter in input fields
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
        }
        // Keyboard Shortcut: Alt + A adds a product row
        if (e.altKey && e.key.toLowerCase() === "a") {
            e.preventDefault();
            handleAddItem();
        }
    };

    if (!isOpen) return null;

    const subTotal = items.reduce((sum, it) => sum + (Number(it.unit_price || 0) * Number(it.quantity || 0)), 0);
    const grandTotal = Math.max(0, subTotal - discountAmount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-300">
            <div className="bg-card border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b flex items-center justify-between bg-muted/10">
                    <div>
                        <h4 className="text-base font-black text-foreground flex items-center gap-2">
                            <span>Create Direct Sales Order</span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase bg-muted/80 border px-1.5 py-0.5 rounded">
                                <Keyboard className="h-3 w-3" /> Keyboard Friendly
                            </span>
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Initialize a Sales Order directly with fast autocomplete fields and keyboard shortcuts.</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {loadingLookups ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-xs">Loading dependencies...</span>
                    </div>
                ) : (
                    <form 
                        onSubmit={handleSubmit} 
                        onKeyDown={handleFormKeyDown}
                        className="flex-1 overflow-y-auto p-6 space-y-6"
                    >
                        {/* Keyboard navigation helper */}
                        <div className="text-[10px] text-muted-foreground bg-muted/30 border border-muted/50 rounded-lg p-2.5 flex items-center justify-between">
                            <span className="font-semibold">💡 Keyboard Shortcuts:</span>
                            <div className="flex gap-4">
                                <span><kbd className="bg-muted px-1.5 py-0.5 border rounded shadow-xs text-[9px] font-bold">Alt + A</kbd> Add product row</span>
                                <span><kbd className="bg-muted px-1.5 py-0.5 border rounded shadow-xs text-[9px] font-bold">Tab</kbd> Move focus forward</span>
                                <span><kbd className="bg-muted px-1.5 py-0.5 border rounded shadow-xs text-[9px] font-bold">Esc</kbd> Close modal</span>
                            </div>
                        </div>

                        {/* Header Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">PO Number <span className="text-red-500">*</span></label>
                                <input
                                    ref={poInputRef}
                                    type="text"
                                    required
                                    value={poNo}
                                    onChange={e => setPoNo(e.target.value)}
                                    placeholder="e.g. PO-88902"
                                    className="w-full h-9 bg-background border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Customer <span className="text-red-500">*</span></label>
                                <CreatableSelect
                                    options={customers.map(c => ({ value: String(c.id), label: `${c.customer_name} (${c.customer_code})` }))}
                                    value={customerId}
                                    onValueChange={val => setCustomerId(val)}
                                    placeholder="Select Customer..."
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Production Branch</label>
                                <CreatableSelect
                                    options={branches.map(b => ({ value: String(b.id), label: b.branch_name }))}
                                    value={branchId}
                                    onValueChange={val => setBranchId(val)}
                                    placeholder="Select Branch..."
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Payment Terms</label>
                                <CreatableSelect
                                    options={paymentTerms.map(t => ({ value: String(t.id), label: `${t.payment_name} (${t.payment_days} days)` }))}
                                    value={paymentTermId}
                                    onValueChange={val => setPaymentTermId(val)}
                                    placeholder="Select Terms..."
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Salesman</label>
                                <CreatableSelect
                                    options={salesmen.map(s => ({ value: String(s.id), label: s.salesman_name }))}
                                    value={salesmanId}
                                    onValueChange={val => setSalesmanId(val)}
                                    placeholder="Select Salesman..."
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Supplier</label>
                                <CreatableSelect
                                    options={suppliers.map(s => ({ value: String(s.id), label: s.supplier_name }))}
                                    value={supplierId}
                                    onValueChange={val => setSupplierId(val)}
                                    placeholder="Select Supplier..."
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Delivery Date</label>
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                    className="w-full h-9 bg-background border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Due Date</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="w-full h-9 bg-background border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Discount Amount (PHP)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={discountAmount}
                                    onChange={e => setDiscountAmount(Number(e.target.value))}
                                    className="w-full h-9 bg-background border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Remarks / Special Instructions</label>
                            <textarea
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                placeholder="Add general remarks, freight instructions, or delivery guidelines here..."
                                rows={2}
                                className="w-full bg-background border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none font-semibold"
                            />
                        </div>

                        {/* Order Items Section */}
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-foreground uppercase tracking-wider">Ordered Products Catalog</h5>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border-none px-3 py-1.5 text-xs font-bold cursor-pointer transition-all"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Product SKU
                                </button>
                            </div>

                            <div className="border rounded-xl bg-card overflow-visible">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-muted/40 border-b text-[9px] font-black uppercase text-muted-foreground">
                                            <th className="py-2.5 px-4 w-1/2">Product finished good</th>
                                            <th className="py-2.5 px-4 text-right">Unit Price (PHP)</th>
                                            <th className="py-2.5 px-4 text-right">Quantity</th>
                                            <th className="py-2.5 px-4 text-right">Total Net</th>
                                            <th className="py-2.5 px-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-muted-foreground italic font-semibold">
                                                    No products added yet. Click &quot;Add Product SKU&quot; or press <kbd className="bg-muted px-1 border rounded text-[9px] font-mono mx-1">Alt + A</kbd> to begin.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item, index) => {
                                                const totalNet = Number(item.unit_price || 0) * Number(item.quantity || 0);
                                                // Filter out product IDs selected in other rows
                                                const otherSelectedProductIds = items
                                                    .map((it, idx) => idx !== index ? it.product_id : 0)
                                                    .filter(id => id > 0);
                                                const filteredOptions = products
                                                    .filter(p => !otherSelectedProductIds.includes(p.product_id))
                                                    .map(p => ({
                                                        value: String(p.product_id),
                                                        label: `${p.product_name} (${p.product_code || `SKU-${p.product_id}`})`
                                                    }));
                                                return (
                                                    <tr key={index} className="hover:bg-muted/5 font-semibold text-foreground">
                                                        <td className="p-3 overflow-visible">
                                                            <CreatableSelect
                                                                options={filteredOptions}
                                                                value={item.product_id ? String(item.product_id) : ""}
                                                                onValueChange={val => handleItemChange(index, "product_id", Number(val))}
                                                                placeholder="Choose Product SKU..."
                                                                className="h-8 text-xs font-semibold"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-right w-32">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={item.unit_price}
                                                                onChange={e => handleItemChange(index, "unit_price", Number(e.target.value))}
                                                                className="w-full bg-background border rounded-lg px-2 py-1 h-8 text-xs text-right outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-right w-24">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={item.quantity}
                                                                onChange={e => handleItemChange(index, "quantity", Number(e.target.value))}
                                                                className="w-full bg-background border rounded-lg px-2 py-1 h-8 text-xs text-right outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-right font-bold text-foreground">
                                                            ₱{totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="p-1 hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 rounded-lg border-none bg-transparent cursor-pointer transition-colors"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Summary panel */}
                        <div className="flex justify-end pt-4 border-t">
                            <div className="w-full md:w-64 space-y-2 border rounded-xl p-4 bg-muted/10">
                                <div className="flex justify-between text-xs text-muted-foreground font-bold">
                                    <span>Subtotal:</span>
                                    <span>₱{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-xs text-rose-500 font-bold">
                                    <span>Discount:</span>
                                    <span>-₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-sm text-foreground font-black border-t pt-2">
                                    <span>Grand Total:</span>
                                    <span className="text-primary">₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="bg-slate-850 hover:bg-slate-800 text-foreground border border-slate-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer animate-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <DollarSign className="h-3.5 w-3.5" />
                                        Create Sales Order
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
