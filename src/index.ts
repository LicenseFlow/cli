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
import { creditsCommand } from './commands/credits';
import { entitlementsCommand } from './commands/entitlements';
import { releasesCommand } from './commands/releases';
import { registerIdentityCommands } from './commands/identity';
import { registerSeatsCommands } from './commands/seats';
import { cacheCommand } from './commands/cache';
import { importCommand } from './commands/import';

const program = new Command();

program
  .name('licenseflow')
  .description('LicenseFlow CLI - License management for developers')
  .version('2.2.0');

// Register all commands
program.addCommand(activateCommand);
program.addCommand(deactivateCommand);
program.addCommand(validateCommand);
program.addCommand(checkoutCommand);
program.addCommand(checkinCommand);
program.addCommand(statusCommand);
program.addCommand(fingerprintCommand);
program.addCommand(configCommand);
program.addCommand(creditsCommand);
program.addCommand(entitlementsCommand);
program.addCommand(releasesCommand);
registerIdentityCommands(program);
registerSeatsCommands(program);
program.addCommand(cacheCommand);
program.addCommand(importCommand);

// Parse arguments
program.parse(process.argv);
