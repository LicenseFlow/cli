/**
 * activate command - Activate a license on this machine
 */

import { Command } from 'commander';
import { activateLicense } from '../lib/api';
import { collectFingerprint, getSimpleDeviceId } from '../lib/fingerprint';
import { setConfig, getLicenseKey } from '../lib/config';
import { log, spinner, printKeyValue, printHeader } from '../lib/output';
import { hostname } from 'os';

export const activateCommand = new Command('activate')
  .description('Activate a license on this machine')
  .argument('[license-key]', 'License key to activate')
  .option('-d, --device-id <id>', 'Custom device ID (auto-generated if not provided)')
  .option('-n, --device-name <name>', 'Device name (defaults to hostname)')
  .option('--full-fingerprint', 'Collect full hardware fingerprint')
  .option('--save', 'Save license key to config for future commands')
  .action(async (licenseKey?: string, options?: {
    deviceId?: string;
    deviceName?: string;
    fullFingerprint?: boolean;
    save?: boolean;
  }) => {
    const key = licenseKey || getLicenseKey();
    
    if (!key) {
      log.error('License key is required. Provide as argument or run: licenseflow config set licenseKey <key>');
      process.exit(1);
    }

    const spin = spinner('Collecting device information...').start();

    try {
      let deviceId = options?.deviceId;
      let fingerprint: Record<string, unknown> | undefined;

      if (options?.fullFingerprint) {
        spin.text = 'Collecting hardware fingerprint...';
        const fp = await collectFingerprint();
        deviceId = deviceId || fp.deviceId;
        fingerprint = fp.fingerprint as unknown as Record<string, unknown>;
      } else if (!deviceId) {
        deviceId = await getSimpleDeviceId();
      }

      const deviceName = options?.deviceName || hostname();

      spin.text = 'Activating license...';
      const result = await activateLicense(key, deviceId, deviceName, fingerprint);

      if (!result.success || !result.data) {
        spin.fail('Activation failed');
        log.error(result.error || 'Unknown error');
        if (result.details) {
          console.log(result.details);
        }
        process.exit(1);
      }

      spin.succeed('License activated successfully!');
      
      printHeader('Activation Details');
      printKeyValue('Activation ID', result.data.activation_id);
      printKeyValue('License ID', result.data.license.id);
      printKeyValue('Status', result.data.license.status);
      printKeyValue('Device ID', deviceId);
      printKeyValue('Device Name', deviceName);
      if (result.data.license.expires_at) {
        printKeyValue('Expires', result.data.license.expires_at);
      }

      if (options?.save) {
        setConfig('licenseKey', key);
        setConfig('deviceId', deviceId);
        log.info('License key and device ID saved to config');
      }

    } catch (error) {
      spin.fail('Activation failed');
      log.error(String(error));
      process.exit(1);
    }
  });
