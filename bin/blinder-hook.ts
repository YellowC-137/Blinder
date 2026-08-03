#!/usr/bin/env node
// Claude Code PreToolUse hook entry. Spawned on every Read tool call, so it
// deliberately bypasses the main CLI (commander/inquirer/tree-sitter imports)
// — startup cost here is user-visible latency on every file read.
// stdout is the hook JSON protocol: nothing else may be written to it.
import { handleHookInput } from '../src/services/hookExec.js';

const chunks: Buffer[] = [];
process.stdin.on('data', (c: Buffer) => chunks.push(c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const decision = handleHookInput(input);
    if (decision) process.stdout.write(JSON.stringify(decision));
  } catch (err) {
    // Malformed stdin → no decision; normal permission flow applies.
    process.stderr.write(`blinder-hook: ${(err as Error).message}\n`);
  }
  process.exit(0);
});
