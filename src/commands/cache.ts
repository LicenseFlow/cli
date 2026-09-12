import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../lib/config';
import { EntitlementCache } from '../lib/cache';
import * as path from 'node:path';
import * as os from 'node:os';

const CACHE_DIR = path.join(os.homedir(), '.licenseflow', 'cache');

export const cacheCommand = new Command('cache')
  .description('Manage the local entitlement cache')
  .addCommand(
    new Command('status')
      .description('Show cache statistics')
      .action(async () => {
        const config = getConfig();
        if (!config.apiKey) {
          console.log(chalk.red('No API key configured. Run: licenseflow config set-key <key>'));
          return;
        }

        const cache = new EntitlementCache(config.apiKey, {
          persistPath: path.join(CACHE_DIR, 'entitlements.enc'),
        });

        const stats = cache.stats();
        console.log(chalk.bold('\n📦 LicenseFlow Local Cache\n'));
        console.log(`  Entries:    ${chalk.cyan(String(stats.size))}`);
        console.log(`  Cache dir:  ${chalk.dim(CACHE_DIR)}`);
        if (stats.keys.length > 0) {
          console.log(`\n  Cached keys:`);
          for (const key of stats.keys) {
            const entry = cache.get(key);
            const source = entry?.source || 'unknown';
            const color = source === 'cache' ? chalk.green : source === 'offline' ? chalk.yellow : chalk.dim;
            console.log(`    ${color('●')} ${key}  (${color(source)})`);
          }
        } else {
          console.log(chalk.dim('\n  No cached entries.'));
        }
        console.log();
      })
  )
  .addCommand(
    new Command('flush')
      .description('Clear all cached entitlements')
      .action(async () => {
        const config = getConfig();
        if (!config.apiKey) {
          console.log(chalk.red('No API key configured. Run: licenseflow config set-key <key>'));
          return;
        }

        const cache = new EntitlementCache(config.apiKey, {
          persistPath: path.join(CACHE_DIR, 'entitlements.enc'),
        });

        const before = cache.stats().size;
        cache.flush();
        console.log(chalk.green(`✓ Flushed ${before} cached entries.`));
      })
  )
  .addCommand(
    new Command('invalidate')
      .description('Invalidate cache for a specific license key')
      .argument('<license-key>', 'License key to invalidate')
      .action(async (licenseKey: string) => {
        const config = getConfig();
        if (!config.apiKey) {
          console.log(chalk.red('No API key configured. Run: licenseflow config set-key <key>'));
          return;
        }

        const cache = new EntitlementCache(config.apiKey, {
          persistPath: path.join(CACHE_DIR, 'entitlements.enc'),
        });

        cache.invalidate(licenseKey);
        console.log(chalk.green(`✓ Invalidated cache for ${licenseKey}`));
      })
  );
