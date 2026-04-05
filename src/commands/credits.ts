import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';

const config = new Conf({ projectName: 'licenseflow' });

export const creditsCommand = new Command('credits')
  .description('Manage usage-based credits');

// ── credits consume ──
creditsCommand
  .command('consume <amount>')
  .description('Consume credits from your organization balance')
  .option('-d, --description <desc>', 'Description for the transaction')
  .option('-p, --product <id>', 'Product ID to scope credits to')
  .option('-c, --currency <currency>', 'Credit currency (default: credits)', 'credits')
  .option('--json', 'Output as JSON')
  .action(async (amountStr: string, options: any) => {
    const spinner = ora('Consuming credits...').start();
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      spinner.fail(chalk.red('Amount must be a positive integer'));
      process.exit(1);
    }

    try {
      const endpoint = (config.get('apiEndpoint') as string) || 'https://api.licenseflow.dev/v1';
      const apiKey = (config.get('apiKey') as string) || process.env.LICENSEFLOW_API_KEY;

      if (!apiKey) {
        spinner.fail(chalk.red('API key required. Run: licenseflow config set apiKey YOUR_KEY'));
        process.exit(1);
      }

      const payload: any = { amount };
      if (options.description) payload.description = options.description;
      if (options.product) payload.product_id = options.product;
      if (options.currency !== 'credits') payload.currency = options.currency;

      const response = await fetch(`${endpoint}/functions/v1/consume-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (options.json) {
        spinner.stop();
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (data.success) {
        spinner.succeed(chalk.green(`Consumed ${data.consumed} credits. Remaining: ${data.remaining}`));
      } else {
        spinner.fail(chalk.red(`Failed: ${data.error}`));
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ── credits balance ──
creditsCommand
  .command('balance')
  .description('Check your organization credit balance')
  .option('-p, --product <id>', 'Product ID to scope')
  .option('-c, --currency <currency>', 'Credit currency')
  .option('--json', 'Output as JSON')
  .action(async (options: any) => {
    const spinner = ora('Fetching credit balance...').start();

    try {
      const endpoint = (config.get('apiEndpoint') as string) || 'https://api.licenseflow.dev/v1';
      const apiKey = (config.get('apiKey') as string) || process.env.LICENSEFLOW_API_KEY;

      if (!apiKey) {
        spinner.fail(chalk.red('API key required. Run: licenseflow config set apiKey YOUR_KEY'));
        process.exit(1);
      }

      const params = new URLSearchParams();
      if (options.product) params.set('product_id', options.product);
      if (options.currency) params.set('currency', options.currency);
      const query = params.toString() ? `?${params.toString()}` : '';

      const response = await fetch(`${endpoint}/functions/v1/get-credit-balance${query}`, {
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
      if (data.balance !== undefined) {
        console.log(chalk.bold('\n  Credit Balance'));
        console.log(`  ${chalk.cyan('Balance:')}     ${chalk.green(data.balance)}`);
        console.log(`  ${chalk.cyan('Granted:')}     ${data.lifetime_granted}`);
        console.log(`  ${chalk.cyan('Consumed:')}    ${data.lifetime_consumed}`);
        console.log(`  ${chalk.cyan('Currency:')}    ${data.currency}`);
      } else if (data.balances) {
        console.log(chalk.bold(`\n  Credit Balances (${data.balances.length})`));
        for (const b of data.balances) {
          console.log(`  ${chalk.cyan(b.currency)}: ${chalk.green(b.balance)} (granted: ${b.lifetime_granted}, consumed: ${b.lifetime_consumed})`);
        }
      }
      console.log('');
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
