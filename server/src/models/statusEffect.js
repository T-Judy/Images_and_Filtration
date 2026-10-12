import { query, withTransaction } from '../db.js';
import { mediaUrl } from '../storage.js';

const SELECT_EFFECTS = `
  SELECT e.id, e.name, e.icon, e.description, e.max_potency, e.max_stack,
         COALESCE((
           SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'icon', r.icon)
                           ORDER BY r.name, r.id)
             FROM status_effect_relations rel
             JOIN status_effects r ON r.id = rel.related_id
            WHERE rel.effect_id = e.id
         ), '[]'::json) AS related_effects
    FROM status_effects e`;

const ORDER_BY = 'ORDER BY e.name, e.id';

export async function listEffects() {
  return (await query(`${SELECT_EFFECTS} ${ORDER_BY}`)).rows;
}

export async function getEffect(id) {
  return (await query(`${SELECT_EFFECTS} WHERE e.id = $1`, [id])).rows[0] ?? null;
}

// Returns the Set of ids that exist
export async function existingIds(ids) {
  if (ids.length === 0) return new Set();
  const { rows } = await query('SELECT id FROM status_effects WHERE id = ANY($1::int[])', [ids]);
  return new Set(rows.map((r) => r.id));
}

// Symmetric relation: store (a,b) and (b,a)
const INSERT_RELATIONS = `
  INSERT INTO status_effect_relations (effect_id, related_id)
  SELECT $1, r FROM unnest($2::int[]) AS r
  UNION
  SELECT r, $1 FROM unnest($2::int[]) AS r
  ON CONFLICT DO NOTHING`;


export async function addRelation(id, otherId) {
  await query(INSERT_RELATIONS, [id, [otherId]]);
}

export async function createEffect({ name, icon, description, max_potency, max_stack, related_ids = [] }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO status_effects (name, icon, description, max_potency, max_stack)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, icon, description, max_potency, max_stack],
    );
    const id = rows[0].id;
    if (related_ids.length) await client.query(INSERT_RELATIONS, [id, related_ids]);
    return id;
  });
}

// Deletes the row (relations will die b/c ON DELETE CASCADE). Returns `{ icon }` of the deleted row, or null if none.
export async function deleteEffect(id) {
  const { rows } = await query('DELETE FROM status_effects WHERE id = $1 RETURNING icon', [id]);
  return rows[0] ?? null;
}

// Map DB row to what the frontend wants
export function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    icon: mediaUrl(row.icon),
    description: row.description,
    max_potency: row.max_potency,
    max_stack: row.max_stack,
    related_effects: row.related_effects.map((r) => ({ id: r.id, name: r.name, icon: mediaUrl(r.icon) })),
  };
}
