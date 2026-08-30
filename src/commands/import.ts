/**
 * LicenseFlow CLI - 1-Click Migration & Import Command
 *
 * Supports importing licenses and customer data from:
 *   - Keygen.sh JSON:API exports
 *   - Cryptlex JSON exports
 *   - Generic CSV files (license_key, email, status, expires_at, etc.)
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { spinner, printHeader, printKeyValue } from '../lib/utils';
import { importLicensesBatch } from '../lib/api';

export const importCommand = new Command('import')
  .description('Import licenses and policies from Keygen.sh, Cryptlex, or CSV');

interface NormalizedLicense {
  license_key: string;
  status: string;
  product_id?: string;
  policy_id?: string;
  customer_email?: string;
  max_activations?: number;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}

// ── Keygen.sh Importer ────────────────────────────────────────────────────────

function parseKeygenExport(jsonContent: string): NormalizedLicense[] {
  const data = JSON.parse(jsonContent);
  const items = Array.isArray(data) ? data : data.data || [];
  const normalized: NormalizedLicense[] = [];

  for (const item of items) {
    if (item.type !== 'licenses' && !item.attributes?.key) continue;
    const attrs = item.attributes || {};
    const meta = attrs.metadata || {};

    normalized.push({
      license_key: attrs.key,
      status: attrs.status === 'ACTIVE' ? 'active' : attrs.status?.toLowerCase() || 'active',
      max_activations: attrs.maxMachines || attrs.maxUses || 1,
      expires_at: attrs.expiry || null,
      customer_email: meta.customerEmail || meta.email || undefined,
      metadata: {
        migrated_from: 'keygen.sh',
        keygen_id: item.id,
        ...meta,
      },
    });
  }

  return normalized;
}

// ── Cryptlex Importer ─────────────────────────────────────────────────────────

function parseCryptlexExport(jsonContent: string): NormalizedLicense[] {
  const data = JSON.parse(jsonContent);
  const items = Array.isArray(data) ? data : data.licenses || [];
  const normalized: NormalizedLicense[] = [];

  for (const item of items) {
    const key = item.key || item.licenseKey;
    if (!key) continue;

    normalized.push({
      license_key: key,
      status: item.suspended ? 'suspended' : item.revoked ? 'revoked' : 'active',
      max_activations: item.allowedActivations || item.maxActivations || 1,
      expires_at: item.expiresAt || null,
      customer_email: item.userEmail || item.customerEmail || undefined,
      metadata: {
        migrated_from: 'cryptlex',
        cryptlex_id: item.id,
        cryptlex_type: item.type,
      },
    });
  }

  return normalized;
}

// ── Generic CSV Importer ──────────────────────────────────────────────────────

function parseCsvExport(csvContent: string): NormalizedLicense[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const keyIdx = headers.findIndex((h) => h === 'key' || h === 'license_key' || h === 'licensekey');
  const emailIdx = headers.findIndex((h) => h === 'email' || h === 'customer_email');
  const statusIdx = headers.findIndex((h) => h === 'status');
  const expiresIdx = headers.findIndex((h) => h === 'expires_at' || h === 'expiry' || h === 'expires');
  const activationsIdx = headers.findIndex((h) => h === 'max_activations' || h === 'activations');

  if (keyIdx === -1) {
    throw new Error('CSV must contain a header with "license_key" or "key"');
  }

  const normalized: NormalizedLicense[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (!cols[keyIdx]) continue;

    normalized.push({
      license_key: cols[keyIdx],
      status: statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx].toLowerCase() : 'active',
      customer_email: emailIdx !== -1 ? cols[emailIdx] : undefined,
      expires_at: expiresIdx !== -1 && cols[expiresIdx] ? cols[expiresIdx] : null,
      max_activations: activationsIdx !== -1 && parseInt(cols[activationsIdx], 10) ? parseInt(cols[activationsIdx], 10) : 1,
      metadata: { migrated_from: 'csv' },
    });
  }

  return normalized;
}

// ── Command Action Handlers ──────────────────────────────────────────────────

async function runImport(
  sourceName: string,
  filePath: string,
  parser: (content: string) => NormalizedLicense[],
  options: { dryRun?: boolean; batchSize?: number }
) {
  const absPath = resolve(process.cwd(), filePath);
  if (!existsSync(absPath)) {
    console.error(chalk.red(`Error: File not found at ${absPath}`));
    process.exit(1);
  }

  const spin = spinner(`Parsing ${sourceName} export file...`);
  spin.start();

  let licenses: NormalizedLicense[] = [];
  try {
    const rawContent = readFileSync(absPath, 'utf8');
    licenses = parser(rawContent);
  } catch (err: any) {
    spin.fail(`Failed to parse ${sourceName} file: ${err.message}`);
    process.exit(1);
  }

  spin.succeed(`Successfully parsed ${chalk.green(licenses.length)} licenses from ${sourceName}`);

  printHeader('Migration Summary');
  printKeyValue('Source', sourceName);
  printKeyValue('File', absPath);
  printKeyValue('License Count', String(licenses.length));
  printKeyValue('Dry Run', options.dryRun ? chalk.yellow('Yes (no changes made)') : chalk.green('No'));

  if (options.dryRun || licenses.length === 0) {
    if (licenses.length > 0) {
      console.log(chalk.cyan('\nSample License Preview:'));
      console.log(JSON.stringify(licenses[0], null, 2));
    }
    return;
  }

  const batchSize = options.batchSize || 100;
  const totalBatches = Math.ceil(licenses.length / batchSize);
  const uploadSpin = spinner(`Importing licenses in batches of ${batchSize}...`);
  uploadSpin.start();

  let imported = 0;
  let failed = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batch = licenses.slice(b * batchSize, (b + 1) * batchSize);
    uploadSpin.text = `Importing batch ${b + 1}/${totalBatches} (${batch.length} licenses)...`;

    const res = await importLicensesBatch(batch);
    if (res.success && res.data) {
      imported += res.data.imported || batch.length;
      failed += res.data.failed || 0;
    } else {
      failed += batch.length;
      console.warn(chalk.yellow(`\nBatch ${b + 1} failed: ${res.error}`));
    }
  }

  if (failed === 0) {
    uploadSpin.succeed(chalk.green(`Import completed: ${imported} licenses imported successfully!`));
  } else {
    uploadSpin.warn(chalk.yellow(`Import finished with partial errors: ${imported} imported, ${failed} failed.`));
  }
}

// ── Subcommands ──────────────────────────────────────────────────────────────

importCommand
  .command('keygen')
  .description('Import licenses from Keygen.sh JSON:API export')
  .requiredOption('-f, --file <path>', 'Path to Keygen JSON export file')
  .option('--dry-run', 'Validate and preview licenses without importing')
  .option('-b, --batch-size <number>', 'Batch upload chunk size', '100')
  .action(async (opts) => {
    await runImport('Keygen.sh', opts.file, parseKeygenExport, {
      dryRun: opts.dryRun,
      batchSize: parseInt(opts.batchSize, 10),
    });
  });

importCommand
  .command('cryptlex')
  .description('Import licenses from Cryptlex JSON export')
  .requiredOption('-f, --file <path>', 'Path to Cryptlex JSON export file')
  .option('--dry-run', 'Validate and preview licenses without importing')
  .option('-b, --batch-size <number>', 'Batch upload chunk size', '100')
  .action(async (opts) => {
    await runImport('Cryptlex', opts.file, parseCryptlexExport, {
      dryRun: opts.dryRun,
      batchSize: parseInt(opts.batchSize, 10),
    });
  });

importCommand
  .command('csv')
  .description('Import licenses from a generic CSV spreadsheet')
  .requiredOption('-f, --file <path>', 'Path to CSV file')
  .option('--dry-run', 'Validate and preview licenses without importing')
  .option('-b, --batch-size <number>', 'Batch upload chunk size', '100')
  .action(async (opts) => {
    await runImport('CSV', opts.file, parseCsvExport, {
      dryRun: opts.dryRun,
      batchSize: parseInt(opts.batchSize, 10),
    });
  });
