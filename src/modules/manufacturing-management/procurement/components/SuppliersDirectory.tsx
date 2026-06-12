import React, { useState } from "react";
import { Supplier } from "../types";
import { Search, Plus, MapPin, Phone, Mail, Award, FileText, CheckCircle2, Globe, Building2, UserSquare2 } from "lucide-react";

interface SuppliersDirectoryProps {
    suppliers: Supplier[];
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
    supplierForm: any;
    setSupplierForm: React.Dispatch<React.SetStateAction<any>>;
    onCreateSupplier: (e: React.FormEvent) => void;
}

export default function SuppliersDirectory({
    suppliers,
    isModalOpen,
    setIsModalOpen,
    supplierForm,
    setSupplierForm,
    onCreateSupplier
}: SuppliersDirectoryProps) {
    const [search, setSearch] = useState("");
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const filteredSuppliers = suppliers.filter(s =>
        s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        s.supplier_shortcut?.toLowerCase().includes(search.toLowerCase()) ||
        s.tin_number?.includes(search)
    );

    const activeSupplier = selectedSupplier || filteredSuppliers[0];

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
                            No suppliers found. Click "Register" to add one.
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
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-foreground leading-tight">{activeSupplier.supplier_name}</h2>
                                    <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                        Active
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <UserSquare2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Contact Person: <strong className="text-foreground font-medium">{activeSupplier.contact_person || "Not Listed"}</strong>
                                </p>
                            </div>
                            <div className="text-left sm:text-right font-mono text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                                <div>SUPPLIER ID: #{activeSupplier.id}</div>
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
                                            {activeSupplier.city ? `${activeSupplier.city}, ` : ""}
                                            {activeSupplier.state_province ? `${activeSupplier.state_province}, ` : ""}
                                            {activeSupplier.postal_code ? `${activeSupplier.postal_code}, ` : ""}
                                            {activeSupplier.country}
                                        </span>
                                    </p>
                                    <p className="flex gap-2 items-center">
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span>Region Scope: Domestic ({activeSupplier.country})</span>
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
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Payment Terms</span>
                                    <p className="text-xs font-semibold text-foreground">{activeSupplier.payment_terms || "Cash On Delivery"}</p>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Delivery Terms</span>
                                    <p className="text-xs font-semibold text-foreground">{activeSupplier.delivery_terms || "FOB / Delivery"}</p>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/10 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">TIN Status</span>
                                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        Verified
                                    </p>
                                </div>
                            </div>
                        </div>

                        {activeSupplier.notes_or_comments && (
                            <div className="space-y-2 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" />
                                    Vendor Agreements / Audit Notes
                                </span>
                                <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{activeSupplier.notes_or_comments}</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground h-full">
                        <Building2 className="h-16 w-16 mb-4 text-muted-foreground/30" />
                        No supplier selected or registered.
                    </div>
                )}
            </div>

            {/* Modal for Supplier Registration */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-card text-foreground w-full max-w-lg border rounded-xl shadow-lg p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <Building2 className="h-4.5 w-4.5 text-primary" />
                                Register Vendor / Supplier
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground text-xs font-bold"
                            >
                                Close
                            </button>
                        </div>

                        <form onSubmit={onCreateSupplier} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Supplier Corporate Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Nabati Foods Philippines Inc."
                                        value={supplierForm.supplier_name}
                                        onChange={e => setSupplierForm({...supplierForm, supplier_name: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Supplier Code / Shortcut</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. NFPI"
                                        value={supplierForm.supplier_shortcut}
                                        onChange={e => setSupplierForm({...supplierForm, supplier_shortcut: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Tax Identifier (TIN Number)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 009-003-737-000"
                                        value={supplierForm.tin_number}
                                        onChange={e => setSupplierForm({...supplierForm, tin_number: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Contact Person</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Caezar De Vera"
                                        value={supplierForm.contact_person}
                                        onChange={e => setSupplierForm({...supplierForm, contact_person: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Phone Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 0917-123-4567"
                                        value={supplierForm.phone_number}
                                        onChange={e => setSupplierForm({...supplierForm, phone_number: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="e.g. caezar@nabati.com"
                                        value={supplierForm.email_address}
                                        onChange={e => setSupplierForm({...supplierForm, email_address: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Business Street Address</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. San Nicolas, City of Tarlac"
                                        value={supplierForm.address}
                                        onChange={e => setSupplierForm({...supplierForm, address: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">City</label>
                                    <input
                                        type="text"
                                        placeholder="Tarlac City"
                                        value={supplierForm.city}
                                        onChange={e => setSupplierForm({...supplierForm, city: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Payment Terms</label>
                                    <select
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
                            </div>

                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
                            >
                                Complete Registration
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
