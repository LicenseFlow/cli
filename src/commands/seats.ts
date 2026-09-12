import { Command } from 'commander';
import chalk from 'chalk';
import { createClient } from '../lib/api';

export function registerSeatsCommands(program: Command) {
  const seats = program
    .command('seats')
    .description('Manage OrgAdmin seat delegation and named seat allocations');

  seats
    .command('list')
    .description('List delegated seats for an organization')
    .requiredOption('-o, --org <organizationId>', 'Target Organization ID')
    .action(async (options) => {
      try {
        const client = createClient();
        const res = await client.get(`/organizations/${options.org}/seats`);
        console.log(chalk.green(`✓ Seats for Organization ${options.org}:`));
        console.table(res.data);
      } catch (err: any) {
        console.error(chalk.red(`Error fetching seats: ${err.message}`));
        process.exit(1);
      }
    });

  seats
    .command('assign')
    .description('Assign a seat to a user email')
    .requiredOption('-o, --org <organizationId>', 'Target Organization ID')
    .requiredOption('-e, --email <userEmail>', 'User Email Address')
    .option('-r, --role <role>', 'Seat Role (user | admin)', 'user')
    .action(async (options) => {
      try {
        const client = createClient();
        console.log(chalk.blue(`Assigning ${options.role} seat to ${options.email}...`));
        const res = await client.post(`/organizations/${options.org}/seats`, {
          email: options.email,
          role: options.role,
        });
        console.log(chalk.green('✓ Seat Assigned Successfully!'));
        console.log(chalk.gray(JSON.stringify(res.data, null, 2)));
      } catch (err: any) {
        console.error(chalk.red(`Error assigning seat: ${err.message}`));
        process.exit(1);
      }
    });

  seats
    .command('revoke')
    .description('Revoke a seat allocation')
    .requiredOption('-s, --seat-id <seatId>', 'Seat Allocation ID')
    .action(async (options) => {
      try {
        const client = createClient();
        await client.delete(`/seats/${options.seatId}`);
        console.log(chalk.green(`✓ Seat ${options.seatId} revoked successfully.`));
      } catch (err: any) {
        console.error(chalk.red(`Error revoking seat: ${err.message}`));
        process.exit(1);
      }
    });
}
