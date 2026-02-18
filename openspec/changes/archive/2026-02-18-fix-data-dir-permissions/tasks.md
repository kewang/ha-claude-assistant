## 1. 修改 run.sh

- [x] 1.1 在 `run.sh` 現有的 `mkdir -p` 區塊中新增 `/data/conversations` 和 `/data/event-subscriptions` 的目錄建立
- [x] 1.2 在 `run.sh` 現有的 `chown` 區塊中新增這兩個目錄的權限設定（`chown -R claude:claude`）
