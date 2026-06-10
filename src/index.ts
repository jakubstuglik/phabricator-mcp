import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig } from './config.js';
import { ConduitClient } from './client/conduit.js';
import { registerAllTools } from './tools/index.js';

console.error("📍 src/index.ts loaded - starting main()");

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

async function main() {
  console.error("🚀 Entering main() - loading config...");
  const config = loadConfig();
  const client = new ConduitClient(config);

  const server = new McpServer({
    name: 'phabricator',
    version: pkg.version,
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
