// Port of tests/status_effect_test.py (pytest-django) to Vitest + supertest.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';

import { MEDIA_ROOT } from '../src/config.js';
import { pool, query } from '../src/db.js';
import { createApp } from '../src/app.js';
import { saveIcon } from '../src/storage.js';
import { createEffect, getEffect } from '../src/models/statusEffect.js';

const IMG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'img_src');
const app = createApp();

// --- helpers ---------------------------------------------------------------

// Real 1x1 red PNG. Needs zlib + a CRC to create valid chunks (struct + zlib in the Python version).
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeValidPng() {
  const chunk = (name, data) => {
    const body = Buffer.concat([Buffer.from(name, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0x00, 0xff, 0x00, 0x00]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const VALID_PNG = makeValidPng();
const icon = (filename = 'icon.png') => ({ buffer: VALID_PNG, filename, contentType: 'image/png' });
const seedImage = async (file, filename) => ({
  buffer: await fs.readFile(path.join(IMG_DIR, file)),
  filename,
  contentType: 'image/png',
});

/** Emulates a form submission. Fields set to `undefined` are left out, like a missing form value. */
function submit(req, fields, file) {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    for (const v of [].concat(value)) req.field(key, String(v));
  }
  if (file) req.attach('icon', file.buffer, { filename: file.filename, contentType: file.contentType });
  return req;
}
const baseFields = (name, extra = {}) => ({
  name,
  description: `A description for ${name}`,
  max_potency: 1,
  max_stack: 1,
  ...extra,
});
const postEffect = (fields, file) => submit(request(app).post('/api/effects'), fields, file);
const count = async () => (await query('SELECT count(*)::int AS n FROM status_effects')).rows[0].n;
const exists = async (where, params) =>
  (await query(`SELECT 1 FROM status_effects WHERE ${where}`, params)).rowCount > 0;
const filesOnDisk = async () => {
  try {
    return await fs.readdir(path.join(MEDIA_ROOT, 'status_icons'));
  } catch {
    return [];
  }
};

/** Creates 3 dummy StatusEffect records directly in the DB (the `three_effects` fixture). */
async function threeEffects() {
  const effects = [];
  for (let i = 1; i <= 3; i++) {
    const iconPath = await saveIcon({ originalname: `icon${i}.png`, buffer: VALID_PNG });
    const id = await createEffect({
      name: `Effect ${i}`,
      icon: iconPath,
      description: `Description for effect ${i}`,
      max_potency: i * 10,
      max_stack: i,
    });
    effects.push(await getEffect(id));
  }
  return effects;
}

beforeEach(async () => {
  await query('TRUNCATE status_effects RESTART IDENTITY CASCADE');
  await fs.rm(MEDIA_ROOT, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(MEDIA_ROOT, { recursive: true, force: true });
  await pool.end();
});

// === Add Tests ===
describe('POST /api/effects (add_card)', () => {
  // Start Successful adds
  it('adds the first effect', async () => {
    const res = await postEffect(baseFields('Poison'), await seedImage('Poison.png', 'poison.png'));
    expect(res.status).toBe(201);
    expect(res.body.effect.name).toBe('Poison');
    expect(res.body.effect.icon).toMatch(/^\/media\/status_icons\/[0-9a-f]{32}\.png$/);
    expect(await exists('name = $1', ['Poison'])).toBe(true);
  });

  it('adds with a (symmetric) relation', async () => {
    // Burn
    let res = await postEffect(
      { name: 'Burn', description: 'A burning effect', max_potency: 99, max_stack: 99 },
      await seedImage('Burn.png', 'burn.png'),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const burnId = res.body.effect.id;

    // Dark Flame
    res = await postEffect(
      { name: 'Dark Flame', description: 'A dark flame effect', max_potency: 7, max_stack: 1, related_effects: [burnId] },
      await seedImage('DarkFlame.png', 'DarkFlame.png'),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const darkFlameId = res.body.effect.id;

    // Dark Flame should list Burn as related
    const darkFlame = await getEffect(darkFlameId);
    expect(darkFlame.related_effects.map((r) => r.id)).toContain(burnId);

    // Verify symmetry
    const burn = await getEffect(burnId);
    expect(burn.related_effects.map((r) => r.id)).toContain(darkFlameId);
  });

  // Start File Validation Tests
  it('rejects bad file types based on extension', async () => {
    const txt = { buffer: Buffer.from('Just some text'), filename: 'not_an_image.txt', contentType: 'text/plain' };
    const res = await postEffect(baseFields('Invalid Effect'), txt);
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/Unsupported extension/);
    expect(await exists('name = $1', ['Invalid Effect'])).toBe(false);
  });

  it("rejects files that aren't valid images even with a .png extension (reads the first bytes)", async () => {
    const fake = { buffer: Buffer.from('Not a real PNG file'), filename: 'fake.png', contentType: 'image/png' };
    const res = await postEffect(baseFields('Fake Effect'), fake);
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/not a valid image/);
    expect(await exists('name = $1', ['Fake Effect'])).toBe(false);
  });

  it('rejects a real image of the wrong type (a GIF renamed .png)', async () => {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const res = await postEffect(baseFields('Gif Effect'), {
      buffer: gif,
      filename: 'sneaky.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/image\/gif/);
    expect(await count()).toBe(0);
  });

  it('rejects a declared Content-Type that is not an allowed image type', async () => {
    const res = await postEffect(baseFields('Bad Type'), { ...icon('a.png'), contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/Unsupported content type/);
    expect(await count()).toBe(0);
  });

  it('rejects a declared Content-Type that disagrees with the real content', async () => {
    const res = await postEffect(baseFields('Liar'), { ...icon('a.png'), contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/does not match/);
    expect(await count()).toBe(0);
  });

  it('rejects an extension that disagrees with the real content (a PNG renamed .jpg)', async () => {
    const res = await postEffect(baseFields('Renamed'), { ...icon('a.jpg'), contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/extension \.jpg does not match/);
    expect(await count()).toBe(0);
  });

  it('accepts a real JPEG with .jpeg and image/jpeg', async () => {
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#f00' } }).jpeg().toBuffer();
    const res = await postEffect(baseFields('Jpeg'), { buffer: jpeg, filename: 'pic.JPEG', contentType: 'image/jpeg' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.effect.icon).toMatch(/\.jpeg$/);
  });

  it('rejects a file with a PNG header but a corrupt body', async () => {
    const corrupt = Buffer.concat([VALID_PNG.subarray(0, 8), Buffer.from('garbage garbage garbage')]);
    const res = await postEffect(baseFields('Corrupt'), { buffer: corrupt, filename: 'corrupt.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.errors.icon).toBeDefined();
    expect(await count()).toBe(0);
  });

  it('writes nothing to disk when validation fails', async () => {
    await postEffect(baseFields(undefined), icon());
    expect(await filesOnDisk()).toEqual([]);
  });

  it('rejects files over the size limit', async () => {
    const big = Buffer.concat([VALID_PNG, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await postEffect(baseFields('Big'), { buffer: big, filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.errors.icon[0]).toMatch(/too large/);
    expect(await count()).toBe(0);
  });

  // Start Required Field Tests
  it('rejects a missing name', async () => {
    const res = await postEffect(baseFields(undefined, { max_potency: 5, max_stack: 3 }), icon());
    expect(res.status).toBe(400);
    expect(res.body.errors.name).toEqual(['This field is required.']);
    expect(await count()).toBe(0);
  });

  it('rejects a missing icon', async () => {
    const res = await postEffect(baseFields('Poison', { max_potency: 5, max_stack: 3 }));
    expect(res.status).toBe(400);
    expect(res.body.errors.icon).toEqual(['This field is required.']);
    expect(await count()).toBe(0);
  });

  it('rejects a missing description', async () => {
    const res = await postEffect({ name: 'Poison', max_potency: 5, max_stack: 3 }, icon());
    expect(res.status).toBe(400);
    expect(res.body.errors.description).toBeDefined();
    expect(await count()).toBe(0);
  });

  it('rejects an empty post', async () => {
    const res = await request(app).post('/api/effects').send({});
    expect(res.status).toBe(400);
    expect(await count()).toBe(0);
  });

  // Number / relation validation (Django's PositiveIntegerField + ModelMultipleChoiceField)
  it('rejects negative and non-numeric potency/stack', async () => {
    const res = await postEffect(baseFields('Bad Numbers', { max_potency: -1, max_stack: 'abc' }), icon());
    expect(res.status).toBe(400);
    expect(res.body.errors.max_potency[0]).toMatch(/greater than or equal to 0/);
    expect(res.body.errors.max_stack).toEqual(['Enter a whole number.']);
  });

  it('accepts 0 and rejects values beyond a Postgres INTEGER', async () => {
    let res = await postEffect(baseFields('Zero', { max_potency: 0 }), icon());
    expect(res.status).toBe(201);
    res = await postEffect(baseFields('Huge', { max_potency: 2147483648 }), icon());
    expect(res.status).toBe(400);
  });

  it('rejects names over 100 characters', async () => {
    const res = await postEffect(baseFields('x'.repeat(101)), icon());
    expect(res.status).toBe(400);
    expect(res.body.errors.name[0]).toMatch(/at most 100 characters/);
  });

  it('rejects a related effect that does not exist', async () => {
    const res = await postEffect(baseFields('Orphan', { related_effects: [424242] }), icon());
    expect(res.status).toBe(400);
    expect(res.body.errors.related_effects[0]).toMatch(/Select a valid choice/);
    expect(await count()).toBe(0);
  });
});

// === Delete Tests ===
describe('DELETE /api/effects/:id (delete_card)', () => {
  it('removes the record', async () => {
    const effects = await threeEffects();
    const target = effects[1];
    const res = await request(app).delete(`/api/effects/${target.id}`);
    expect(res.status).toBe(204);
    expect(await exists('id = $1', [target.id])).toBe(false);
  });

  it('leaves the others intact', async () => {
    const effects = await threeEffects();
    const target = effects[1];
    await request(app).delete(`/api/effects/${target.id}`);
    for (const e of effects.filter((e) => e.id !== target.id)) {
      expect(await exists('id = $1', [e.id])).toBe(true);
    }
  });

  it('returns 404 for a nonexistent effect', async () => {
    const res = await request(app).delete('/api/effects/99999');
    expect(res.status).toBe(404);
  });

  it('returns 404 (not 500) for a malformed id', async () => {
    expect((await request(app).delete('/api/effects/abc')).status).toBe(404);
    expect((await request(app).delete('/api/effects/99999999999999')).status).toBe(404);
  });

  it('deletes the icon file and the relation rows too', async () => {
    const [a, b] = await threeEffects();
    await createEffect({ name: 'R', icon: a.icon, description: 'x', max_potency: 1, max_stack: 1, related_ids: [a.id, b.id] });
    await request(app).delete(`/api/effects/${a.id}`);
    expect(await filesOnDisk()).not.toContain(path.basename(a.icon));
    const rows = (await query('SELECT count(*)::int AS n FROM status_effect_relations WHERE effect_id = $1 OR related_id = $1', [a.id])).rows;
    expect(rows[0].n).toBe(0); // only the rows touching the deleted effect are gone
    expect((await query('SELECT count(*)::int AS n FROM status_effect_relations')).rows[0].n).toBe(2); // R <-> b remain
  });
});

// === Index ===
describe('GET /api/effects', () => {
  it('lists all effects ordered by name, with related effects and media URLs', async () => {
    const [a, b] = await threeEffects();
    await createEffect({ name: 'Effect 0', icon: a.icon, description: 'x', max_potency: 1, max_stack: 1, related_ids: [b.id] });
    const res = await request(app).get('/api/effects');
    expect(res.status).toBe(200);
    expect(res.body.effects.map((e) => e.name)).toEqual(['Effect 0', 'Effect 1', 'Effect 2', 'Effect 3']);
    expect(res.body.effects[0].related_effects).toEqual([{ id: b.id, name: 'Effect 2', icon: `/media/${b.icon}` }]);
    expect(Object.keys(res.body.effects[0]).sort()).toEqual([
      'description', 'icon', 'id', 'max_potency', 'max_stack', 'name', 'related_effects',
    ]);
  });

  it('unknown /api routes are a JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
