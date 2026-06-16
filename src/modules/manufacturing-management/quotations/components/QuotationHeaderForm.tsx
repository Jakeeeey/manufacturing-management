import React, { useState, useRef, useEffect } from "react";
import { Plus, Loader2, X, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
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
    setProjectName
}: QuotationHeaderFormProps) {
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const storeTypeContainerRef = useRef<HTMLDivElement>(null);

    // Modal state for customer creation
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customerCode, setCustomerCode] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerTin, setCustomerTin] = useState("");
    const [storeName, setStoreName] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    
    // PSGC Address Selection State
    const [provinces, setProvinces] = useState<{ code: string; name: string }[]>([]);
    const [cities, setCities] = useState<{ code: string; name: string; provinceCode: string | boolean; regionCode?: string }[]>([]);
    const [barangays, setBarangays] = useState<{ code: string; name: string }[]>([]);

    const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
    const [selectedCityCode, setSelectedCityCode] = useState("");
    const [selectedBarangayCode, setSelectedBarangayCode] = useState("");

    // Search queries for Comboboxes
    const [provinceQuery, setProvinceQuery] = useState("");
    const [cityQuery, setCityQuery] = useState("");
    const [barangayQuery, setBarangayQuery] = useState("");

    const [isProvinceDropdownFocused, setIsProvinceDropdownFocused] = useState(false);
    const [isCityDropdownFocused, setIsCityDropdownFocused] = useState(false);
    const [isBarangayDropdownFocused, setIsBarangayDropdownFocused] = useState(false);

    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [loadingBarangays, setLoadingBarangays] = useState(false);

    const provinceContainerRef = useRef<HTMLDivElement>(null);
    const cityContainerRef = useRef<HTMLDivElement>(null);
    const barangayContainerRef = useRef<HTMLDivElement>(null);
    
    // Store type dropdown / on-the-fly registration state
    const [storeTypes, setStoreTypes] = useState<{ id: number; store_type: string }[]>([]);
    const [selectedStoreTypeId, setSelectedStoreTypeId] = useState<number | null>(null);
    const [storeTypeQuery, setStoreTypeQuery] = useState("");
    const [isStoreTypeFocused, setIsStoreTypeFocused] = useState(false);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

    // Sync province text query with code
    useEffect(() => {
        const match = provinces.find(p => p.code === selectedProvinceCode);
        if (match) {
            setProvinceQuery(match.name);
        } else if (!selectedProvinceCode) {
            setProvinceQuery("");
        }
    }, [selectedProvinceCode, provinces]);

    // Sync city text query with code
    useEffect(() => {
        const match = cities.find(c => c.code === selectedCityCode);
        if (match) {
            setCityQuery(match.name);
        } else if (!selectedCityCode) {
            setCityQuery("");
        }
    }, [selectedCityCode, cities]);

    // Sync barangay text query with code
    useEffect(() => {
        const match = barangays.find(b => b.code === selectedBarangayCode);
        if (match) {
            setBarangayQuery(match.name);
        } else if (!selectedBarangayCode) {
            setBarangayQuery("");
        }
    }, [selectedBarangayCode, barangays]);

    // Sync store type text query with ID
    useEffect(() => {
        const match = storeTypes.find(st => st.id === selectedStoreTypeId);
        if (match) {
            setStoreTypeQuery(match.store_type);
        } else if (!selectedStoreTypeId) {
            setStoreTypeQuery("");
        }
    }, [selectedStoreTypeId, storeTypes]);

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

            // Load PSGC Provinces
            setLoadingProvinces(true);
            fetch("/api/psgc/provinces")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const list = [...data, { code: "130000000", name: "Metro Manila" }];
                        list.sort((a, b) => a.name.localeCompare(b.name));
                        setProvinces(list);
                    }
                })
                .catch(err => console.error("Error fetching provinces:", err))
                .finally(() => setLoadingProvinces(false));

            // Load all PSGC Cities globally for direct searchable combo
            setLoadingCities(true);
            fetch("/api/psgc/cities-municipalities")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        data.sort((a, b) => a.name.localeCompare(b.name));
                        setCities(data);
                    }
                })
                .catch(err => console.error("Error fetching cities:", err))
                .finally(() => setLoadingCities(false));
        } else {
            // Reset state on close
            setProvinces([]);
            setCities([]);
            setBarangays([]);
            setSelectedProvinceCode("");
            setSelectedCityCode("");
            setSelectedBarangayCode("");
            setProvinceQuery("");
            setCityQuery("");
            setBarangayQuery("");
            setStoreTypeQuery("");
            setSelectedStoreTypeId(null);
            setIsCodeManuallyEdited(false);
        }
    }, [isModalOpen]);

    // Handle Province change - reset dependent address selections
    const handleProvinceChange = (provinceCode: string) => {
        setSelectedProvinceCode(provinceCode);
        setSelectedCityCode("");
        setSelectedBarangayCode("");
        setCityQuery("");
        setBarangayQuery("");
        setBarangays([]);
    };

    // Safe change handlers to clear cascade dependencies when typing/editing
    const handleProvinceQueryChange = (val: string) => {
        setProvinceQuery(val);
        setSelectedProvinceCode("");
        setSelectedCityCode("");
        setSelectedBarangayCode("");
        setCityQuery("");
        setBarangayQuery("");
        setBarangays([]);
        setIsProvinceDropdownFocused(true);
    };

    const handleCityQueryChange = (val: string) => {
        setCityQuery(val);
        setSelectedCityCode("");
        setSelectedBarangayCode("");
        setBarangayQuery("");
        setBarangays([]);
        setIsCityDropdownFocused(true);
    };

    const handleBarangayQueryChange = (val: string) => {
        setBarangayQuery(val);
        setSelectedBarangayCode("");
        setIsBarangayDropdownFocused(true);
    };

    // Handle City selection (always auto-aligns Province/Region)
    const handleSelectCity = async (city: { code: string; name: string; provinceCode: string | boolean; regionCode?: string }) => {
        setSelectedCityCode(city.code);
        setCityQuery(city.name);
        setIsCityDropdownFocused(false);
        setSelectedBarangayCode("");
        setBarangayQuery("");
        setBarangays([]);

        // Determine matching province code
        let matchedProvCode = "";
        if (city.regionCode === "130000000" || !city.provinceCode) {
            matchedProvCode = "130000000"; // Metro Manila
        } else {
            matchedProvCode = String(city.provinceCode);
        }

        setSelectedProvinceCode(matchedProvCode);
        const provObj = provinces.find(p => p.code === matchedProvCode);
        if (provObj) {
            setProvinceQuery(provObj.name);
        }

        // Fetch barangays immediately for the selected city
        setLoadingBarangays(true);
        try {
            const res = await fetch(`/api/psgc/cities-municipalities/${city.code}/barangays`);
            const data = await res.json();
            if (Array.isArray(data)) {
                data.sort((a, b) => a.name.localeCompare(b.name));
                setBarangays(data);
            }
        } catch (err) {
            console.error("Error fetching barangays:", err);
        } finally {
            setLoadingBarangays(false);
        }
    };

    // Close search dropdowns on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
            
            // Revert queries to matching values if user clears input focus without selecting
            if (storeTypeContainerRef.current && !storeTypeContainerRef.current.contains(event.target as Node)) {
                setIsStoreTypeFocused(false);
                const selected = storeTypes.find(st => st.id === selectedStoreTypeId);
                setStoreTypeQuery(selected ? selected.store_type : "");
            }
            if (provinceContainerRef.current && !provinceContainerRef.current.contains(event.target as Node)) {
                setIsProvinceDropdownFocused(false);
                const selected = provinces.find(p => p.code === selectedProvinceCode);
                setProvinceQuery(selected ? selected.name : "");
            }
            if (cityContainerRef.current && !cityContainerRef.current.contains(event.target as Node)) {
                setIsCityDropdownFocused(false);
                const selected = cities.find(c => c.code === selectedCityCode);
                setCityQuery(selected ? selected.name : "");
            }
            if (barangayContainerRef.current && !barangayContainerRef.current.contains(event.target as Node)) {
                setIsBarangayDropdownFocused(false);
                const selected = barangays.find(b => b.code === selectedBarangayCode);
                setBarangayQuery(selected ? selected.name : "");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [selectedStoreTypeId, storeTypes, selectedProvinceCode, provinces, selectedCityCode, cities, selectedBarangayCode, barangays]);

    // Filtered lists
    const displayList = customers.slice(0, 10);

    const filteredStoreTypes = storeTypes.filter(st =>
        (st.store_type || "").toLowerCase().includes(storeTypeQuery.toLowerCase())
    );

    const filteredProvinces = provinces.filter(p =>
        (p.name || "").toLowerCase().includes(provinceQuery.toLowerCase())
    );

    // Filter cities by province code if a province is selected. Otherwise, list all cities.
    const filteredCities = cities.filter(c => {
        const matchesSearch = (c.name || "").toLowerCase().includes(cityQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (selectedProvinceCode) {
            if (selectedProvinceCode === "130000000") {
                return c.regionCode === "130000000";
            }
            return c.provinceCode === selectedProvinceCode;
        }
        return true;
    });

    const filteredBarangays = barangays.filter(b =>
        (b.name || "").toLowerCase().includes(barangayQuery.toLowerCase())
    );

    const handleNameChange = (nameVal: string) => {
        setCustomerName(nameVal);
        if (!isCodeManuallyEdited) {
            const generated = nameVal
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 10);
            setCustomerCode(generated);
        }
    };

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerCode.trim() || !customerName.trim()) {
            toast.error("Customer Code and Customer Name are required");
            return;
        }

        setIsSaving(true);
        try {
            let finalStoreTypeId: number | null = null;

            if (storeTypeQuery.trim()) {
                const exactMatch = storeTypes.find(
                    st => (st.store_type || "").toLowerCase() === storeTypeQuery.trim().toLowerCase()
                );

                if (exactMatch) {
                    finalStoreTypeId = exactMatch.id;
                } else {
                    const storeTypeRes = await fetch("/api/manufacturing/finished-goods/store-types", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ store_type: storeTypeQuery.trim() })
                    });
                    const storeTypeData = await storeTypeRes.json();
                    if (!storeTypeRes.ok) {
                        throw new Error(storeTypeData.error || "Failed to register new store type");
                    }
                    finalStoreTypeId = storeTypeData.id;
                }
            }

            const response = await fetch("/api/manufacturing/finished-goods/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_code: customerCode.trim(),
                    customer_name: customerName.trim(),
                    customer_tin: customerTin.trim() || undefined,
                    store_name: storeName.trim() || undefined,
                    contact_number: contactNumber.trim() || undefined,
                    customer_email: customerEmail.trim() || undefined,
                    brgy: barangayQuery.trim() || undefined,
                    city: cityQuery.trim() || undefined,
                    province: provinceQuery.trim() || undefined,
                    store_type: finalStoreTypeId || undefined,
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
            
            setCustomerCode("");
            setCustomerName("");
            setCustomerTin("");
            setStoreName("");
            setContactNumber("");
            setCustomerEmail("");
            setSelectedProvinceCode("");
            setSelectedCityCode("");
            setSelectedBarangayCode("");
            setProvinceQuery("");
            setCityQuery("");
            setBarangayQuery("");
            setProvinces([]);
            setCities([]);
            setBarangays([]);
            setSelectedStoreTypeId(null);
            setStoreTypeQuery("");
            setIsCodeManuallyEdited(false);
            setIsModalOpen(false);
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

                {/* Project Name / Code */}
                <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Project Name / Code</label>
                    <input
                        type="text"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="e.g. Project Vertex Alpha, Hotel Phase 1"
                        className="w-full rounded border px-3 py-2 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>

                {/* Customer Selection Search dropdown */}
                <div className="relative" ref={containerRef}>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block">Customer Client</label>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-bold uppercase transition-colors"
                        >
                            <Plus className="h-3 w-3" /> New Customer
                        </button>
                    </div>
                    
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Type to search active customers..."
                            value={customerSearchText}
                            onFocus={() => {
                                setIsFocused(true);
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

            {/* Premium, High-Fidelity Customer Creation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-[#020617]/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-slate-100">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]/35">
                            <div>
                                <h3 className="text-sm font-bold tracking-tight text-white">Register Customer</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Introduce a new customer profile into the ERP core directory.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Name */}
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Customer Name <span className="text-primary">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Vertex Technologies"
                                            value={customerName}
                                            onChange={e => handleNameChange(e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150"
                                        />
                                    </div>
                                </div>

                                {/* Code */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Customer Code <span className="text-primary">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="VERTEXTECH"
                                        value={customerCode}
                                        onChange={e => {
                                            setCustomerCode(e.target.value.toUpperCase());
                                            setIsCodeManuallyEdited(true);
                                        }}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150 font-mono"
                                    />
                                    <span className="text-[9px] text-slate-500 block mt-1">Must be unique (e.g. ACMECORP).</span>
                                </div>

                                {/* TIN */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Tax ID Number (TIN)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="000-123-456-000"
                                        value={customerTin}
                                        onChange={e => setCustomerTin(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150"
                                    />
                                </div>

                                {/* Store Type Selection (Combobox) */}
                                <div className="col-span-2 relative" ref={storeTypeContainerRef}>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Store Type
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Type to filter or register store type..."
                                            value={storeTypeQuery}
                                            onFocus={() => setIsStoreTypeFocused(true)}
                                            onChange={e => {
                                                setStoreTypeQuery(e.target.value);
                                                setSelectedStoreTypeId(null);
                                                setIsStoreTypeFocused(true);
                                            }}
                                            className="w-full rounded-lg border border-slate-700 pl-3 pr-8 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150"
                                        />
                                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 text-slate-500">
                                            {selectedStoreTypeId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStoreTypeId(null);
                                                        setStoreTypeQuery("");
                                                    }}
                                                    className="hover:text-slate-200"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </div>
                                        
                                        {isStoreTypeFocused && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-[160px] overflow-y-auto border border-slate-800 bg-[#1e293b] rounded-lg shadow-xl z-50 divide-y divide-slate-800 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent font-sans">
                                                {filteredStoreTypes.map((st) => (
                                                    <button
                                                        key={st.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStoreTypeId(st.id);
                                                            setStoreTypeQuery(st.store_type);
                                                            setIsStoreTypeFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors font-medium text-slate-200 block"
                                                    >
                                                        {st.store_type}
                                                    </button>
                                                ))}

                                                {/* Offer to create store type on the fly */}
                                                {storeTypeQuery.trim() !== "" && 
                                                 !storeTypes.some(st => (st.store_type || "").toLowerCase() === storeTypeQuery.trim().toLowerCase()) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsStoreTypeFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary/20 text-primary font-bold transition-colors block border-t border-slate-800 bg-primary/5"
                                                    >
                                                        + Create "{storeTypeQuery}" as new Store Type
                                                    </button>
                                                )}
                                                
                                                {filteredStoreTypes.length === 0 && storeTypeQuery.trim() === "" && (
                                                    <div className="px-3 py-2 text-xs text-slate-400 text-center">
                                                        No store types found. Type to create.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Store Name */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Store Name / Brand
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Acme Hub"
                                        value={storeName}
                                        onChange={e => setStoreName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150"
                                    />
                                </div>

                                {/* Contact Number */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Contact Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. +63 917 123 4567"
                                        value={contactNumber}
                                        onChange={e => setContactNumber(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150"
                                    />
                                </div>

                                {/* Email */}
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="billing@acme.com"
                                        value={customerEmail}
                                        onChange={e => setCustomerEmail(e.target.value)}
                                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150"
                                    />
                                </div>

                                {/* Divider for Address */}
                                <div className="col-span-2 border-t border-slate-800 pt-3.5 mt-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Geographic Address (PSGC Lookup)
                                    </span>
                                </div>

                                {/* Province Searchable Combobox */}
                                <div className="relative" ref={provinceContainerRef}>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Province
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={loadingProvinces ? "Loading..." : "Search province..."}
                                            disabled={loadingProvinces}
                                            value={provinceQuery}
                                            onFocus={() => setIsProvinceDropdownFocused(true)}
                                            onChange={e => handleProvinceQueryChange(e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 pl-3 pr-8 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150 disabled:opacity-50"
                                        />
                                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 text-slate-500">
                                            {selectedProvinceCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProvinceCode("");
                                                        setSelectedCityCode("");
                                                        setCityQuery("");
                                                        setSelectedBarangayCode("");
                                                        setBarangayQuery("");
                                                        setCities([]);
                                                        setBarangays([]);
                                                    }}
                                                    className="hover:text-slate-200"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                            {loadingProvinces ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Search className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                        
                                        {isProvinceDropdownFocused && !loadingProvinces && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-[160px] overflow-y-auto border border-slate-800 bg-[#1e293b] rounded-lg shadow-xl z-50 divide-y divide-slate-800 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                {filteredProvinces.map((p) => (
                                                    <button
                                                        key={p.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedProvinceCode(p.code);
                                                            setProvinceQuery(p.name);
                                                            handleProvinceChange(p.code);
                                                            setIsProvinceDropdownFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors font-medium text-slate-200 block animate-in fade-in-50 duration-75"
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))}
                                                {filteredProvinces.length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-slate-400 text-center">
                                                        No provinces found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* City Searchable Combobox */}
                                <div className="relative" ref={cityContainerRef}>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        City / Municipality
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={loadingCities ? "Loading..." : "Search city..."}
                                            disabled={loadingCities}
                                            value={cityQuery}
                                            onFocus={() => setIsCityDropdownFocused(true)}
                                            onChange={e => handleCityQueryChange(e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 pl-3 pr-8 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150 disabled:opacity-50"
                                        />
                                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 text-slate-500">
                                            {selectedCityCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCityCode("");
                                                        setSelectedBarangayCode("");
                                                        setBarangayQuery("");
                                                        setBarangays([]);
                                                    }}
                                                    className="hover:text-slate-200"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                            {loadingCities ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Search className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                        
                                        {isCityDropdownFocused && !loadingCities && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-[160px] overflow-y-auto border border-slate-800 bg-[#1e293b] rounded-lg shadow-xl z-50 divide-y divide-slate-800 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                {filteredCities.map((c) => (
                                                    <button
                                                        key={c.code}
                                                        type="button"
                                                        onClick={() => handleSelectCity(c)}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors font-medium text-slate-200 block animate-in fade-in-50 duration-75"
                                                    >
                                                        {c.name}
                                                    </button>
                                                ))}
                                                {filteredCities.length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-slate-400 text-center">
                                                        No cities found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Barangay Searchable Combobox */}
                                <div className="col-span-2 relative" ref={barangayContainerRef}>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                                        Barangay / District
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={!selectedCityCode ? "Select City/Municipality first" : loadingBarangays ? "Loading..." : "Search barangay..."}
                                            disabled={!selectedCityCode || loadingBarangays}
                                            value={barangayQuery}
                                            onFocus={() => setIsBarangayDropdownFocused(true)}
                                            onChange={e => handleBarangayQueryChange(e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 pl-3 pr-8 py-2 text-xs bg-slate-900/50 text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-150 disabled:opacity-50 font-sans"
                                        />
                                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 text-slate-500">
                                            {selectedBarangayCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedBarangayCode("");
                                                    }}
                                                    className="hover:text-slate-200"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                            {loadingBarangays ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Search className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                        
                                        {isBarangayDropdownFocused && selectedCityCode && !loadingBarangays && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-[160px] overflow-y-auto border border-slate-800 bg-[#1e293b] rounded-lg shadow-xl z-50 divide-y divide-slate-800 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                {filteredBarangays.map((b) => (
                                                    <button
                                                        key={b.code}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedBarangayCode(b.code);
                                                            setBarangayQuery(b.name);
                                                            setIsBarangayDropdownFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors font-medium text-slate-200 block animate-in fade-in-50 duration-75"
                                                    >
                                                        {b.name}
                                                    </button>
                                                ))}
                                                {filteredBarangays.length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-slate-400 text-center">
                                                        No barangays found
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-6 bg-[#0f172a]">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-lg px-4 py-2 transition-all duration-150 shadow-md flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Register Customer"
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
