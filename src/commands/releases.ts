import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';

const config = new Conf({ projectName: 'licenseflow' });

export const releasesCommand = new Command('releases')
  .description('Check for software updates');

releasesCommand
  .command('check <productId>')
  .description('Check for the latest release of a product')
  .option('-v, --current-version <version>', 'Your current version', '0.0.0')
  .option('-c, --channel <channel>', 'Release channel', 'stable')
  .option('--json', 'Output as JSON')
  .action(async (productId: string, options: any) => {
    const spinner = ora('Checking for updates...').start();

    try {
      const endpoint = (config.get('apiEndpoint') as string) || 'https://api.licenseflow.dev/v1';
      const apiKey = (config.get('apiKey') as string) || process.env.LICENSEFLOW_API_KEY;

      if (!apiKey) {
        spinner.fail(chalk.red('API key required. Run: licenseflow config set apiKey YOUR_KEY'));
        process.exit(1);
      }

      const params = new URLSearchParams({
        product_id: productId,
        channel: options.channel,
      });

      const response = await fetch(`${endpoint}/functions/v1/release-management/latest?${params}`, {
        headers: {
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.status === 404) {
        spinner.info(chalk.yellow('No releases found for this product'));
        return;
      }

      const data = await response.json();

      if (options.json) {
        spinner.stop();
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (!data || data.version === options.currentVersion) {
        spinner.succeed(chalk.green(`You're up to date! (v${options.currentVersion})`));
        return;
      }

      spinner.succeed(chalk.green(`Update available!`));
      console.log(`\n  ${chalk.cyan('Current:')}  v${options.currentVersion}`);
      console.log(`  ${chalk.cyan('Latest:')}   v${chalk.bold(data.version)}`);
      console.log(`  ${chalk.cyan('Channel:')}  ${data.channel || options.channel}`);
      if (data.release_notes) {
        console.log(`\n  ${chalk.cyan('Release Notes:')}`);
        console.log(`  ${data.release_notes}`);
      }
      console.log('');
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
