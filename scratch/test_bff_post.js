/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');

async function main() {
    try {
        const payload = {
            productDetails: {
                product_name: "Test Canolein BFF Oil " + Date.now(),
                product_code: "RM-BFF-" + Math.floor(Math.random() * 10000),
                description: "Test description",
                unit_of_measurement: 1, 
                density_factor: 0.92,
                product_category: 1, 
                product_type: 389,
            },
            supplierIds: [2]
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
