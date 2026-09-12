/**
 * verify-offline command - Cryptographically verify an air-gapped / offline license file
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const verifyOfflineCommand = new Command('verify-offline')
  .description('Cryptographically verify an air-gapped or offline license file (.lic or .json)')
  .argument('<file-path>', 'Path to the .lic or .json offline license file')
  .option('-k, --public-key <key>', 'Ed25519 public key (hex or PEM format)')
  .option('--json', 'Output validation result as JSON')
  .action(async (filePath: string, options: { publicKey?: string; json?: boolean }) => {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`Error: License file not found at ${resolvedPath}`));
      process.exit(1);
    }

    try {
      const fileContent = fs.readFileSync(resolvedPath, 'utf8').trim();
      let payload: Record<string, unknown>;
      let signatureStr = '';
      let pubKeyStr = options.publicKey || '';

      if (fileContent.startsWith('{')) {
        const parsed = JSON.parse(fileContent);
        if (parsed.payload) {
          payload = typeof parsed.payload === 'string' ? JSON.parse(parsed.payload) : parsed.payload;
          signatureStr = parsed.signature || '';
          if (!pubKeyStr && parsed.public_key) {
            pubKeyStr = parsed.public_key;
          }
        } else {
          payload = parsed;
          signatureStr = parsed.signature || '';
          if (!pubKeyStr && parsed.public_key) pubKeyStr = parsed.public_key;
        }
      } else if (fileContent.includes('.')) {
        // Token format: <base64payload>.<base64signature>
        const [p64, s64] = fileContent.split('.');
        payload = JSON.parse(Buffer.from(p64, 'base64url').toString('utf8'));
        signatureStr = s64;
      } else {
        throw new Error('Unsupported offline license file format. Expected JSON or dual-token format.');
      }

      // Verify expiration
      let isExpired = false;
      const expiresAt = (payload.expires_at || payload.expiresAt) as string | undefined;
      if (expiresAt) {
        isExpired = new Date(expiresAt) < new Date();
      }

      // Verify signature if public key provided
      let signatureValid = false;
      let signatureChecked = false;

      if (pubKeyStr && signatureStr) {
        signatureChecked = true;
        const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const dataBuffer = Buffer.from(rawPayload);
        const sigBuffer = signatureStr.length === 128 && /^[0-9a-fA-F]+$/.test(signatureStr)
          ? Buffer.from(signatureStr, 'hex')
          : Buffer.from(signatureStr, 'base64');

        try {
          if (pubKeyStr.includes('-----BEGIN PUBLIC KEY-----')) {
            signatureValid = crypto.verify(null, dataBuffer, pubKeyStr, sigBuffer);
          } else {
            // Hex Ed25519 (32 bytes)
            const cleanHex = pubKeyStr.trim();
            const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
            const derKey = Buffer.concat([derPrefix, Buffer.from(cleanHex, 'hex')]);
            const pubKeyObj = crypto.createPublicKey({
              key: derKey,
              format: 'der',
              type: 'spki',
            });
            signatureValid = crypto.verify(null, dataBuffer, pubKeyObj, sigBuffer);
          }
        } catch {
          signatureValid = false;
        }
      }

      const isValid = (!signatureChecked || signatureValid) && !isExpired;

      if (options.json) {
        console.log(JSON.stringify({
          valid: isValid,
          signature_verified: signatureChecked ? signatureValid : 'not_checked',
          expired: isExpired,
          payload,
        }, null, 2));
        process.exit(isValid ? 0 : 1);
      }

      console.log();
      if (isValid) {
        console.log(chalk.green.bold('✔ Offline License Valid'));
      } else {
        console.log(chalk.red.bold('✖ Offline License Invalid'));
      }

      console.log();
      console.log(chalk.bold('License Details:'));
      console.log(`  File:           ${chalk.gray(filePath)}`);
      console.log(`  Model:          ${chalk.cyan((payload.model || 'offline_airgap') as string)}`);
      if (payload.license_key || payload.licenseKey) {
        console.log(`  License Key:    ${chalk.white((payload.license_key || payload.licenseKey) as string)}`);
      }
      if (expiresAt) {
        console.log(`  Expires:        ${isExpired ? chalk.red(expiresAt) : chalk.green(expiresAt)}`);
      }
      if (signatureChecked) {
        console.log(`  Ed25519 Sig:    ${signatureValid ? chalk.green('Verified') : chalk.red('Failed / Mismatched')}`);
      }
      if (payload.features || payload.entitlements) {
        console.log(`  Features:       ${chalk.yellow(JSON.stringify(payload.features || payload.entitlements))}`);
      }
      console.log();

      process.exit(isValid ? 0 : 1);
    } catch (err: unknown) {
      console.error(chalk.red(`Verification error: ${String(err)}`));
      process.exit(1);
    }
  });
