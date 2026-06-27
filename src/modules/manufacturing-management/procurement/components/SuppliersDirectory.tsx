import React, { useState, useEffect } from "react";
import { Supplier, RawMaterial } from "../types";
import { Search, Plus, MapPin, Phone, Mail, Award, FileText, CheckCircle2, AlertCircle, Globe, Building2, UserSquare2, Trash2, Link } from "lucide-react";
import { fetchPHProvinces, fetchPHCities, fetchPHBarangays, PSGCItem } from "@/lib/services/address-service";
import { fetchLinkedProducts, linkProductToSupplier, unlinkProductFromSupplier } from "../services/procurement-api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface SuppliersDirectoryProps {
    suppliers: Supplier[];
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    supplierForm: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupplierForm: React.Dispatch<React.SetStateAction<any>>;
    supplierError?: string | null;
    isEditingSupplier?: boolean;
    onStartEditSupplier?: (supplier: Supplier) => void;
    onCreateSupplier: (e: React.FormEvent) => void;
    rawMaterials?: RawMaterial[];
}

const getCurrencyFromNotes = (notes: string | null | undefined): string => {
    if (!notes) return "PHP";
    const match = notes.match(/\[Currency:\s*(\w+)\]/);
    return match ? match[1] : "PHP";
};

const cleanNotes = (notes: string | null | undefined): string => {
    if (!notes) return "";
    return notes.replace(/\[Currency:\s*\w+\]/, "").trim();
};

export default function SuppliersDirectory({
    suppliers,
    isModalOpen,
    setIsModalOpen,
    supplierForm,
    setSupplierForm,
    supplierError,
    isEditingSupplier = false,
    onStartEditSupplier,
    onCreateSupplier,
    rawMaterials = []
}: SuppliersDirectoryProps) {
    const [search, setSearch] = useState("");
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const [provinces, setProvinces] = useState<PSGCItem[]>([]);
    const [cities, setCities] = useState<PSGCItem[]>([]);
    const [barangays, setBarangays] = useState<PSGCItem[]>([]);

    const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
    const [selectedCityCode, setSelectedCityCode] = useState("");
    const [selectedBarangayCode, setSelectedBarangayCode] = useState("");

    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [loadingBarangays, setLoadingBarangays] = useState(false);

    const filteredSuppliers = suppliers.filter(s =>
        s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        s.supplier_shortcut?.toLowerCase().includes(search.toLowerCase()) ||
        s.tin_number?.includes(search)
    );

    const activeSupplier = selectedSupplier || filteredSuppliers[0];

    const isPH = !supplierForm.country || supplierForm.country.toLowerCase() === "philippines" || supplierForm.country.toLowerCase() === "ph";

    useEffect(() => {
        if (isModalOpen && isPH) {
            loadProvinces();
        }
    }, [isModalOpen, isPH]);

    useEffect(() => {
        if (!isModalOpen) {
            setSelectedProvinceCode("");
            setSelectedCityCode("");
            setSelectedBarangayCode("");
            setProvinces([]);
            setCities([]);
            setBarangays([]);
        }
    }, [isModalOpen]);

    const loadProvinces = async () => {
        setLoadingProvinces(true);
        const list = await fetchPHProvinces();
        setProvinces(list);
        setLoadingProvinces(false);
    };

    const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const code = e.target.value;
        const matched = provinces.find(p => p.code === code);
        const name = matched ? matched.name : "";
        
        setSelectedProvinceCode(code);
        setSelectedCityCode("");
        setSelectedBarangayCode("");
        setCities([]);
        setBarangays([]);
        
        setSupplierForm((prev: any) => ({
            ...prev,
            state_province: name,
            city: "",
            brgy: ""
        }));

        if (code) {
            setLoadingCities(true);
            const list = await fetchPHCities(code);
            setCities(list);
            setLoadingCities(false);
        }
    };

    const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const code = e.target.value;
        const matched = cities.find(c => c.code === code);
        const name = matched ? matched.name : "";
        
        setSelectedCityCode(code);
        setSelectedBarangayCode("");
        setBarangays([]);
        
        setSupplierForm((prev: any) => ({
            ...prev,
            city: name,
            brgy: ""
        }));

        if (code) {
            setLoadingBarangays(true);
            const list = await fetchPHBarangays(code);
            setBarangays(list);
            setLoadingBarangays(false);
        }
    };

    const handleBarangayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const code = e.target.value;
        const matched = barangays.find(b => b.code === code);
        const name = matched ? matched.name : "";
        
        setSelectedBarangayCode(code);
        
        setSupplierForm((prev: any) => ({
            ...prev,
            brgy: name
        }));
    };

    const [linkedProducts, setLinkedProducts] = useState<any[]>([]);
    const [loadingLinkedProducts, setLoadingLinkedProducts] = useState(false);

    const [isLinkingOpen, setIsLinkingOpen] = useState(false);
    const [selectedProductIdToLink, setSelectedProductIdToLink] = useState("");

    const loadLinkedProducts = async (supplierId: number) => {
        setLoadingLinkedProducts(true);
        try {
            const data = await fetchLinkedProducts(supplierId);
            setLinkedProducts(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLinkedProducts(false);
        }
    };

    useEffect(() => {
        if (activeSupplier) {
            loadLinkedProducts(activeSupplier.id);
        } else {
            setLinkedProducts([]);
        }
        setIsLinkingOpen(false);
        setSelectedProductIdToLink("");
    }, [activeSupplier]);

    const handleLinkProduct = async () => {
        if (!selectedProductIdToLink || !activeSupplier) return;
        try {
            await linkProductToSupplier(activeSupplier.id, Number(selectedProductIdToLink));
            toast.success("Product linked successfully");
            setIsLinkingOpen(false);
            setSelectedProductIdToLink("");
            loadLinkedProducts(activeSupplier.id);
        } catch (e) {
            console.error(e);
            toast.error("Failed to link product");
        }
    };

    const handleUnlinkProduct = async (linkId: number) => {
        try {
            await unlinkProductFromSupplier(linkId);
            toast.success("Product unlinked successfully");
            loadLinkedProducts(activeSupplier.id);
        } catch (e) {
            console.error(e);
            toast.error("Failed to unlink product");
        }
    };



    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
            {/* Left side: Directory list */}
            <div className="w-full lg:w-2/5 flex flex-col border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="p-4 border-b space-y-3 shrink-0 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-primary" />
                            Suppliers Directory ({filteredSuppliers.length})
                        </h3>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-all shadow-sm"
                        >
                            <Plus className="h-3.5 w-3.5" /> Register
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search suppliers name, TIN, code..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y">
                    {filteredSuppliers.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            No suppliers found. Click &quot;Register&quot; to add one.
                        </div>
                    ) : (
                        filteredSuppliers.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedSupplier(s)}
                                className={`w-full text-left p-4 hover:bg-muted/30 transition-all flex flex-col gap-1.5 ${
                                    activeSupplier?.id === s.id ? "bg-primary/5 border-l-2 border-primary" : ""
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="font-semibold text-xs text-foreground truncate">{s.supplier_name}</span>
                                    {s.supplier_shortcut && (
                                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                                            {s.supplier_shortcut}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="truncate flex items-center gap-1">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        {s.city || "No Address"}, {s.country}
                                    </span>
                                    {s.tin_number && (
                                        <span className="font-mono text-[9px] bg-muted px-1 rounded">TIN: {s.tin_number}</span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right side: Detailed Supplier Profile */}
            <div className="flex-1 border rounded-xl bg-card overflow-y-auto p-6 shadow-sm flex flex-col gap-6">
                {activeSupplier ? (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-6">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-foreground leading-tight">{activeSupplier.supplier_name}</h2>
                                        <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                            Active
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onStartEditSupplier?.(activeSupplier)}
                                        className="text-[10px] text-primary hover:underline font-bold border border-primary/20 px-2 py-1 rounded bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer"
                                    >
                                        Edit Details
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <UserSquare2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Contact Person: <strong className="text-foreground font-medium">{activeSupplier.contact_person || "Not Listed"}</strong>
                                </p>
                            </div>
                            <div className="text-left sm:text-right font-mono text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                                <div>TIN: {activeSupplier.tin_number || "Pending Registration"}</div>
                            </div>
                        </div>

                        {/* Profile Info Fields */}
                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    Company Address
                                </h4>
                                <div className="space-y-2.5 text-xs text-foreground/80">
                                    <p className="flex gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                        <span>
                                            {activeSupplier.address ? `${activeSupplier.address}, ` : ""}
                                            {activeSupplier.brgy ? `Brgy. ${activeSupplier.brgy}, ` : ""}
                                            {activeSupplier.city ? `${activeSupplier.city}, ` : ""}
                                            {activeSupplier.state_province ? `${activeSupplier.state_province}, ` : ""}
                                            {activeSupplier.postal_code ? `${activeSupplier.postal_code}, ` : ""}
                                            {activeSupplier.country}
                                        </span>
                                    </p>
                                    <p className="flex gap-2 items-center">
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span>
                                            Region Scope: {
                                                (!activeSupplier.country || activeSupplier.country.toLowerCase() === "philippines" || activeSupplier.country.toLowerCase() === "ph")
                                                    ? `Domestic (${activeSupplier.country || 'Philippines'})`
                                                    : `International (${activeSupplier.country})`
                                            }
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                                    <Phone className="h-4 w-4 text-primary" />
                                    Communications & Contact
                                </h4>
                                <div className="space-y-2.5 text-xs text-foreground/80">
                                    <p className="flex gap-2 items-center">
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span>Phone: {activeSupplier.phone_number || "No Contact Number"}</span>
                                    </p>
                                    <p className="flex gap-2 items-center">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span>Email: {activeSupplier.email_address || "No Email Registered"}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Trade terms */}
                        <div className="space-y-4 pt-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                                <Award className="h-4 w-4 text-primary" />
                                Commercial Agreement & Trade Terms
                            </h4>
                            <div className="grid gap-4 sm:grid-cols-4">
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Payment Terms</span>
                                    <p className="text-xs font-semibold text-foreground">{activeSupplier.payment_terms || "Cash On Delivery"}</p>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Delivery Terms</span>
                                    <p className="text-xs font-semibold text-foreground">{activeSupplier.delivery_terms || "FOB / Delivery"}</p>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Preferred Currency</span>
                                    <p className="text-xs font-semibold text-foreground">{getCurrencyFromNotes(activeSupplier.notes_or_comments)}</p>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">TIN Status</span>
                                    {activeSupplier.tin_number ? (
                                        <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            Verified
                                        </p>
                                    ) : (
                                        <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                            Unverified
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {cleanNotes(activeSupplier.notes_or_comments) && (
                            <div className="space-y-2 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl mt-4">
                                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" />
                                    Vendor Agreements / Audit Notes
                                </span>
                                <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{cleanNotes(activeSupplier.notes_or_comments)}</p>
                            </div>
                        )}

                        {/* Associated Products Section */}
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Link className="h-4 w-4 text-primary" />
                                    Associated Raw Materials & Products
                                </h4>
                                {!isLinkingOpen && (
                                    <button
                                        onClick={() => setIsLinkingOpen(true)}
                                        className="text-[10px] text-primary hover:underline font-bold border border-primary/20 px-2 py-1 rounded bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer flex items-center gap-1"
                                    >
                                        <Plus className="h-3 w-3" /> Link Product
                                    </button>
                                )}
                            </div>

                            {isLinkingOpen && (
                                <div className="flex gap-2 items-center bg-muted/20 p-3 rounded-lg border">
                                    <select
                                        value={selectedProductIdToLink}
                                        onChange={e => setSelectedProductIdToLink(e.target.value)}
                                        className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                    >
                                        <option key="default" value="">-- Select Product to Link --</option>
                                        {rawMaterials.filter(rm => 
                                            !linkedProducts.some(lp => lp.product_id?.id === rm.id)
                                        ).map(rm => (
                                            <option key={rm.id} value={rm.id}>
                                                {rm.product_code ? `[${rm.product_code}] ` : ""}{rm.product_name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleLinkProduct}
                                        disabled={!selectedProductIdToLink}
                                        className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/95 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        Link
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsLinkingOpen(false);
                                            setSelectedProductIdToLink("");
                                        }}
                                        className="text-muted-foreground hover:text-foreground text-xs font-semibold px-2 py-1.5"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {loadingLinkedProducts ? (
                                <div className="text-center text-xs text-muted-foreground py-4">
                                    Loading associated products...
                                </div>
                            ) : linkedProducts.length === 0 ? (
                                <div className="text-center text-xs text-muted-foreground/60 py-6 border border-dashed rounded-xl bg-muted/5">
                                    No raw materials linked to this supplier. Click &quot;+ Link Product&quot; to associate one.
                                </div>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {linkedProducts.map((lp: any) => (
                                        <div key={lp.id} className="border rounded-xl p-3 flex items-center justify-between bg-muted/10">
                                            <div className="space-y-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[9px] text-muted-foreground bg-muted border px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                                                        {lp.product_id?.product_code || "N/A"}
                                                    </span>
                                                    <span className="text-xs font-bold text-foreground truncate block">
                                                        {lp.product_id?.product_name || "Unknown Product"}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">
                                                    {lp.product_id?.description || "No description"}
                                                    {lp.product_id?.unit_of_measurement?.uom_name ? ` • (${lp.product_id?.unit_of_measurement?.uom_name})` : ""}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleUnlinkProduct(lp.id)}
                                                className="text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                                                title="Unlink Product"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground h-full">
                        <Building2 className="h-16 w-16 mb-4 text-muted-foreground/30" />
                        No supplier selected or registered.
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="bg-card text-foreground w-full max-w-lg border rounded-xl shadow-lg p-6 space-y-4"
                        >
                            <div className="flex items-center justify-between border-b pb-3">
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <Building2 className="h-4.5 w-4.5 text-primary" />
                                    {isEditingSupplier ? "Edit Vendor / Supplier Profile" : "Register Vendor / Supplier"}
                                </h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-muted-foreground hover:text-foreground text-xs font-bold"
                                >
                                    Close
                                </button>
                            </div>

                            {supplierError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                    <span>{supplierError}</span>
                                </div>
                            )}

                            <form onSubmit={onCreateSupplier} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Supplier Corporate Name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. Nabati Foods Philippines Inc."
                                            value={supplierForm.supplier_name}
                                            onChange={e => setSupplierForm({...supplierForm, supplier_name: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Supplier Code / Shortcut <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. NFPI"
                                            value={supplierForm.supplier_shortcut}
                                            onChange={e => setSupplierForm({...supplierForm, supplier_shortcut: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Tax Identifier (TIN Number)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 009-003-737-000"
                                            value={supplierForm.tin_number}
                                            onChange={e => setSupplierForm({...supplierForm, tin_number: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Contact Person</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Caezar De Vera"
                                            value={supplierForm.contact_person}
                                            onChange={e => setSupplierForm({...supplierForm, contact_person: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Phone Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0917-123-4567"
                                            value={supplierForm.phone_number}
                                            onChange={e => setSupplierForm({...supplierForm, phone_number: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Email Address</label>
                                        <input
                                            type="email"
                                            placeholder="e.g. caezar@nabati.com"
                                            value={supplierForm.email_address}
                                            onChange={e => setSupplierForm({...supplierForm, email_address: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Business Street Address <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. San Nicolas, City of Tarlac"
                                            value={supplierForm.address}
                                            onChange={e => setSupplierForm({...supplierForm, address: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5 col-span-2">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Country</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Philippines"
                                            value={supplierForm.country}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setSupplierForm({...supplierForm, country: val, state_province: "", city: "", brgy: ""});
                                                setSelectedProvinceCode("");
                                                setSelectedCityCode("");
                                                setSelectedBarangayCode("");
                                            }}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                        />
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {isPH ? (
                                            <motion.div
                                                key="ph-fields"
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 5 }}
                                                className="col-span-2 grid grid-cols-2 gap-4"
                                            >
                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-semibold text-muted-foreground">
                                                        Province {loadingProvinces && "(Loading...)"}
                                                    </label>
                                                    <select
                                                        value={selectedProvinceCode}
                                                        onChange={handleProvinceChange}
                                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                                    >
                                                        <option key="default" value="">-- Select Province --</option>
                                                        {provinces.map(p => (
                                                            <option key={p.code} value={p.code}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-semibold text-muted-foreground">
                                                        City / Municipality {loadingCities && "(Loading...)"}
                                                    </label>
                                                    <select
                                                        disabled={!selectedProvinceCode}
                                                        value={selectedCityCode}
                                                        onChange={handleCityChange}
                                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold disabled:opacity-50"
                                                    >
                                                        <option key="default" value="">-- Select City --</option>
                                                        {cities.map(c => (
                                                            <option key={c.code} value={c.code}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1.5 col-span-2">
                                                    <label className="text-[11px] font-semibold text-muted-foreground">
                                                        Barangay {loadingBarangays && "(Loading...)"}
                                                    </label>
                                                    <select
                                                        disabled={!selectedCityCode}
                                                        value={selectedBarangayCode}
                                                        onChange={handleBarangayChange}
                                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold disabled:opacity-50"
                                                    >
                                                        <option key="default" value="">-- Select Barangay --</option>
                                                        {barangays.map(b => (
                                                            <option key={b.code} value={b.code}>{b.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="intl-fields"
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 5 }}
                                                className="col-span-2 grid grid-cols-2 gap-4"
                                            >
                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-semibold text-muted-foreground">State / Province</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. California"
                                                        value={supplierForm.state_province}
                                                        onChange={e => setSupplierForm({...supplierForm, state_province: e.target.value})}
                                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-semibold text-muted-foreground">City</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Los Angeles"
                                                        value={supplierForm.city}
                                                        onChange={e => setSupplierForm({...supplierForm, city: e.target.value})}
                                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Payment Terms <span className="text-red-500">*</span></label>
                                        <select
                                            required
                                            value={supplierForm.payment_terms}
                                            onChange={e => setSupplierForm({...supplierForm, payment_terms: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        >
                                            <option value="Cash On Delivery">Cash On Delivery</option>
                                            <option value="Net 15 Days">Net 15 Days</option>
                                            <option value="Net 30 Days">Net 30 Days</option>
                                            <option value="Net 60 Days">Net 60 Days</option>
                                            <option value="Letter of Credit">Letter of Credit</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Delivery Terms</label>
                                        <select
                                            value={supplierForm.delivery_terms}
                                            onChange={e => setSupplierForm({...supplierForm, delivery_terms: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        >
                                            <option value="Delivery">Local Delivery</option>
                                            <option value="FOB (Free on Board)">FOB (Free on Board)</option>
                                            <option value="EXW (Ex Works)">EXW (Ex Works)</option>
                                            <option value="CIF (Cost, Insurance & Freight)">CIF (Cost, Insurance & Freight)</option>
                                            <option value="DDP (Delivered Duty Paid)">DDP (Delivered Duty Paid)</option>
                                            <option value="FOB / Delivery">FOB / Delivery</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Preferred Currency</label>
                                        <select
                                            value={supplierForm.currency}
                                            onChange={e => setSupplierForm({...supplierForm, currency: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        >
                                            <option value="PHP">PHP (Philippine Peso)</option>
                                            <option value="USD">USD (US Dollar)</option>
                                        </select>
                                    </div>

                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[11px] font-semibold text-muted-foreground">Vendor Agreements / Notes</label>
                                        <textarea
                                            placeholder="e.g. Any standard notes or terms of contracts..."
                                            value={supplierForm.notes_or_comments}
                                            onChange={e => setSupplierForm({...supplierForm, notes_or_comments: e.target.value})}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium min-h-[60px]"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm cursor-pointer animate-none"
                                >
                                    {isEditingSupplier ? "Save Changes" : "Complete Registration"}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
