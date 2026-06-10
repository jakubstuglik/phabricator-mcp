#!/usr/bin/env node

/**
 * bin/phabricator-mcp.js
 * 
 * This bin allows npx -y github:jakubstuglik/phabricator-mcp to run the server from source.
 * npx fetches the git repo, npm installs (builds if needed), runs this bin.
 * This script uses tsx (in dependencies) to execute src/index.ts directly.
 * Relative paths resolve correctly inside the installed package tree.
 */

console.error("🚀 Starting Phabricator MCP server from GitHub...");

import('tsx/esm')
    .then(() => {
        return import('../src/index.ts');
    })
    .catch((err) => {
        console.error('❌ Failed to start Phabricator MCP:');
        console.error(err);
        process.exit(1);
    });
