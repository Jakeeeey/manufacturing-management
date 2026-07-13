/* eslint-disable */
const http = require('http');

async function main() {
    try {
        const urlString = "http://localhost:3000/api/manufacturing/finished-goods/products?limit=250";
        console.log("Fetching URL:", urlString);
        
        const urlObj = new URL(urlString);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log("Status:", res.statusCode);
                console.log("Headers:", res.headers);
                console.log("Response:", data.substring(0, 1000));
            });
        });
        req.end();
    } catch (e) {
        console.error(e);
    }
}
main();
