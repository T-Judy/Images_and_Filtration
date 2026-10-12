import { Router } from 'express';
import { uploadIcon } from '../upload.js';
import { saveIcon, deleteIcon } from '../storage.js';
import { cleanEffectForm } from '../validation.js';
import {
  listEffects, getEffect, createEffect, deleteEffect, toApi,
} from '../models/statusEffect.js';

const router = Router();

const notFound = (res) => res.status(404).json({ error: 'Not found' });

// Don't allow insanity
function parseId(req, res, next) {
  if (!/^\d{1,10}$/.test(req.params.id) || Number(req.params.id) > 2147483647) return notFound(res);
  req.effectId = Number(req.params.id);
  next();
}

// index defaults to ALL data. Since this is for demo purposes I'm not implementing pagenation, you might want to for your project though!
router.get('/', async (req, res) => {
  res.json({ effects: (await listEffects()).map(toApi) });
});

// add (via sending to root)
router.post('/', uploadIcon, async (req, res) => {
  const { errors, data } = await cleanEffectForm(req.body, req.file);
  if (errors) return res.status(400).json({ errors });

  const icon = await saveIcon(req.file); // validated, so now it's safe to write to disk
  try {
    const id = await createEffect({ ...data, icon });
    res.status(201).json({ effect: toApi(await getEffect(id)) });
  } catch (err) {
    await deleteIcon(icon); // kill the orphan
    throw err;
  }
});

// delete
router.delete('/:id', parseId, async (req, res) => {
  const removed = await deleteEffect(req.effectId);
  if (!removed) return notFound(res);
  await deleteIcon(removed.icon);
  res.status(204).end();
});

export default router;
