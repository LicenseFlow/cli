/**
 * config command - Manage CLI configuration
 */

import { Command } from 'commander';
import { getConfig, setConfig, clearConfig, getApiEndpoint } from '../lib/config';
import { log, printKeyValue, printHeader } from '../lib/output';
import chalk from 'chalk';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = getConfig();
    
    printHeader('LicenseFlow CLI Configuration');
    printKeyValue('API Endpoint', config.apiEndpoint);
    printKeyValue('API Key', config.apiKey ? chalk.dim('••••' + config.apiKey.slice(-4)) : undefined);
    printKeyValue('License Key', config.licenseKey ? chalk.dim(config.licenseKey.substring(0, 12) + '...') : undefined);
    printKeyValue('Device ID', config.deviceId ? chalk.dim(config.deviceId.substring(0, 16) + '...') : undefined);
    printKeyValue('Lease Key', config.leaseKey);
    printKeyValue('Verbose', config.verbose);
  });

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    const validKeys = ['apiKey', 'apiEndpoint', 'licenseKey', 'deviceId', 'verbose'];
    
    if (!validKeys.includes(key)) {
      log.error(`Invalid config key: ${key}`);
      log.info(`Valid keys: ${validKeys.join(', ')}`);
      process.exit(1);
    }

    const finalValue = key === 'verbose' ? value === 'true' : value;
    setConfig(key as keyof ReturnType<typeof getConfig>, finalValue as string | boolean);
    log.success(`Set ${key} = ${key === 'apiKey' ? '••••' : value}`);
  });

configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action((key: string) => {
    const config = getConfig();
    const value = config[key as keyof typeof config];
    
    if (value === undefined) {
      log.warn(`${key} is not set`);
    } else if (key === 'apiKey') {
      console.log('••••' + String(value).slice(-4));
    } else {
      console.log(value);
    }
  });

configCommand
  .command('clear')
  .description('Clear all configuration')
  .option('-f, --force', 'Skip confirmation')
  .action((options?: { force?: boolean }) => {
    if (!options?.force) {
      log.warn('This will clear all saved configuration including API keys');
      log.info('Run with --force to confirm');
      return;
    }

    clearConfig();
    log.success('Configuration cleared');
  });

configCommand
  .command('path')
  .description('Show config file location')
  .action(() => {
    // Conf stores in platform-specific location
    const os = process.platform;
    let path: string;
    
    if (os === 'win32') {
      path = `${process.env.APPDATA}\\licenseflow-cli-nodejs\\config.json`;
    } else if (os === 'darwin') {
      path = `${process.env.HOME}/Library/Preferences/licenseflow-cli-nodejs/config.json`;
    } else {
      path = `${process.env.HOME}/.config/licenseflow-cli-nodejs/config.json`;
    }
    
    console.log(path);
  });
