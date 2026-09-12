import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';

const config = new Conf({ projectName: 'licenseflow' });

export const entitlementsCommand = new Command('entitlements')
  .description('Manage license entitlements');

// ── entitlements list ──
entitlementsCommand
  .command('list')
  .description('List all entitlements for your organization')
  .option('--json', 'Output as JSON')
  .action(async (options: any) => {
    const spinner = ora('Fetching entitlements...').start();

    try {
      const endpoint = (config.get('apiEndpoint') as string) || 'https://api.licenseflow.dev/v1';
      const apiKey = (config.get('apiKey') as string) || process.env.LICENSEFLOW_API_KEY;

      if (!apiKey) {
        spinner.fail(chalk.red('API key required. Run: licenseflow config set apiKey YOUR_KEY'));
        process.exit(1);
      }

      const response = await fetch(`${endpoint}/functions/v1/manage-entitlements`, {
        headers: {
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();

      if (options.json) {
        spinner.stop();
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      spinner.stop();
      if (Array.isArray(data) && data.length > 0) {
        console.log(chalk.bold(`\n  Entitlements (${data.length})\n`));
        for (const ent of data) {
          console.log(`  ${chalk.cyan(ent.code)} ${chalk.dim('—')} ${ent.name} ${chalk.dim(`(${ent.data_type})`)}`);
        }
      } else {
        console.log(chalk.yellow('\n  No entitlements found'));
      }
      console.log('');
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ── entitlements check ──
entitlementsCommand
  .command('check <licenseKey> <featureCode>')
  .description('Check if a license has a specific entitlement')
  .option('--json', 'Output as JSON')
  .action(async (licenseKey: string, featureCode: string, options: any) => {
    const spinner = ora('Verifying license entitlement...').start();

    try {
      const endpoint = (config.get('apiEndpoint') as string) || 'https://api.licenseflow.dev/v1';
      const apiKey = (config.get('apiKey') as string) || process.env.LICENSEFLOW_API_KEY;

      if (!apiKey) {
        spinner.fail(chalk.red('API key required. Run: licenseflow config set apiKey YOUR_KEY'));
        process.exit(1);
      }

      // First verify the license to get entitlements
      const response = await fetch(`${endpoint}/functions/v1/verify-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = (await response.json()) as any;

      if (options.json) {
        spinner.stop();
        const result = {
          license_key: licenseKey,
          feature_code: featureCode,
          has_feature: false,
          entitlement_value: null as any,
        };
        if (data.valid && data.entitlements) {
          const ent = data.entitlements[featureCode];
          result.has_feature = ent === true || ent?.enabled === true || ent?.value === true;
          result.entitlement_value = ent ?? null;
        }
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!data.valid) {
        spinner.fail(chalk.red('License is not valid'));
        process.exit(1);
      }

      const entitlements = data.entitlements || {};
      const ent = entitlements[featureCode];

      if (ent === undefined || ent === null) {
        spinner.fail(chalk.yellow(`Feature "${featureCode}" not found in license entitlements`));
        process.exit(1);
      }

      const hasFeature = ent === true || ent?.enabled === true || ent?.value === true;

      if (hasFeature) {
        spinner.succeed(chalk.green(`✓ Feature "${featureCode}" is ${chalk.bold('ENABLED')}`));
      } else {
        spinner.fail(chalk.red(`✗ Feature "${featureCode}" is ${chalk.bold('DISABLED')}`));
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
