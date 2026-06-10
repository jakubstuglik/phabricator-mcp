#!/usr/bin/env node

import('tsx/esm')
    .then(() => import('../src/index.ts'))
    .catch((err) => {
        console.error('❌ Failed to start Phabricator MCP server:');
        console.error(err);
        process.exit(1);
    });