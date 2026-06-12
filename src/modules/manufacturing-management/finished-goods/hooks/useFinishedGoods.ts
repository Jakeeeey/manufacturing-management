import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { Product, ProductVersion, Brand, Category, Unit, BOMItem, RoutingStep, ProductOverhead, BFFCatalogProduct, OperationType, OverheadType } from "../types";
import {
    fetchBrands,
    fetchCategories,
    fetchUnits,
    fetchVersions,
    fetchBOMDetails,
    saveBOMDetails,
    registerProduct,
    registerNewVersion,
    createBrand,
    createCategory
} from "../services/finished-goods-api";

export function useFinishedGoods(initialTab: string = "details") {
    // UI Layout & Tab States
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Metadata tables
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [overheadTypes, setOverheadTypes] = useState<OverheadType[]>([]);
    const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
    const [simulatedForexRate, setSimulatedForexRate] = useState<number>(61.39);


    // Loading & Saving indicators
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingBOM, setLoadingBOM] = useState(false);
    const [savingBOM, setSavingBOM] = useState(false);

    // Catalog search
    const [products, setProducts] = useState<Product[]>([]);
    const [allCatalogProducts, setAllCatalogProducts] = useState<BFFCatalogProduct[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery] = useDebounce(searchQuery, 400);

    // Versions
    const [versions, setVersions] = useState<ProductVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [activeBOMId, setActiveBOMId] = useState<number | null>(null);
    const [versionCosts, setVersionCosts] = useState<Record<number, number>>({});

    // Registration Modal
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [registerForm, setRegisterForm] = useState({
        title: "",
        sku: "",
        baseUom: "L",
        targetSellingPrice: "",
        barcode: "",
        densityFactor: "1.0",
        versionName: "v1.0",
        brandId: "",
        categoryId: ""
    });

    // Form Edits
    const [editedDetails, setEditedDetails] = useState<Partial<Product>>({});
    const [editedBOM, setEditedBOM] = useState<BOMItem[]>([]);
    const [editedRoutings, setEditedRoutings] = useState<RoutingStep[]>([]);
    const [editedOverheads, setEditedOverheads] = useState<ProductOverhead[]>([]);

    // Selected product helper
    const selectedProduct = useMemo(() => {
        return products.find(p => p.id === selectedProductId) || products[0];
    }, [products, selectedProductId]);

    // Fetch Brands, Categories, Units, and BOM materials catalog on Mount
    useEffect(() => {
        async function loadMetadata() {
            try {
                const [bList, cList, uList, prodRes, overheadRes, operationsRes, forexRes] = await Promise.all([
                    fetchBrands(),
                    fetchCategories(),
                    fetchUnits(),
                    fetch("/api/manufacturing/finished-goods/products?limit=100"),
                    fetch("/api/manufacturing/finished-goods/overhead-types"),
                    fetch("/api/manufacturing/finished-goods/operations"),
                    fetch("https://open.er-api.com/v6/latest/USD").catch(() => null)
                ]);
                setBrands(bList);
                setCategories(cList);
                setUnits(uList);
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    setAllCatalogProducts(prodData);
                }
                if (overheadRes.ok) {
                    setOverheadTypes(await overheadRes.json());
                }
                if (operationsRes.ok) {
                    setOperationTypes(await operationsRes.json());
                }
                if (forexRes && forexRes.ok) {
                    const forexData = await forexRes.json();
                    const liveRate = forexData.rates?.PHP;
                    if (liveRate) {
                        setSimulatedForexRate(parseFloat(liveRate.toFixed(2)));
                    }
                }
            } catch (e) {
                console.error("Failed to load metadata:", e);
                toast.error("Error loading brand, category, or UOM options");
            }
        }
        loadMetadata();
    }, []);

    // Load Catalog Products when Search Query changes
    useEffect(() => {
        async function loadCatalog() {
            setLoadingProducts(true);
            try {
                const query = new URLSearchParams();
                if (debouncedSearchQuery) query.append("search", debouncedSearchQuery);
                query.append("limit", "100");

                const res = await fetch(`/api/manufacturing/finished-goods/products?${query.toString()}`);
                if (!res.ok) throw new Error("Failed to fetch products");
                const data = await res.json();

                // Map to UI model
                const mapped: Product[] = data.map((p: BFFCatalogProduct) => ({
                    id: String(p.product_id),
                    sku: p.product_code || `SKU-${p.product_id}`,
                    title: p.product_name,
                    description: p.description || "",
                    barcode: p.barcode || "",
                    baseUom: p.unit_of_measurement?.unit_shortcut || "PCS",
                    expectedYieldPercent: 100,
                    targetSellingPrice: Number(p.price_per_unit || 0),
                    parentProduct: p.parent_id === null,
                    bom: [],
                    routings: [],
                    densityFactor: p.density_factor ? Number(p.density_factor) : 1.0,
                    product_brand: p.product_brand ? Number(p.product_brand) : undefined,
                    product_category: p.product_category ? Number(p.product_category) : undefined,
                    has_versions: !!p.has_versions
                }));

                setProducts(mapped);

                const exists = mapped.some((p: Product) => p.id === selectedProductId);
                if (!exists && mapped.length > 0) {
                    setSelectedProductId(mapped[0].id);
                }
            } catch (e) {
                console.error("Failed loading products catalog:", e);
                toast.error("Failed to fetch product catalog");
            } finally {
                setLoadingProducts(false);
            }
        }
        loadCatalog();
    }, [debouncedSearchQuery, selectedProductId]);

    // Load Versions when Selected Product changes
    useEffect(() => {
        if (!selectedProductId) return;
        const numericId = Number(selectedProductId);
        if (isNaN(numericId) || numericId <= 0) {
            setVersions([]);
            setSelectedVersionId(null);
            return;
        }

        async function loadVersions() {
            setLoadingBOM(true);
            try {
                const list = await fetchVersions(numericId);
                setVersions(list);
                if (list && list.length > 0) {
                    setSelectedVersionId(list[0].id);
                } else {
                    setSelectedVersionId(null);
                }
            } catch (e) {
                console.error("Failed loading product versions:", e);
                setVersions([]);
                setSelectedVersionId(null);
            } finally {
                setLoadingBOM(false);
            }
        }
        loadVersions();
    }, [selectedProductId]);

    // Load dynamic cost for each version when versions list changes
    useEffect(() => {
        if (versions.length === 0 || !selectedProductId) return;
        const numericId = Number(selectedProductId);


        async function loadAllVersionCosts() {
            const costs: Record<number, number> = {};
            // Run asynchronously in parallel to avoid blocking the main UI flow
            Promise.all(versions.map(async (v) => {
                try {
                    // Call a custom endpoint to get version cost without loading full details if possible, or handle silently
                    const res = await fetch(`/api/manufacturing/finished-goods/bom-cost?productId=${numericId}&versionId=${v.id}&forexRate=${simulatedForexRate}`);
                    if (res.ok) {
                        const costData = await res.json();
                        costs[v.id] = costData.cost;
                    } else {
                        costs[v.id] = 0;
                    }
                } catch {
                    costs[v.id] = 0;
                }
            })).then(() => {
                setVersionCosts(prev => ({ ...prev, ...costs }));
            });
        }
        loadAllVersionCosts();
    }, [versions, selectedProductId, simulatedForexRate]);


    // Load BOM & Routings when Selected Version or simulatedForexRate changes
    useEffect(() => {
        if (!selectedProductId || !selectedProduct) return;
        const numericId = Number(selectedProductId);
        if (isNaN(numericId) || numericId <= 0) return;

        if (selectedVersionId === null) {
            setActiveBOMId(null);
            setEditedBOM([]);
            setEditedRoutings([]);
            return;
        }

        async function loadRecipe() {
            setLoadingBOM(true);
            try {
                const details = await fetchBOMDetails(numericId, selectedVersionId!, simulatedForexRate);
                if (details) {
                    setActiveBOMId(details.bomId);
                    setEditedDetails({
                        sku: selectedProduct.sku,
                        title: selectedProduct.title,
                        description: selectedProduct.description,
                        barcode: selectedProduct.barcode,
                        baseUom: selectedProduct.baseUom,
                        expectedYieldPercent: details.expectedYieldPercent,
                        targetSellingPrice: selectedProduct.targetSellingPrice,
                        densityFactor: selectedProduct.densityFactor || 1.0,
                        product_brand: selectedProduct.product_brand,
                        product_category: selectedProduct.product_category,
                        customOverhead: details.customOverhead || 0
                    });
                    setEditedBOM(details.ingredients);
                    setEditedRoutings(details.routings);
                    setEditedOverheads(details.overheads || []);
                } else {
                    setActiveBOMId(null);
                    setEditedBOM([]);
                    setEditedRoutings([]);
                    setEditedOverheads([]);
                }
            } catch (e) {
                console.error("Failed to load BOM version details:", e);
            } finally {
                setLoadingBOM(false);
            }
        }
        loadRecipe();
    }, [selectedVersionId, selectedProductId, selectedProduct, simulatedForexRate]);


    // Handlers
    const handleRegisterProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!registerForm.title.trim() || !registerForm.sku.trim() || !registerForm.versionName.trim()) {
            toast.error("Please fill in Product Name, SKU, and Version Name.");
            return;
        }

        setSavingBOM(true);
        try {
            const matchedUnit = units.find(u => u.unit_shortcut === registerForm.baseUom);
            const unitId = matchedUnit ? matchedUnit.unit_id : (units[0]?.unit_id || 1);

            const brandVal = registerForm.brandId ? Number(registerForm.brandId) : undefined;
            const categoryVal = registerForm.categoryId ? Number(registerForm.categoryId) : undefined;

            const res = await registerProduct(
                {
                    product_name: registerForm.title.trim(),
                    product_code: registerForm.sku.trim(),
                    barcode: registerForm.barcode.trim(),
                    price_per_unit: Number(registerForm.targetSellingPrice) || 0,
                    density_factor: Number(registerForm.densityFactor) || 1.0,
                    unit_of_measurement: unitId,
                    product_brand: brandVal,
                    product_category: categoryVal
                },
                registerForm.versionName.trim()
            );

            if (res.success && res.productId) {
                toast.success(`Successfully registered "${registerForm.title}"!`);
                setIsRegisterModalOpen(false);

                // Reset registration form
                setRegisterForm({
                    title: "",
                    sku: "",
                    baseUom: "L",
                    targetSellingPrice: "",
                    barcode: "",
                    densityFactor: "1.0",
                    versionName: "v1.0",
                    brandId: "",
                    categoryId: ""
                });

                 // Reload products list
                const resList = await fetch("/api/manufacturing/finished-goods/products?limit=100");
                const dataList = await resList.json();
                setAllCatalogProducts(dataList);
                 const list: Product[] = dataList.map((p: BFFCatalogProduct) => ({
                    id: String(p.product_id),
                    sku: p.product_code || `SKU-${p.product_id}`,
                    title: p.product_name,
                    description: p.description || "",
                    barcode: p.barcode || "",
                    baseUom: p.unit_of_measurement?.unit_shortcut || "PCS",
                    expectedYieldPercent: 100,
                    targetSellingPrice: Number(p.price_per_unit || 0),
                    parentProduct: p.parent_id === null,
                    bom: [],
                    routings: [],
                    densityFactor: p.density_factor ? Number(p.density_factor) : 1.0,
                    product_brand: p.product_brand ? Number(p.product_brand) : undefined,
                    product_category: p.product_category ? Number(p.product_category) : undefined,
                    has_versions: !!p.has_versions
                }));
                setProducts(list);

                // Select new product & trigger version select
                setSelectedProductId(String(res.productId));
                const vList = await fetchVersions(res.productId);
                setVersions(vList);
                if (vList && vList.length > 0) {
                    setSelectedVersionId(vList[0].id);
                }

                // Switch tab straight to BOM
                setActiveTab("bom");
            }
        } catch (err) {
            console.error("Product registration error:", err);
            const error = err instanceof Error ? err : new Error(String(err));
            toast.error(error.message || "Failed to register product");
        } finally {
            setSavingBOM(false);
        }
    };

    const handleRegisterNewVersion = async () => {
        const numericId = Number(selectedProductId);
        if (isNaN(numericId) || numericId <= 0) {
            toast.error("Please select a product first.");
            return;
        }

        const name = prompt("Enter version registration name (e.g. OIL 2ND VERSION EASY MIX):");
        if (!name || !name.trim()) return;

        setSavingBOM(true);
        try {
            const res = await registerNewVersion(
                numericId,
                activeBOMId,
                editedDetails.expectedYieldPercent || 100,
                `BOM for ${selectedProduct.title}`,
                name.trim()
            );

            // Cast res.bom to any to avoid property access checks if it's untyped
            const bomObj = res.bom as { version?: { id: number } } | null;

            if (res.success && bomObj) {
                toast.success(`Successfully registered version "${name}"!`);
                const list = await fetchVersions(numericId);
                setVersions(list);
                setSelectedVersionId(bomObj.version?.id || Number(bomObj.version) || null);
            }
        } catch (e) {
            console.error("Version registration error:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to register new version");
        } finally {
            setSavingBOM(false);
        }
    };

    const handleSave = async () => {
        const numericProductId = Number(selectedProductId);
        if (isNaN(numericProductId) || numericProductId <= 0) {
            toast.error("Invalid product selected");
            return;
        }

        if (activeBOMId === null) {
            toast.error("No active version to save.");
            return;
        }

        setSavingBOM(true);
        try {
            const res = await saveBOMDetails(
                numericProductId,
                activeBOMId,
                {
                    title: editedDetails.title || "",
                    sku: editedDetails.sku || "",
                    barcode: editedDetails.barcode || "",
                    baseUom: editedDetails.baseUom || "L",
                    expectedYieldPercent: editedDetails.expectedYieldPercent || 100,
                    targetSellingPrice: editedDetails.targetSellingPrice || 0,
                    densityFactor: editedDetails.densityFactor || 1.0,
                    productBrand: editedDetails.product_brand,
                    productCategory: editedDetails.product_category,
                    customOverhead: editedDetails.customOverhead || 0
                },
                editedBOM,
                editedRoutings,
                editedOverheads
            );

            if (res.success) {
                setProducts(prev => prev.map(p => {
                    if (p.id === selectedProductId) {
                        return {
                            ...p,
                            sku: editedDetails.sku || p.sku,
                            title: editedDetails.title || p.title,
                            description: editedDetails.description || p.description,
                            barcode: editedDetails.barcode || p.barcode,
                            baseUom: editedDetails.baseUom || p.baseUom,
                            expectedYieldPercent: editedDetails.expectedYieldPercent || p.expectedYieldPercent,
                            targetSellingPrice: editedDetails.targetSellingPrice || p.targetSellingPrice,
                            densityFactor: editedDetails.densityFactor || p.densityFactor,
                            product_brand: editedDetails.product_brand,
                            product_category: editedDetails.product_category,
                            customOverhead: editedDetails.customOverhead
                        };
                    }
                    return p;
                }));

                const vList = await fetchVersions(numericProductId);
                setVersions(vList);
                toast.success("Finished good configuration saved successfully!");
            }
        } catch (err) {
            console.error("Save error:", err);
            const error = err instanceof Error ? err : new Error(String(err));
            toast.error(error.message || "Error saving configuration");
        } finally {
            setSavingBOM(false);
        }
    };

    const handleCreateBrand = async (name: string): Promise<number | undefined> => {
        try {
            const res = await createBrand(name);
            if (res.success && res.brand) {
                toast.success(`Brand "${name}" created successfully!`);
                setBrands(prev => [...prev, res.brand].sort((a, b) => a.brand_name.localeCompare(b.brand_name)));
                return res.brand.brand_id;
            }
        } catch (e) {
            console.error("Failed to create brand:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to create brand");
        }
    };

    const handleCreateCategory = async (name: string): Promise<number | undefined> => {
        try {
            const res = await createCategory(name);
            if (res.success && res.category) {
                toast.success(`Category "${name}" created successfully!`);
                setCategories(prev => [...prev, res.category].sort((a, b) => a.category_name.localeCompare(b.category_name)));
                return res.category.category_id;
            }
        } catch (e) {
            console.error("Failed to create category:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to create category");
        }
    };

    return {
        handleCreateBrand,
        handleCreateCategory,
        activeTab,
        setActiveTab,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        brands,
        categories,
        units,
        loadingProducts,
        loadingBOM,
        savingBOM,
        products,
        setProducts,
        allCatalogProducts,
        selectedProductId,
        setSelectedProductId,
        selectedProduct,
        searchQuery,
        setSearchQuery,
        versions,
        setVersions,
        versionCosts,
        selectedVersionId,
        setSelectedVersionId,
        activeBOMId,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        registerForm,
        setRegisterForm,
        editedDetails,
        setEditedDetails,
        editedBOM,
        setEditedBOM,
        editedRoutings,
        setEditedRoutings,
        editedOverheads,
        setEditedOverheads,
        overheadTypes,
        setOverheadTypes,
        operationTypes,
        setOperationTypes,
        simulatedForexRate,
        setSimulatedForexRate,
        handleRegisterProduct,
        handleRegisterNewVersion,
        handleSave
    };
}


