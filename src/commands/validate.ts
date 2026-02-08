/**
 * validate command - Validate a license key
 */

import { Command } from 'commander';
import { validateLicense } from '../lib/api';
import { getLicenseKey } from '../lib/config';
import { log, spinner, printKeyValue, printHeader, formatJson } from '../lib/output';
import chalk from 'chalk';

export const validateCommand = new Command('validate')
  .description('Validate a license key')
  .argument('[license-key]', 'License key to validate')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Only output valid/invalid (for scripts)')
  .action(async (licenseKey?: string, options?: {
    json?: boolean;
    quiet?: boolean;
  }) => {
    const key = licenseKey || getLicenseKey();
    
    if (!key) {
      log.error('License key is required');
      process.exit(1);
    }

    const spin = options?.quiet ? null : spinner('Validating license...').start();

    try {
      const result = await validateLicense(key);

      if (!result.success || !result.data) {
        spin?.fail('Validation failed');
        if (options?.quiet) {
          console.log('invalid');
          process.exit(1);
        }
        log.error(result.error || 'Unknown error');
        process.exit(1);
      }

      const license = result.data.license;
      const isValid = result.data.valid && license.status === 'active';

      if (options?.quiet) {
        console.log(isValid ? 'valid' : 'invalid');
        process.exit(isValid ? 0 : 1);
      }

      if (options?.json) {
        console.log(formatJson(result.data));
        process.exit(isValid ? 0 : 1);
      }

      spin?.succeed(isValid ? 'License is valid!' : 'License is not valid');

      printHeader('License Details');
      printKeyValue('License ID', license.id);
      printKeyValue('Status', license.status === 'active' 
        ? chalk.green(license.status) 
        : chalk.red(license.status));
      
      if (license.expires_at) {
        const expires = new Date(license.expires_at);
        const isExpired = expires < new Date();
        printKeyValue('Expires', isExpired 
          ? chalk.red(expires.toISOString()) 
          : expires.toISOString());
      }

      if (license.features && Object.keys(license.features).length > 0) {
        printHeader('Features');
        for (const [key, value] of Object.entries(license.features)) {
          printKeyValue(key, String(value));
        }
      }

      process.exit(isValid ? 0 : 1);

    } catch (error) {
      spin?.fail('Validation failed');
      log.error(String(error));
      process.exit(1);
    }
  });
