/**
 * Advanced Hardware Fingerprinting
 * 
 * Collects unique hardware identifiers:
 * - CPU: Model, cores, speed, serial
 * - GPU: Vendor, model, VRAM
 * - Network: MAC addresses (primary)
 * - Disk: Serial numbers
 * - Motherboard: Serial, manufacturer
 * - OS: Platform, version, architecture
 */

import * as si from 'systeminformation';
import { createHash } from 'crypto';

export interface HardwareFingerprint {
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speed: number;
    serial?: string;
  };
  gpu: {
    vendor: string;
    model: string;
    vram?: number;
  }[];
  network: {
    mac: string;
    iface: string;
    type: string;
  }[];
  disk: {
    type: string;
    size: number;
    serial?: string;
    vendor?: string;
  }[];
  motherboard: {
    manufacturer: string;
    model: string;
    serial?: string;
  };
  os: {
    platform: string;
    distro: string;
    release: string;
    arch: string;
    hostname: string;
  };
  bios: {
    vendor: string;
    version: string;
    releaseDate?: string;
  };
  system: {
    manufacturer: string;
    model: string;
    serial?: string;
    uuid?: string;
  };
}

export interface FingerprintResult {
  fingerprint: HardwareFingerprint;
  deviceId: string; // SHA-256 hash of key identifiers
  timestamp: string;
}

/**
 * Collect comprehensive hardware fingerprint
 */
export async function collectFingerprint(): Promise<FingerprintResult> {
  const [cpu, graphics, network, disk, baseboard, os, bios, system] = await Promise.all([
    si.cpu(),
    si.graphics(),
    si.networkInterfaces(),
    si.diskLayout(),
    si.baseboard(),
    si.osInfo(),
    si.bios(),
    si.system(),
  ]);

  // Filter to physical network interfaces (exclude virtual/loopback)
  const physicalNetworks = (network as si.Systeminformation.NetworkInterfacesData[])
    .filter(n => n.mac && n.mac !== '00:00:00:00:00:00' && !n.virtual && n.operstate === 'up')
    .map(n => ({
      mac: n.mac,
      iface: n.iface,
      type: n.type,
    }));

  const fingerprint: HardwareFingerprint = {
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
      speed: cpu.speed,
      // Note: CPU serial is not available on most systems
    },
    gpu: graphics.controllers.map(g => ({
      vendor: g.vendor,
      model: g.model,
      vram: g.vram,
    })),
    network: physicalNetworks,
    disk: disk.map(d => ({
      type: d.type,
      size: d.size,
      serial: d.serialNum || undefined,
      vendor: d.vendor,
    })),
    motherboard: {
      manufacturer: baseboard.manufacturer,
      model: baseboard.model,
      serial: baseboard.serial || undefined,
    },
    os: {
      platform: os.platform,
      distro: os.distro,
      release: os.release,
      arch: os.arch,
      hostname: os.hostname,
    },
    bios: {
      vendor: bios.vendor,
      version: bios.version,
      releaseDate: bios.releaseDate || undefined,
    },
    system: {
      manufacturer: system.manufacturer,
      model: system.model,
      serial: system.serial || undefined,
      uuid: system.uuid || undefined,
    },
  };

  // Generate stable device ID from key identifiers
  const deviceId = generateDeviceId(fingerprint);

  return {
    fingerprint,
    deviceId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate a stable device ID from hardware fingerprint
 * Uses: CPU brand + primary MAC + system UUID/serial + motherboard serial
 */
function generateDeviceId(fp: HardwareFingerprint): string {
  const components = [
    fp.cpu.brand,
    fp.cpu.physicalCores.toString(),
    fp.network[0]?.mac || 'no-mac',
    fp.system.uuid || fp.system.serial || 'no-uuid',
    fp.motherboard.serial || 'no-mb-serial',
  ];

  const data = components.join('|');
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Get a simple device ID (faster, less comprehensive)
 */
export async function getSimpleDeviceId(): Promise<string> {
  const [cpu, network, system] = await Promise.all([
    si.cpu(),
    si.networkInterfaces(),
    si.system(),
  ]);

  const primaryMac = (network as si.Systeminformation.NetworkInterfacesData[])
    .find(n => n.mac && n.mac !== '00:00:00:00:00:00' && !n.virtual)?.mac || 'no-mac';

  const components = [
    cpu.brand,
    primaryMac,
    system.uuid || system.serial || 'no-uuid',
  ];

  return createHash('sha256').update(components.join('|')).digest('hex');
}

/**
 * Compare two fingerprints and calculate similarity score
 * Returns 0-100 (100 = identical)
 */
export function compareFingerprints(
  fp1: HardwareFingerprint,
  fp2: HardwareFingerprint
): number {
  let score = 0;
  let maxScore = 0;

  // CPU (high weight)
  maxScore += 30;
  if (fp1.cpu.brand === fp2.cpu.brand) score += 15;
  if (fp1.cpu.physicalCores === fp2.cpu.physicalCores) score += 10;
  if (fp1.cpu.manufacturer === fp2.cpu.manufacturer) score += 5;

  // MAC addresses (high weight)
  maxScore += 25;
  const macs1 = new Set(fp1.network.map(n => n.mac));
  const macs2 = new Set(fp2.network.map(n => n.mac));
  const macOverlap = [...macs1].filter(m => macs2.has(m)).length;
  score += Math.min(25, (macOverlap / Math.max(macs1.size, macs2.size)) * 25);

  // System UUID/serial (high weight)
  maxScore += 20;
  if (fp1.system.uuid && fp2.system.uuid && fp1.system.uuid === fp2.system.uuid) {
    score += 20;
  } else if (fp1.system.serial && fp2.system.serial && fp1.system.serial === fp2.system.serial) {
    score += 15;
  }

  // Motherboard (medium weight)
  maxScore += 15;
  if (fp1.motherboard.serial && fp2.motherboard.serial && 
      fp1.motherboard.serial === fp2.motherboard.serial) {
    score += 15;
  } else if (fp1.motherboard.model === fp2.motherboard.model) {
    score += 5;
  }

  // OS (low weight - can change)
  maxScore += 10;
  if (fp1.os.platform === fp2.os.platform) score += 5;
  if (fp1.os.arch === fp2.os.arch) score += 3;
  if (fp1.os.hostname === fp2.os.hostname) score += 2;

  return Math.round((score / maxScore) * 100);
}
