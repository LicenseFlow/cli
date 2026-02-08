#!/usr/bin/env node
/**
 * LicenseFlow CLI
 * 
 * Commands:
 *   activate    - Activate a license on this machine
 *   deactivate  - Deactivate a license
 *   validate    - Validate a license key
 *   checkout    - Checkout a temporary license lease (for CI/CD)
 *   checkin     - Release a license lease
 *   status      - Check license or lease status
 *   fingerprint - Generate hardware fingerprint
 *   config      - Manage CLI configuration
 */

import { Command } from 'commander';
import { activateCommand } from './commands/activate';
import { deactivateCommand } from './commands/deactivate';
import { validateCommand } from './commands/validate';
import { checkoutCommand } from './commands/checkout';
import { checkinCommand } from './commands/checkin';
import { statusCommand } from './commands/status';
import { fingerprintCommand } from './commands/fingerprint';
import { configCommand } from './commands/config';

const program = new Command();

program
  .name('licenseflow')
  .description('LicenseFlow CLI - License management for developers')
  .version('1.0.0');

// Register all commands
program.addCommand(activateCommand);
program.addCommand(deactivateCommand);
program.addCommand(validateCommand);
program.addCommand(checkoutCommand);
program.addCommand(checkinCommand);
program.addCommand(statusCommand);
program.addCommand(fingerprintCommand);
program.addCommand(configCommand);

// Parse arguments
program.parse();
