#!/usr/bin/env node
// Pinterest publishing CLI for the Cake Quote Kit account.
// Reads PINTEREST_TOKEN from ./.env (never committed). Uses Pinterest API v5.
//
//   node scripts/pinterest.mjs me                      account summary
//   node scripts/pinterest.mjs boards                  list boards with ids
//   node scripts/pinterest.mjs pins [boardId]          list pins on a board (default: first board)
//   node scripts/pinterest.mjs publish <queue.json> [--dry-run] [--limit N] [--id pin01] [--create-boards]
//                                                      create pins from a queue file; marks published entries
//   node scripts/pinterest.mjs delete <pinId>          delete a pin
//
// Queue entry shape (docs/pins/queue.json):
//   {"id":"pin01","board":"Cake calculator","title":"…","description":"…","link":"https://…",
//    "alt_text":"…","image":"docs/pins/pin01.png" | "image_url":"https://…", "published_id":null}

import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.pinterest.com/v5';

async function loadEnv() {
  const file = resolve(root, '.env');
  if (!existsSync(file)) return;
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
  }
}

async function api(path, {method = 'GET', body} = {}) {
  const token = process.env.PINTEREST_TOKEN;
  if (!token) throw new Error('PINTEREST_TOKEN is missing. Add it to .env');
  const res = await fetch(API + path, {
    method,
    headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {raw: text}; }
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${data.message || text}`);
  return data;
}

async function allBoards() {
  const out = [];
  let bookmark;
  do {
    const q = bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : '';
    const page = await api(`/boards?page_size=100${q}`);
    out.push(...page.items);
    bookmark = page.bookmark;
  } while (bookmark);
  return out;
}

const BOARD_DESCRIPTIONS = {
  'Cake Pricing & Profit': 'How to price custom cakes so the quote covers ingredients, working time, overheads, payment fees and a real margin. Free cake pricing calculator.',
  'Cake Business Checklists': 'Printable checklists for home bakers and cake businesses: what to count before you send a cake quote.',
  'Home Bakery Templates': 'Excel templates for cake makers: pricing, printable quotes, ingredient stock, shopping lists and order tracking.'
};

async function boardId(nameOrId, boards, {create = false} = {}) {
  if (/^\d+$/.test(nameOrId)) return nameOrId;
  const list = boards || await allBoards();
  const b = list.find(x => x.name.toLowerCase() === nameOrId.toLowerCase());
  if (b) return b.id;
  if (!create) throw new Error(`Board "${nameOrId}" not found (run with --create-boards to create it)`);
  const made = await api('/boards', {method: 'POST', body: {name: nameOrId, description: BOARD_DESCRIPTIONS[nameOrId] || '', privacy: 'PUBLIC'}});
  list.push(made);
  console.log(`created board "${nameOrId}" → ${made.id}`);
  return made.id;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
}
const flag = name => process.argv.includes(name);

const mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'};

async function mediaSource(entry) {
  if (entry.image_url) return {source_type: 'image_url', url: entry.image_url};
  if (entry.image) {
    const file = resolve(root, entry.image);
    if (!existsSync(file)) throw new Error(`Image not found: ${entry.image}`);
    const type = mime[extname(file).toLowerCase()];
    if (!type) throw new Error(`Unsupported image type: ${entry.image}`);
    return {source_type: 'image_base64', content_type: type, data: (await readFile(file)).toString('base64')};
  }
  throw new Error('Entry needs "image" (local file) or "image_url"');
}

function validate(entry) {
  const problems = [];
  if (!entry.title || entry.title.length > 100) problems.push('title missing or >100 chars');
  if (entry.description && entry.description.length > 800) problems.push('description >800 chars');
  if (!entry.link || !/^https:\/\//.test(entry.link)) problems.push('link must be https');
  if (entry.alt_text && entry.alt_text.length > 500) problems.push('alt_text >500 chars');
  if (!entry.image && !entry.image_url) problems.push('no image');
  if (entry.image && !existsSync(resolve(root, entry.image))) problems.push(`image file missing (${entry.image})`);
  if (!entry.board) problems.push('no board');
  return problems;
}

const commands = {
  async me() {
    const u = await api('/user_account');
    console.log(`${u.business_name || u.username} (@${u.username}) · ${u.account_type} · ${u.board_count} boards · ${u.pin_count} pins · ${u.website_url}`);
  },

  async boards() {
    for (const b of await allBoards()) console.log(`${b.id}  ${b.name}  (${b.pin_count} pins, ${b.privacy})`);
  },

  async pins() {
    const boards = await allBoards();
    const id = process.argv[3] ? await boardId(process.argv[3], boards) : boards[0].id;
    const page = await api(`/boards/${id}/pins?page_size=100`);
    for (const p of page.items) console.log(`${p.id}  ${p.created_at.slice(0, 10)}  ${p.title}\n    ${p.link}`);
    if (!page.items.length) console.log('(no pins)');
  },

  async publish() {
    const queueFile = process.argv[3];
    if (!queueFile) throw new Error('Usage: publish <queue.json> [--dry-run] [--limit N] [--id pinXX]');
    const path = resolve(root, queueFile);
    const queue = JSON.parse(await readFile(path, 'utf8'));
    const dry = flag('--dry-run');
    const limit = Number(arg('--limit', Infinity));
    const only = arg('--id', null);
    const boards = dry ? null : await allBoards();

    let done = 0;
    for (const entry of queue) {
      if (only && entry.id !== only) continue;
      if (entry.published_id) { console.log(`skip ${entry.id}: already published as ${entry.published_id}`); continue; }
      if (done >= limit) break;
      const problems = validate(entry);
      if (problems.length) { console.log(`skip ${entry.id}: ${problems.join(', ')}`); continue; }
      if (dry) { console.log(`would publish ${entry.id}: "${entry.title}" → ${entry.link} [${entry.image || entry.image_url}]`); done++; continue; }

      const body = {
        board_id: await boardId(entry.board, boards, {create: flag('--create-boards')}),
        title: entry.title,
        description: entry.description || '',
        link: entry.link,
        alt_text: entry.alt_text || entry.title,
        media_source: await mediaSource(entry)
      };
      const pin = await api('/pins', {method: 'POST', body});
      entry.published_id = pin.id;
      entry.published_at = new Date().toISOString();
      await writeFile(path, JSON.stringify(queue, null, 2) + '\n');
      console.log(`published ${entry.id} → ${pin.id}  https://www.pinterest.com/pin/${pin.id}/`);
      done++;
    }
    if (!done) console.log('Nothing to publish.');
  },

  async delete() {
    const id = process.argv[3];
    if (!/^\d+$/.test(id || '')) throw new Error('Usage: delete <pinId>');
    await api(`/pins/${id}`, {method: 'DELETE'});
    console.log(`deleted ${id}`);
  }
};

await loadEnv();
const cmd = commands[process.argv[2]];
if (!cmd) {
  console.error('Commands: me | boards | pins [boardId] | publish <queue.json> [--dry-run] [--limit N] [--id pinXX] | delete <pinId>');
  process.exit(1);
}
try { await cmd(); } catch (e) { console.error('Error:', e.message); process.exit(1); }
