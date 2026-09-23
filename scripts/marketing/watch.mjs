import { mkdir, open, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditSite, changes } from './audit.mjs';

const origin = process.argv[2] || 'https://qrupgrade.com';
const directory = resolve(process.env.QR_GROWTH_STATE_DIR || '.agents/loops/discovery');
await mkdir(directory, { recursive: true });
try { await stat(resolve(directory, '../PAUSED')); console.log(JSON.stringify({ status: 'paused' })); process.exit(0); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const lock = resolve(directory, 'run.lock');
try { const entry = await stat(lock); if (Date.now() - entry.mtimeMs > 20 * 60_000) await unlink(lock); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let handle;
try { handle = await open(lock, 'wx'); } catch (error) { if (error.code !== 'EEXIST') throw error; console.log(JSON.stringify({ status: 'already-running' })); process.exit(0); }
try {
  const state = resolve(directory, 'latest.json');
  let previous;
  try { previous = JSON.parse(await readFile(state, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('Discovery state is unreadable; repair it before running again.'); }
  if (previous && previous.origin !== new URL(origin).origin) throw new Error('Use a separate state directory for a different origin.');
  const report = await auditSite({ origin });
  const delta = changes(previous, report);
  // Preserve unresolved findings while evidence is incomplete.
  if (!report.complete && previous) {
    const ids = new Set(report.issues.map(issue => issue.id));
    for (const issue of previous.issues) if (!ids.has(issue.id)) report.issues.push({ ...issue, retained: true });
  }
  const temp = `${state}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, state);
  const output = { status: report.complete ? 'checked' : 'partial', checkedAt: report.checkedAt, pageCount: report.pages.length, issueCount: report.issues.length, ...delta };
  await writeFile(resolve(directory, 'last-change.json'), JSON.stringify(output, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(output, null, 2));
  if (!report.complete) process.exitCode = 2;
} finally { await handle.close(); await unlink(lock); }
