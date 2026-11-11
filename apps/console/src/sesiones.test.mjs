// node src/sesiones.test.mjs
//
// Las grabaciones publicadas (public/sesion-*.json, #187): en cada momento que tiene fotogramas,
// «Lo que ves tú» y «Lo que ve el modelo» son del mismo paso. Una sesión web lleva sus fotogramas
// en pares (paresIncoherentes: cada par con los dos lados del mismo id, en orden, sin fotogramas
// sueltos; en una migrada, los dos originales a menos de PAR_DT_MAX s), y cada JPEG existe.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { paresIncoherentes, tramo, valida } from './reproductor.js'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const archivos = readdirSync(PUBLIC).filter((f) => /^sesion-[a-z0-9-]+\.json$/.test(f))
assert.ok(archivos.length > 0, 'no hay grabaciones')

let conPares = 0
for (const f of archivos) {
  const d = JSON.parse(readFileSync(join(PUBLIC, f), 'utf8'))
  assert.ok(valida(d), `${f}: no es priv8-sesion/1`)
  assert.equal(paresIncoherentes(d), null, `${f}: ${paresIncoherentes(d)}`)
  const pares = d.pares ?? []
  if (pares.length) conPares += 1
  for (const p of pares) {
    for (const lado of [p.ocho, p.real]) {
      if (lado) assert.ok(existsSync(join(PUBLIC, lado.src)), `${f}: falta ${lado.src}`)
    }
  }
  // Reproducida a saltos de 50 ms, como la consola: las dos pantallas siempre del mismo par.
  let i = 0
  let j = 0
  let k = 0
  let ocho = null
  let real = null
  for (let t = 0; t <= d.duracion; t += 0.05) {
    const r = tramo(d, i, j, t, k)
    ;({ i, j, k } = r)
    if (r.par) { ocho = r.par.ocho; real = r.par.real }
    if (ocho && real) assert.equal(ocho.par, real.par, `${f}: en ${t.toFixed(2)} s, pantallas de pasos distintos`)
  }
}
assert.ok(conPares > 0, 'ninguna grabación web con pares')

console.log(`sesiones: ok (${archivos.length} grabaciones, ${conPares} con pares)`)
