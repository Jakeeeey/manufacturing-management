import React from "react";
import { Edit2, Archive, ArchiveRestore, ShieldCheck, ShieldAlert, Mail, Phone, MapPin, EyeOff } from "lucide-react";
import { Customer } from "../types";

interface ClientsTableProps {
    customers: Customer[];
    loading: boolean;
    onEdit: (c: Customer) => void;
    onDelete: (id: number | string) => void;
    onToggleActive: (c: Customer) => void;
}

export default function ClientsTable({
    customers,
    loading,
    onEdit,
    onDelete,
    onToggleActive
}: ClientsTableProps) {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-xl shadow-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <span className="text-xs text-muted-foreground mt-4 font-bold">Querying Client Directory...</span>
            </div>
        );
    }

    if (customers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border rounded-xl shadow-sm p-5">
                <EyeOff className="h-12 w-12 text-muted-foreground/35 mb-3" />
                <h4 className="text-xs font-bold text-foreground">No Clients Found</h4>
                <p className="text-[10px] text-muted-foreground mt-1 max-w-xs leading-relaxed">
                    Try searching another keyword or register a new customer profile.
                </p>
            </div>
        );
    }

    return (
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-0">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-muted/30 border-b text-muted-foreground font-bold uppercase tracking-wider select-none">
                            <th className="p-4 font-semibold">Client Identity</th>
                            <th className="p-4 font-semibold">Store Mapping</th>
                            <th className="p-4 font-semibold">Tax TIN</th>
                            <th className="p-4 font-semibold">Contact Logs</th>
                            <th className="p-4 font-semibold">Billing Address</th>
                            <th className="p-4 font-semibold text-center w-20">Status</th>
                            <th className="p-4 font-semibold text-center w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {customers.map((c) => {
                            const activeBool = c.isActive === 1 || c.isActive === true;
                            
                            // Parse Store Type string or object
                            let storeType = "N/A";
                            const rawStoreType = c.store_type || c.store_type_id;
                            if (rawStoreType) {
                                storeType = typeof rawStoreType === "object" 
                                    ? rawStoreType.store_type 
                                    : `ID: ${rawStoreType}`;
                            }

                            // Full address builder
                            const addressParts = [c.brgy, c.city, c.province].filter(Boolean);
                            const fullAddress = addressParts.join(", ") || "No Address Provided";

                            return (
                                <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-4">
                                        <div className="space-y-0.5">
                                            <span className="font-extrabold text-foreground text-sm block">
                                                {c.customer_name}
                                            </span>
                                            <span className="font-mono text-[10px] text-muted-foreground block font-bold">
                                                {c.customer_code}
                                            </span>
                                        </div>
                                    </td>
                                    
                                    <td className="p-4">
                                        <div className="space-y-0.5">
                                            <span className="font-bold text-foreground block">
                                                {c.store_name || "N/A"}
                                            </span>
                                            <span className="inline-flex bg-muted text-muted-foreground px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase tracking-wider">
                                                {storeType}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="p-4 font-mono font-bold text-foreground">
                                        {c.customer_tin || "N/A"}
                                    </td>

                                    <td className="p-4">
                                        <div className="space-y-1">
                                            {c.customer_email && (
                                                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                                                    <Mail className="h-3 w-3 text-primary shrink-0" />
                                                    <span className="truncate max-w-[150px]">{c.customer_email}</span>
                                                </div>
                                            )}
                                            {c.contact_number && (
                                                <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                                                    <Phone className="h-3 w-3 text-primary shrink-0" />
                                                    <span>{c.contact_number}</span>
                                                </div>
                                            )}
                                            {!c.customer_email && !c.contact_number && (
                                                <span className="text-muted-foreground/50 italic">None</span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="p-4 max-w-xs">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-1.5 items-start text-muted-foreground leading-normal font-medium">
                                                <MapPin className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${c.latitude && c.longitude ? "text-emerald-500 font-bold" : "text-primary"}`} />
                                                <span className="truncate font-semibold text-foreground" title={fullAddress}>
                                                    {fullAddress}
                                                </span>
                                            </div>
                                            {c.latitude !== undefined && c.latitude !== null && c.longitude !== undefined && c.longitude !== null && (
                                                <span className="text-[9px] text-muted-foreground font-mono font-bold pl-5 flex items-center gap-1">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    GPS: {Number(c.latitude).toFixed(6)}, {Number(c.longitude).toFixed(6)}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="p-4 text-center">
                                        <button
                                            type="button"
                                            onClick={() => onToggleActive(c)}
                                            className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[9px] font-black border transition-all cursor-pointer ${
                                                activeBool
                                                    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 hover:bg-emerald-500/25"
                                                    : "bg-destructive/15 border-destructive/25 text-destructive hover:bg-destructive/25"
                                            }`}
                                            title="Click to toggle status"
                                        >
                                            {activeBool ? (
                                                <>
                                                    <ShieldCheck className="h-2.5 w-2.5" />
                                                    Active
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldAlert className="h-2.5 w-2.5" />
                                                    Inactive
                                                </>
                                            )}
                                        </button>
                                    </td>

                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button
                                                onClick={() => onEdit(c)}
                                                disabled={!activeBool}
                                                className={`p-1.5 rounded-lg transition-colors ${
                                                    activeBool 
                                                        ? "text-primary hover:bg-primary/10 cursor-pointer" 
                                                        : "text-muted-foreground/45 cursor-not-allowed"
                                                }`}
                                                title={activeBool ? "Edit billing profile" : "Cannot edit inactive profile"}
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            {activeBool ? (
                                                <button
                                                    onClick={() => onToggleActive(c)}
                                                    className="text-amber-600 hover:bg-amber-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                    title="Archive client profile (deactivate)"
                                                >
                                                    <Archive className="h-3.5 w-3.5" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onToggleActive(c)}
                                                    className="text-emerald-600 hover:bg-emerald-500/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                    title="Restore client profile (activate)"
                                                >
                                                    <ArchiveRestore className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
