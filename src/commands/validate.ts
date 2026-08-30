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
  .option('-e, --environment <id>', 'Environment ID for scoped validation')
  .action(async (licenseKey?: string, options?: {
    json?: boolean;
    quiet?: boolean;
    environment?: string;
  }) => {
    const key = licenseKey || getLicenseKey();
    
    if (!key) {
      log.error('License key is required');
      process.exit(1);
    }

    const spin = options?.quiet ? null : spinner('Validating license...').start();

    try {
      const result = await validateLicense(key, options?.environment);

      if (!result.success || !result.data) {
        spin?.fail('Validation failed');
        if (options?.quiet) {
          console.log('invalid');
          process.exit(1);
        }
        log.error(result.error || 'Unknown error');
        process.exit(1);
      }

      const data = result.data;
      const isValid = data.valid && data.status === 'active';

      if (options?.quiet) {
        console.log(isValid ? 'valid' : 'invalid');
        process.exit(isValid ? 0 : 1);
      }

      if (options?.json) {
        console.log(formatJson(data));
        process.exit(isValid ? 0 : 1);
      }

      spin?.succeed(isValid ? 'License is valid!' : 'License is not valid');

      printHeader('License Details');
      printKeyValue('License Key', data.licenseKey || key);
      printKeyValue('Status', data.status === 'active' 
        ? chalk.green(data.status) 
        : chalk.red(data.status || 'unknown'));
      
      if (data.expiresAt) {
        const expires = new Date(data.expiresAt);
        const isExpired = expires < new Date();
        printKeyValue('Expires', isExpired 
          ? chalk.red(expires.toISOString()) 
          : expires.toISOString());
      }

      if (data.entitlements && Object.keys(data.entitlements).length > 0) {
        printHeader('Entitlements');
        for (const [entKey, value] of Object.entries(data.entitlements)) {
          printKeyValue(entKey, String(value));
        }
      }

      process.exit(isValid ? 0 : 1);

    } catch (error) {
      spin?.fail('Validation failed');
      log.error(String(error));
      process.exit(1);
    }
  });
