/* eslint-disable */
const http = require('http');

async function main() {
    try {
        const payload = {
            productDetails: {
                product_name: "Test Canolein Parent Oil " + Date.now(),
                product_code: "RM-PAR-" + Math.floor(Math.random() * 10000),
                description: "Test parent description",
                unit_of_measurement: 2, // Grams (valid)
                density_factor: 0.92,
                product_category: 328, // Valid category
                product_type: 389,
                unit_of_measurement_count: 1
            },
            supplierIds: [2],
            packagingVariants: [
                {
                    product_name: "Test Canolein Parent Oil " + Date.now() + " (Bag of 25 kg)",
                    product_code: "RM-PAR-" + Math.floor(Math.random() * 10000) + "-BAG25",
                    unit_of_measurement: 1, // Bag UOM (valid)
                    unit_of_measurement_count: 25,
                    density_factor: 0.92,
                    product_category: 328,
                    product_type: 389
                }
            ]
        };

        const urlObj = new URL("http://localhost:3000/api/manufacturing/procurement/raw-materials");
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 3000,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log("BFF POST Status:", res.statusCode);
                console.log("BFF POST Response:", data);
            });
        });
        req.write(JSON.stringify(payload));
        req.end();
    } catch (e) {
        console.error("BFF POST Error:", e);
    }
}

main();
