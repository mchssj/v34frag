// Pruebas de qué se borra en el recorte. Desde la raíz: node --test docs/bitacora/2026-11-10-r2-tope-10gb/pruebas/eleccion.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickOldest } from '../../../../cloudflare/demo-worker/src/index.js';
import { pickInOrder } from '../../../../cloudflare/clips-worker/src/index.js';

const GB = 1e9;
const o = (key, size, uploaded) => ({ key, size, uploaded });

test('demos: debajo del objetivo no se borra nada', () => {
  assert.deepEqual(pickOldest([o('demos/a', 1 * GB, '2026-01-01')], 9 * GB, 9.5 * GB), []);
});

test('demos: borra las más viejas hasta quedar en 9,5 GB, sin mirar el orden de entrada', () => {
  const objs = [
    o('demos/c', 1 * GB, '2026-03-01'),
    o('crashes/b', 0.2 * GB, '2026-02-01'),
    o('demos/a', 0.5 * GB, '2026-01-01'),
    o('demos/d', 1 * GB, '2026-04-01'),
  ];
  // 10,6 GB: hay que liberar 1,1 GB -> a (0,5) + b (0,2) = 0,7 no alcanza, + c (1) = 1,7.
  const picked = pickOldest(objs, 10.6 * GB, 9.5 * GB).map((x) => x.key);
  assert.deepEqual(picked, ['demos/a', 'crashes/b', 'demos/c']);
});

test('demos: justo en el objetivo alcanza', () => {
  const picked = pickOldest([o('demos/a', 0.5 * GB, '2026-01-01'), o('demos/b', 1 * GB, '2026-01-02')], 10 * GB, 9.5 * GB);
  assert.deepEqual(picked.map((x) => x.key), ['demos/a']);
});

test('demos: si no alcanza, devuelve todos los candidatos', () => {
  const picked = pickOldest([o('demos/a', 0.1 * GB, '2026-01-01')], 12 * GB, 9.5 * GB);
  assert.equal(picked.length, 1);
});

test('demos: no cambia el arreglo de entrada', () => {
  const objs = [o('demos/b', 1, '2026-02-01'), o('demos/a', 1, '2026-01-01')];
  pickOldest(objs, 10, 0);
  assert.equal(objs[0].key, 'demos/b');
});

test('clips: respeta el orden de la base (destacados al final) y para al llegar', () => {
  const due = [
    { clip_id: '1', video_key: 'clips/x/1', size: 0.6 * GB },
    { clip_id: '2', video_key: 'clips/x/2', size: 0.6 * GB },
    { clip_id: '3', video_key: 'clips/x/3-destacado', size: 5 * GB },
  ];
  assert.deepEqual(pickInOrder(due, 10.6 * GB, 9.5 * GB).map((c) => c.clip_id), ['1', '2']);
});

test('clips: uno que ya no está en R2 (tamaño 0) entra y no frena', () => {
  const due = [
    { clip_id: '1', video_key: 'clips/x/1', size: 0 },
    { clip_id: '2', video_key: 'clips/x/2', size: 1 * GB },
  ];
  assert.deepEqual(pickInOrder(due, 10.2 * GB, 9.5 * GB).map((c) => c.clip_id), ['1', '2']);
});
