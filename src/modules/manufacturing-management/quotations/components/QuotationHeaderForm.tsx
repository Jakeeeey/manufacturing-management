import React, { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Customer } from "../types";
import { PaymentTerm } from "../../clients/types";
import ClientFormModal from "../../clients/components/ClientFormModal";

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
    setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>;
    handleSearchCustomers: (search: string) => void;
    selectCustomer: (id: string, nameCode: string) => void;
    priceTypes: PriceType[];
    selectedPriceTypeId: string;
    setSelectedPriceTypeId: (val: string) => void;
    remarks: string;
    setRemarks: (val: string) => void;
    projectName: string;
    setProjectName: (val: string) => void;
    showValidationErrors?: boolean;
    selectedProjectId?: number | null;
}

export function QuotationHeaderForm({
    quoteNumber,
    setQuoteNumber,
    customerSearchText,
    selectedCustomerId,
    customers,
    setCustomers,
    handleSearchCustomers,
    selectCustomer,
    priceTypes,
    selectedPriceTypeId,
    setSelectedPriceTypeId,
    remarks,
    setRemarks,
    projectName,
    setProjectName,
    showValidationErrors = false,
    selectedProjectId
}: QuotationHeaderFormProps) {
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const inputBorderClass = (val: string) => {
        if (showValidationErrors && !val.trim()) {
            return "border-rose-500 ring-1 ring-rose-500 focus:border-rose-500 focus:ring-rose-500";
        }
        return "border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-primary";
    };

    // Modal state for customer creation
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        customer_code: "",
        customer_name: "",
        customer_tin: "",
        contact_number: "",
        customer_email: "",
        store_name: "",
        store_type_id: "",
        payment_term: "",
        province: "",
        city: "",
        brgy: "",
        latitude: "",
        longitude: "",
        isActive: true
    });
    
    // PSGC Address Selection State
    const [provinces, setProvinces] = useState<{ code: string; name: string }[]>([]);
    const [cities, setCities] = useState<{ code: string; name: string; provinceCode: string | boolean }[]>([]);
    const [barangays, setBarangays] = useState<{ code: string; name: string; cityCode: string }[]>([]);

    const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
    const [selectedCityCode, setSelectedCityCode] = useState("");
    
    const [storeTypes, setStoreTypes] = useState<{ id: number; store_type: string }[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isSaving, setIsSaving] = useState(false);

    // Load store types & initial provinces/cities when customer modal is opened
    useEffect(() => {
        if (isModalOpen) {
            // Load Store Types
            fetch("/api/manufacturing/finished-goods/store-types")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setStoreTypes(data);
                    }
                })
                .catch(err => console.error("Error loading store types:", err));

            fetch("/api/manufacturing/payment-terms")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setPaymentTerms(data);
                    }
                })
                .catch(err => console.error("Error loading payment terms:", err));

            // Load PSGC Provinces
            fetch("/api/psgc/provinces")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const list = [...data, { code: "130000000", name: "Metro Manila" }];
                        list.sort((a, b) => a.name.localeCompare(b.name));
                        setProvinces(list);
                    }
                })
                .catch(err => console.error("Error fetching provinces:", err));

            // Load all PSGC Cities globally for direct searchable combo
            fetch("/api/psgc/cities-municipalities")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        data.sort((a, b) => a.name.localeCompare(b.name));
                        setCities(data);
                    }
                })
                .catch(err => console.error("Error fetching cities:", err));
        } else {
            // Reset state on close
            setProvinces([]);
            setCities([]);
            setBarangays([]);
            setPaymentTerms([]);
            setSelectedProvinceCode("");
            setSelectedCityCode("");
            setFormData({
                customer_code: "",
                customer_name: "",
                customer_tin: "",
                contact_number: "",
                customer_email: "",
                store_name: "",
                store_type_id: "",
                payment_term: "",
                province: "",
                city: "",
                brgy: "",
                latitude: "",
                longitude: "",
                isActive: true
            });
        }
    }, [isModalOpen]);

    // Load barangays dynamically when selectedCityCode changes
    useEffect(() => {
        const loadBarangays = async () => {
            if (!selectedCityCode) {
                setBarangays([]);
                return;
            }
            try {
                const res = await fetch(`/api/psgc/cities-municipalities/${selectedCityCode}/barangays`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const mapped = data.map((b: any) => ({
                            code: b.code,
                            name: b.name,
                            cityCode: selectedCityCode
                        }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                        mapped.sort((a: any, b: any) => a.name.localeCompare(b.name));
                        setBarangays(mapped);
                    }
                }
            } catch (err) {
                console.error("Error loading barangays:", err);
            }
        };
        loadBarangays();
    }, [selectedCityCode]);

    // Close search dropdown on click outside for the customer selection input
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

    // Filtered list for the Customer Client autocomplete selection
    const displayList = customers.slice(0, 10);

    const handleCustomerNameChange = (nameVal: string) => {
        setFormData(prev => {
            const next = { ...prev, customer_name: nameVal };
            if (nameVal.trim()) {
                const words = nameVal.trim().toUpperCase().split(/\s+/).slice(0, 3);
                const prefix = words.map(w => w.replace(/[^A-Z0-9]/g, "").slice(0, 3)).join("-");
                const random = Math.floor(100 + Math.random() * 900);
                next.customer_code = `CUST-${prefix}-${random}`;
            }
            return next;
        });
    };

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customer_code.trim() || !formData.customer_name.trim()) {
            toast.error("Customer Code and Customer Name are required");
            return;
        }

        setIsSaving(true);
        try {
            // Map province and city names from selected codes
            const provName = provinces.find(p => p.code === selectedProvinceCode)?.name || formData.province;
            const cityName = cities.find(c => c.code === selectedCityCode)?.name || formData.city;
            const brgyName = barangays.find(b => b.code === formData.brgy)?.name || formData.brgy;

            // Parse coordinates
            const latVal = formData.latitude.trim();
            const lngVal = formData.longitude.trim();
            const parsedLatitude = latVal ? parseFloat(latVal) : null;
            const parsedLongitude = lngVal ? parseFloat(lngVal) : null;

            const response = await fetch("/api/manufacturing/finished-goods/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_code: formData.customer_code.trim(),
                    customer_name: formData.customer_name.trim(),
                    customer_tin: formData.customer_tin.trim() || undefined,
                    store_name: formData.store_name.trim() || undefined,
                    contact_number: formData.contact_number.trim() || undefined,
                    customer_email: formData.customer_email.trim() || undefined,
                    brgy: brgyName.trim() || undefined,
                    city: cityName.trim() || undefined,
                    province: provName.trim() || undefined,
                    store_type: formData.store_type_id ? Number(formData.store_type_id) : undefined,
                    payment_term: formData.payment_term ? Number(formData.payment_term) : null,
                    latitude: parsedLatitude !== null && !isNaN(parsedLatitude) ? parsedLatitude : null,
                    longitude: parsedLongitude !== null && !isNaN(parsedLongitude) ? parsedLongitude : null,
                    isActive: 1
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create customer");
            }

            toast.success(`Customer "${data.customer_name}" registered successfully!`);
            
            if (setCustomers) {
                setCustomers(prev => [data, ...prev]);
            }
            selectCustomer(String(data.id), `${data.customer_name} (${data.customer_code})`);
            setIsModalOpen(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error creating customer:", error);
            let errMsg = error.message || "Failed to create customer";
            if (errMsg.toLowerCase().includes("unique")) {
                errMsg = "A customer with this Customer Code already exists. Please choose a different code.";
            }
            toast.error(errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
            <h4 className="text-sm font-bold text-foreground border-b pb-2">Quotation Header</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quote Number */}
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Quote Number (Unique)</label>
                    <input
                        type="text"
                        value={quoteNumber}
                        onChange={e => setQuoteNumber(e.target.value)}
                        className={`w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 ${inputBorderClass(quoteNumber)}`}
                    />
                </div>

                {/* Project Name / Code */}
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Project Name / Code</label>
                    <input
                        type="text"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="e.g. Project Vertex Alpha, Hotel Phase 1"
                        disabled={!!selectedProjectId}
                        className={`w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 ${inputBorderClass(projectName)} disabled:opacity-80 disabled:bg-muted/40`}
                    />
                </div>

                {/* Customer Selection Search dropdown */}
                <div className="relative" ref={containerRef}>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block">Customer Client</label>
                        {!selectedProjectId && (
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-bold uppercase transition-colors"
                            >
                                <Plus className="h-3 w-3" /> New Customer
                            </button>
                        )}
                    </div>
                    
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Type to search active customers..."
                            value={customerSearchText}
                            disabled={!!selectedProjectId}
                            onFocus={() => {
                                // Ensure that if there's no selected value, we open it
                                setIsFocused(true);
                                if (customers.length === 0) {
                                    handleSearchCustomers("");
                                }
                            }}
                            onChange={(e) => {
                                setIsFocused(true);
                                handleSearchCustomers(e.target.value);
                            }}
                            className={`w-full rounded border pl-3 pr-8 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 ${inputBorderClass(selectedCustomerId)} disabled:opacity-80 disabled:bg-muted/40`}
                        />
                        {selectedCustomerId && !selectedProjectId && (
                            <button
                                type="button"
                                onClick={() => {
                                    selectCustomer("", "");
                                    handleSearchCustomers("");
                                }}
                                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        
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
                        className={`w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 ${inputBorderClass(selectedPriceTypeId)}`}
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
                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Notes / Remarks</label>
                    <textarea
                        rows={2}
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Add special instructions, terms, or customer agreement details here..."
                        className="w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Premium, High-Fidelity Customer Creation Modal */}
            <ClientFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingCustomer={null}
                formData={formData}
                setFormData={setFormData}
                storeTypes={storeTypes}
                setStoreTypes={setStoreTypes}
                provinces={provinces}
                cities={cities}
                barangays={barangays}
                paymentTerms={paymentTerms}
                selectedProvinceCode={selectedProvinceCode}
                setSelectedProvinceCode={setSelectedProvinceCode}
                selectedCityCode={selectedCityCode}
                setSelectedCityCode={setSelectedCityCode}
                onSave={handleSaveCustomer}
                onNameChange={handleCustomerNameChange}
            />
        </div>
    );
}
