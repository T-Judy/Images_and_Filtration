import { validateImageFile } from './imageValidator.js';
import { existingIds } from './models/statusEffect.js';

const REQUIRED = 'This field is required.';
const NAME_MAX = 100;
const INT_MAX = 2147483647; // Postgres INTEGER max 

const last = (v) => (Array.isArray(v) ? v[v.length - 1] : v);
const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function cleanText(raw, { max } = {}) {
  const value = String(last(raw) ?? '').trim(); // CharField strips whitespace by default
  if (!value) return { error: REQUIRED };
  const length = [...value].length; // count characters, not UTF-16 units
  if (max && length > max) return { error: `Ensure this value has at most ${max} characters (it has ${length}).` };
  return { value };
}

function cleanPositiveInt(raw) {
  const str = String(last(raw) ?? '').trim();
  if (str === '') return { error: REQUIRED };
  if (!/^[+-]?\d+(\.0*)?$/.test(str)) return { error: 'Enter a whole number.' };
  const n = Number(str.replace(/\.0*$/, '')) + 0; // no dirty 0
  if (n < 0) return { error: 'Ensure this value is greater than or equal to 0.' };
  if (n > INT_MAX) return { error: `Ensure this value is less than or equal to ${INT_MAX}.` };
  return { value: n };
}

/**
 * Validate the add/edit form.
 * @param {object} body       req.body (text fields)
 * @param {object|undefined} file  req.file (the uploaded icon, if any)
 * @returns {Promise<{errors: object|null, data: object|null}>}
 */
export async function cleanEffectForm(body = {}, file) {
  const errors = {};
  const data = {};

  for (const [field, result] of [
    ['name', cleanText(body.name, { max: NAME_MAX })],
    ['description', cleanText(body.description)],
    ['max_potency', cleanPositiveInt(body.max_potency)],
    ['max_stack', cleanPositiveInt(body.max_stack)],
  ]) {
    if (result.error) errors[field] = [result.error];
    else data[field] = result.value;
  }

  // icon
  if (file) {
    if (file.size === 0) errors.icon = ['The submitted file is empty.'];
    else {
      const problems = await validateImageFile(file);
      if (problems.length) errors.icon = problems;
    }
  } else {
    errors.icon = [REQUIRED];
  }

  // related_effects: optional list of existing effect ids
  const badValues = [];
  const ids = new Set();
  for (const raw of toArray(body.related_effects)) {
    const s = String(raw).trim();
    if (s === '') continue;
    if (/^\d+$/.test(s) && Number(s) <= INT_MAX) ids.add(Number(s));
    else badValues.push(s);
  }
  const found = await existingIds([...ids]);
  const missing = [...ids].filter((id) => !found.has(id));
  const invalid = [...badValues, ...missing];
  if (invalid.length) {
    errors.related_effects = invalid.map((v) => `Select a valid choice. ${v} is not one of the available choices.`);
  }
  data.related_ids = [...ids].filter((id) => found.has(id));

  return Object.keys(errors).length ? { errors, data: null } : { errors: null, data };
}
