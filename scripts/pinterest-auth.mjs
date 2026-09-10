#!/usr/bin/env node
// One-time OAuth authorization for the Pinterest app → writes a write-capable token to .env.
// The token generator in the Pinterest developer console only issues read scopes;
// pins:write and boards:write are only granted through this OAuth flow.
//
// Prerequisites in .env:
//   PINTEREST_APP_ID=…        numeric App ID from developers.pinterest.com → your app
//   PINTEREST_APP_SECRET=…    App secret key (40 hex chars)
// Prerequisite in the app settings (developers.pinterest.com → app → Configure → Redirect URIs):
//   http://localhost:8085/callback
//
//   node scripts/pinterest-auth.mjs            start local callback server + print authorize URL
//   node scripts/pinterest-auth.mjs --code X   exchange a code manually (if the redirect did not reach localhost)
//   node scripts/pinterest-auth.mjs --refresh  refresh the access token using PINTEREST_REFRESH_TOKEN

import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {exec} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = resolve(root, '.env');
const SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
const PORT = 8085;
const REDIRECT = `http://localhost:${PORT}/callback`;

async function readEnv() {
  const env = {};
  if (!existsSync(ENV)) return env;
  for (const line of (await readFile(ENV, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function writeEnv(updates) {
  let text = existsSync(ENV) ? await readFile(ENV, 'utf8') : '';
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : text.replace(/\n?$/, '\n') + `${k}=${v}\n`;
  }
  await writeFile(ENV, text);
}

async function tokenRequest(env, params) {
  const id = env.PINTEREST_APP_ID, secret = env.PINTEREST_APP_SECRET || env.PINTEREST;
  if (!id || !secret) throw new Error('Set PINTEREST_APP_ID and PINTEREST_APP_SECRET in .env first.');
  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token request failed (HTTP ${res.status}): ${data.message || JSON.stringify(data)}`);
  return data;
}

async function saveToken(data) {
  const updates = {PINTEREST_TOKEN: data.access_token};
  if (data.refresh_token) updates.PINTEREST_REFRESH_TOKEN = data.refresh_token;
  if (data.expires_in) updates.PINTEREST_TOKEN_EXPIRES = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await writeEnv(updates);
  console.log(`Saved PINTEREST_TOKEN to .env (scopes: ${data.scope || SCOPES}; expires ${updates.PINTEREST_TOKEN_EXPIRES || 'unknown'}).`);
  console.log('Now run: node scripts/pinterest.mjs boards');
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

const env = await readEnv();

if (process.argv.includes('--refresh')) {
  if (!env.PINTEREST_REFRESH_TOKEN) throw new Error('No PINTEREST_REFRESH_TOKEN in .env. Run the full authorization first.');
  const data = await tokenRequest(env, {grant_type: 'refresh_token', refresh_token: env.PINTEREST_REFRESH_TOKEN, scope: SCOPES});
  await saveToken(data);
  process.exit(0);
}

const manualCode = argValue('--code');
if (manualCode) {
  const data = await tokenRequest(env, {grant_type: 'authorization_code', code: manualCode, redirect_uri: REDIRECT});
  await saveToken(data);
  process.exit(0);
}

if (!env.PINTEREST_APP_ID) {
  console.error('Add PINTEREST_APP_ID (and PINTEREST_APP_SECRET) to .env first. Both are on the app page at developers.pinterest.com.');
  process.exit(1);
}

const state = randomBytes(12).toString('hex');
const authorizeUrl = 'https://www.pinterest.com/oauth/?' + new URLSearchParams({
  client_id: env.PINTEREST_APP_ID, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPES, state
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  if (url.searchParams.get('state') !== state || !code) {
    res.writeHead(400, {'Content-Type': 'text/plain'}).end('Invalid callback. Check the terminal.');
    console.error('Callback without a valid code/state:', url.search);
    return;
  }
  try {
    const data = await tokenRequest(env, {grant_type: 'authorization_code', code, redirect_uri: REDIRECT});
    await saveToken(data);
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}).end('<h2>Pinterest authorized. You can close this tab.</h2>');
  } catch (e) {
    console.error(e.message);
    res.writeHead(500, {'Content-Type': 'text/plain'}).end(e.message);
  } finally {
    setTimeout(() => server.close(() => process.exit(0)), 300);
  }
});

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT}`);
  console.log('Make sure this exact Redirect URI is saved in the Pinterest app settings.\n');
  console.log('Open this URL in your browser and approve access for the Cake quote kit account:\n');
  console.log(authorizeUrl + '\n');
  if (process.platform === 'darwin') exec(`open "${authorizeUrl}"`);
  console.log('Waiting for Pinterest to redirect back… (Ctrl+C to abort)');
  console.log(`If the browser shows a connection error, copy the "code=" value from its address bar and run:\n  node scripts/pinterest-auth.mjs --code <code>`);
});
