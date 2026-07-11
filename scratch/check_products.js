/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://vtc:8074';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || 'test';

async function main() {
    try {
        const urlString = `${DIRECTUS_URL}/items/products/25527?fields=product_id,product_name,parent_id`;
        console.log("Fetching URL:", urlString);
        
        const urlObj = new URL(urlString);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DIRECTUS_TOKEN}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log("Status:", res.statusCode);
                console.log(data);
            });
        });
        req.end();
    } catch (e) {
        console.error(e);
    }
}
main();
