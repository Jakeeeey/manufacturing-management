import React from "react";
import { Search, Plus } from "lucide-react";
import { CatalogProduct } from "../types";

interface ProductCatalogTableProps {
    loadingProducts: boolean;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    paginatedCatalog: CatalogProduct[];
    filteredCatalog: CatalogProduct[];
    addProductToQuote: (prod: CatalogProduct) => void;
    currentPage: number;
    setCurrentPage: (updater: number | ((prev: number) => number)) => void;
    totalPages: number;
}

export function ProductCatalogTable({
    loadingProducts,
    searchQuery,
    setSearchQuery,
    paginatedCatalog,
    filteredCatalog,
    addProductToQuote,
    currentPage,
    setCurrentPage,
    totalPages
}: ProductCatalogTableProps) {
    const itemsWithHeaders = paginatedCatalog.map((prod, idx) => {
        const currentCategory = prod.parent_id?.product_name || prod.product_name;
        const prevProd = idx > 0 ? paginatedCatalog[idx - 1] : null;
        const prevCategory = prevProd ? (prevProd.parent_id?.product_name || prevProd.product_name) : "";
        const showHeader = currentCategory !== prevCategory;
        return { prod, showHeader, currentCategory };
    });

    return (
        <div className="space-y-4 rounded-xl border bg-muted/10 p-5">
            <h4 className="text-sm font-bold text-foreground border-b pb-2 flex justify-between items-center">
                <span>Finished Goods Catalog</span>
                {loadingProducts && <span className="text-[10px] text-muted-foreground">Loading...</span>}
            </h4>

            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search products to add..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full rounded border pl-8 pr-3 py-1.5 text-xs bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {itemsWithHeaders.map(({ prod, showHeader, currentCategory }) => {
                    const cost = prod.cost_per_unit || 0;
                    return (
                        <React.Fragment key={prod.product_id}>
                            {showHeader && (
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 px-2 py-1 rounded mt-2 first:mt-0">
                                    👪 Family: {currentCategory}
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-card border rounded-lg p-2.5 shadow-xs hover:border-primary/45 transition-colors">
                                <div className="min-w-0 pr-2">
                                    <span className="text-xs font-semibold text-foreground truncate block">{prod.product_name}</span>
                                    <span className="text-[10px] text-muted-foreground block">
                                        SKU: {prod.product_code} | UOM: {prod.unit_of_measurement?.unit_shortcut || "PCS"} | Cost: ₱{cost.toFixed(2)}
                                    </span>
                                </div>
                                <button
                                    onClick={() => addProductToQuote(prod)}
                                    className="shrink-0 p-1.5 bg-muted rounded-md text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                                    title="Add to Quote Draft"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </React.Fragment>
                    );
                })}
                {filteredCatalog.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6">
                        No matching goods found.
                    </div>
                )}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-2 mt-1">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="px-2 py-1 border rounded text-[10px] font-semibold bg-background hover:bg-muted disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <span className="text-[10px] text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-2 py-1 border rounded text-[10px] font-semibold bg-background hover:bg-muted disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
