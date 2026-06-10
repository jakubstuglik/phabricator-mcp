#!/usr/bin/env node

/**
 * bin/phabricator-mcp.js
 * 
 * This bin allows npx -y github:jakubstuglik/phabricator-mcp (and the published package)
 * to run the MCP server from TypeScript source using tsx (preferred for git/fork usage and live source changes).
 * Falls back to the built dist/index.js .
 * 
 * We put tsx in dependencies (not just dev) so it is present when npx installs the package from git.
 * The installed package root is used for relative paths, avoiding cwd pollution from the MCP host.
 */

import('tsx/esm').then(() => {
  // Run the source. Path is relative to bin/ inside the installed package tree.
  import('../src/index.ts');
}).catch((err) => {
  console.error('tsx/esm failed to load (or not present), falling back to dist/index.js. Error:', err?.message || err);
  import('../dist/index.js').catch((distErr) => {
    console.error('Failed to load dist as well:', distErr);
    process.exit(1);
  });
});
