/**
 * fingerprint command - Generate and display hardware fingerprint
 */

import { Command } from 'commander';
import { collectFingerprint, getSimpleDeviceId, HardwareFingerprint } from '../lib/fingerprint';
import { log, spinner, printKeyValue, printHeader, formatJson } from '../lib/output';
import chalk from 'chalk';

export const fingerprintCommand = new Command('fingerprint')
  .description('Generate hardware fingerprint for this machine')
  .option('--json', 'Output as JSON')
  .option('--simple', 'Generate simple device ID only (faster)')
  .option('--components <list>', 'Show specific components (cpu,gpu,network,disk,motherboard,os,bios,system)', 'all')
  .action(async (options?: {
    json?: boolean;
    simple?: boolean;
    components?: string;
  }) => {
    const spin = spinner('Collecting hardware information...').start();

    try {
      if (options?.simple) {
        const deviceId = await getSimpleDeviceId();
        spin.succeed('Device ID generated');
        
        if (options?.json) {
          console.log(JSON.stringify({ deviceId }));
        } else {
          printHeader('Device ID');
          console.log(deviceId);
        }
        return;
      }

      const result = await collectFingerprint();
      spin.succeed('Hardware fingerprint collected');

      if (options?.json) {
        console.log(formatJson(result));
        return;
      }

      printHeader('Device ID');
      console.log(chalk.cyan(result.deviceId));
      console.log();

      const components = options?.components === 'all' 
        ? ['cpu', 'gpu', 'network', 'disk', 'motherboard', 'os', 'bios', 'system']
        : options?.components?.split(',') || [];

      const fp = result.fingerprint;

      if (components.includes('cpu')) {
        printHeader('CPU');
        printKeyValue('Manufacturer', fp.cpu.manufacturer);
        printKeyValue('Brand', fp.cpu.brand);
        printKeyValue('Cores', `${fp.cpu.physicalCores} physical / ${fp.cpu.cores} logical`);
        printKeyValue('Speed', `${fp.cpu.speed} GHz`);
      }

      if (components.includes('gpu') && fp.gpu.length > 0) {
        printHeader('GPU');
        for (let i = 0; i < fp.gpu.length; i++) {
          const gpu = fp.gpu[i];
          if (fp.gpu.length > 1) console.log(chalk.dim(`  [${i}]`));
          printKeyValue('Vendor', gpu.vendor);
          printKeyValue('Model', gpu.model);
          if (gpu.vram) printKeyValue('VRAM', `${gpu.vram} MB`);
        }
      }

      if (components.includes('network') && fp.network.length > 0) {
        printHeader('Network Interfaces');
        for (const net of fp.network) {
          console.log(`  ${chalk.cyan(net.iface)}: ${net.mac} (${net.type})`);
        }
      }

      if (components.includes('disk') && fp.disk.length > 0) {
        printHeader('Disks');
        for (let i = 0; i < fp.disk.length; i++) {
          const disk = fp.disk[i];
          const sizeGB = Math.round(disk.size / (1024 ** 3));
          console.log(`  ${chalk.cyan(`Disk ${i}`)}: ${disk.type} ${sizeGB}GB ${disk.vendor || ''}`);
          if (disk.serial) {
            console.log(`    Serial: ${chalk.dim(disk.serial)}`);
          }
        }
      }

      if (components.includes('motherboard')) {
        printHeader('Motherboard');
        printKeyValue('Manufacturer', fp.motherboard.manufacturer);
        printKeyValue('Model', fp.motherboard.model);
        if (fp.motherboard.serial) {
          printKeyValue('Serial', fp.motherboard.serial);
        }
      }

      if (components.includes('os')) {
        printHeader('Operating System');
        printKeyValue('Platform', fp.os.platform);
        printKeyValue('Distro', fp.os.distro);
        printKeyValue('Release', fp.os.release);
        printKeyValue('Architecture', fp.os.arch);
        printKeyValue('Hostname', fp.os.hostname);
      }

      if (components.includes('bios')) {
        printHeader('BIOS');
        printKeyValue('Vendor', fp.bios.vendor);
        printKeyValue('Version', fp.bios.version);
        if (fp.bios.releaseDate) {
          printKeyValue('Release Date', fp.bios.releaseDate);
        }
      }

      if (components.includes('system')) {
        printHeader('System');
        printKeyValue('Manufacturer', fp.system.manufacturer);
        printKeyValue('Model', fp.system.model);
        if (fp.system.serial) {
          printKeyValue('Serial', fp.system.serial);
        }
        if (fp.system.uuid) {
          printKeyValue('UUID', fp.system.uuid);
        }
      }

      console.log();
      log.dim(`Collected at: ${result.timestamp}`);

    } catch (error) {
      spin.fail('Failed to collect fingerprint');
      log.error(String(error));
      process.exit(1);
    }
  });
