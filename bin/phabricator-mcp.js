#!/usr/bin/env node

import('../dist/index.js').catch((err) => {
    console.error('❌ Failed to start @jstuglik/phabricator-mcp:');
    console.error(err);
    process.exit(1);
});