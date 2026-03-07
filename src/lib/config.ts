/**
 * CLI Configuration Management
 * Stores API keys, endpoints, and cached data
 */

import Conf from 'conf';

interface CLIConfig {
  apiKey?: string;
  apiEndpoint: string;
  licenseKey?: string;
  deviceId?: string;
  leaseKey?: string;
  verbose: boolean;
}

const config = new Conf<CLIConfig>({
  projectName: 'licenseflow-cli',
  defaults: {
    apiEndpoint: 'https://api.licenseflow.dev/v1',
    verbose: false,
  },
});

export function getConfig(): CLIConfig {
  return {
    apiKey: config.get('apiKey'),
    apiEndpoint: config.get('apiEndpoint'),
    licenseKey: config.get('licenseKey'),
    deviceId: config.get('deviceId'),
    leaseKey: config.get('leaseKey'),
    verbose: config.get('verbose'),
  };
}

export function setConfig(key: keyof CLIConfig, value: string | boolean): void {
  config.set(key, value);
}

export function clearConfig(): void {
  config.clear();
}

export function getApiEndpoint(): string {
  return config.get('apiEndpoint');
}

export function getApiKey(): string | undefined {
  return config.get('apiKey');
}

export function getLicenseKey(): string | undefined {
  return config.get('licenseKey');
}

export function getLeaseKey(): string | undefined {
  return config.get('leaseKey');
}

export function setLeaseKey(key: string): void {
  config.set('leaseKey', key);
}

export function clearLeaseKey(): void {
  config.delete('leaseKey');
}
