const url = process.env.SYNC_URL;
const token = process.env.SYNC_TOKEN;
if (!url || !token) throw new Error('Set SYNC_URL and SYNC_TOKEN to trigger the sync Worker.');
if (process.argv.length > 2) throw new Error('A sync run covers all configured datasources.');

const response = await fetch(new URL('/sync', url), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Could not trigger sync: HTTP ${response.status}.`);
console.log(await response.json());
