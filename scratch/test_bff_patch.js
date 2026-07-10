const http = require('http');

async function main() {
    try {
        const payload = {
            productId: 25506, // Canolein Oil
            productDetails: {
                product_name: "Canolein Oil",
                product_code: "RM-C",
                description: "Updated description via automated BFF test " + Date.now(),
                unit_of_measurement: 2, // Grams (valid)
                density_factor: 0.92,
                product_category: 328, // Valid category
                product_type: 389
            },
            supplierIds: [2]
        };

        const urlObj = new URL("http://localhost:3000/api/manufacturing/procurement/raw-materials");
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 3000,
            path: urlObj.pathname,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log("BFF PATCH Status:", res.statusCode);
                console.log("BFF PATCH Response:", data);
            });
        });
        req.write(JSON.stringify(payload));
        req.end();
    } catch (e) {
        console.error("BFF PATCH Error:", e);
    }
}

main();
