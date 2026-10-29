// Run from the project root. Credentials stay in the local process, never in output.
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'node:fs/promises';
process.loadEnvFile('.env.local');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = 'module04-qa-assets';
const folder = new URL('./assets/', import.meta.url);
const source = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const response = await fetch(source);
if (!response.ok) throw new Error('Could not retrieve the public CC0 test video.');
await writeFile(new URL('flower.mp4', folder), new Uint8Array(await response.arrayBuffer()));
const existing = await client.storage.getBucket(bucket);
if (existing.error) {
  const created = await client.storage.createBucket(bucket, { public: true, fileSizeLimit: 10_000_000 });
  if (created.error) throw new Error('Could not create the dedicated synthetic-assets bucket.');
}
const types = {
  'portrait.pdf': 'application/pdf', 'landscape.pdf': 'application/pdf', 'scanned.pdf': 'application/pdf',
  'fillable.pdf': 'application/pdf', 'multipage.pdf': 'application/pdf', 'flower.mp4': 'video/mp4',
  'audio.wav': 'audio/wav', 'diagram.png': 'image/png', 'notes.txt': 'text/plain', 'reference.zip': 'application/zip',
};
const assets = [];
for (const [name, contentType] of Object.entries(types)) {
  const file = await readFile(new URL(name, folder));
  const path = `v1/${name}`;
  const uploaded = await client.storage.from(bucket).upload(path, file, { contentType, cacheControl: '3600', upsert: true });
  if (uploaded.error) throw new Error(`Upload failed for ${name}.`);
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  const check = await fetch(data.publicUrl, { method: 'HEAD' });
  if (!check.ok) throw new Error(`Read-back failed for ${name}.`);
  assets.push({ name, path, url: data.publicUrl, bytes: file.length, status: check.status,
    contentType: check.headers.get('content-type'), cacheControl: check.headers.get('cache-control') });
}
await writeFile(new URL('./asset-upload-results.json', import.meta.url), JSON.stringify({ bucket, source, assets }, null, 2));
console.log(JSON.stringify({ bucket, assets: assets.map(({ name, bytes, status }) => ({ name, bytes, status })) }));
