---
name: release
description: |
  This skill should be used when the user asks to "release", "publish a new version",
  "bump version", "發佈新版本", "release patch", "release minor", "release major",
  "/release", or wants to create and publish a new version release.
---

# Release Workflow

自動化版本發佈流程，包含測試、commit、版本更新和 push。會智慧分析變更內容並推薦適當的版本類型。

## 使用方式

- `/release` - 自動分析變更並推薦版本類型
- `/release patch` - 強制修補版本 (1.1.4 → 1.1.5)
- `/release minor` - 強制次要版本 (1.1.4 → 1.2.0)
- `/release major` - 強制主要版本 (1.1.4 → 2.0.0)

## 執行步驟

### 1. 執行測試
執行 `npm test` 確保所有測試通過。如果測試失敗，中止發佈並報告錯誤。

### 2. 檢查變更
執行 `git status` 檢查：
- 已暫存的變更
- 未暫存的變更
- 未追蹤的檔案

### 3. 更新文件

#### CHANGELOG.md（兩份，內容必須一致）
根據自上次 tag 以來的 commits，同步更新：
- `CHANGELOG.md`（專案根目錄）
- `claude-ha-assistant/CHANGELOG.md`（Add-on 目錄）

更新方式：
1. 讀取目前 CHANGELOG.md 取得現有格式
2. 在最上方新增一個版本條目（版本號使用即將發佈的新版本）
3. 根據 commits 分類為 `### Added`、`### Fixed`、`### Changed` 等區塊
4. 將相同內容寫入兩份檔案

#### README.md 與 DOCS.md（兩份，內容必須一致）
如果有使用者可見的變更（新功能、設定選項、使用方式等），同步更新：
- `README.md`（專案根目錄）
- `claude-ha-assistant/DOCS.md`（Add-on 目錄，顯示於 HA Add-on 頁面）

兩份檔案內容必須保持一致。修改其中一份時，另一份也要同步更新。

#### CLAUDE.md
如果有程式碼變更，檢查是否需要更新 CLAUDE.md：
- 新增功能需要更新文件
- API 變更需要更新文件
- 重大變更需要更新文件

### 4. Commit 變更
如果有待 commit 的變更：
- 分析變更內容
- 生成適當的 commit message（參考最近的 commit 風格）
- 執行 `git add` 和 `git commit`

### 5. 分析並推薦版本類型
如果用戶未指定版本類型，分析變更並推薦：

**推薦 major 的情況：**
- Breaking changes（不相容的 API 變更）
- 重大架構調整
- Commit message 包含 "BREAKING" 或 "breaking change"

**推薦 minor 的情況：**
- 新增功能（feat）
- 新增 API 或工具
- 新增檔案或模組
- Commit message 包含 "feat" 或 "add"

**推薦 patch 的情況：**
- Bug 修復（fix）
- 文件更新（docs）
- 小幅調整、重構
- 依賴更新
- Commit message 包含 "fix"、"docs"、"refactor"、"chore"

分析方法：
1. `git log $(git describe --tags --abbrev=0)..HEAD --oneline` 查看自上次 tag 以來的 commits
2. `git diff --stat $(git describe --tags --abbrev=0)` 查看變更的檔案
3. 根據 commit messages 的關鍵字和變更範圍做出推薦

### 6. 確認發佈
顯示發佈摘要並詢問確認：
- 推薦的版本類型及原因
- 當前版本 → 新版本
- 變更內容摘要
- 即將執行的操作

使用 AskUserQuestion 讓用戶確認或選擇其他版本類型。

### 7. 執行版本發佈
執行 `npm version [patch|minor|major]`，這會：
- 更新 package.json 版本
- 執行 version hook 同步 config.yaml
- 建立 git commit
- 建立 git tag (v1.x.x)

### 8. Push 到 remote
執行：
- `git push` - 推送 commits
- `git push --tags` - 推送 tags

### 9. 報告結果
顯示：
- 新版本號
- Commit hash
- Tag 名稱
- GitHub release 頁面連結（如適用）

## 版本類型參考 (SemVer)

| 類型 | 說明 | 範例 |
|-----|------|------|
| major | 不相容的 API 變更 | 1.1.4 → 2.0.0 |
| minor | 向後相容的新功能 | 1.1.4 → 1.2.0 |
| patch | 向後相容的問題修復 | 1.1.4 → 1.1.5 |

## 注意事項

- 發佈前確保所有測試通過
- 確保 working directory 已準備好（無意外的未追蹤檔案）
- 遵循語義化版本規範 (SemVer)
- 推薦僅供參考，用戶可在確認時選擇其他版本類型
