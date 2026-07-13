/* eslint-disable */
const http = require('http');

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://vtc:8074';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || 'test';

async function testPost() {
    try {
        const payload = {
            product_name: "Test Canolein Base Oil API " + Date.now(),
            product_code: "RM-TEST-" + Math.floor(Math.random() * 10000),
            description: "Test description",
            unit_of_measurement: 1, // e.g. grams/kg
            density_factor: 0.92,
            product_category: 1, // e.g. oil
            product_type: 389, // raw material
            isActive: 1,
            status: "Approved",
            item_type: "regular"
        };

        const urlObj = new URL(`${DIRECTUS_URL}/items/products?fields=product_id`);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DIRECTUS_TOKEN}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log("POST Status:", res.statusCode);
                console.log("POST Response:", data);
            });
        });
        req.write(JSON.stringify(payload));
        req.end();
    } catch (e) {
        console.error("POST Error:", e);
    }
}

testPost();
