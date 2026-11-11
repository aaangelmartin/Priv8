/* Cómo registrar Priv8 (servidor MCP local, stdio) en cada asistente (#195).
   Cada entrada sale de la documentación oficial del asistente, enlazada en `doc`, revisada el 11 nov 2026.
   Solo van los que documentan servidores MCP locales por stdio. */

export const RUTA = '~/.priv8/mcp/priv8-mcp';
/* en los JSON y YAML no se expande «~»: va la ruta completa, con tu carpeta de usuario */
const ABS = 'TU_HOME/.priv8/mcp/priv8-mcp';
const icono = (n) => new URL(`./ia/${n}.svg`, import.meta.url).href;

const mcpServers = `{
  "mcpServers": {
    "priv8": {
      "command": "${ABS}",
      "args": ["mcp"]
    }
  }
}`;

export const CONECTAR = [
  {
    id: 'claude', nombre: 'Claude Code', icono: icono('claude'), auto: true, abre: 'claude',
    texto: 'Un comando en la terminal, para tu usuario.',
    cmd: `claude mcp add --scope user priv8 -- ${RUTA} mcp`,
    doc: 'https://code.claude.com/docs/en/mcp',
  },
  {
    id: 'codex', nombre: 'Codex', icono: icono('openai'), auto: true, abre: 'codex',
    texto: 'Un comando. La CLI, la app y la extensión de Codex comparten esta configuración (~/.codex/config.toml).',
    cmd: `codex mcp add priv8 -- ${RUTA} mcp`,
    doc: 'https://developers.openai.com/codex/mcp',
  },
  {
    id: 'gemini', nombre: 'Gemini CLI', icono: icono('googlegemini'), auto: true, abre: 'gemini',
    texto: 'Un comando, para tu usuario (~/.gemini/settings.json).',
    cmd: `gemini mcp add --scope user priv8 ${RUTA} mcp`,
    doc: 'https://geminicli.com/docs/tools/mcp-server/',
  },
  {
    id: 'grok', nombre: 'Grok CLI', icono: icono('grok'), abre: 'grok',
    texto: 'Un comando (o una tabla [mcp_servers.priv8] en ~/.grok/config.toml).',
    cmd: `grok mcp add priv8 -- ${RUTA} mcp`,
    doc: 'https://docs.x.ai/build/features/mcp-servers',
  },
  {
    id: 'cursor', nombre: 'Cursor', icono: icono('cursor'),
    texto: <>Añádelo a <code>~/.cursor/mcp.json</code> para tenerlo en todos tus proyectos. Cambia <code>TU_HOME</code> por tu carpeta de usuario (<code>echo $HOME</code>): en el JSON no vale <code>~</code>.</>,
    cmd: mcpServers, json: true,
    doc: 'https://cursor.com/docs/context/mcp',
  },
  {
    id: 'opencode', nombre: 'opencode', icono: icono('opencode'),
    texto: <>Un comando, para todos tus proyectos. En versiones anteriores, <code>opencode mcp add</code> te lo pregunta: tipo local y el mismo comando.</>,
    cmd: `opencode mcp add priv8 --global -- ${RUTA} mcp`,
    doc: 'https://opencode.ai/docs/mcp-servers/',
  },
  {
    id: 'otro', nombre: 'Otro asistente MCP', icono: null,
    texto: 'Cualquier asistente que admita servidores MCP locales por stdio: nombre priv8, comando y argumento mcp.',
    cmd: `${RUTA} mcp`,
    doc: 'https://modelcontextprotocol.io/docs/learn/architecture',
  },
];
