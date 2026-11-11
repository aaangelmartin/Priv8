# Despliegue de los subdominios de priv8.es

| Dirección | Qué es | Dónde vive |
|---|---|---|
| `priv8.es` | La web (`apps/landing`) | GitHub Pages, desde este repositorio (`.github/workflows/landing-pages.yml`) |
| `demo.priv8.es` | Todo lo de la demo en un sitio (`apps/demo-site`), con contraseña | Cloudflare Pages, subida directa con Wrangler |
| `mcp.priv8.es` | «Pruébalo con tu Claude Code» | La prepara otra tarea; aquí solo se enlaza |

El DNS de `priv8.es` está en Cloudflare.

## demo.priv8.es

### Qué publica

`apps/demo-site` es una página Vite + React con el diseño de la web (solo en claro). `pnpm build` hace la página y después `scripts/assemble.mjs` copia en `dist/` todo lo que enlaza:

| Ruta | Contenido | De dónde sale |
|---|---|---|
| `/` | La página con las tarjetas | `apps/demo-site` |
| `/consola/` | La consola de auditoría, estática. Se abre con `?feed=sin-protocolo`, `?feed=con-protocolo` o `?demo` | `apps/console` compilada con `BASE_PATH=/consola/` |
| `/correo/` | La bandeja de correo de la demo | `apps/inbox-sim` compilada con `BASE_PATH=/correo/` |
| `/erp/` | Alba Core, con la sesión de la demo ya abierta | `apps/erp-sim` compilada con `BASE_PATH=/erp/`, `VITE_ALBA_DEMO=1` y `VITE_ALBA_SESION=admin.alba` |
| `/equipo/` | Fotos de perfil de GitHub del equipo (sin red, iniciales) | Se descargan al compilar |
| `/docs/entregables/` | PDF de una cara, diapositivas (HTML y PDF), fuentes y los dos vídeos | `docs/entregables/` |
| `/brand/logo/` | Logos que usan las diapositivas en HTML | `brand/logo/` |
| `/apk/` | `priv8-8.apk`, `banca-alcor.apk`, `brezo-banco.apk`, `nimbo-broker.apk` | `./gradlew assembleDebug` en `apps/android-8` y `apps/banks-sim` |
| `/archivos.json` | Tamaño de cada archivo, para las tarjetas | `scripts/assemble.mjs` |

Nada de esto llama a un modelo ni a una API de pago: son archivos estáticos. El correo, el ERP y la consola son copias sin agente detrás; guardan lo que hagas en el navegador de cada visitante (`localStorage`). **No se ofrece un agente en vivo alojado**, porque usaría nuestra clave de API y cualquiera con el enlace podría gastarla. Las demos en vivo corren en el Mac de quien presenta.

Las APK no están en git: se compilan y se copian en cada build. Por eso el despliegue se hace con subida directa desde el Mac y no con una build en Cloudflare (su imagen de build no trae el SDK de Android).

### Control de acceso: contraseña compartida

**Decisión: `demo.priv8.es` pide una contraseña compartida.** Es la autenticación básica de HTTP: el navegador saca su ventana de usuario y contraseña, el usuario da igual y solo cuenta la contraseña. No pide correos ni códigos. Se la damos al jurado junto con el enlace.

La pone `apps/demo-site/functions/_middleware.js`, un middleware de Pages Functions que corre delante de todo el sitio, también de los archivos estáticos. Compara la contraseña con la variable `DEMO_PASSWORD` del proyecto de Pages (en tiempo constante). Si la variable no existe, el sitio queda abierto. El mismo middleware sirve las rutas profundas de las apps (`/correo/bandeja`, `/erp/facturas/alta`) con el `index.html` de cada una; un `_redirects` no vale aquí porque Cloudflare lo aplica también a los archivos que existen. Pruebas: `node scripts/middleware.test.mjs`.

Qué riesgos cubre y cuáles no:

- **Material sin publicar y ancho de banda.** Son los dos únicos riesgos: lo alojado es estático y no gasta nada por visita. La contraseña evita que el enlace circule solo y que los buscadores lo indexen (además van `noindex` y `X-Robots-Tag`).
- **Cuota de Functions.** Con el middleware, cada petición (también la de un vídeo o una APK) cuenta como una invocación de Functions. El plan gratuito da 100.000 al día, que resetean a medianoche UTC; una demo con el jurado usa unos cientos. Si un bot las agotara, Cloudflare por defecto «falla abierto»: deja pasar a los archivos sin el middleware, es decir, sin contraseña. Para evitarlo, en el proyecto se puede elegir **Fail closed** (devuelve un error 1027 hasta el día siguiente) donde el panel ofrezca el modo de fallo de Functions. No lo hemos podido confirmar en la documentación de Pages, así que conviene mirarlo en el panel.
- **No es un control de identidad.** Quien tenga la contraseña entra. Para la hackathon basta; para material sensible habría que usar Cloudflare Access con usuarios propios.

Alternativas descartadas:

- **Cloudflare Access** (Zero Trust, gratis hasta 50 usuarios): pide el correo de cada persona y un código por correo. Descartado por decisión del equipo: el jurado tiene que entrar sin dar su correo.
- **GitHub Pages:** ya sirve `priv8.es` desde este repositorio, solo admite un dominio propio por repositorio y no tiene contraseña.
- **Sitio abierto:** funciona igual (basta con no poner `DEMO_PASSWORD`), pero el material de la demo quedaría al alcance de cualquiera con el enlace antes del jurado.

### Pasos (los hace una persona; nada de esto está desplegado)

Requisitos en el Mac: Node 20 o superior, pnpm, JDK 17 y el SDK de Android (para las APK) y una cuenta de Cloudflare con la zona `priv8.es`.

**1. Compilar**

```sh
export JAVA_HOME=/ruta/al/jdk-17 ANDROID_HOME=$HOME/Library/Android/sdk
cd apps/demo-site
pnpm install
pnpm build                  # PRIV8_APK=skip pnpm build reutiliza las APK ya compiladas
pnpm preview                # http://127.0.0.1:5302, para revisarlo antes de subir
```

`pnpm preview` no ejecuta el middleware: en local el sitio va sin contraseña (las rutas profundas sí funcionan, con un plugin en `vite.config.js`). Para probarla en local: `npx wrangler pages dev dist --binding DEMO_PASSWORD=prueba`.

**2. Crear el proyecto de Pages** (una vez, desde `apps/demo-site`)

```sh
npx wrangler login
npx wrangler pages project create priv8-demo --production-branch main
```

El nombre `priv8-demo` es el de `apps/demo-site/wrangler.toml`. Un proyecto de subida directa no se puede pasar después a la integración con Git.

**3. Poner la contraseña** (antes del primer despliegue)

```sh
npx wrangler pages secret put DEMO_PASSWORD --project-name priv8-demo
```

O en el panel: **Workers & Pages** > `priv8-demo` > **Settings** > **Variables and Secrets** > **Add**, tipo **Secret** (cifrado), nombre `DEMO_PASSWORD`, en **Production**. Una contraseña larga y fácil de dictar, por ejemplo tres palabras con guiones.

**4. Desplegar** (desde `apps/demo-site`, para que Wrangler incluya `functions/`)

```sh
npx wrangler pages deploy dist --project-name priv8-demo --branch main
```

Wrangler compila `functions/_middleware.js` junto con `dist/`. Límites que comprueba `assemble.mjs`: 25 MiB por archivo (el más grande es un vídeo de 2,4 MB) y 20.000 archivos.

**5. Dominio propio**

En el panel: **Workers & Pages** > `priv8-demo` > **Custom domains** > **Set up a domain** > `demo.priv8.es` > **Continue** > confirmar el registro DNS. Como la zona está en Cloudflare, el CNAME se crea solo. No hay que crearlo a mano antes: si existe, el dominio puede quedarse en error 522.

**6. Comprobar**

```sh
curl -sI https://demo.priv8.es/ | head -3                      # 401 y WWW-Authenticate: Basic
curl -sI -u x:LA_CONTRASEÑA https://demo.priv8.es/ | head -3     # 200
curl -sI -u x:LA_CONTRASEÑA https://priv8-demo.pages.dev/ | head -3
```

La dirección `priv8-demo.pages.dev` y las de cada despliegue (`<hash>.priv8-demo.pages.dev`) pasan por el mismo middleware, así que también piden la contraseña.

### Cambiar la contraseña o abrir el sitio

- **Cambiarla:** `npx wrangler pages secret put DEMO_PASSWORD --project-name priv8-demo` con la nueva y volver a desplegar (paso 4). Los cambios de variables se aplican en el siguiente despliegue.
- **Abrir el sitio:** borrar la variable (`npx wrangler pages secret delete DEMO_PASSWORD --project-name priv8-demo`, o en **Settings** > **Variables and Secrets**) y volver a desplegar. El middleware sigue ahí, pero deja pasar todo.
- **Sin `functions/`** el sitio abre igual, pero al recargar una ruta profunda del correo o del ERP se vería la portada: mejor desplegar siempre con el middleware.

### Actualizar

Cualquier cambio en la página, la consola, los entregables o las APK: pasos 1 y 4. Sin GitHub Actions: las APK salen del Mac.

## Fuentes

Documentación de Cloudflare consultada el 11 de noviembre de 2026:

- Middleware de Pages Functions (`functions/_middleware.js`, `onRequest`, `context.next()`): https://developers.cloudflare.com/pages/functions/middleware/
- `/functions` en la raíz del proyecto, no dentro de `dist/`: https://developers.cloudflare.com/pages/functions/get-started/
- Variables y secretos (Settings > Variables and Secrets), redespliegue: https://developers.cloudflare.com/pages/functions/bindings/
- `wrangler.toml` de Pages (`name`, `pages_build_output_dir`, `compatibility_date`): https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- Comandos `wrangler pages` (`deploy`, `secret put`, `project create`): https://developers.cloudflare.com/workers/wrangler/commands/pages/
- Subida directa (sin paso posterior a Git; 20.000 archivos y 25 MiB por archivo): https://developers.cloudflare.com/pages/get-started/direct-upload/
- Dominios propios: https://developers.cloudflare.com/pages/configuration/custom-domains/
- `_headers` no se aplica a respuestas de Functions: https://developers.cloudflare.com/pages/configuration/headers/
- `_redirects` se aplica aunque el archivo exista y no a lo que sirve una Function: https://developers.cloudflare.com/pages/configuration/redirects/
- `env.ASSETS.fetch()` en Functions: https://developers.cloudflare.com/pages/functions/api-reference/
- Cuota de Functions (cuenta en la de Workers, 100.000 al día en gratis; lo estático no se mide): https://developers.cloudflare.com/pages/functions/pricing/ y https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Access y One-time PIN (alternativa descartada): https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/ y https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
