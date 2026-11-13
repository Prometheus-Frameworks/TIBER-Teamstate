'use strict';
// Pure local bridge. No network, pipeline imports, source writes or global activation.
const fs = require('node:fs');
const { inspectReleaseWeek } = require('./compiled/inspectReleaseWeek.js');
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!Array.isArray(input)) throw new Error('Expected bounded week batch');
  if (input.length < 1 || input.length > 5) throw new Error('Unsupported batch length');
  const seen = new Set();
  const output = input.map(x => {
    if (seen.has(x.scope.week)) throw new Error('Duplicate week batch');
    seen.add(x.scope.week);
    return inspectReleaseWeek(Buffer.from(x.bytes, 'base64'), x.scope);
  });
  process.stdout.write(JSON.stringify(output));
} catch (error) {
  process.stderr.write(String(error && error.message || error) + '\n');
  process.exitCode = 1;
}
