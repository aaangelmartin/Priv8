# Bandeja de correo simulada

El buzón de cuentas a pagar de Talleres Norte (`cuentasapagar@talleresnorte.example`). Llega la factura F-2026-0412 de Suministros Lumen con su PDF y, en el cuerpo, un cambio de IBAN con una instrucción para el asistente: la trampa que Priv8 bloquea por procedencia. Datos de `data/seed.json`.

```bash
cd apps/inbox-sim
pnpm install
pnpm dev          # http://127.0.0.1:5174
```

| Ruta | Pantalla | Política (`policies/inbox.yaml`) |
|---|---|---|
| `/bandeja` | Recibidos; filas con `.remitente` y `#abrir-<id>` | `bandeja` |
| `/correo/9` | Lectura: `#de`, `#asunto`, `#cuerpo`, `#adjunto` y la vista previa del PDF (`#pdf-proveedor`, `#pdf-cif`, `#pdf-numero`, `#pdf-importe`), `#responder` | `correo.lectura` |
| `/responder/9` | `#para`, `#texto`, `#enviar`; al enviar vuelve a la bandeja con `#aviso` «Respuesta enviada» | `correo.respuesta` |
| `/enviados` | Respuestas enviadas | — |
| `/reset` | Vacía leídos y enviados | — |

Mismo contrato con el adaptador web que el ERP (`apps/erp-sim/README.md`): solo entra en el snapshot lo que lleva `data-p8`. La vista previa del PDF sale hoy del seed; con #20 el texto se extraerá del PDF en local.
