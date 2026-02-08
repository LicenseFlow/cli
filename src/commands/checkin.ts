/**
 * checkin command - Release a license lease
 */

import { Command } from 'commander';
import { checkinLicense } from '../lib/api';
import { getLeaseKey, clearLeaseKey } from '../lib/config';
import { log, spinner, printKeyValue, printHeader, formatDuration } from '../lib/output';

export const checkinCommand = new Command('checkin')
  .description('Release a license lease (check in when done)')
  .argument('[lease-key]', 'Lease key to release (uses saved key if not provided)')
  .option('--json', 'Output as JSON')
  .action(async (leaseKey?: string, options?: { json?: boolean }) => {
    const key = leaseKey || getLeaseKey();
    
    if (!key) {
      log.error('Lease key is required. Provide as argument or checkout first.');
      process.exit(1);
    }

    const spin = spinner('Releasing lease...').start();

    try {
      const result = await checkinLicense(key);

      if (!result.success || !result.data) {
        spin.fail('Check-in failed');
        log.error(result.error || 'Unknown error');
        if (result.details) {
          console.log(result.details);
        }
        process.exit(1);
      }

      // Clear saved lease key
      clearLeaseKey();

      if (options?.json) {
        spin.stop();
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }

      spin.succeed('Lease released successfully!');

      printHeader('Release Details');
      printKeyValue('Lease Key', result.data.lease.lease_key);
      printKeyValue('Status', result.data.lease.status);
      printKeyValue('Used Duration', formatDuration(result.data.lease.used_seconds));
      printKeyValue('Checked In At', result.data.lease.checked_in_at);

      log.info('License slot is now available for other jobs');

    } catch (error) {
      spin.fail('Check-in failed');
      log.error(String(error));
      process.exit(1);
    }
  });
