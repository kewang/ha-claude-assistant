/**
 * 版本資訊模組
 *
 * 從 package.json 讀取版本號，確保全專案版本一致。
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

export const VERSION: string = packageJson.version;
