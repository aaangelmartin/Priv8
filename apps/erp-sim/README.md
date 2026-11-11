# Alba Core (ERP simulado)

Un ERP de escritorio antiguo servido en el navegador, sin API: el agente solo lo usa a través de la pantalla (adaptador web). Datos de `data/seed.json`.

```bash
cd apps/erp-sim
pnpm install
pnpm dev          # http://127.0.0.1:5173
```

Usuario de la demo: `admin.alba` / `Alba-2026!` (la clave es roja: la escribe la persona, nunca el agente).

| Ruta | Pantalla | Política |
|---|---|---|
| `/login` | Identificación | `login` |
| `/facturas/alta` | Alta de factura del pedido recibido (Suministros Lumen, PED-2026-3318) | `factura.alta` |
| `/proveedores/7` | Ficha del proveedor con el IBAN maestro y el teléfono | `proveedor.ficha` |
| `/proveedores`, `/facturas` | Listados | — |
| `/reset` | Borra la sesión y las facturas registradas | — |

## Contrato con el adaptador web

Solo entra en el snapshot lo que lleva `data-p8="<role>"` (roles de `docs/contracts/common.schema.json`). El selector del elemento es `#id`, que es lo que casan las políticas de `policies/alba-core.yaml` y la escena `b2b` de `core/scenes.py`. `data-p8-label` da la etiqueta; `data-p8-actions` sustituye a las acciones por defecto del rol (`""` sin acciones, `call` en el teléfono de la ficha). Las facturas registradas se guardan en `localStorage`.
