const DIRECTUS_URL = "http://vtc:8074";
const headers = {
    "Authorization": "Bearer test",
    "Content-Type": "application/json"
};

async function printBOM(productId) {
    const pRes = await fetch(`${DIRECTUS_URL}/items/products/${productId}?fields=product_id,product_code,product_name`, { headers });
    const prod = pRes.ok ? (await pRes.json()).data : {};
    console.log(`\n==================================================`);
    console.log(`Product: ID=${prod.product_id}, Code=${prod.product_code}, Name=${prod.product_name}`);

    // Get active version
    const verFilter = encodeURIComponent(JSON.stringify({
        product_id: { _eq: productId },
        status: { _eq: "Active" }
    }));
    const verRes = await fetch(`${DIRECTUS_URL}/items/product_manufacturing_version?filter=${verFilter}&limit=1`, { headers });
    const versions = verRes.ok ? (await verRes.json()).data || [] : [];
    if (versions.length === 0) {
        console.log("No active manufacturing version found.");
        return;
    }
    const version = versions[0];
    console.log(`Active Version: ID=${version.version_id}, Name=${version.version_name}, Base Qty=${version.base_quantity}`);

    // Fetch routing steps
    const routesFilter = encodeURIComponent(JSON.stringify({ version_id: { _eq: version.version_id } }));
    const routesRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes?filter=${routesFilter}&sort=sequence_order&limit=-1`, { headers });
    const routes = routesRes.ok ? (await routesRes.json()).data || [] : [];

    const routeIds = routes.map(r => r.route_id);
    if (routeIds.length === 0) return;

    // Fetch BOM items
    const bomFilter = encodeURIComponent(JSON.stringify({ route_id: { _in: routeIds } }));
    const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom?filter=${bomFilter}&limit=-1`, { headers });
    const bomItems = bomRes.ok ? (await bomRes.json()).data || [] : [];

    console.log("\nBOM Components:");
    for (const item of bomItems) {
        const componentRes = await fetch(`${DIRECTUS_URL}/items/products/${item.product_id}?fields=product_id,product_code,product_name,unit_of_measurement.unit_shortcut`, { headers });
        const comp = componentRes.ok ? (await componentRes.json()).data : {};
        
        // Check if this component has an active version (meaning it is a sub-assembly)
        const subVerFilter = encodeURIComponent(JSON.stringify({ product_id: { _eq: item.product_id }, status: { _eq: "Active" } }));
        const subVerRes = await fetch(`${DIRECTUS_URL}/items/product_manufacturing_version?filter=${subVerFilter}&limit=1`, { headers });
        const subVersions = subVerRes.ok ? (await subVerRes.json()).data || [] : [];
        const isSubAssembly = subVersions.length > 0;

        console.log(`- Component ID: ${item.product_id} (${comp.product_code}) - ${comp.product_name}`);
        console.log(`  Qty required: ${item.quantity_required} per ${version.base_quantity}`);
        console.log(`  Type: ${isSubAssembly ? "Sub-Assembly" : "Raw Material"}`);
        
        if (isSubAssembly) {
            await printBOM(item.product_id);
        }
    }
}

async function main() {
    await printBOM(25564); // PROD-003-500-BOX
}

main().catch(console.error);
