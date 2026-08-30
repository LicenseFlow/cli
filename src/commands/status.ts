/**
 * status command - Check license or lease status
 */

import { Command } from 'commander';
import { validateLicense, getLeaseStatus } from '../lib/api';
import { getLicenseKey, getLeaseKey } from '../lib/config';
import { log, spinner, printKeyValue, printHeader, formatDuration } from '../lib/output';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Check status of a license or lease')
  .option('-l, --license [key]', 'Check license status')
  .option('-L, --lease [key]', 'Check lease status')
  .option('--json', 'Output as JSON')
  .action(async (options?: {
    license?: string | boolean;
    lease?: string | boolean;
    json?: boolean;
  }) => {
    // Default to checking lease if we have one saved
    const savedLeaseKey = getLeaseKey();
    const savedLicenseKey = getLicenseKey();

    if (!options?.license && !options?.lease) {
      if (savedLeaseKey) {
        options = { ...options, lease: savedLeaseKey };
      } else if (savedLicenseKey) {
        options = { ...options, license: savedLicenseKey };
      } else {
        log.error('Specify --license or --lease, or save a license key first');
        process.exit(1);
      }
    }

    const spin = spinner('Checking status...').start();

    try {
      // Check lease status
      if (options?.lease) {
        const leaseKey = typeof options.lease === 'string' ? options.lease : savedLeaseKey;
        if (!leaseKey) {
          spin.fail('No lease key provided or saved');
          process.exit(1);
        }

        const result = await getLeaseStatus(leaseKey);

        if (!result.success || !result.data) {
          spin.fail('Failed to get lease status');
          log.error(result.error || 'Unknown error');
          process.exit(1);
        }

        if (options?.json) {
          spin.stop();
          console.log(JSON.stringify(result.data, null, 2));
          return;
        }

        const lease = result.data.lease;
        const isValid = result.data.is_valid;

        spin.succeed(isValid ? 'Lease is active' : `Lease is ${lease.status}`);

        printHeader('Lease Status');
        printKeyValue('Lease Key', lease.lease_key);
        printKeyValue('Status', isValid ? chalk.green(lease.status) : chalk.red(lease.status));
        printKeyValue('Requester', lease.requester_id);
        
        if (isValid) {
          printKeyValue('Remaining', formatDuration(lease.remaining_seconds));
        }
        printKeyValue('Expires At', lease.expires_at);

        printHeader('License');
        printKeyValue('License ID', result.data.license.license_id);
        printKeyValue('License Status', result.data.license.status);

        process.exit(isValid ? 0 : 1);
      }

      // Check license status
      if (options?.license) {
        const licenseKey = typeof options.license === 'string' ? options.license : savedLicenseKey;
        if (!licenseKey) {
          spin.fail('No license key provided or saved');
          process.exit(1);
        }

        const result = await validateLicense(licenseKey);

        if (!result.success || !result.data) {
          spin.fail('Failed to get license status');
          log.error(result.error || 'Unknown error');
          process.exit(1);
        }

        if (options?.json) {
          spin.stop();
          console.log(JSON.stringify(result.data, null, 2));
          return;
        }

        const data = result.data;
        const isValid = data.valid && data.status === 'active';

        spin.succeed(isValid ? 'License is valid' : 'License is not valid');

        printHeader('License Status');
        printKeyValue('License Key', data.licenseKey || licenseKey);
        printKeyValue('Status', isValid ? chalk.green(data.status || 'active') : chalk.red(data.status || 'unknown'));
        
        if (data.expiresAt) {
          const expires = new Date(data.expiresAt);
          const isExpired = expires < new Date();
          printKeyValue('Expires', isExpired 
            ? chalk.red(expires.toISOString()) 
            : expires.toISOString());
        }

        process.exit(isValid ? 0 : 1);
      }

    } catch (error) {
      spin.fail('Status check failed');
      log.error(String(error));
      process.exit(1);
    }
  });
