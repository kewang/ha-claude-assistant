#!/usr/bin/env node
/**
 * Home Assistant 連線測試腳本
 */

import { config } from 'dotenv';
import { HAClient } from './core/ha-client.js';

config();

async function main() {
  console.log('🏠 Home Assistant 連線測試\n');
  console.log(`URL: ${process.env.HA_URL}`);
  console.log(`Token: ${process.env.HA_TOKEN?.substring(0, 10)}...\n`);

  const client = new HAClient();

  // 1. 測試連線
  console.log('1. 測試 API 連線...');
  try {
    const result = await client.checkConnection();
    console.log(`   ✅ 成功: ${result.message}\n`);
  } catch (error) {
    console.error(`   ❌ 失敗: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }

  // 2. 取得設定
  console.log('2. 取得 HA 設定...');
  try {
    const config = await client.getConfig();
    console.log(`   ✅ 版本: ${config.version}`);
    console.log(`   ✅ 位置: ${config.location_name}`);
    console.log(`   ✅ 時區: ${config.time_zone}\n`);
  } catch (error) {
    console.error(`   ⚠️ 無法取得設定: ${error instanceof Error ? error.message : error}\n`);
  }

  // 3. 列出實體統計
  console.log('3. 實體統計...');
  try {
    const states = await client.getStates();
    const domains: Record<string, number> = {};

    for (const state of states) {
      const domain = state.entity_id.split('.')[0];
      domains[domain] = (domains[domain] || 0) + 1;
    }

    console.log(`   ✅ 總共 ${states.length} 個實體`);
    const sortedDomains = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [domain, count] of sortedDomains) {
      console.log(`      - ${domain}: ${count}`);
    }
    console.log();
  } catch (error) {
    console.error(`   ❌ 失敗: ${error instanceof Error ? error.message : error}\n`);
  }

  // 4. 列出部分燈具
  console.log('4. 燈具列表（前 5 個）...');
  try {
    const lights = await client.listEntitiesByType('light');
    const sample = lights.slice(0, 5);

    if (sample.length === 0) {
      console.log('   ℹ️ 沒有找到燈具\n');
    } else {
      for (const light of sample) {
        console.log(`   - ${light.friendly_name} (${light.entity_id}): ${light.state}`);
      }
      if (lights.length > 5) {
        console.log(`   ... 還有 ${lights.length - 5} 個燈具`);
      }
      console.log();
    }
  } catch (error) {
    console.error(`   ❌ 失敗: ${error instanceof Error ? error.message : error}\n`);
  }

  // 5. 列出部分感測器
  console.log('5. 感測器列表（前 5 個）...');
  try {
    const sensors = await client.listEntitiesByType('sensor');
    const sample = sensors.slice(0, 5);

    if (sample.length === 0) {
      console.log('   ℹ️ 沒有找到感測器\n');
    } else {
      for (const sensor of sample) {
        console.log(`   - ${sensor.friendly_name}: ${sensor.state}`);
      }
      if (sensors.length > 5) {
        console.log(`   ... 還有 ${sensors.length - 5} 個感測器`);
      }
      console.log();
    }
  } catch (error) {
    console.error(`   ❌ 失敗: ${error instanceof Error ? error.message : error}\n`);
  }

  console.log('🎉 測試完成！Home Assistant 連線正常。');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
