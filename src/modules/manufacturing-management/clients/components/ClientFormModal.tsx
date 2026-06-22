import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Save, User, MapPin, ChevronDown, Loader2 } from "lucide-react";
import { Customer, StoreType } from "../types";
import { toast } from "sonner";
import CustomerMapSelector from "./CustomerMapSelector";

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
    onNameChange
}: ClientFormModalProps) {
    const [storeTypeQuery, setStoreTypeQuery] = useState("");
    const [isStoreTypeFocused, setIsStoreTypeFocused] = useState(false);
    const [isRegisteringStoreType, setIsRegisteringStoreType] = useState(false);
    const storeTypeContainerRef = useRef<HTMLDivElement>(null);

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
                toast.error(`Failed to get coordinates: ${error.message}`);
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

                {/* Modal Scrollable Body */}
                <form onSubmit={onSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* section 1: Identity */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-wider border-b pb-1">1. Customer Identity</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Client/Corporate Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.customer_name}
                                    onChange={(e) => onNameChange(e.target.value)}
                                    placeholder="e.g. Super Shopping Corp."
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Customer Account Code</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.customer_code}
                                    onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, customer_code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. CUST-SUPER-204"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">TIN Number (Tax Registry)</label>
                                <input
                                    type="text"
                                    value={formData.customer_tin}
                                    onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, customer_tin: e.target.value }))}
                                    placeholder="e.g. 000-123-456-000"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Store/Outlet Name</label>
                                <input
                                    type="text"
                                    value={formData.store_name}
                                    onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, store_name: e.target.value }))}
                                    placeholder="e.g. Super Shopping (Ortigas)"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
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
                                        className="w-full bg-background border rounded-lg pl-3 pr-8 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
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
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-wider border-b pb-1">2. Contact Details</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</label>
                                <input
                                    type="email"
                                    value={formData.customer_email}
                                    onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, customer_email: e.target.value }))}
                                    placeholder="e.g. accounting@supershopping.com"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Number</label>
                                <input
                                    type="text"
                                    value={formData.contact_number}
                                    onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, contact_number: e.target.value }))}
                                    placeholder="e.g. 0917-123-4567 or 8888-8888"
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* section 3: Billing Address */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-wider border-b pb-1 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            3. Corporate Billing Address (PH PSGC Lookup)
                        </h4>
                        
                        <div className="grid grid-cols-3 gap-4">
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
                                    className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all"
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
                                    className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Select Barangay...</option>
                                    {barangays.map(b => (
                                        <option key={b.code} value={b.code}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Geographic Coordinates */}
                        <div className="border-t border-dashed pt-4 mt-2">
                            <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-2">
                                Geographic Coordinates (For Route Optimization)
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Latitude</label>
                                    <input
                                        type="text"
                                        value={formData.latitude}
                                        onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, latitude: e.target.value }))}
                                        placeholder="e.g. 14.5995"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Longitude</label>
                                    <input
                                        type="text"
                                        value={formData.longitude}
                                        onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, longitude: e.target.value }))}
                                        placeholder="e.g. 120.9842"
                                        className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={handleGetCurrentLocation}
                                        className="w-full h-9 inline-flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg text-xs font-bold transition-all border border-primary/20 cursor-pointer"
                                        title="Use your browser's location sensor to pin coordinates"
                                    >
                                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
                                        Pin GPS Location
                                    </button>
                                </div>
                            </div>

                            {/* Interactive Map Selector */}
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

                    {/* section 4: Settings */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between p-3.5 border bg-muted/5 rounded-xl">
                            <div className="space-y-0.5">
                                <span className="text-xs font-bold block">Active Account Status</span>
                                <span className="text-[9px] text-muted-foreground block max-w-sm">
                                    Deactivating this profile excludes it from billing searches and pricing locks in new Quotations.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData((prev: ClientFormData) => ({ ...prev, isActive: e.target.checked }))}
                                className="h-4.5 w-4.5 rounded border-muted text-primary focus:ring-primary cursor-pointer"
                            />
                        </div>
                    </div>
                </form>

                {/* Modal Footer */}
                <div className="flex gap-3 justify-end p-5 border-t bg-muted/5 shrink-0">
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
                </div>
            </div>
        </div>
    );
}
