const https = require('https');

const VERCEL_URL = process.env.VERCEL_URL || 'https://admin-chohopark.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('CRON_SECRET is not set');
  process.exit(1);
}

const url = new URL('/api/cron/sms', VERCEL_URL);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json'
  }
};

console.log(`[${new Date().toISOString()}] Triggering SMS cron...`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
    process.exit(res.statusCode >= 500 ? 1 : 0);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.end();
