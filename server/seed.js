// Run with: npm run seed
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool, query } from './src/db.js';
import { saveIcon, deleteIcon } from './src/storage.js';
import { createEffect, addRelation } from './src/models/statusEffect.js';

const IMG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tests', 'img_src');

const SEED_DATA = [
  {
    name: 'Poison',
    description: 'At the end of the turn, take fixed damage by the Count, then halve the Count.',
    max_potency: 1,
    max_stack: 99,
    src_path: 'Poison',
    relation: [],
  },
  {
    name: 'Burn',
    description: "At the end of the turn, take fixed damage by the effect's Potency, then reduce its Count by 1. ",
    max_potency: 99,
    max_stack: 99,
    src_path: 'Burn',
    relation: ['Dark Flame'],
  },
  {
    name: 'Dark Flame',
    description: 'Unique Burn. Target loses Defence Level and Offense Level equal to the value of this effect.\nTurn End: Deal (Value * Burn Potency) Pride damage to target, then expire.',
    max_potency: 1,
    max_stack: 7,
    src_path: 'DarkFlame',
    relation: ['Burn'],
  },
  {
    name: 'Rupture',
    description: "When hit by an attack, take fixed damage by the effect's Potency. Then reduce its Count by 1.",
    max_potency: 99,
    max_stack: 99,
    src_path: 'Rupture',
    relation: [],
  },
  {
    name: 'Unlock-I',
    description: '- Defense Level +1\n- Combat End: Heal 5 SP',
    max_potency: 1,
    max_stack: 1,
    src_path: 'Unlock-I',
    relation: ['Unlock-II', 'Unlock-III'],
  },
  {
    name: 'Unlock-II',
    description: '- Defense Level +2\n- Combat End: Heal 10 SP',
    max_potency: 1,
    max_stack: 1,
    src_path: 'Unlock-II',
    relation: ['Unlock-I', 'Unlock-III'],
  },
  {
    name: 'Unlock-III',
    description: '- Defense Level +3\n- Combat End: Heal 15 SP',
    max_potency: 1,
    max_stack: 1,
    src_path: 'Unlock-III',
    relation: ['Unlock-I', 'Unlock-II'],
  },
];

/** Deletes the entire table and the icon files. */
export async function reset() {
  const { rows } = await query('DELETE FROM status_effects RETURNING icon'); // Since I need the icon names I need to await this.
  await Promise.all(rows.map((r) => deleteIcon(r.icon)));
  console.log(`Deleted ${rows.length} existing status effects.`);
}

export async function seed() {
  const created = new Map(); // name -> { id, relation }

  // Make objects w/o relationships
  for (const { src_path, relation, ...data } of SEED_DATA) {
    const buffer = await fs.readFile(path.join(IMG_DIR, `${src_path}.png`));
    const icon = await saveIcon({ originalname: `${src_path}.png`, buffer });
    const id = await createEffect({ ...data, icon });
    created.set(data.name, { id, relation });
    console.log(`  Created: ${data.name}`);
  }

  // Make relationships
  for (const { id, relation } of created.values()) {
    for (const relatedName of relation) {
      const related = created.get(relatedName);
      if (!related) continue;
      await addRelation(id, related.id);
    }
  }

  console.log(`Seeded ${created.size} status effects.`);
}

// Only run when executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log('--- Resetting database ---');
    await reset();
    console.log('--- Seeding database ---');
    await seed();
    console.log('--- Done ---');
  } finally {
    await pool.end();
  }
}
