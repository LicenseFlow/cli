/**
 * checkout command - Checkout a temporary license lease for CI/CD
 */

import { Command } from 'commander';
import { checkoutLicense } from '../lib/api';
import { getLicenseKey, setLeaseKey } from '../lib/config';
import { log, spinner, printKeyValue, printHeader, formatDuration } from '../lib/output';

export const checkoutCommand = new Command('checkout')
  .description('Checkout a temporary license lease (for CI/CD pipelines)')
  .argument('[license-key]', 'License key to checkout')
  .requiredOption('-r, --requester <id>', 'Requester ID (CI job ID, machine name, etc.)')
  .option('-t, --duration <seconds>', 'Lease duration in seconds (default: 7200 = 2h)', '7200')
  .option('--type <type>', 'Requester type: ci_job, machine, or user', 'ci_job')
  .option('--pipeline <name>', 'Pipeline name for metadata')
  .option('--branch <name>', 'Branch name for metadata')
  .option('--json', 'Output as JSON')
  .action(async (licenseKey?: string, options?: {
    requester: string;
    duration?: string;
    type?: 'ci_job' | 'machine' | 'user';
    pipeline?: string;
    branch?: string;
    json?: boolean;
  }) => {
    const key = licenseKey || getLicenseKey();
    
    if (!key) {
      log.error('License key is required');
      process.exit(1);
    }

    if (!options?.requester) {
      log.error('Requester ID is required (--requester)');
      process.exit(1);
    }

    const spin = spinner('Checking out license...').start();

    try {
      const durationSeconds = parseInt(options.duration || '7200', 10);
      const metadata: Record<string, unknown> = {};
      
      if (options.pipeline) metadata.pipeline = options.pipeline;
      if (options.branch) metadata.branch = options.branch;
      if (process.env.CI) metadata.ci = true;
      if (process.env.GITHUB_ACTIONS) metadata.github_run_id = process.env.GITHUB_RUN_ID;
      if (process.env.GITLAB_CI) metadata.gitlab_job_id = process.env.CI_JOB_ID;

      const result = await checkoutLicense(
        key,
        options.requester,
        durationSeconds,
        options.type as 'ci_job' | 'machine' | 'user',
        Object.keys(metadata).length > 0 ? metadata : undefined
      );

      if (!result.success || !result.data) {
        spin.fail('Checkout failed');
        log.error(result.error || 'Unknown error');
        if (result.details) {
          console.log(result.details);
        }
        process.exit(1);
      }

      // Save lease key for easy checkin later
      setLeaseKey(result.data.lease.lease_key);

      if (options?.json) {
        spin.stop();
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }

      spin.succeed('License checked out successfully!');

      printHeader('Lease Details');
      printKeyValue('Lease Key', result.data.lease.lease_key);
      printKeyValue('License ID', result.data.lease.license_id);
      printKeyValue('Duration', formatDuration(result.data.lease.duration_seconds));
      printKeyValue('Expires At', result.data.lease.expires_at);
      printKeyValue('Requester', options.requester);

      console.log();
      log.info('Run "licenseflow checkin" when done to release the lease early');
      log.dim(`Or use: licenseflow checkin ${result.data.lease.lease_key}`);

    } catch (error) {
      spin.fail('Checkout failed');
      log.error(String(error));
      process.exit(1);
    }
  });
