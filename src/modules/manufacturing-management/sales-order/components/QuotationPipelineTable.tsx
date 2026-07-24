import React from "react";
import { FileText, Loader2, ArrowRight } from "lucide-react";
import { QuotationHeader } from "../types";
import { formatCurrency } from "@/lib/utils";

interface QuotationPipelineTableProps {
    quotes: QuotationHeader[];
    convertingId: number | null;
    handleConvertQuote: (quoteId: number) => void;
}

export function QuotationPipelineTable({
    quotes,
    convertingId,
    handleConvertQuote
}: QuotationPipelineTableProps) {
    if (quotes.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">Quotation Pipeline is Empty</h4>
                <p className="text-[11px] text-muted-foreground mt-1">All quotes are converted or none are present.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border rounded-xl bg-card shadow-sm">
            <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 font-semibold text-muted-foreground uppercase">Quote No</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Agreed Price</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase">Date</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {quotes.map(q => {
                        const custName = q.customer_id ? `${q.customer_id.customer_name} (${q.customer_id.customer_code})` : "General";
                        return (
                            <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                                <td className="p-3 font-bold text-foreground">{q.quote_number}</td>
                                <td className="p-3 font-medium text-foreground">{custName}</td>
                                <td className="p-3 text-right font-bold text-primary font-mono">{formatCurrency(q.total_selling_price)}</td>
                                <td className="p-3 text-muted-foreground">{new Date(q.quote_date).toLocaleDateString()}</td>
                                <td className="p-3 text-center">
                                    <button
                                        disabled={convertingId === q.id}
                                        onClick={() => handleConvertQuote(q.id)}
                                        className="inline-flex items-center gap-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-sm"
                                    >
                                        {convertingId === q.id ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Converting...
                                            </>
                                        ) : (
                                            <>
                                                Convert SO
                                                <ArrowRight className="h-3 w-3" />
                                            </>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
