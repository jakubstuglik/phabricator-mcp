#!/usr/bin/env node

process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ UNHANDLED REJECTION:', err);
    process.exit(1);
});

console.error("🚀 Starting Phabricator MCP server from GitHub...");

import('tsx/esm')
    .then(() => {
        console.error("✅ tsx/esm loaded");
        return import('../src/index.ts');
    })
    .then(() => {
        console.error("✅ src/index.ts imported successfully");
    })
    .catch((err) => {
        console.error('❌ CRITICAL ERROR in bin script:');
        console.error(err.stack || err);
        process.exit(1);
    });