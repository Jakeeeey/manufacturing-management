/* eslint-disable */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Save, User, MapPin, ChevronDown, Loader2, Search, Sliders, Building, Phone, Settings } from "lucide-react";
import { Customer, StoreType } from "../types";
import { toast } from "sonner";
import CustomerMapSelector from "./CustomerMapSelector";
import { ClientProduct, ClientProductVersion } from "../hooks/useClients";

export interface ClientFormData {
    customer_code: string;
    customer_name: string;
    customer_tin: string;
    contact_number: string;
    customer_email: string;
    store_name: string;
    store_type_id: string;
    province: string;
    city: string;
    brgy: string;
    latitude: string;
    longitude: string;
    isActive: boolean;
}

interface ClientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingCustomer: Customer | null;
    formData: ClientFormData;
    setFormData: React.Dispatch<React.SetStateAction<ClientFormData>>;
    storeTypes: StoreType[];
    setStoreTypes?: React.Dispatch<React.SetStateAction<StoreType[]>>;
    provinces: { code: string; name: string }[];
    cities: { code: string; name: string; provinceCode: string | boolean }[];
    barangays: { code: string; name: string; cityCode: string }[];
    selectedProvinceCode: string;
    setSelectedProvinceCode: (v: string) => void;
    selectedCityCode: string;
    setSelectedCityCode: (v: string) => void;
    onSave: (e: React.FormEvent) => void;
    onNameChange: (val: string) => void;

    // Overrides settings props
    products?: ClientProduct[];
    versionsMap?: Record<number, ClientProductVersion[]>;
    overrides?: Record<number, number>;
    loadingOverrides?: boolean;
    updateProductVersionOverride?: (productId: number, versionId: number | null) => Promise<void>;
}

export default function ClientFormModal({
    isOpen,
    onClose,
    editingCustomer,
    formData,
    setFormData,
    storeTypes,
    setStoreTypes,
    provinces,
    cities,
    barangays,
    selectedProvinceCode,
    setSelectedProvinceCode,
    selectedCityCode,
    setSelectedCityCode,
    onSave,
    onNameChange,
    products = [],
    versionsMap = {},
    overrides = {},
    loadingOverrides = false,
    updateProductVersionOverride
}: ClientFormModalProps) {
    const [storeTypeQuery, setStoreTypeQuery] = useState("");
    const [isStoreTypeFocused, setIsStoreTypeFocused] = useState(false);
    const [isRegisteringStoreType, setIsRegisteringStoreType] = useState(false);
    const storeTypeContainerRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<"general" | "overrides">("general");
    const [productSearch, setProductSearch] = useState("");

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            (p.name || "").toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.code || "").toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [products, productSearch]);

    useEffect(() => {
        if (isOpen) {
            setActiveTab("general");
            setProductSearch("");
        }
    }, [isOpen]);

    // Sync query string with the selected ID
    useEffect(() => {
        const matched = storeTypes.find(st => String(st.id) === String(formData.store_type_id));
        if (matched) {
            setStoreTypeQuery(matched.store_type);
        } else if (!formData.store_type_id) {
            setStoreTypeQuery("");
        }
    }, [formData.store_type_id, storeTypes]);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (storeTypeContainerRef.current && !storeTypeContainerRef.current.contains(event.target as Node)) {
                setIsStoreTypeFocused(false);
                const matched = storeTypes.find(st => String(st.id) === String(formData.store_type_id));
                setStoreTypeQuery(matched ? matched.store_type : "");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [formData.store_type_id, storeTypes]);

    const filteredStoreTypes = useMemo(() => {
        return storeTypes.filter(st =>
            (st.store_type || "").toLowerCase().includes(storeTypeQuery.toLowerCase())
        );
    }, [storeTypes, storeTypeQuery]);

    const handleGetCurrentLocation = () => {
        if (!window.isSecureContext) {
            toast.error("Geolocation requires a secure connection (HTTPS) or localhost. Please type coordinates manually.");
            return;
        }
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        toast.info("Acquiring GPS coordinates...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);
                setFormData((prev: ClientFormData) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng
                }));
                toast.success(`Location captured! Lat: ${lat}, Lng: ${lng}`);
            },
            (error) => {
                console.error("Geolocation error:", error);
                let userFriendlyMessage = error.message;
                if (error.code === 1) { // PERMISSION_DENIED
                    userFriendlyMessage = "Location permission was denied. Please allow location access in your browser settings.";
                } else if (error.code === 2) { // POSITION_UNAVAILABLE
                    userFriendlyMessage = "Location coordinates are unavailable on this network/device.";
                } else if (error.code === 3) { // TIMEOUT
                    userFriendlyMessage = "Geolocation request timed out.";
                }
                toast.error(`Failed to get coordinates: ${userFriendlyMessage}`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleRegisterStoreType = async () => {
        const query = storeTypeQuery.trim();
        if (!query) return;

        setIsRegisteringStoreType(true);
        try {
            const res = await fetch("/api/manufacturing/finished-goods/store-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ store_type: query })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to create store type");
            }
            
            toast.success(`Store Type "${query}" registered successfully!`);
            const newSt: StoreType = { id: data.id, store_type: query };
            
            if (setStoreTypes) {
                setStoreTypes(prev => [...prev, newSt]);
            }
            
            setFormData(prev => ({ ...prev, store_type_id: String(data.id) }));
            setIsStoreTypeFocused(false);
        } catch (err) {
            console.error("Error creating store type:", err);
            const message = err instanceof Error ? err.message : "Failed to create store type";
            toast.error(message);
        } finally {
            setIsRegisteringStoreType(false);
        }
    };

    if (!isOpen) return null;

    // Filter cities by selected province
    const filteredCities = selectedProvinceCode
        ? cities.filter(c => c.provinceCode === selectedProvinceCode || String(c.provinceCode) === "130000000")
        : cities;

    const showOverridesTab = editingCustomer && !!updateProductVersionOverride;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-card border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b p-5 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <User className="h-4.5 w-4.5 text-primary" />
                        {editingCustomer ? "Edit Client Billing Profile" : "Register New Client Profile"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Navigation Tabs (only shown when editing existing customer) */}
                {showOverridesTab && (
                    <div className="flex border-b px-6 py-2.5 gap-2 bg-muted/20 shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveTab("general")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all outline-none cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "general"
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            <User className="h-3.5 w-3.5" />
                            General Billing Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("overrides")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all outline-none cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "overrides"
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            <Sliders className="h-3.5 w-3.5" />
                            Served BOM Versions
                        </button>
                    </div>
                )}

                {activeTab === "overrides" && showOverridesTab ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/10">
                        <div className="flex flex-col gap-1.5 bg-card border rounded-2xl p-5 shadow-sm">
                            <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Sliders className="h-4.5 w-4.5 text-primary" />
                                Served BOM Versions Configuration
                            </h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Override which manufacturing Bill of Materials (BOM) version is served to this customer. By default, customers are served the globally Active version.
                            </p>
                        </div>

                        {/* Search bar */}
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search finished goods by name or SKU..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full bg-background border rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold transition-all shadow-sm"
                            />
                        </div>

                        {loadingOverrides ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Loading settings...</span>
                            </div>
                        ) : (
                            <div className="border rounded-2xl divide-y bg-background overflow-hidden max-h-[45vh] overflow-y-auto shadow-sm">
                                {filteredProducts.length === 0 ? (
                                    <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                        <Search className="h-6 w-6 text-muted-foreground/35" />
                                        <span>No finished goods match your search query.</span>
                                    </div>
                                ) : (
                                    filteredProducts.map((p) => {
                                        const productVersions = versionsMap[p.id] || [];
                                        const selectedVer = overrides[p.id] || "";
                                        
                                        return (
                                            <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors gap-4">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-xs font-bold text-foreground truncate">{p.name}</span>
                                                    <span className="text-[9px] font-mono text-muted-foreground/75 uppercase tracking-wider">{p.code}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <select
                                                        value={selectedVer}
                                                        onChange={(e) => {
                                                            const val = e.target.value ? Number(e.target.value) : null;
                                                            updateProductVersionOverride?.(p.id, val);
                                                        }}
                                                        className="rounded-lg border bg-background text-foreground text-xs font-bold px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition-all hover:bg-muted/30"
                                                    >
                                                        <option value="">Default (Standard BOM Version 1)</option>
                                                         {productVersions.map((v) => (
                                                             <option key={(v as any).version_id ?? (v as any).id} value={(v as any).version_id ?? (v as any).id}>
                                                                 {v.version_name} ({v.status})
                                                             </option>
                                                         ))}
                                                     </select>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={onSave} className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10 scrollbar-thin">
                    
                        {/* section 1: Identity */}
                        <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2.5 border-b pb-3">
                                <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                    <Building className="h-4 w-4" />
                                </span>
                                <div>
                                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">1. Customer Identity</h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Corporate identity, tax identification, and store classification.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                        Client/Corporate Name 
                                        <span className="text-destructive font-bold text-[11px]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.customer_name}
                                        onChange={(e) => onNameChange(e.target.value)}
                                        placeholder="e.g. Super Shopping Corp."
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold transition-all font-semibold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                        Customer Account Code 
                                        <span className="text-destructive font-bold text-[11px]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.customer_code}
                                        onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, customer_code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. CUST-SUPER-204"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono font-bold transition-all text-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">TIN Number (Tax Registry)</label>
                                    <input
                                        type="text"
                                        value={formData.customer_tin}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\D/g, "");
                                            const limited = raw.slice(0, 12);
                                            setFormData((prev: ClientFormData) => ({ ...prev, customer_tin: limited }));
                                        }}
                                        placeholder="e.g. 000-123-456-000"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono font-semibold transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Store/Outlet Name</label>
                                    <input
                                        type="text"
                                        value={formData.store_name}
                                        onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, store_name: e.target.value }))}
                                        placeholder="e.g. Super Shopping (Ortigas)"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold transition-all font-semibold"
                                    />
                                </div>

                                <div className="space-y-1.5 relative" ref={storeTypeContainerRef}>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Store Trade Type</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Type to search or register..."
                                            value={storeTypeQuery}
                                            onFocus={() => setIsStoreTypeFocused(true)}
                                            onChange={e => {
                                                setStoreTypeQuery(e.target.value);
                                                setIsStoreTypeFocused(true);
                                            }}
                                            className="w-full bg-background border rounded-lg pl-3 pr-8 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold transition-all font-semibold"
                                        />
                                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 text-muted-foreground">
                                            {formData.store_type_id && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, store_type_id: "" }));
                                                        setStoreTypeQuery("");
                                                    }}
                                                    className="hover:text-foreground cursor-pointer"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                            {isRegisteringStoreType ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                        
                                        {isStoreTypeFocused && (
                                            <div className="absolute left-0 right-0 top-full mt-1 max-h-[160px] overflow-y-auto border bg-card rounded-lg shadow-lg z-50 divide-y divide-border scrollbar-thin">
                                                {filteredStoreTypes.map((st) => (
                                                    <button
                                                        key={st.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, store_type_id: String(st.id) }));
                                                            setStoreTypeQuery(st.store_type);
                                                            setIsStoreTypeFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors font-semibold text-foreground block cursor-pointer"
                                                    >
                                                        {st.store_type}
                                                    </button>
                                                ))}

                                                {/* Offer to create store type on the fly */}
                                                {storeTypeQuery.trim() !== "" && 
                                                 !storeTypes.some(st => (st.store_type || "").toLowerCase() === storeTypeQuery.trim().toLowerCase()) && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRegisterStoreType}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary/20 text-primary font-bold transition-colors block border-t bg-primary/5 cursor-pointer"
                                                    >
                                                        + Create &quot;{storeTypeQuery}&quot; as new Store Type
                                                    </button>
                                                )}
                                                
                                                {filteredStoreTypes.length === 0 && storeTypeQuery.trim() === "" && (
                                                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                                        No store types found. Type to create.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* section 2: Contact Info */}
                        <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2.5 border-b pb-3">
                                <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                    <Phone className="h-4 w-4" />
                                </span>
                                <div>
                                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">2. Contact Details</h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Corporate billing and operations touchpoints.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.customer_email}
                                        onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, customer_email: e.target.value }))}
                                        placeholder="e.g. accounting@supershopping.com"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold transition-all font-semibold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Number</label>
                                    <input
                                        type="text"
                                        value={formData.contact_number}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\D/g, "");
                                            const limited = raw.slice(0, 11);
                                            setFormData((prev: ClientFormData) => ({ ...prev, contact_number: limited }));
                                        }}
                                        placeholder="e.g. 0917-123-4567 or 8888-8888"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono font-semibold transition-all font-semibold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* section 3: Billing Address */}
                        <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2.5 border-b pb-3">
                                <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                    <MapPin className="h-4 w-4" />
                                </span>
                                <div>
                                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">3. Corporate Billing Address</h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Corporate billing address integrated with Philippine Standard Geographic Code (PSGC).</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5 flex flex-col justify-end">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Province</label>
                                    <select
                                        value={selectedProvinceCode}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedProvinceCode(val);
                                            setSelectedCityCode("");
                                            setFormData((prev: ClientFormData) => ({ ...prev, province: "", city: "", brgy: "" }));
                                        }}
                                        className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition-all"
                                    >
                                        <option value="">Select Province...</option>
                                        {provinces.map(p => (
                                            <option key={p.code} value={p.code}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5 flex flex-col justify-end">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">City / Municipality</label>
                                    <select
                                        value={selectedCityCode}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedCityCode(val);
                                            setFormData((prev: ClientFormData) => ({ ...prev, city: "", brgy: "" }));
                                        }}
                                        disabled={!selectedProvinceCode}
                                        className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select City...</option>
                                        {filteredCities.map(c => (
                                            <option key={c.code} value={c.code}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5 flex flex-col justify-end">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Barangay</label>
                                    <select
                                        value={formData.brgy}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData((prev: ClientFormData) => ({ ...prev, brgy: val }));
                                        }}
                                        disabled={!selectedCityCode}
                                        className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select Barangay...</option>
                                        {barangays.map(b => (
                                            <option key={b.code} value={b.code}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Geographic Coordinates */}
                            <div className="border-t border-dashed pt-4 mt-2 space-y-3">
                                <div>
                                    <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block">
                                        Geographic Coordinates (For Logistics & Route Optimization)
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Latitude</label>
                                        <input
                                            type="text"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, latitude: e.target.value }))}
                                            placeholder="e.g. 14.5995"
                                            className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono font-bold transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Longitude</label>
                                        <input
                                            type="text"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, longitude: e.target.value }))}
                                            placeholder="e.g. 120.9842"
                                            className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono font-bold transition-all"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={handleGetCurrentLocation}
                                            className="w-full h-9 inline-flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg text-xs font-bold transition-all border border-primary/20 cursor-pointer active:scale-[0.98]"
                                            title="Use your browser's location sensor to pin coordinates"
                                        >
                                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                                            Pin GPS Location
                                        </button>
                                    </div>
                                </div>

                                {/* Interactive Map Selector */}
                                <div className="border rounded-xl overflow-hidden mt-2 bg-background/50 animate-in fade-in duration-200">
                                    <CustomerMapSelector
                                        latitude={formData.latitude}
                                        longitude={formData.longitude}
                                        onChange={(lat, lng) => {
                                            setFormData((prev: ClientFormData) => ({
                                                ...prev,
                                                latitude: lat,
                                                longitude: lng
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* section 4: Settings */}
                        <div className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                        <Settings className="h-4 w-4" />
                                    </span>
                                    <div className="space-y-0.5">
                                        <span className="text-xs font-bold block text-foreground">Active Account Status</span>
                                        <span className="text-[9px] text-muted-foreground block max-w-sm">
                                            Deactivating this profile excludes it from billing searches and pricing locks in new Quotations.
                                        </span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, isActive: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </form>
                )}

                {/* Modal Footer */}
                <div className="flex gap-3 justify-end p-5 border-t bg-muted/5 shrink-0">
                    {activeTab === "overrides" ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 inline-flex items-center justify-center bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/95 transition-all shadow-md cursor-pointer"
                        >
                            Done / Close
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted text-foreground transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary/95 transition-all shadow-md cursor-pointer"
                            >
                                <Save className="h-3.5 w-3.5" />
                                Save Profile
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
