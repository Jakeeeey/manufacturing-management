import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRight, X } from "lucide-react";
import { Customer, QuotationHeader, QuotationSnapshotNode } from "../types";

interface QuotationDetailModalProps {
    isDetailModalOpen: boolean;
    selectedQuote: QuotationHeader | null;
    snapshots: QuotationSnapshotNode[];
    loadingSnapshots: boolean;
    setIsDetailModalOpen: (open: boolean) => void;
    reviseQuotation: (quote: QuotationHeader) => void;
    loadQuotes?: () => void;
}

export function QuotationDetailModal({
    isDetailModalOpen,
    selectedQuote,
    snapshots,
    loadingSnapshots,
    setIsDetailModalOpen,
    reviseQuotation,
    loadQuotes
}: QuotationDetailModalProps) {
    const [converting, setConverting] = useState(false);
    
    // Sub-form overlay state for Sales Order fields
    const [showSOFieldsForm, setShowSOFieldsForm] = useState(false);
    const [poNo, setPoNo] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [soRemarks, setSoRemarks] = useState("");
    const [discountAmount, setDiscountAmount] = useState("");
    const [paymentTermsList, setPaymentTermsList] = useState<{ id: number; payment_name: string; payment_days: number | null }[]>([]);

    const [salesmanId, setSalesmanId] = useState("");
    const [salesmanSearch, setSalesmanSearch] = useState("");
    const [isSalesmanFocused, setIsSalesmanFocused] = useState(false);
    const [salesmenList, setSalesmenList] = useState<{ id: number; salesman_name: string; salesman_code: string; branch_code?: number }[]>([]);

    const [supplierId, setSupplierId] = useState("");
    const [supplierSearch, setSupplierSearch] = useState("");
    const [isSupplierFocused, setIsSupplierFocused] = useState(false);
    const [suppliersList, setSuppliersList] = useState<{ id: number; supplier_name: string }[]>([]);

    const [branchId, setBranchId] = useState("");
    const [branchSearch, setBranchSearch] = useState("");
    const [isBranchFocused, setIsBranchFocused] = useState(false);
    const [branchesList, setBranchesList] = useState<{ id: number; branch_name: string; branch_code: string }[]>([]);

    useEffect(() => {
        if (showSOFieldsForm) {
            fetch("/api/manufacturing/payment-terms")
                .then(res => res.ok ? res.json() : [])
                .then(data => setPaymentTermsList(data))
                .catch(err => console.error("Error loading payment terms:", err));

            fetch("/api/manufacturing/salesman")
                .then(res => res.ok ? res.json() : [])
                .then(data => setSalesmenList(data))
                .catch(err => console.error("Error loading salesmen:", err));

            fetch("/api/manufacturing/procurement/suppliers")
                .then(res => res.ok ? res.json() : [])
                .then(data => setSuppliersList(data))
                .catch(err => console.error("Error loading suppliers:", err));

            fetch("/api/manufacturing/procurement/qa-receiving?action=branches")
                .then(res => res.ok ? res.json() : [])
                .then(data => setBranchesList(data))
                .catch(err => console.error("Error loading branches:", err));
        }
    }, [showSOFieldsForm]);

    const filteredSalesmen = salesmenList.filter(s => 
        s.salesman_name.toLowerCase().includes(salesmanSearch.toLowerCase()) ||
        s.salesman_code.toLowerCase().includes(salesmanSearch.toLowerCase())
    );

    const filteredSuppliers = suppliersList.filter(s => 
        s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase())
    );

    const filteredBranches = branchesList.filter(b => 
        b.branch_name.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.branch_code.toLowerCase().includes(branchSearch.toLowerCase())
    );

    const calculateAndSetDueDate = (delDateStr: string, termIdStr: string, termsList: typeof paymentTermsList) => {
        if (!delDateStr) {
            setDueDate("");
            return;
        }

        const term = termsList.find(t => String(t.id) === termIdStr);
        if (!term || term.payment_days === null || term.payment_days === undefined) {
            setDueDate(delDateStr);
        } else {
            const date = new Date(delDateStr);
            date.setDate(date.getDate() + Number(term.payment_days));
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            setDueDate(`${yyyy}-${mm}-${dd}`);
        }
    };

    const handleDeliveryDateChange = (val: string) => {
        setDeliveryDate(val);
        calculateAndSetDueDate(val, paymentTerms, paymentTermsList);
    };

    const handlePaymentTermChange = (val: string) => {
        setPaymentTerms(val);
        calculateAndSetDueDate(deliveryDate, val, paymentTermsList);
    };

    const handleConvertToSalesOrder = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedQuote) return;
        
        if (!poNo.trim()) {
            toast.error("Purchase Order Number (PO No.) is required");
            return;
        }

        setConverting(true);
        try {
            const res = await fetch("/api/manufacturing/sales-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quotationId: selectedQuote.id,
                    poNo: poNo.trim(),
                    dueDate: dueDate || undefined,
                    deliveryDate: deliveryDate || undefined,
                    paymentTerms: paymentTerms ? parseInt(paymentTerms) : undefined,
                    remarks: soRemarks.trim() || undefined,
                    discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
                    salesmanId: salesmanId ? parseInt(salesmanId) : undefined,
                    supplierId: supplierId ? parseInt(supplierId) : undefined,
                    branchId: branchId ? parseInt(branchId) : undefined
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to convert quote to sales order.");
            }

            toast.success(`Successfully converted to Sales Order: ${data.order_no}`);
            setIsDetailModalOpen(false);
            setShowSOFieldsForm(false);
            
            // Reset fields
            setPoNo("");
            setDueDate("");
            setDeliveryDate("");
            setPaymentTerms("");
            setSoRemarks("");
            setDiscountAmount("");
            setSalesmanId("");
            setSalesmanSearch("");
            setSupplierId("");
            setSupplierSearch("");
            setBranchId("");
            setBranchSearch("");

            if (loadQuotes) {
                loadQuotes();
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to convert quote");
        } finally {
            setConverting(false);
        }
    };

    if (!isDetailModalOpen || !selectedQuote) return null;

    const simulatedCost = Number(selectedQuote.total_simulated_cost || 0);
    const sellingPrice = Number(selectedQuote.total_selling_price || 0);
    const netMargin = sellingPrice - simulatedCost;
    const marginPct = sellingPrice > 0 ? (netMargin / sellingPrice) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card border rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/10">
                    <div>
                        <h3 className="text-base font-bold text-foreground">Quote Snapshot Detail</h3>
                        <p className="text-xs text-muted-foreground">Quote Number: <strong className="text-foreground">{selectedQuote.quote_number}</strong> | Status: <span className="font-bold text-primary">{selectedQuote.status || "Draft"}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedQuote.status !== "Converted to SO" && (
                            <button
                                disabled={converting}
                                onClick={() => setShowSOFieldsForm(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg px-3 py-1.5 transition-colors shadow-xs flex items-center gap-1 animate-pulse"
                            >
                                Approve & Convert to SO
                                <ArrowRight className="h-3 w-3" />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                reviseQuotation(selectedQuote);
                                setIsDetailModalOpen(false);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors shadow-xs"
                        >
                            Revise Quote
                        </button>
                        <button
                            onClick={() => setIsDetailModalOpen(false)}
                            className="text-muted-foreground hover:text-foreground text-xs font-semibold rounded-lg border px-3 py-1.5 hover:bg-muted"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b bg-card">
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Customer Account</span>
                        <span className="text-xs font-bold text-foreground block truncate">
                            {(selectedQuote.customer_id && typeof selectedQuote.customer_id === "object") 
                                ? `${(selectedQuote.customer_id as Customer).customer_name} (${(selectedQuote.customer_id as Customer).customer_code})`
                                : `Cust ID: ${selectedQuote.customer_id}`}
                        </span>
                    </div>
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Production Cost (Total)</span>
                        <span className="text-xs font-bold text-foreground block">
                            ₱{simulatedCost.toFixed(2)}
                        </span>
                    </div>
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Agreed Quote Price</span>
                        <span className="text-xs font-bold text-primary block">
                            ₱{sellingPrice.toFixed(2)}
                        </span>
                    </div>
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Estimated Net Margin</span>
                        <span className={`text-xs font-bold block ${netMargin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            ₱{netMargin.toFixed(2)} ({marginPct.toFixed(1)}%)
                        </span>
                    </div>
                </div>

                {/* Snapshot Contents */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loadingSnapshots ? (
                        <div className="flex justify-center items-center py-20 text-muted-foreground text-xs">
                            Loading snapshot cost sheets...
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Material costs list */}
                            <div>
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Frozen Quotation Product Rules</span>
                                <div className="border rounded-lg overflow-hidden bg-card">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead className="bg-muted/40 border-b">
                                            <tr>
                                                <th className="p-2.5 font-semibold text-muted-foreground">Product Name</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Quantity</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground">UOM</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Frozen Base Cost</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Agreed Target Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {snapshots.map(item => {
                                                const unitCost = Number(item.frozen_unit_cost_php || 0);
                                                const totalCost = Number(item.frozen_total_cost_php || 0);
                                                return (
                                                    <tr key={item.id} className="hover:bg-muted/10">
                                                        <td className="p-2.5 font-medium text-foreground">{item.node_name}</td>
                                                        <td className="p-2.5 text-right font-medium">{item.quantity}</td>
                                                        <td className="p-2.5 text-muted-foreground">{item.uom}</td>
                                                        <td className="p-2.5 text-right font-semibold text-muted-foreground">₱{unitCost.toFixed(2)}</td>
                                                        <td className="p-2.5 text-right font-bold text-primary">₱{totalCost.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {snapshots.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No frozen item records found in snapshot.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Remarks section */}
                            {selectedQuote.remarks && (
                                <div className="rounded-lg border bg-muted/5 p-4 space-y-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase block">Quotation Remarks / Notes</span>
                                    <p className="text-xs text-foreground italic">&quot;{selectedQuote.remarks}&quot;</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sales Order Required Fields Sub-Form Popup Overlay */}
            {showSOFieldsForm && (
                <div className="fixed inset-0 bg-[#020617]/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-slate-100">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]/35">
                            <div>
                                <h3 className="text-sm font-bold text-white">Convert to Sales Order</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Please provide required details to create the Sales Order.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSOFieldsForm(false)}
                                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleConvertToSalesOrder} className="p-6 space-y-4">
                            {/* PO Number */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                                    PO Number <span className="text-primary">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. PO-992384"
                                    value={poNo}
                                    onChange={e => setPoNo(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Delivery Date */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                                        Delivery Date
                                    </label>
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={e => handleDeliveryDateChange(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                    />
                                </div>

                                {/* Due Date */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                                        Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                    />
                                </div>

                                {/* Payment Terms Selector */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                                        Payment Terms
                                    </label>
                                    <select
                                        value={paymentTerms}
                                        onChange={e => handlePaymentTermChange(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3.5 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                    >
                                        <option value="" className="bg-slate-900">Select Term...</option>
                                        {paymentTermsList.map(term => (
                                            <option key={term.id} value={term.id} className="bg-slate-900">
                                                {term.payment_name} {term.payment_days !== null ? `(${term.payment_days} days)` : "(COD/Immediate)"}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Discount Amount */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                                        Discount Amount (₱)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 1500"
                                        value={discountAmount}
                                        onChange={e => setDiscountAmount(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-2">
                                {/* Searchable Salesman */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                                        Salesman
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Type to search salesman..."
                                        value={salesmanSearch}
                                        onFocus={() => setIsSalesmanFocused(true)}
                                        onBlur={() => setTimeout(() => setIsSalesmanFocused(false), 200)}
                                        onChange={(e) => setSalesmanSearch(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                                    />
                                    {isSalesmanFocused && (
                                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-[#0f172a] shadow-xl divide-y divide-slate-800">
                                            {filteredSalesmen.map(s => (
                                                <button
                                                    type="button"
                                                    key={s.id}
                                                    onClick={() => {
                                                        setSalesmanId(String(s.id));
                                                        setSalesmanSearch(`${s.salesman_name} (${s.salesman_code})`);
                                                        setIsSalesmanFocused(false);
                                                        // Auto-select branch if salesman has branch_code
                                                        if (s.branch_code) {
                                                            const matchBranch = branchesList.find(b => b.id === s.branch_code);
                                                            if (matchBranch) {
                                                                setBranchId(String(matchBranch.id));
                                                                setBranchSearch(`${matchBranch.branch_name} (${matchBranch.branch_code})`);
                                                            } else {
                                                                setBranchId(String(s.branch_code));
                                                                setBranchSearch(`Branch ID ${s.branch_code}`);
                                                            }
                                                        }
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                                >
                                                    {s.salesman_name} ({s.salesman_code})
                                                </button>
                                            ))}
                                            {filteredSalesmen.length === 0 && (
                                                <div className="p-2 text-xs text-muted-foreground text-center">No salesmen found</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Searchable Supplier */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                                        Supplier
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Type to search supplier..."
                                        value={supplierSearch}
                                        onFocus={() => setIsSupplierFocused(true)}
                                        onBlur={() => setTimeout(() => setIsSupplierFocused(false), 200)}
                                        onChange={(e) => setSupplierSearch(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                                    />
                                    {isSupplierFocused && (
                                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-[#0f172a] shadow-xl divide-y divide-slate-800">
                                            {filteredSuppliers.map(s => (
                                                <button
                                                    type="button"
                                                    key={s.id}
                                                    onClick={() => {
                                                        setSupplierId(String(s.id));
                                                        setSupplierSearch(s.supplier_name);
                                                        setIsSupplierFocused(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                                >
                                                    {s.supplier_name}
                                                </button>
                                            ))}
                                            {filteredSuppliers.length === 0 && (
                                                <div className="p-2 text-xs text-muted-foreground text-center">No suppliers found</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Searchable Target Branch */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                                        Production Branch
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Type to search branch..."
                                        value={branchSearch}
                                        onFocus={() => setIsBranchFocused(true)}
                                        onBlur={() => setTimeout(() => setIsBranchFocused(false), 200)}
                                        onChange={(e) => setBranchSearch(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                                    />
                                    {isBranchFocused && (
                                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                                            {filteredBranches.map(b => (
                                                <button
                                                    type="button"
                                                    key={b.id}
                                                    onClick={() => {
                                                        setBranchId(String(b.id));
                                                        setBranchSearch(`${b.branch_name} (${b.branch_code})`);
                                                        setIsBranchFocused(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                                >
                                                    {b.branch_name} ({b.branch_code})
                                                </button>
                                            ))}
                                            {filteredBranches.length === 0 && (
                                                <div className="p-2 text-xs text-muted-foreground text-center">No branches found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                                    Remarks / Internal Notes
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Add any special instructions or terms..."
                                    value={soRemarks}
                                    onChange={e => setSoRemarks(e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowSOFieldsForm(false)}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={converting}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg px-4 py-2 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {converting ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Converting...
                                        </>
                                    ) : (
                                        "Approve & Create SO"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
