#!/usr/bin/env node
/**
 * 同步 package.json 版本到其他檔案
 *
 * 會同步到:
 * - claude-ha-assistant/config.yaml (HA Add-on)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// 讀取 package.json 版本
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = packageJson.version;

console.log(`Syncing version: ${version}`);

// 同步到 HA Add-on config.yaml
const configPath = join(rootDir, 'claude-ha-assistant', 'config.yaml');
let configContent = readFileSync(configPath, 'utf-8');
configContent = configContent.replace(/^version:\s*".*"$/m, `version: "${version}"`);
writeFileSync(configPath, configContent);
console.log(`  ✓ claude-ha-assistant/config.yaml`);

console.log('Version sync complete!');
