import React from "react";
import { History, Trash2 } from "lucide-react";
import { SelectedQuoteProduct } from "../types";

interface SelectedProductsListProps {
    selectedProductsList: SelectedQuoteProduct[];
    handleAgreedPriceChange: (productId: number, val: number) => void;
    removeProductFromQuote: (productId: number) => void;
}

export function SelectedProductsList({
    selectedProductsList,
    handleAgreedPriceChange,
    removeProductFromQuote
}: SelectedProductsListProps) {
    return (
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm lg:col-span-3">
            <h4 className="text-sm font-bold text-foreground border-b pb-2">Agreed Override Pricing Sheet</h4>

            {selectedProductsList.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-16">
                    No products selected. Click items from the catalog panel to add them to this pricing draft.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-muted/40 border-b">
                            <tr>
                                <th className="p-2.5 font-semibold text-muted-foreground">Product</th>
                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Production Cost</th>
                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Price Type Rate</th>
                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Custom Agreed Price</th>
                                <th className="p-2.5 font-semibold text-muted-foreground text-right">GP Margin (%)</th>
                                <th className="p-2.5 font-semibold text-muted-foreground text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {selectedProductsList.map((item) => {
                                const cost = Number(item.product.cost_per_unit || 0);
                                const priceTypePrice = Number(item.priceTypePrice || 0);
                                const agreedPrice = Number(item.agreedPrice || 0);
                                const gp = agreedPrice - cost;
                                const margin = agreedPrice > 0 ? (gp / agreedPrice) * 100 : 0;
                                const isOverride = agreedPrice !== priceTypePrice;

                                return (
                                    <tr key={item.product.product_id} className="hover:bg-muted/20">
                                        <td className="p-2.5">
                                            <span className="font-medium text-foreground block">{item.product.product_name}</span>
                                            <span className="text-[10px] text-muted-foreground">SKU: {item.product.product_code}</span>
                                        </td>
                                        <td className="p-2.5 text-right font-semibold text-muted-foreground">₱{cost.toFixed(2)}</td>
                                        <td className="p-2.5 text-right text-muted-foreground font-medium flex items-center justify-end gap-1.5 pt-4">
                                            <History className="h-3 w-3 text-muted-foreground" />
                                            ₱{priceTypePrice.toFixed(2)}
                                        </td>
                                        <td className="p-2.5 text-right">
                                            <div className="relative inline-block">
                                                <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground">₱</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={agreedPrice}
                                                    onChange={e => handleAgreedPriceChange(item.product.product_id, parseFloat(e.target.value) || 0)}
                                                    className={`w-28 rounded border pl-5 pr-2 py-1 text-right text-xs bg-background outline-none ${
                                                        isOverride ? "border-amber-500 font-bold text-amber-600 focus:ring-1 focus:ring-amber-500" : "text-foreground focus:ring-1 focus:ring-primary"
                                                    }`}
                                                />
                                            </div>
                                        </td>
                                        <td className={`p-2.5 text-right font-bold ${gp >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                            ₱{gp.toFixed(2)} ({margin.toFixed(1)}%)
                                        </td>
                                        <td className="p-2.5 text-center">
                                            <button
                                                onClick={() => removeProductFromQuote(item.product.product_id)}
                                                className="p-1 hover:bg-muted text-destructive rounded"
                                                title="Remove Item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
