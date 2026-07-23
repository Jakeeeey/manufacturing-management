import { FormEvent, useEffect, useState } from "react";
import { Calendar, Download, FileText, Loader2, Printer, X } from "lucide-react";
import { archiveInvoiceDocument, fetchPrintableInvoice, fetchReceiptTypes } from "../services/invoicing-api";
import { CreateInvoicePayload, CreatedInvoiceResult, InvoicingCandidate, PrintableInvoice, ReceiptType } from "../types";
import { generateInvoiceReceiptPdf } from "../utils/generateInvoiceReceiptPdf";

interface Props {
    candidate: InvoicingCandidate;
    submitting: boolean;
    onClose: () => void;
    onSubmit: (payload: CreateInvoicePayload) => Promise<CreatedInvoiceResult | null>;
}

export default function CreateInvoiceModal({ candidate, submitting, onClose, onSubmit }: Props) {
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const [invoiceNo, setInvoiceNo] = useState(`INV-${candidate.order_no.replace(/^SO-/, "")}`);
    const [invoiceDate, setInvoiceDate] = useState(today);
    const [dueDate, setDueDate] = useState(due.toISOString().slice(0, 10));
    const [remarks, setRemarks] = useState(`Billing for Sales Order ${candidate.order_no}`);
    const [receiptTypes, setReceiptTypes] = useState<ReceiptType[]>([]);
    const [invoiceTypeId, setInvoiceTypeId] = useState(0);
    const [printable, setPrintable] = useState<PrintableInvoice | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [loadingPrint, setLoadingPrint] = useState(false);
    const [archiveStatus, setArchiveStatus] = useState<"idle" | "saved" | "failed">("idle");
    const selectedType = receiptTypes.find((type) => type.id === invoiceTypeId);

    useEffect(() => {
        void fetchReceiptTypes().then((types) => {
            setReceiptTypes(types);
            setInvoiceTypeId(types[0]?.id || 0);
        });
    }, []);

    useEffect(() => {
        if (!printable) return;
        const url = URL.createObjectURL(generateInvoiceReceiptPdf(printable).output("blob"));
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [printable]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const created = await onSubmit({ salesOrderId: candidate.order_id, invoiceTypeId, invoiceNo: invoiceNo.trim(), invoiceDate, dueDate, remarks: remarks.trim() || undefined });
        if (!created) return;
        setLoadingPrint(true);
        try {
            const invoice = await fetchPrintableInvoice(created.invoiceId);
            setPrintable(invoice);
            try {
                await archiveInvoiceDocument(invoice.invoiceId, generateInvoiceReceiptPdf(invoice).output("blob"), invoice.invoiceNo);
                setArchiveStatus("saved");
            } catch {
                setArchiveStatus("failed");
            }
        } finally {
            setLoadingPrint(false);
        }
    };

    const print = () => {
        if (!printable) return;
        const doc = generateInvoiceReceiptPdf(printable);
        doc.autoPrint();
        window.open(URL.createObjectURL(doc.output("blob")), "_blank", "noopener,noreferrer");
    };

    const download = () => printable && generateInvoiceReceiptPdf(printable).save(`${printable.invoiceNo}.pdf`);

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <div className={`flex max-h-[94vh] w-full ${printable ? "max-w-6xl" : "max-w-xl"} flex-col overflow-hidden rounded-2xl border bg-card shadow-xl`}>
            <div className="flex items-center justify-between border-b px-6 py-4">
                <div><h3 className="text-sm font-black uppercase tracking-wide">{printable ? `${printable.receiptType.type} Ready` : "Convert To Invoice"}</h3><p className="mt-0.5 text-[10px] text-muted-foreground">{candidate.order_no} · {candidate.customer_name}</p></div>
                <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {loadingPrint ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : printable ? <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
                <iframe title="Invoice receipt preview" src={previewUrl} className="min-h-[65vh] flex-1 rounded-xl border bg-white" />
                <div className="w-full space-y-3 md:w-64">
                    <div className="rounded-xl border bg-emerald-500/5 p-4"><p className="text-[9px] font-black uppercase text-emerald-600">Invoice Created</p><p className="mt-1 font-black">{printable.invoiceNo}</p><p className="text-[10px] text-muted-foreground">Status: {printable.transactionStatus}</p><p className={`mt-2 text-[9px] ${archiveStatus === "failed" ? "text-amber-600" : "text-muted-foreground"}`}>{archiveStatus === "saved" ? "PDF archived" : archiveStatus === "failed" ? "PDF archive failed; printing is still available" : "Archiving PDF..."}</p></div>
                    <button type="button" onClick={print} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground"><Printer className="h-4 w-4" />Print Receipt</button>
                    <button type="button" onClick={download} className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"><Download className="h-4 w-4" />Download PDF</button>
                    <button type="button" onClick={onClose} className="w-full rounded-xl border px-4 py-2.5 text-xs font-bold">Close</button>
                </div>
            </div> : <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-6">
                <div className="rounded-xl border bg-muted/20 p-4 text-xs"><span className="font-bold">{candidate.po_no || "No PO number"}</span><span className="mx-2 text-muted-foreground">·</span>{candidate.branch_name || `Branch #${candidate.branch_id}`}<p className="mt-2 text-[10px] text-muted-foreground">The server rechecks version-matched inventory before creating the invoice. Stock is deducted later during consolidation picking.</p></div>
                <div className="overflow-hidden rounded-xl border">
                    <div className="border-b bg-muted/30 px-4 py-2 text-[9px] font-extrabold uppercase text-muted-foreground">Available Order Items</div>
                    <div className="max-h-44 divide-y overflow-y-auto">{candidate.details.map(line => {
                        const product = typeof line.product_id === "object" ? line.product_id : null;
                        return <div key={line.detail_id} className="flex items-center justify-between gap-4 px-4 py-2 text-xs"><div className="min-w-0"><p className="truncate font-bold">{product?.product_name || `Product #${line.product_id}`}</p><p className="text-[9px] text-muted-foreground">{product?.product_code || ""} · {line.bom_version_name || "No version"}</p></div><div className="shrink-0 text-right"><p className="font-bold">{line.ordered_quantity} {product?.uom || ""}</p><p className="text-[9px] text-muted-foreground">₱{Number(line.net_amount || line.ordered_quantity * line.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div></div>;
                    })}</div>
                    <div className="flex justify-between border-t bg-muted/20 px-4 py-3 text-xs font-black"><span>Total</span><span>₱{Number(candidate.net_amount || candidate.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <label className="block space-y-1.5"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Receipt Type</span><select required value={invoiceTypeId || ""} onChange={e => setInvoiceTypeId(Number(e.target.value))} className="w-full rounded-xl border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"><option value="" disabled>Select receipt type</option>{receiptTypes.map(type => <option key={type.id} value={type.id}>{type.type}</option>)}</select></label>
                <label className="block space-y-1.5"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Invoice / Receipt Number</span><div className="relative"><FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input required maxLength={selectedType?.maxLength || undefined} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="w-full rounded-xl border bg-background py-2 pl-9 pr-3.5 text-xs outline-none focus:border-primary" /></div></label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[{ label: "Invoice Date", value: invoiceDate, set: setInvoiceDate }, { label: "Payment Due Date", value: dueDate, set: setDueDate }].map(field => <label key={field.label} className="space-y-1.5"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">{field.label}</span><div className="relative"><Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input required type="date" value={field.value} onChange={e => field.set(e.target.value)} className="w-full rounded-xl border bg-muted/40 py-2 pl-9 pr-3.5 text-xs outline-none focus:border-primary" /></div></label>)}</div>
                <label className="block space-y-1.5"><span className="text-[10px] font-extrabold uppercase text-muted-foreground">Remarks</span><textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full resize-none rounded-xl border bg-muted/40 px-3.5 py-2 text-xs outline-none focus:border-primary" /></label>
                <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-xs font-bold">Cancel</button><button disabled={submitting || !invoiceTypeId} className="rounded-xl bg-primary px-5 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">{submitting ? "Checking Inventory..." : "Convert & Prepare Receipt"}</button></div>
            </form>}
        </div>
    </div>;
}
