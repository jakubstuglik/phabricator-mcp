#!/usr/bin/env node

console.error("🚀 Starting Phabricator MCP server from GitHub...");

import('tsx/esm')
    .then(() => {
        console.error("✅ tsx/esm loaded successfully");
        return import('../src/index.ts');
    })
    .then(() => {
        console.error("✅ src/index.ts imported - MCP server should be running");
    })
    .catch((err) => {
        console.error('❌ CRITICAL ERROR starting Phabricator MCP:');
        console.error(err.stack || err);
        process.exit(1);
    });