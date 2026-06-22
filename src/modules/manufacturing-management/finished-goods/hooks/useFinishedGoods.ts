import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { Product, ProductVersion, Brand, Category, Unit, BOMItem, RoutingStep, ProductOverhead, BFFCatalogProduct, OperationType, OverheadType, Supplier, ProductClass, ProductSegment, ProductSection } from "../types";
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
    createCategory,
    fetchClasses,
    fetchSegments,
    fetchSections,
    createSegment,
    createClass,
    createSection
} from "../services/finished-goods-api";

export function useFinishedGoods(initialTab: string = "details") {
    // UI Layout & Tab States
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Metadata tables
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [classes, setClasses] = useState<ProductClass[]>([]);
    const [segments, setSegments] = useState<ProductSegment[]>([]);
    const [sections, setSections] = useState<ProductSection[]>([]);
    const [overheadTypes, setOverheadTypes] = useState<OverheadType[]>([]);
    const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
    const [simulatedForexRate, setSimulatedForexRate] = useState<number>(61.39);
    const [debouncedForexRate] = useDebounce(simulatedForexRate, 300);


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
        categoryId: "",
        description: "",
        costPerUnit: "",
        uomCount: "0",
        classId: "",
        segmentId: "",
        sectionId: "",
        shelfLife: "",
        productImage: "",
        parentId: "",
        productionCapacityPerHour: "",
        supplierIds: [] as string[]
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
                const [bList, cList, uList, prodRes, overheadRes, operationsRes, forexRes, supRes, classesList, segmentsList, sectionsList] = await Promise.all([
                    fetchBrands(),
                    fetchCategories(),
                    fetchUnits(),
                    fetch("/api/manufacturing/finished-goods/products?limit=100"),
                    fetch("/api/manufacturing/finished-goods/overhead-types"),
                    fetch("/api/manufacturing/finished-goods/operations"),
                    fetch("https://open.er-api.com/v6/latest/USD").catch(() => null),
                    fetch("/api/manufacturing/procurement/suppliers"),
                    fetchClasses().catch(() => []),
                    fetchSegments().catch(() => []),
                    fetchSections().catch(() => [])
                ]);
                setBrands(bList);
                setCategories(cList);
                setUnits(uList);
                setClasses(classesList);
                setSegments(segmentsList);
                setSections(sectionsList);
                if (supRes && supRes.ok) {
                    setSuppliers(await supRes.json());
                }
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

                // Map to UI model (only show finished goods which have versions)
                const finishedGoods = data.filter((p: BFFCatalogProduct) => !!p.has_versions);
                const mapped: Product[] = finishedGoods.map((p: BFFCatalogProduct) => {
                    const parentId = p.parent_id && typeof p.parent_id === "object"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ? Number((p.parent_id as any).product_id)
                        : (p.parent_id ? Number(p.parent_id) : null);
                    return {
                        id: String(p.product_id),
                        sku: p.product_code || `SKU-${p.product_id}`,
                        title: p.product_name,
                        description: p.description || "",
                        barcode: p.barcode || "",
                        baseUom: p.unit_of_measurement?.unit_shortcut || "PCS",
                        expectedYieldPercent: 100,
                        targetSellingPrice: Number(p.price_per_unit || 0),
                        parentProduct: parentId === null,
                        parent_id: parentId,
                        bom: [],
                        routings: [],
                        densityFactor: p.density_factor ? Number(p.density_factor) : 1.0,
                        product_brand: p.product_brand ? Number(p.product_brand) : undefined,
                        product_category: p.product_category ? Number(p.product_category) : undefined,
                        product_class: p.product_class ? Number(p.product_class) : undefined,
                        product_segment: p.product_segment ? Number(p.product_segment) : undefined,
                        product_section: p.product_section ? Number(p.product_section) : undefined,
                        product_shelf_life: p.product_shelf_life ? Number(p.product_shelf_life) : undefined,
                        cost_per_unit: p.cost_per_unit ? Number(p.cost_per_unit) : undefined,
                        unit_of_measurement_count: p.unit_of_measurement_count ? Number(p.unit_of_measurement_count) : undefined,
                        product_image: p.product_image || undefined,
                        production_capacity_per_hour: p.production_capacity_per_hour ? Number(p.production_capacity_per_hour) : undefined,
                        has_versions: !!p.has_versions
                    };
                });

                setProducts(mapped);

                if (mapped.length > 0) {
                    setSelectedProductId(prev => {
                        const exists = mapped.some((p: Product) => p.id === prev);
                        return exists ? prev : mapped[0].id;
                    });
                }
            } catch (e) {
                console.error("Failed loading products catalog:", e);
                toast.error("Failed to fetch product catalog");
            } finally {
                setLoadingProducts(false);
            }
        }
        loadCatalog();
    }, [debouncedSearchQuery]);

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
                    const res = await fetch(`/api/manufacturing/finished-goods/bom-cost?productId=${numericId}&versionId=${v.id}&forexRate=${debouncedForexRate}`);
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
    }, [versions, selectedProductId, debouncedForexRate]);


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
                const details = await fetchBOMDetails(numericId, selectedVersionId!, debouncedForexRate);
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
                        product_class: selectedProduct.product_class,
                        product_segment: selectedProduct.product_segment,
                        product_section: selectedProduct.product_section,
                        product_shelf_life: selectedProduct.product_shelf_life,
                        cost_per_unit: selectedProduct.cost_per_unit,
                        unit_of_measurement_count: selectedProduct.unit_of_measurement_count,
                        product_image: selectedProduct.product_image,
                        parent_id: selectedProduct.parent_id,
                        customOverhead: details.customOverhead || 0,
                        production_capacity_per_hour: selectedProduct.production_capacity_per_hour || 0
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
    }, [selectedVersionId, selectedProductId, selectedProduct, simulatedForexRate, debouncedForexRate]);


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
            const classVal = registerForm.classId ? Number(registerForm.classId) : undefined;
            const segmentVal = registerForm.segmentId ? Number(registerForm.segmentId) : undefined;
            const sectionVal = registerForm.sectionId ? Number(registerForm.sectionId) : undefined;
            const shelfLifeVal = registerForm.shelfLife ? Number(registerForm.shelfLife) : undefined;
            const uomCountVal = registerForm.uomCount ? Number(registerForm.uomCount) : 0;
            const costPerUnitVal = registerForm.costPerUnit ? Number(registerForm.costPerUnit) : 0;

            const res = await registerProduct(
                {
                    product_name: registerForm.title.trim(),
                    product_code: registerForm.sku.trim(),
                    description: registerForm.description.trim(),
                    barcode: registerForm.barcode.trim(),
                    price_per_unit: Number(registerForm.targetSellingPrice) || 0,
                    cost_per_unit: costPerUnitVal,
                    density_factor: Number(registerForm.densityFactor) || 1.0,
                    unit_of_measurement: unitId,
                    unit_of_measurement_count: uomCountVal,
                    product_brand: brandVal,
                    product_category: categoryVal,
                    product_class: classVal,
                    product_segment: segmentVal,
                    product_section: sectionVal,
                    product_shelf_life: shelfLifeVal,
                    product_image: registerForm.productImage || undefined,
                    parent_id: registerForm.parentId ? Number(registerForm.parentId) : null,
                    production_capacity_per_hour: Number(registerForm.productionCapacityPerHour) || 0
                },
                registerForm.versionName.trim(),
                registerForm.supplierIds.map(Number)
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
                    categoryId: "",
                    description: "",
                    costPerUnit: "",
                    uomCount: "0",
                    classId: "",
                    segmentId: "",
                    sectionId: "",
                    shelfLife: "",
                    productImage: "",
                    parentId: "",
                    productionCapacityPerHour: "",
                    supplierIds: [] as string[]
                });

                 // Reload products list
                const resList = await fetch("/api/manufacturing/finished-goods/products?limit=100");
                const dataList = await resList.json();
                setAllCatalogProducts(dataList);
                  const list: Product[] = dataList.map((p: BFFCatalogProduct) => {
                     const parentId = p.parent_id && typeof p.parent_id === "object"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                         ? Number((p.parent_id as any).product_id)
                         : (p.parent_id ? Number(p.parent_id) : null);
                     return {
                        id: String(p.product_id),
                        sku: p.product_code || `SKU-${p.product_id}`,
                        title: p.product_name,
                        description: p.description || "",
                        barcode: p.barcode || "",
                        baseUom: p.unit_of_measurement?.unit_shortcut || "PCS",
                        expectedYieldPercent: 100,
                        targetSellingPrice: Number(p.price_per_unit || 0),
                        parentProduct: parentId === null,
                        parent_id: parentId,
                        bom: [],
                        routings: [],
                        densityFactor: p.density_factor ? Number(p.density_factor) : 1.0,
                        product_brand: p.product_brand ? Number(p.product_brand) : undefined,
                        product_category: p.product_category ? Number(p.product_category) : undefined,
                        product_class: p.product_class ? Number(p.product_class) : undefined,
                        product_segment: p.product_segment ? Number(p.product_segment) : undefined,
                        product_section: p.product_section ? Number(p.product_section) : undefined,
                        product_shelf_life: p.product_shelf_life ? Number(p.product_shelf_life) : undefined,
                        cost_per_unit: p.cost_per_unit ? Number(p.cost_per_unit) : undefined,
                        unit_of_measurement_count: p.unit_of_measurement_count ? Number(p.unit_of_measurement_count) : undefined,
                        product_image: p.product_image || undefined,
                        production_capacity_per_hour: p.production_capacity_per_hour ? Number(p.production_capacity_per_hour) : undefined,
                        has_versions: !!p.has_versions
                     };
                  });
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
                    description: editedDetails.description || "",
                    costPerUnit: editedDetails.cost_per_unit || 0,
                    unitOfMeasurementCount: editedDetails.unit_of_measurement_count || 0,
                    productClass: editedDetails.product_class,
                    productSegment: editedDetails.product_segment,
                    productSection: editedDetails.product_section,
                    productShelfLife: editedDetails.product_shelf_life,
                    productImage: editedDetails.product_image,
                    parent_id: editedDetails.parent_id !== undefined ? (editedDetails.parent_id ? Number(editedDetails.parent_id) : null) : null,
                    customOverhead: editedDetails.customOverhead || 0,
                    productionCapacityPerHour: editedDetails.production_capacity_per_hour
                },
                editedBOM,
                editedRoutings,
                editedOverheads
            );
 
            if (res.success) {
                setProducts(prev => prev.map(p => {
                    if (p.id === selectedProductId) {
                        const updatedParentId = editedDetails.parent_id !== undefined ? (editedDetails.parent_id ? Number(editedDetails.parent_id) : null) : p.parent_id;
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
                            product_class: editedDetails.product_class,
                            product_segment: editedDetails.product_segment,
                            product_section: editedDetails.product_section,
                            product_shelf_life: editedDetails.product_shelf_life,
                            cost_per_unit: editedDetails.cost_per_unit,
                            unit_of_measurement_count: editedDetails.unit_of_measurement_count,
                            product_image: editedDetails.product_image,
                            parent_id: updatedParentId,
                            parentProduct: updatedParentId === null,
                            customOverhead: editedDetails.customOverhead,
                            production_capacity_per_hour: editedDetails.production_capacity_per_hour !== undefined ? editedDetails.production_capacity_per_hour : p.production_capacity_per_hour
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

    const handleCreateSegment = async (name: string): Promise<number | undefined> => {
        try {
            const res = await createSegment(name);
            if (res.success && res.segment) {
                toast.success(`Segment "${name}" created successfully!`);
                setSegments(prev => [...prev, res.segment].sort((a, b) => a.segment_name.localeCompare(b.segment_name)));
                return res.segment.segment_id;
            }
        } catch (e) {
            console.error("Failed to create segment:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to create segment");
        }
    };

    const handleCreateClass = async (name: string): Promise<number | undefined> => {
        try {
            const res = await createClass(name);
            if (res.success && res.class) {
                toast.success(`Class "${name}" created successfully!`);
                setClasses(prev => [...prev, res.class].sort((a, b) => a.class_name.localeCompare(b.class_name)));
                return res.class.class_id;
            }
        } catch (e) {
            console.error("Failed to create class:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to create class");
        }
    };

    const handleCreateSection = async (name: string): Promise<number | undefined> => {
        try {
            const res = await createSection(name);
            if (res.success && res.section) {
                toast.success(`Section "${name}" created successfully!`);
                setSections(prev => [...prev, res.section].sort((a, b) => a.section_name.localeCompare(b.section_name)));
                return res.section.section_id;
            }
        } catch (e) {
            console.error("Failed to create section:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to create section");
        }
    };

    return {
        handleCreateBrand,
        handleCreateCategory,
        handleCreateSegment,
        handleCreateClass,
        handleCreateSection,
        activeTab,
        setActiveTab,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        brands,
        categories,
        units,
        suppliers,
        classes,
        segments,
        sections,
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


