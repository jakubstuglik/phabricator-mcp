#!/usr/bin/env node

/**
 * bin/phabricator-mcp.js
 * 
 * This is the entry point for \
px -y github:jakubstuglik/phabricator-mcp\.
 * npx will run this when the package is fetched from git.
 * 
 * It uses tsx (from dependencies) to run the TypeScript source directly (src/index.ts).
 * This allows running the latest source from the fork without a separate build step in the command.
 * 
 * The relative import works because this runs from within the installed package directory.
 */

import('tsx/esm').then(() => {
  import('../src/index.ts');
}).catch((err) => {
  console.error('Failed to load with tsx:', err);
  process.exit(1);
});
