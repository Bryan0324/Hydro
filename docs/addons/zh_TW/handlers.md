# 路由處理器（Handlers）

處理器是處理 HTTP 請求（或 WebSocket 連線）的類別。  
Hydro 中每個頁面或 API 端點背後都有對應的處理器。

> **English version:** [../handlers.md](../handlers.md)

## 目錄

- [定義處理器](#定義處理器)
- [路由註冊](#路由註冊)
- [HTTP 方法](#http-方法)
- [參數裝飾器](#參數裝飾器)
- [內建型別](#內建型別)
- [權限與特權檢查](#權限與特權檢查)
- [回應輔助方法](#回應輔助方法)
- [速率限制](#速率限制)
- [WebSocket（ConnectionHandler）](#websocketconnectionhandler)
- [需要 Sudo 確認](#需要-sudo-確認)
- [處理器生命週期](#處理器生命週期)

---

## 定義處理器

從 `hydrooj` 匯入 `Handler` 並繼承它：

```typescript
import { Handler, param, Types } from 'hydrooj';

class MyHandler extends Handler {
    async get() {
        this.response.body = { hello: 'world' };
    }
}
```

---

## 路由註冊

在 `apply` 函式中使用 `ctx.Route` 註冊路由：

```typescript
import { Context, PERM, PRIV } from 'hydrooj';

export async function apply(ctx: Context) {
    // 公開路由
    ctx.Route('my_page', '/my-page', MyHandler);

    // 需要域權限的路由
    ctx.Route('my_admin', '/my-admin', MyAdminHandler, PERM.PERM_EDIT_DOMAIN);

    // 需要系統特權的路由
    ctx.Route('my_system', '/my-system', MySystemHandler, PRIV.PRIV_EDIT_SYSTEM);

    // 需要多個條件的路由（用戶必須滿足全部條件）
    ctx.Route('my_route', '/my-route/:id', MyRouteHandler, PERM.PERM_VIEW_PROBLEM);
}
```

> 路由名稱在所有附加元件中必須唯一。建議使用附加元件名稱作為前綴以避免衝突。

---

## HTTP 方法

處理器可以實作 `get`、`post`、`put`、`delete` 和 `patch` 的任意組合。  
當表單提交包含隱藏欄位 `_operation` 時，Hydro 會呼叫對應的 `post<Operation>` 方法。

```typescript
class MyHandler extends Handler {
    // 處理 GET /my-page
    async get() {
        this.response.template = 'my_page.html';
        this.response.body = { items: [] };
    }

    // 所有 POST 請求先執行此方法；可用於通用的權限檢查
    async post() {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
    }

    // 處理 _operation=create 的 POST
    @param('title', Types.Title)
    @param('content', Types.Content)
    async postCreate(domainId: string, title: string, content: string) {
        // ...
    }

    // 處理 _operation=delete 的 POST
    @param('id', Types.ObjectId)
    async postDelete(domainId: string, id: ObjectId) {
        // ...
    }
}
```

---

## 參數裝飾器

參數裝飾器從請求中提取、驗證並轉換參數，注入到處理器方法的引數中。

```typescript
import { get, post, route, param, Types } from 'hydrooj';
```

| 裝飾器 | 來源 | 說明 |
|--------|------|------|
| `@get(name, type?)` | URL 查詢字串 | `?name=value` |
| `@query(name, type?)` | URL 查詢字串 | `@get` 的別名 |
| `@post(name, type?)` | 請求主體 | 表單或 JSON 主體 |
| `@route(name, type?)` | URL 路徑片段 | 路由樣式中的 `:name` |
| `@param(name, type?)` | 任意來源 | 依序檢查查詢字串、主體、路由參數 |

### 簽名

```typescript
@get(name: string, type?: Type, isOptional?: boolean, validate?: Validator, convert?: Converter)
@get(name: string, type?: Type, validate?: Validator, convert?: Converter)
```

- `isOptional` 為 `true` 時，參數為可選（缺失時傳入 `undefined`）。
- `isOptional` 為 `'convert'` 時，即使值缺失也會套用轉換器。
- `Validator` 的型別為 `(value: any) => boolean`。
- `Converter<T>` 的型別為 `(value: any) => T`。

### 範例

```typescript
class ArticleHandler extends Handler {
    @param('page', Types.PositiveInt, true)       // 可選的頁碼
    @param('keyword', Types.String, true)          // 可選的搜尋關鍵字
    async get(domainId: string, page = 1, keyword?: string) {
        // ...
    }

    @route('aid', Types.ObjectId)                  // URL 中必填的 :aid
    @post('title', Types.Title)                    // 主體中必填的 title
    @post('content', Types.Content)                // 主體中必填的 content
    async postUpdate(domainId: string, aid: ObjectId, title: string, content: string) {
        // ...
    }
}
```

---

## 內建型別

所有型別均可透過 `hydrooj` 的 `Types.*` 存取：

### 字串型別

| 型別 | 驗證規則 | 備註 |
|------|---------|------|
| `Types.String` | 非空字串 | 基本字串，無額外限制 |
| `Types.ShortString` | 1–255 字元 | |
| `Types.Title` | 1–64 字元 | 不能為空白 |
| `Types.Content` | 最多 65 535 字元 | 適用於富文字或 Markdown |
| `Types.Key` | `[\w-]{1,255}` | 識別碼安全字串 |
| `Types.Username` | 3–31 字元（或 2 個 CJK 字元）| |
| `Types.UidOrName` | 使用者名稱或數字 UID | |
| `Types.Password` | 6–255 字元 | |
| `Types.Email` | 合法電子郵件地址 | |
| `Types.Filename` | 安全檔名 | 不含路徑穿越字元 |
| `Types.DomainId` | `[a-zA-Z]\w{3,31}` | |
| `Types.ProblemId` | 數字或 slug | 返回 `number \| string` |
| `Types.Role` | 1–31 個字組字元 | |
| `Types.Emoji` | 單個 emoji | |

### 數字型別

| 型別 | 驗證規則 |
|------|---------|
| `Types.Int` | 整數（正負皆可） |
| `Types.UnsignedInt` | 非負整數 |
| `Types.PositiveInt` | 嚴格正整數 |
| `Types.Float` | 有限浮點數 |

### 其他型別

| 型別 | 說明 |
|------|------|
| `Types.ObjectId` | MongoDB `ObjectId` |
| `Types.Boolean` | `false`/`off`/`no`/`0` → `false` |
| `Types.Date` | 日期字串 `YYYY-M-D` → 正規化為 `YYYY-MM-DD` |
| `Types.Time` | 時間字串 `H:M` → 正規化為 `HH:MM` |
| `Types.Range(values)` | 值必須在給定陣列或物件的鍵中 |
| `Types.NumericArray` | 逗號分隔或陣列格式的數字 |
| `Types.CommaSeperatedArray` | 逗號分隔或陣列格式的字串 |
| `Types.Set` | 陣列或單一值 → `Set` |
| `Types.Any` | 不做驗證或轉換 |
| `Types.ArrayOf(type)` | 指定型別的陣列 |
| `Types.AnyOf(...types)` | 符合任一給定型別的值 |

---

## 權限與特權檢查

在處理器內部使用以下方法：

```typescript
// 域權限（來自 PERM 的 bigint）
this.checkPerm(PERM.PERM_EDIT_DOMAIN);
this.checkPerm(PERM.PERM_CREATE_PROBLEM, PERM.PERM_EDIT_PROBLEM); // 任一即可

// 系統特權（來自 PRIV 的 number）
this.checkPriv(PRIV.PRIV_USER_PROFILE);     // 必須已登入
this.checkPriv(PRIV.PRIV_EDIT_SYSTEM);      // 必須是超級管理員
```

兩者在檢查失敗時都會拋出 `PermissionError` / `PrivilegeError`。

也可以直接判斷：

```typescript
if (this.user.hasPerm(PERM.PERM_VIEW_PROBLEM)) { /* ... */ }
if (this.user.hasPriv(PRIV.PRIV_USER_PROFILE)) { /* ... */ }
if (this.user.own(doc)) { /* 擁有此文件 */ }
```

### 常用域權限（`PERM`）

| 常數 | 說明 |
|------|------|
| `PERM.PERM_VIEW` | 瀏覽域 |
| `PERM.PERM_VIEW_PROBLEM` | 瀏覽題目 |
| `PERM.PERM_SUBMIT_PROBLEM` | 提交解答 |
| `PERM.PERM_CREATE_PROBLEM` | 建立題目 |
| `PERM.PERM_EDIT_PROBLEM` | 編輯任意題目 |
| `PERM.PERM_EDIT_PROBLEM_SELF` | 編輯自己的題目 |
| `PERM.PERM_VIEW_RECORD` | 查看其他用戶的提交記錄 |
| `PERM.PERM_READ_RECORD_CODE` | 讀取所有提交的原始碼 |
| `PERM.PERM_REJUDGE` | 重判提交記錄 |
| `PERM.PERM_VIEW_CONTEST` | 查看比賽 |
| `PERM.PERM_CREATE_CONTEST` | 建立比賽 |
| `PERM.PERM_ATTEND_CONTEST` | 參加比賽 |
| `PERM.PERM_VIEW_DISCUSSION` | 查看討論 |
| `PERM.PERM_CREATE_DISCUSSION` | 發表討論 |
| `PERM.PERM_EDIT_DOMAIN` | 編輯域設定 |
| `PERM.PERM_VIEW_RANKING` | 查看排行榜 |

### 常用系統特權（`PRIV`）

| 常數 | 說明 |
|------|------|
| `PRIV.PRIV_USER_PROFILE` | 已登入用戶 |
| `PRIV.PRIV_REGISTER_USER` | 可以註冊新帳號 |
| `PRIV.PRIV_EDIT_SYSTEM` | 系統管理員 |
| `PRIV.PRIV_MANAGE_ALL_DOMAIN` | 可管理任何域 |
| `PRIV.PRIV_CREATE_DOMAIN` | 可建立域 |

---

## 回應輔助方法

| 屬性 / 方法 | 說明 |
|------------|------|
| `this.response.body = obj` | JSON 資料或模板資料 |
| `this.response.template = 'file.html'` | 要渲染的模板 |
| `this.response.redirect = '/url'` | 重新導向至 URL |
| `this.response.status = 404` | HTTP 狀態碼 |
| `this.response.type = 'application/json'` | 覆寫 Content-Type |
| `this.back(body?)` | 重新導向回 Referer（可附帶主體） |
| `this.binary(data, filename?)` | 傳送檔案下載 |
| `this.holdFile(name)` | 在請求結束後保留上傳的暫存檔案 |
| `this.url(routeName, args?)` | 根據路由名稱建構 URL |

---

## 速率限制

```typescript
// 每 3600 秒內 'add_blog' 操作最多允許 60 次，以用戶 IP 為鍵
await this.limitRate('add_blog', 3600, 60);
```

超過限制時 `limitRate` 會拋出 `OpcountExceededError`。

---

## WebSocket（ConnectionHandler）

對於需要即時雙向通訊的場景，繼承 `ConnectionHandler`：

```typescript
import { ConnectionHandler, param, Types } from 'hydrooj';

class MyConnectionHandler extends ConnectionHandler {
    async prepare() {
        // WebSocket 建立連線時呼叫
    }

    @param('channel', Types.String)
    async message(domainId: string, channel: string) {
        // 每次收到客戶端訊息時呼叫
        this.send({ type: 'echo', channel });
    }

    async cleanup() {
        // WebSocket 關閉時呼叫
    }
}

// 註冊：
ctx.Connection('my_ws', '/ws/my-channel', MyConnectionHandler);
```

`ConnectionHandler` 方法：

| 方法 | 說明 |
|------|------|
| `this.send(data)` | 向客戶端傳送資料 |
| `this.close(code?, reason?)` | 關閉連線 |
| `this.ping()` | 傳送 ping 框架 |

---

## 需要 Sudo 確認

對需要用戶重新輸入密碼確認的 `post*` 方法，使用 `@requireSudo` 裝飾器：

```typescript
import { requireSudo, Handler } from 'hydrooj';

class DangerousHandler extends Handler {
    @requireSudo
    async postDeleteAll() {
        // 只有在用戶於 /user/sudo 頁面確認密碼後才會執行
    }
}
```

---

## 處理器生命週期

每個請求的方法呼叫順序如下：

1. **`_prepare(args)`** — 在 HTTP 方法處理器之前執行；用於載入共用資源。  
   從路由上下文注入帶有裝飾器的參數。
2. **`prepare(args)`** — `_prepare` 的別名。
3. **`get(args)` / `post(args)` / …** — 對應 HTTP 動詞的實際處理器。
4. **`postMethod(args)`** — 由 POST 主體中 `_operation` 欄位選擇的子處理器。
5. **`cleanup()`** — 在回應傳送後執行（即使出錯也會執行）。

```typescript
class ArticleHandler extends Handler {
    article: ArticleDoc;

    @route('aid', Types.ObjectId)
    async _prepare(domainId: string, aid: ObjectId) {
        this.article = await ArticleModel.get(aid);
        if (!this.article) throw new DocumentNotFoundError('article', aid);
    }

    async get() {
        this.response.template = 'article.html';
        this.response.body = { article: this.article };
    }

    async post() {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
    }

    @param('content', Types.Content)
    async postEdit(domainId: string, content: string) {
        await ArticleModel.edit(this.article._id, content);
        this.back();
    }
}
```
