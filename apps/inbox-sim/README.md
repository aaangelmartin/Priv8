# Bandeja de correo simulada (`apps/inbox-sim/`)

El buzón de cuentas a pagar de Talleres Norte (`cuentasapagar@talleresnorte.example`), la otra pantalla del B2B. Llega la factura F-2026-0412 de Suministros Lumen con su PDF y, en el cuerpo, un cambio de IBAN con una instrucción para el asistente: la trampa que Priv8 CUA bloquea por procedencia. Datos de `data/seed.json`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `src/App.jsx` | Pantallas y rutas del correo |
| `src/correo.css` | Aspecto de webmail |
| `public/factura-octubre.pdf` | El PDF adjunto de la factura |

| Ruta | Pantalla | Política (`policies/inbox.yaml`) |
|---|---|---|
| `/bandeja` | Recibidos; filas con `.remitente` y `#abrir-<id>` | `bandeja` |
| `/correo/9` | Lectura: `#de`, `#asunto`, `#cuerpo`, `#adjunto`, la vista previa del PDF (`#pdf-proveedor`, `#pdf-cif`, `#pdf-numero`, `#pdf-importe`) y `#responder` | `correo.lectura` |
| `/responder/9` | `#para`, `#texto`, `#enviar`; al enviar vuelve a la bandeja con `#aviso` «Respuesta enviada» | `correo.respuesta` |
| `/enviados` | Respuestas enviadas | - |
| `/carpeta/<nombre>` | Destacados, Pospuestos, Borradores y etiquetas (solo pantalla, sin `data-p8`) | - |
| `/reset` | Vacía leídos y enviados | - |

## Uso

```bash
cd apps/inbox-sim
pnpm install
pnpm dev          # http://127.0.0.1:5174
```

`make web` lo arranca junto con Alba Core y la consola.

## Pruebas

No tiene pruebas propias: lo prueban `uv run pytest adapters/web/tests` y la batería de correos de `data/test_bateria.py`.

## Detalles

- **Aspecto de webmail (#129).** Menú lateral, búsqueda, avatares, extractos, etiquetas y estrellas son pantalla para la persona y van sin `data-p8`. En las filas, `.remitente` enseña el nombre y entrega la dirección al adaptador con `data-p8-text`, así que el snapshot no cambia.
- **Contrato con el adaptador web.** El mismo que el ERP (`apps/erp-sim/README.md`): solo entra en el snapshot lo que lleva `data-p8`.
- La vista previa del PDF sale hoy del seed; con #20 el texto se extraerá del PDF en local.
