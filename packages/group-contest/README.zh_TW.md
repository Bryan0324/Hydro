# @hydrooj/group-contest

Hydro OJ 的「**分組比賽**」擴充套件。在現有比賽基礎上新增組別層，讓參賽者以隊伍為單位參賽；計分時以組為單位聚合成員分數，並呈現組別排行榜。

---

## 功能特色

- 參賽者可在使用 `group` 規則的比賽中建立或加入分組。
- 每位用戶在同一場比賽中只能屬於一個組別。
- 組別排行榜以各題「組內最高分成員」的成績加總為組別總分。
- 隊長（或比賽管理員）可重新命名、調整人數上限或刪除組別。
- 每日自動清理空組別。
- 多語言支援：`zh`（簡體中文）、`zh_TW`（繁體中文）、`en`（英文）。

---

## 套件結構

```
packages/group-contest/
├── package.json
├── tsconfig.json
├── templates/
│   ├── group_contest_list.html        # 分組列表頁
│   ├── group_contest_detail.html      # 分組詳情／管理頁
│   └── group_contest_scoreboard.html  # 組別排行榜頁
└── src/
    ├── index.ts     # apply() 入口 — 路由、事件、UI 注入、i18n
    ├── model.ts     # GroupModel — MongoDB 資料存取層
    ├── handler.ts   # HTTP 路由處理器
    └── rule.ts      # 自訂比賽規則 "group"（繼承 OI 規則）
```

---

## 資料模型

組別資料儲存於獨立的 MongoDB 集合 `group-contest.groups`，不污染 `document` 集合。

### `GroupDoc` 欄位

| 欄位 | 型別 | 說明 |
|------|------|------|
| `_id` | `ObjectId` | 組別唯一識別碼 |
| `domainId` | `string` | 域識別碼 |
| `tid` | `ObjectId` | 對應比賽 ID |
| `name` | `string` | 組別名稱 |
| `captain` | `number` | 隊長的 UID |
| `members` | `number[]` | 所有成員 UID（含隊長） |
| `createdAt` | `Date` | 建立時間 |
| `maxSize` | `number?` | 最大人數（可選） |

### 資料庫索引

| 索引 | 用途 |
|------|------|
| `{ domainId, tid }` | 查詢某場比賽的所有組別 |
| `{ domainId, tid, members }` | 快速查找某用戶所屬組別 |

---

## 比賽規則：`group`

建立比賽時選擇 **「分組制（OI）」** 即可啟用組別計分。

### 計分邏輯

每道題目的組別得分為該組**任一成員的最高得分**，組別總分為各題最高分之加總。

```
組別總分 = Σ max(成員得分[題目]) （各題取組內最高）
```

比較前會套用 `tdoc.score` 中定義的題目加權比率。

### 可見性

與 OI 規則相同——比賽結束後才公開提交記錄、個人成績及排行榜。

---

## HTTP 路由

| 路由名稱 | URL | 方法 | 說明 |
|----------|-----|------|------|
| `group_contest_list` | `/contest/:tid/group` | `GET` | 顯示所有組別與成員 |
| `group_contest_list` | `/contest/:tid/group` | `POST _operation=create` | 建立組別（成為隊長） |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `GET` | 組別詳情 |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=join` | 加入組別 |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=leave` | 退出組別 |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=edit` | 修改組別名稱或人數上限 |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=delete` | 刪除組別 |
| `group_contest_scoreboard` | `/contest/:tid/group/scoreboard` | `GET` | 組別排行榜 |

### 權限規則

- **建立組別**：需有 `PERM_ATTEND_CONTEST` 權限，且用戶已報名該比賽。
- **加入組別**：條件同上。同一場比賽中每位用戶只能屬於一個組別。
- **編輯／刪除組別**：僅限隊長或比賽管理員（`PERM_EDIT_CONTEST`）。
- **退出組別**：非隊長成員皆可。隊長不能退出，如需離開須先刪除組別。
- **修改 `maxSize`**：新值必須 ≥ 目前成員人數。

---

## 事件

| 事件 | 行為 |
|------|------|
| `contest/register` | 用戶報名 `group` 規則的比賽時，系統會發站內信提醒其加入或建立分組。 |
| `task/daily` | 自動刪除成員數為零的空組別。 |

---

## 國際化鍵值

| 鍵 | 繁體中文 |
|----|---------|
| `group_contest_list` | 分組列表 |
| `group_contest_detail` | 分組詳情 |
| `group_contest_scoreboard` | 分組排行榜 |
| `Group` | 分組 |
| `Group Score` | 組總分 |
| `Create Group` | 建立分組 |
| `Join Group` | 加入分組 |
| `Leave Group` | 退出分組 |
| `Edit Group` | 編輯分組 |
| `Delete Group` | 刪除分組 |
| `Already in a group` | 您已在一個分組中 |
| `Group is full` | 分組已滿 |
| `Captain cannot leave the group` | 隊長不能退出分組 |
| `You must attend the contest first` | 請先報名參加比賽 |

---

## 安裝方式

本套件為 Hydro monorepo 的一部分。安裝為 Hydro 擴充套件：

```bash
hydrooj addon add @hydrooj/group-contest
```

或手動將其加入 Hydro 組態。

---

## 授權條款

AGPL-3.0-or-later
