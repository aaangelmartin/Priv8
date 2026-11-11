# Gramática de tokens · v1

Un token sustituye a un dato ámbar en todo lo que sale hacia la nube. Lo producen el tokenizador y el oráculo (Camino 1); lo leen el renderizador local de la app 8 (Camino 4), la consola (Camino 2) y la voz local (Camino 3).

```
token    = "‹" TIPO "_" n [ "-" etiqueta ] "›"
TIPO     = IBAN | DNI | NIE | CIF | PERSONA | PROVEEDOR | IMPORTE
         | SUMA | FACTURA | TEL | EMAIL | MOVIMIENTO | RESPUESTA | CODIGO
n        = 1..          contador por tipo, empieza en 1, estable en la sesión
etiqueta = origen | rasgo
origen   = propio | maestro | correo | tercero | titular
rasgo    = positivo | negativo
```

Expresión regular (la misma en Python, Kotlin y JavaScript):

```
‹([A-Z]+)_(\d+)(?:-([a-z]+))?›
```

Los delimitadores son U+2039 `‹` y U+203A `›`; el guion ASCII `-` (U+002D) separa la etiqueta. En código, escribir las comillas como escapes (`\u2039`, `\u203a`) para no depender de la codificación del archivo. Como el tipo es solo mayúsculas y `n` solo cifras, el primer guion siempre cierra la parte `TIPO_n`.

Hasta el 11 nov el separador era el punto medio U+00B7; el formato antiguo ya no se acepta.

## Tipos

| Tipo | Qué es | Etiquetas habituales |
|---|---|---|
| `IBAN` | Cuenta bancaria | `propio`, `maestro`, `correo`, `tercero` |
| `DNI`, `NIE`, `CIF` | Documento de identidad o fiscal | `titular`, `tercero` |
| `PERSONA` | Nombre de una persona | `titular`, `tercero` |
| `PROVEEDOR` | Nombre de empresa o de cuenta destino | `maestro`, `correo`, `propio` |
| `IMPORTE` | Cantidad de dinero | `positivo`, `negativo` |
| `SUMA` | Resultado de `oracle sum`; no existe en pantalla | ninguna |
| `FACTURA` | Número de factura | `correo`, `maestro` |
| `TEL`, `EMAIL` | Contacto | `maestro`, `correo` |
| `MOVIMIENTO` | Concepto de un movimiento bancario | ninguna |
| `RESPUESTA` | Respuesta esperada a la pregunta de comprobación de la llamada | ninguna |
| `CODIGO` | Referencia u otro código sensible que no encaja arriba | ninguna |

Origen: `propio` (cuenta de la persona o de la empresa que paga), `maestro` (ficha del ERP), `correo` (llegó en un correo), `tercero` (otra fuente externa), `titular` (la persona usuaria).

## Reglas

1. **Mismo valor y misma sesión, mismo token.** El valor se normaliza antes de comparar (IBAN sin espacios y en mayúsculas, importes como número). Si el mismo IBAN aparece en la ficha y en un correo, conserva el primer token; la procedencia completa vive en la bóveda.
2. **La etiqueta dice lo justo.** Lo que el modelo necesita para decidir (de dónde viene un IBAN, el signo de un importe) y nada más.
3. **Lo rojo no tiene token.** Claves, PIN, usuario de acceso, OTP y tarjeta completa llegan como `"text": null, "cls": "rojo"` y nunca entran en la bóveda.
4. **Token desconocido no se escribe.** Si el modelo escribe un token que no está en la bóveda de su sesión, el ejecutor lo rechaza (`denied: token_desconocido`).
5. **Texto real que imite un token.** Si la pantalla contiene `‹`, `›` o algo con forma de token, el núcleo los sustituye por `<` y `>` antes de tokenizar. Así una página no puede colar un token falso.
6. **Renderizado local.** El renderizador cambia cada token por su valor solo en la zona de confianza (app 8, consola). Un token que no esté en la bóveda se muestra tal cual, en Plex Mono con fondo cobalto suave.

## Ejemplos

```
"ES91 2100 0418 4502 0005 1332"   → ‹IBAN_1-maestro›
"ES91210004184502 00051332"       → ‹IBAN_1-maestro›   (misma sesión, mismo valor)
"-45,20 €"                        → ‹IMPORTE_2-negativo›
oracle sum                        → ‹SUMA_1›
{"label":"Clave","text":"••••"}   → {"label":"Clave","text":null,"cls":"rojo"}
```
