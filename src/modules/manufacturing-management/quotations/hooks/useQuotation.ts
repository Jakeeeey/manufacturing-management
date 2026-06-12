import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { QuotationHeader, QuotationSnapshotNode, CatalogProduct, SelectedQuoteProduct, Customer } from "../types";

export function useQuotation() {
    // List view vs Create view
    const [view, setView] = useState<"list" | "create">("list");

    // Master Quotations
    const [quotes, setQuotes] = useState<QuotationHeader[]>([]);
    const [loadingQuotes, setLoadingQuotes] = useState(true);
    const [selectedQuote, setSelectedQuote] = useState<QuotationHeader | null>(null);
    const [snapshots, setSnapshots] = useState<QuotationSnapshotNode[]>([]);
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Create Quotation Flow States
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [customerSearchText, setCustomerSearchText] = useState<string>("");
    const [quoteNumber, setQuoteNumber] = useState<string>("");
    const [remarks, setRemarks] = useState<string>("");
    const [priceTypes, setPriceTypes] = useState<{ price_type_id: number; price_type_name: string }[]>([]);
    const [selectedPriceTypeId, setSelectedPriceTypeId] = useState<string>("");
    
    // Catalog and selected products
    const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [selectedProductsList, setSelectedProductsList] = useState<SelectedQuoteProduct[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery] = useDebounce(searchQuery, 400);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    const [priceTypeRatesMap, setPriceTypeRatesMap] = useState<Record<number, number>>({}); // Map: productId -> price
    const [savingQuote, setSavingQuote] = useState(false);

    // Load master list of quotations
    const loadQuotes = async () => {
        setLoadingQuotes(true);
        try {
            const res = await fetch("/api/manufacturing/finished-goods/quotes");
            if (!res.ok) throw new Error("Failed to fetch quotations");
            const data = await res.json();
            setQuotes(data);
        } catch (e) {
            console.error("Error loading quotes:", e);
            toast.error(e instanceof Error ? e.message : "Failed to load quotations");
        } finally {
            setLoadingQuotes(false);
        }
    };

    // Initialize module metadata
    useEffect(() => {
        loadQuotes();
        
        // Fetch active customers initially
        fetch("/api/manufacturing/finished-goods/customers")
            .then(res => res.ok ? res.json() : [])
            .then(data => setCustomers(data))
            .catch(e => console.error("Error fetching customers:", e));

        // Fetch price types
        fetch("/api/manufacturing/finished-goods/price-types")
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setPriceTypes(data);
                if (data.length > 0) {
                    setSelectedPriceTypeId(String(data[0].price_type_id));
                }
            })
            .catch(e => console.error("Error fetching price types:", e));

        // Fetch master catalog products
        setLoadingProducts(true);
        fetch("/api/manufacturing/finished-goods/products?limit=250")
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setCatalogProducts(data);
                setLoadingProducts(false);
            })
            .catch(e => {
                console.error("Error fetching catalog:", e);
                setLoadingProducts(false);
            });
    }, []);

    // Load specific price sheets when Price Type selection changes
    useEffect(() => {
        if (!selectedPriceTypeId) {
            setPriceTypeRatesMap({});
            return;
        }
        fetch(`/api/manufacturing/finished-goods/price-types?priceTypeId=${selectedPriceTypeId}`)
            .then(res => res.ok ? res.json() : [])
            .then((data) => {
                const map: Record<number, number> = {};
                (data as { product_id: number | { product_id: number } | null; price: string | number }[]).forEach(item => {
                    const prodId = typeof item.product_id === "object" && item.product_id !== null ? item.product_id.product_id : item.product_id;
                    if (prodId) {
                        map[Number(prodId)] = parseFloat(String(item.price)) || 0;
                    }
                });
                setPriceTypeRatesMap(map);

                // Dynamically update preloaded rates on already selected items list
                setSelectedProductsList(prev => prev.map(item => {
                    const preloadedRate = map[item.product.product_id] || item.product.price_per_unit || 0;
                    return {
                        ...item,
                        priceTypePrice: preloadedRate,
                        agreedPrice: item.agreedPrice === item.priceTypePrice ? preloadedRate : item.agreedPrice
                    };
                }));
            })
            .catch(e => console.error("Error loading price type rules:", e));
    }, [selectedPriceTypeId]);

    const viewQuoteDetails = async (quote: QuotationHeader) => {
        setSelectedQuote(quote);
        setIsDetailModalOpen(true);
        setLoadingSnapshots(true);
        try {
            const res = await fetch(`/api/manufacturing/finished-goods/quotes/snapshots?quoteId=${quote.id}`);
            if (!res.ok) throw new Error("Failed to load snapshot details");
            const data = await res.json();
            setSnapshots(data);
        } catch (e) {
            console.error("Error fetching snapshots:", e);
            toast.error(e instanceof Error ? e.message : "Failed to fetch snapshot details");
        } finally {
            setLoadingSnapshots(false);
        }
    };

    // Initialize fresh new quote flow
    const initCreateFlow = () => {
        setView("create");
        setSelectedProductsList([]);
        setRemarks("");
        setSelectedCustomerId("");
        setCustomerSearchText("");
        
        // Generate QT-YYYYMMDD-HHMMSS
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        setQuoteNumber(`QT-${year}${month}${day}-${hour}${min}${sec}`);
    };

    const reviseQuotation = async (quote: QuotationHeader) => {
        setLoadingSnapshots(true);
        try {
            const res = await fetch(`/api/manufacturing/finished-goods/quotes/snapshots?quoteId=${quote.id}`);
            if (!res.ok) throw new Error("Failed to load snapshot details for revision");
            const snapshotItems: QuotationSnapshotNode[] = await res.json();
            
            // Map snapshots to SelectedQuoteProduct format
            const mappedProducts: SelectedQuoteProduct[] = snapshotItems.map(item => {
                const prodMatch = catalogProducts.find(p => p.product_id === item.product_id);
                const catalogProd: CatalogProduct = prodMatch || {
                    product_id: item.product_id,
                    product_name: item.node_name,
                    product_code: "",
                    price_per_unit: item.frozen_total_cost_php,
                    cost_per_unit: item.frozen_unit_cost_php,
                    unit_of_measurement: { unit_shortcut: item.uom }
                };
                return {
                    product: catalogProd,
                    priceTypePrice: item.frozen_unit_cost_php,
                    agreedPrice: item.frozen_total_cost_php
                };
            });

            setSelectedProductsList(mappedProducts);
            
            // Generate revised quote number e.g. QT-XXXXXXXXX-REV1
            const baseNum = quote.quote_number;
            let newQuoteNum = baseNum;
            const revMatch = baseNum.match(/-REV(\d+)$/);
            if (revMatch) {
                const nextRev = parseInt(revMatch[1]) + 1;
                newQuoteNum = baseNum.replace(/-REV\d+$/, `-REV${nextRev}`);
            } else {
                newQuoteNum = `${baseNum}-REV1`;
            }
            
            setQuoteNumber(newQuoteNum);
            
            const custIdStr = typeof quote.customer_id === "object" && quote.customer_id !== null
                ? String((quote.customer_id as Customer).id)
                : String(quote.customer_id);
            setSelectedCustomerId(custIdStr);
            
            const custNameStr = typeof quote.customer_id === "object" && quote.customer_id !== null
                ? `${(quote.customer_id as Customer).customer_name} (${(quote.customer_id as Customer).customer_code})`
                : `Cust ID: ${quote.customer_id}`;
            setCustomerSearchText(custNameStr);

            setRemarks(quote.remarks || "");
            setView("create");
        } catch (e) {
            console.error("Error preparing revision:", e);
            toast.error(e instanceof Error ? e.message : "Failed to prepare revision");
        } finally {
            setLoadingSnapshots(false);
        }
    };

    const addProductToQuote = (prod: CatalogProduct) => {
        const alreadyExists = selectedProductsList.some(item => item.product.product_id === prod.product_id);
        if (alreadyExists) {
            toast.info("Product already added to list");
            return;
        }
        const preloadedPrice = priceTypeRatesMap[prod.product_id] || prod.price_per_unit || 0;
        setSelectedProductsList(prev => [...prev, {
            product: prod,
            priceTypePrice: preloadedPrice,
            agreedPrice: preloadedPrice
        }]);
        toast.success(`Added ${prod.product_name} to quotation draft`);
    };

    const removeProductFromQuote = (productId: number) => {
        setSelectedProductsList(prev => prev.filter(item => item.product.product_id !== productId));
    };

    const handleAgreedPriceChange = (productId: number, val: number) => {
        setSelectedProductsList(prev => prev.map(item => 
            item.product.product_id === productId ? { ...item, agreedPrice: val } : item
        ));
    };

    const handleSearchCustomers = async (searchVal: string) => {
        setCustomerSearchText(searchVal);
        setSelectedCustomerId(""); // Clear selection to allow display of lists
        try {
            const res = await fetch(`/api/manufacturing/finished-goods/customers?search=${encodeURIComponent(searchVal)}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (err) {
            console.error("Error querying customers:", err);
        }
    };

    const selectCustomer = (id: string, nameCode: string) => {
        setSelectedCustomerId(id);
        setCustomerSearchText(nameCode);
    };

    const submitQuotation = async () => {
        if (!selectedCustomerId) {
            toast.error("Please select a customer");
            return;
        }
        if (selectedProductsList.length === 0) {
            toast.error("Please add at least one product to the quotation list");
            return;
        }
        if (!quoteNumber.trim()) {
            toast.error("Quotation number cannot be empty");
            return;
        }

        setSavingQuote(true);
        try {
            const totalSelling = selectedProductsList.reduce((sum, item) => sum + item.agreedPrice, 0);
            const totalCost = selectedProductsList.reduce((sum, item) => sum + (item.product.cost_per_unit || 0), 0);

            const header = {
                quote_number: quoteNumber.trim(),
                customer_id: parseInt(selectedCustomerId),
                total_selling_price: totalSelling,
                total_simulated_cost: totalCost,
                forex_rate_used: 61.39, // Default forex rate used for quote translation
                remarks: remarks || ""
            };

            const snapshots = selectedProductsList.map(item => ({
                product_id: item.product.product_id,
                version_id: 1, // Default version context
                node_name: item.product.product_name,
                node_type: "product_quota",
                quantity: 1,
                uom: item.product.unit_of_measurement?.unit_shortcut || "PCS",
                frozen_unit_cost_php: item.product.cost_per_unit || 0,
                frozen_total_cost_php: item.agreedPrice // Save the target agreed price into the cost snapshot tree for quote tracking
            }));

            const res = await fetch("/api/manufacturing/finished-goods/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ header, snapshots })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save quotation");
            }

            toast.success(`Quotation ${quoteNumber} saved successfully!`);
            setView("list");
            loadQuotes();
        } catch (e) {
            console.error("Save quotation error:", e);
            toast.error(e instanceof Error ? e.message : "Error saving quotation");
        } finally {
            setSavingQuote(false);
        }
    };

    // Reset current page when query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery]);

    // Filtered products list for selector searchbox using debounced search and grouped/sorted by Parent Product Family
    const filteredCatalog = useMemo(() => {
        const filtered = catalogProducts.filter(p => 
            p.product_name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (p.product_code || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        );

        // Sort by Parent Product Name (Product Family hierarchy) first, then by individual variation Name
        return [...filtered].sort((a, b) => {
            const familyA = a.parent_id?.product_name || a.product_name;
            const familyB = b.parent_id?.product_name || b.product_name;
            const famCompare = familyA.localeCompare(familyB);
            if (famCompare !== 0) return famCompare;
            return a.product_name.localeCompare(b.product_name);
        });
    }, [catalogProducts, debouncedSearchQuery]);

    const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
    
    const paginatedCatalog = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredCatalog.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredCatalog, currentPage]);

    return {
        view,
        setView,
        quotes,
        loadingQuotes,
        selectedQuote,
        setSelectedQuote,
        snapshots,
        loadingSnapshots,
        isDetailModalOpen,
        setIsDetailModalOpen,
        customers,
        selectedCustomerId,
        customerSearchText,
        quoteNumber,
        setQuoteNumber,
        remarks,
        setRemarks,
        priceTypes,
        selectedPriceTypeId,
        setSelectedPriceTypeId,
        catalogProducts,
        loadingProducts,
        selectedProductsList,
        searchQuery,
        setSearchQuery,
        currentPage,
        setCurrentPage,
        priceTypeRatesMap,
        savingQuote,
        loadQuotes,
        viewQuoteDetails,
        initCreateFlow,
        reviseQuotation,
        addProductToQuote,
        removeProductFromQuote,
        handleAgreedPriceChange,
        handleSearchCustomers,
        selectCustomer,
        submitQuotation,
        filteredCatalog,
        totalPages,
        paginatedCatalog
    };
}
