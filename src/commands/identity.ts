import { Command } from 'commander';
import chalk from 'chalk';
import { createClient } from '../lib/api';

export function registerIdentityCommands(program: Command) {
  const identity = program
    .command('identity')
    .description('Manage keyless identity-based entitlements and SSO resolution');

  identity
    .command('resolve')
    .description('Resolve keyless entitlements for an authenticated user')
    .requiredOption('-t, --token <jwt>', 'User OIDC / SSO Bearer Access Token')
    .requiredOption('-o, --org <organizationId>', 'Target Organization ID')
    .requiredOption('-p, --product <productId>', 'Target Product ID')
    .action(async (options) => {
      try {
        const client = createClient();
        console.log(chalk.blue(`Resolving identity entitlements for org ${options.org}...`));

        const res = await client.post('/entitlements/resolve-identity', {
          organization_id: options.org,
          product_id: options.product,
        }, {
          headers: {
            Authorization: `Bearer ${options.token}`,
          },
        });

        console.log(chalk.green('✓ Identity Resolved Successfully!'));
        console.log(chalk.gray(JSON.stringify(res.data, null, 2)));
      } catch (err: any) {
        console.error(chalk.red(`Error resolving identity: ${err.message}`));
        process.exit(1);
      }
    });
}
