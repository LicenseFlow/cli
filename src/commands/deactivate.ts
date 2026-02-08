/**
 * deactivate command - Deactivate a license from this machine
 */

import { Command } from 'commander';
import { deactivateLicense } from '../lib/api';
import { getSimpleDeviceId } from '../lib/fingerprint';
import { getLicenseKey, getConfig, setConfig } from '../lib/config';
import { log, spinner } from '../lib/output';

export const deactivateCommand = new Command('deactivate')
  .description('Deactivate a license from this machine')
  .argument('[license-key]', 'License key to deactivate')
  .option('-d, --device-id <id>', 'Device ID to deactivate')
  .option('--clear-config', 'Clear saved license key from config')
  .action(async (licenseKey?: string, options?: {
    deviceId?: string;
    clearConfig?: boolean;
  }) => {
    const key = licenseKey || getLicenseKey();
    
    if (!key) {
      log.error('License key is required. Provide as argument or run: licenseflow config set licenseKey <key>');
      process.exit(1);
    }

    const spin = spinner('Preparing deactivation...').start();

    try {
      let deviceId = options?.deviceId || getConfig().deviceId;
      
      if (!deviceId) {
        spin.text = 'Generating device ID...';
        deviceId = await getSimpleDeviceId();
      }

      spin.text = 'Deactivating license...';
      const result = await deactivateLicense(key, deviceId);

      if (!result.success) {
        spin.fail('Deactivation failed');
        log.error(result.error || 'Unknown error');
        if (result.details) {
          console.log(result.details);
        }
        process.exit(1);
      }

      spin.succeed('License deactivated successfully!');
      log.info(`Device ID: ${deviceId}`);

      if (options?.clearConfig) {
        setConfig('licenseKey', '');
        setConfig('deviceId', '');
        log.info('Cleared saved license key and device ID from config');
      }

    } catch (error) {
      spin.fail('Deactivation failed');
      log.error(String(error));
      process.exit(1);
    }
  });
