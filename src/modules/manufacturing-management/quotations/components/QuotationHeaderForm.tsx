import React, { useState, useRef, useEffect } from "react";
import { Customer } from "../types";

interface PriceType {
    price_type_id: string | number;
    price_type_name: string;
}

interface QuotationHeaderFormProps {
    quoteNumber: string;
    setQuoteNumber: (val: string) => void;
    customerSearchText: string;
    selectedCustomerId: string;
    customers: Customer[];
    handleSearchCustomers: (search: string) => void;
    selectCustomer: (id: string, nameCode: string) => void;
    priceTypes: PriceType[];
    selectedPriceTypeId: string;
    setSelectedPriceTypeId: (val: string) => void;
    remarks: string;
    setRemarks: (val: string) => void;
}

export function QuotationHeaderForm({
    quoteNumber,
    setQuoteNumber,
    customerSearchText,
    selectedCustomerId,
    customers,
    handleSearchCustomers,
    selectCustomer,
    priceTypes,
    selectedPriceTypeId,
    setSelectedPriceTypeId,
    remarks,
    setRemarks
}: QuotationHeaderFormProps) {
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close search dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Filtered list: show up to 10 matching or default records
    const displayList = customers.slice(0, 10);

    return (
        <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-bold text-foreground border-b pb-2">Quotation Header</h4>
            
            <div className="space-y-3">
                {/* Quote Number */}
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Quote Number (Unique)</label>
                    <input
                        type="text"
                        value={quoteNumber}
                        onChange={e => setQuoteNumber(e.target.value)}
                        className="w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>

                {/* Customer Selection Search dropdown */}
                <div className="relative" ref={containerRef}>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Customer Client</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Type to search active customers..."
                            value={customerSearchText}
                            onFocus={() => {
                                setIsFocused(true);
                                // Trigger empty search to preload active customers if none loaded yet
                                if (customers.length === 0) {
                                    handleSearchCustomers("");
                                }
                            }}
                            onChange={(e) => {
                                setIsFocused(true);
                                handleSearchCustomers(e.target.value);
                            }}
                            className="w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                        />
                        
                        {/* Dropdown list */}
                        {isFocused && !selectedCustomerId && (
                            <div className="absolute left-0 right-0 top-full mt-1 max-h-[200px] overflow-y-auto border bg-card rounded-md shadow-lg z-50 divide-y">
                                {displayList.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            selectCustomer(String(c.id), `${c.customer_name} (${c.customer_code})`);
                                            setIsFocused(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors font-medium text-foreground block"
                                    >
                                        {c.customer_name} ({c.customer_code})
                                    </button>
                                ))}
                                {displayList.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                        No active customers found.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Price Type selection */}
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Base Price Type Template</label>
                    <select
                        value={selectedPriceTypeId}
                        onChange={e => setSelectedPriceTypeId(e.target.value)}
                        className="w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="">-- No Price Type Template --</option>
                        {priceTypes.map(pt => (
                            <option key={pt.price_type_id} value={pt.price_type_id}>
                                Price Type {pt.price_type_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Notes/Remarks */}
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Notes / Remarks</label>
                    <textarea
                        rows={3}
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Add special instructions, terms, or customer agreement details here..."
                        className="w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>
        </div>
    );
}
