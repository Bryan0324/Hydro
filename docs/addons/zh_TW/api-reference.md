# API 參考

`hydrooj` 主附加元件進入點所有匯出項目的完整參考。

> **匯入路徑：** `import { ... } from 'hydrooj';`  
> **English version:** [../api-reference.md](../api-reference.md)

---

## 目錄

- [插件工具](#插件工具)
- [Context 與 Service](#context-與-service)
- [處理器類別](#處理器類別)
- [參數裝飾器](#參數裝飾器)
- [參數型別](#參數型別)
- [錯誤類別](#錯誤類別)
- [資料模型](#資料模型)
- [工具函式](#工具函式)
- [Pipeline 工具](#pipeline-工具)
- [型別工具](#型別工具)
- [Storage 服務](#storage-服務)
- [API 建構器（類 GraphQL 風格）](#api-建構器類-graphql-風格)
- [介面與型別宣告](#介面與型別宣告)
- [第三方重新匯出](#第三方重新匯出)
- [維護腳本](#維護腳本)
- [OAuth 提供者](#oauth-提供者)

---

## 插件工具

### `definePlugin(args)`

以完整 TypeScript 型別包裝插件定義。

```typescript
import { definePlugin, Schema } from 'hydrooj';

export default definePlugin({
    name: 'my-plugin',
    schema: Schema.object({
        apiKey: Schema.string().required(),
    }),
    apply(ctx, config) {
        // config 型別為 { apiKey: string }
    },
});
```

**參數：**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `name` | `string?` | 插件名稱 |
| `apply` | `(ctx, config) => void \| Promise<void>` | 插件進入點 |
| `schema` / `Config` | `Schema<T>?` | 設定結構（[Schemastery](https://github.com/shigma/schemastery)） |
| `inject` | `(keyof Context)[] \| Record<string, any>?` | 呼叫 `apply` 前等待的服務 |

---

## Context 與 Service

### `Context`

插件的依賴注入容器（繼承自 [Cordis](https://github.com/cordiverse/cordis) `Context`）。  
透過插件 `ctx` 註冊的所有效果——路由、事件監聽器、UI 注入、計時器、設定——
都會在插件卸載或熱重載時**自動清除**。

```typescript
import { Context } from 'hydrooj';

export async function apply(ctx: Context) {
    // 在此處註冊的所有效果都限定在此插件的生命週期內
}
```

---

#### 路由

```typescript
// HTTP 路由 — 處理器回應 GET/POST/PUT/DELETE 請求
ctx.Route('my_page', '/my/page/:id', MyPageHandler);

// 附帶權限/特權守衛 — 沒有對應權限的使用者會收到 403
import { PERM, PRIV } from 'hydrooj';
ctx.Route('admin_page', '/admin', AdminHandler, PRIV.PRIV_EDIT_SYSTEM);

// WebSocket 路由
ctx.Connection('my_ws', '/my/ws', MyWsHandler);
```

| 方法 | 參數 | 說明 |
|------|------|------|
| `ctx.Route(name, path, HandlerClass, ...perms)` | `name` — 唯一路由名稱；`path` — Koa-router URL 模式；`HandlerClass` — 繼承自 `Handler` 的類別；`perms` — 可選的 `PERM`/`PRIV` 值 | 註冊 HTTP 路由，回傳清除函式 |
| `ctx.Connection(name, path, HandlerClass, ...perms)` | 同 `Route`，但 `HandlerClass` 必須繼承自 `ConnectionHandler` | 註冊 WebSocket 路由 |

**路由名稱命名規範**

路由 `name` 用於建構 URL（`this.url('my_page', { id: 42 })`）以及指定 handler mixin 的目標。
請選擇在所有附加元件中全域唯一的名稱。

---

#### 事件

```typescript
// 訂閱 — 插件卸載時監聽器自動移除
ctx.on('app/ready', async () => {
    console.log('所有插件已載入！');
});

// 單次訂閱 — 第一次呼叫後自動移除
ctx.once('database/connect', (db) => {
    console.log('MongoDB 已連線：', db.databaseName);
});

// 在當前程序本地觸發事件
ctx.emit('record/change', rdoc);

// 觸發並等待每個非同步監聽器完成（串行瀑布）
await ctx.serial('handler/before/MyPage', h);

// 在本地觸發並並發等待所有監聽器（平行扇出）
await ctx.parallel('problem/get', pdoc, handler);

// 向所有 PM2 叢集程序廣播（非叢集模式下退化為本地）
ctx.broadcast('user/delcache', userId.toString());
```

| 方法 | 說明 |
|------|------|
| `ctx.on(event, handler)` | 訂閱；插件卸載時自動移除監聽器 |
| `ctx.once(event, handler)` | 單次訂閱；第一次呼叫後自動移除 |
| `ctx.emit(event, ...args)` | 在當前程序中同步觸發；**不**等待非同步監聽器 |
| `ctx.parallel(event, ...args)` | 觸發並 `await Promise.all(監聽器)` — 並發扇出 |
| `ctx.serial(event, ...args)` | 按註冊順序逐一觸發並等待每個監聽器 — **回傳第一個非 `undefined` 的回傳值** |
| `ctx.broadcast(event, ...args)` | 透過 PM2 bus 進行跨程序廣播；非叢集模式下退化為 `ctx.parallel` |

> **`serial` 與 `parallel` 的差異：** 當需要監聽器能夠攔截或中斷處理流程時（例如 `handler/before/*` 中介軟體 hook），使用 `ctx.serial`。當所有監聽器都是獨立的副作用時，使用 `ctx.parallel`。

---

#### UI 與語言

```typescript
// 註冊 UI 節點 — 插件卸載時移除
ctx.injectUI('NavMenu', 'blog_main', { icon: 'book', displayName: 'Blog', uid: '${handler.user._id}' },
    PRIV.PRIV_USER_PROFILE);

// 載入翻譯 — 插件卸載時移除
ctx.i18n.load('zh_TW', {
    Blog: '部落格',
    blog_main: '部落格',
});
ctx.i18n.load('zh', {
    Blog: '博客',
});
ctx.i18n.load('en', {
    Blog: 'Blog',
});
```

| 方法 | 說明 |
|------|------|
| `ctx.injectUI(target, name, args?, ...guards)` | 注入 UI 節點；目標與參數說明見 [ui.md](./ui.md) |
| `ctx.i18n.load(lang, translations)` | 為 `lang` 新增翻譯條目（插件卸載時移除） |
| `ctx.i18n.get(key, lang)` | 查詢單一翻譯鍵；找不到時回傳 `null` |
| `ctx.i18n.translate(str, languages)` | 按語言優先順序解析 `str` |
| `ctx.i18n.langs(interfaceOnly?)` | 回傳所有已註冊語言的 `{ 語言碼: 語言名稱 }` 映射 |

---

#### 生命週期與依賴注入

```typescript
// 等待一個或多個服務就緒後呼叫 fn。
// fn 在子作用域中執行 — 若任何依賴服務消失，它會被自動撤銷。
ctx.inject(['server', 'setting'], (c) => {
    c.Route('my_route', '/my', MyHandler);
    // ...
});

// 手動載入子插件（可附帶設定）
ctx.plugin(MyService, { apiKey: '...' });

// 註冊任意清理效果 — 插件卸載時呼叫 fn
ctx.effect(() => {
    const timer = setInterval(() => doSomething(), 60_000);
    return () => clearInterval(timer);    // ← 清理函式
});

// 建立附帶額外域作用域資料的子 Context（框架內部使用）
const childCtx = ctx.extend({ domain: ddoc });
```

| 方法 | 說明 |
|------|------|
| `ctx.plugin(plugin, config?)` | 載入子插件；回傳代表其生命週期的 `Fiber` |
| `ctx.inject(deps, fn)` | 等待所有 `deps` 服務就緒後呼叫 `fn(childCtx)` |
| `ctx.effect(() => cleanup)` | 註冊帶有清理函式的副作用 |
| `ctx.extend(patch)` | 回傳淺複製的子 `Context`，並合併額外屬性 |
| `ctx.get(serviceName)` | 按名稱查詢服務；若尚未可用則回傳 `undefined` |

---

#### Hydro 特有方法

```typescript
// 從「管理員 → 維護」介面呼叫的腳本
ctx.addScript(
    'my-addon/fixData',
    '修復舊資料',
    Schema.object({ dryRun: Schema.boolean().default(true) }),
    async ({ dryRun }, report) => {
        // ...
        report({ message: '完成。' });
        return true;
    },
);

// 註冊可插拔模組（例如密碼雜湊提供者）
ctx.provideModule('hash', 'argon2', {
    hash: (password, salt) => argon2.hash(password + salt),
    check: (password, salt, digest) => argon2.verify(digest, password + salt),
});

// 排程延遲回呼，插件卸載後自動取消
ctx.setImmediate(() => warmupCache());
```

| 方法 | 說明 |
|------|------|
| `ctx.addScript(name, desc, schema, run)` | 註冊維護腳本；詳見[維護腳本](#維護腳本) |
| `ctx.provideModule(type, id, module)` | 註冊模組實作；`type` 是 `ModuleInterfaces` 的鍵 |
| `ctx.setImmediate(fn, ...args)` | 延遲回呼；若插件在觸發前卸載則自動取消 |

---

#### Handler Mixin（進階）

這些方法讓你無需繼承子類別，即可為**每個**指定類型的處理器注入行為。

```typescript
// 為每個 HTTP handler 新增方法/屬性
ctx.handlerMixin({
    myHelper() {
        return this.request.headers['x-my-header'];
    },
});

// 為每個 WebSocket handler 新增方法/屬性
ctx.wsHandlerMixin({
    onMyEvent(data) { this.send({ type: 'ack' }); },
});

// 按路由名稱擴充特定的處理器類別
ctx.withHandlerClass('my_route', (HandlerClass) => {
    HandlerClass.prototype.extraMethod = function () { /* ... */ };
});

// 以原始 Koa 中介軟體攔截某 URL 前綴下的所有請求
ctx.addCaptureRoute('/static/', async (c, next) => {
    c.body = await serveStatic(c.path);
});
```

| 方法 | 簽名 | 說明 |
|------|------|------|
| `ctx.handlerMixin(mixin)` | `mixin: Partial<Handler> \| (h) => Partial<Handler>` | 將屬性/方法混入每個 HTTP `Handler` |
| `ctx.wsHandlerMixin(mixin)` | `mixin: Partial<ConnectionHandler> \| (h) => Partial<ConnectionHandler>` | 混入每個 WebSocket `ConnectionHandler` |
| `ctx.withHandlerClass(name, cb)` | `name`：路由名稱；`cb(HandlerClass)` | 按已註冊的路由名稱修改特定處理器類別 |
| `ctx.addCaptureRoute(prefix, cb)` | `prefix`：URL 前綴；`cb(ctx, next)`：Koa 中介軟體 | 攔截所有以 `prefix` 開頭的請求 |

---

#### 服務屬性

##### `ctx.db` — 資料庫服務

透過 [MongoService](../../../../packages/hydrooj/src/service/db.ts) 直接存取 MongoDB。

```typescript
// 取得具型別的集合句柄
const coll = ctx.db.collection('my-addon.items');
await coll.insertOne({ _id: 'foo', value: 42 });

// 分頁遊標 — 回傳 [docs, numPages, totalCount]
const [docs, numPages, total] = await ctx.db.paginate(
    coll.find({ active: true }).sort({ _id: -1 }),
    page,       // 從 1 開始的頁碼
    20,         // 每頁筆數
);

// 確保索引存在（冪等操作）
await ctx.db.ensureIndexes(coll,
    { key: { owner: 1 }, name: 'owner' },
    { key: { createdAt: -1 }, name: 'createdAt' },
);
```

| 方法 | 簽名 | 說明 |
|------|------|------|
| `collection(name)` | `name: keyof Collections` | 取得 `Collection<T>` 句柄 |
| `paginate(cursor, page, pageSize)` | `cursor: FindCursor<T>`, `page: number`, `pageSize: number` | 回傳 `[docs, numPages, totalCount]` |
| `ensureIndexes(coll, ...indexes)` | `indexes: IndexDescription[]` | 建立缺少的索引；刪除已移除的索引 |
| `ranked(cursor, equ)` | `cursor: FindCursor<T> \| T[]`, `equ: (a,b)=>boolean` | 回傳帶同名次的 `[rank, doc][]` |

##### `ctx.setting` — 設定服務

註冊出現在 Hydro 設定 UI 中並持久化到資料庫的插件設定。

```typescript
import { Schema } from 'hydrooj';

// 全域系統設定（管理員 → 系統設定）
ctx.setting.SystemSetting(Schema.object({
    'my-addon.apiKey': Schema.string().default('').description('外部 API 金鑰'),
    'my-addon.timeout': Schema.number().default(5000).description('請求逾時（毫秒）'),
}));

// 每個域的設定（域 → 設定）
ctx.setting.DomainSetting(Schema.object({
    'my-addon.enabled': Schema.boolean().default(false).description('啟用 My Addon'),
}));

// 用戶偏好設定（用戶 → 偏好設定）
ctx.setting.PreferenceSetting(Schema.object({
    'my-addon.theme': Schema.union(['light', 'dark'] as const).default('light'),
}));

// 讀取系統設定值
const apiKey = ctx.setting.get('my-addon.apiKey');   // string | undefined

// 取得響應式設定代理 — 設定變更時自動更新
const config = ctx.setting.requestConfig(Schema.object({
    'my-addon.apiKey': Schema.string().default(''),
    'my-addon.timeout': Schema.number().default(5000),
}));
// config['my-addon.apiKey'] 永遠反映當前值
```

| 方法 | 說明 |
|------|------|
| `setting.SystemSetting(...schemas)` | 註冊全域系統設定；插件卸載時移除 |
| `setting.DomainSetting(...schemas)` | 註冊每個域的設定 |
| `setting.PreferenceSetting(...schemas)` | 註冊每個用戶的偏好設定 |
| `setting.AccountSetting(...schemas)` | 註冊帳號層級設定 |
| `setting.DomainUserSetting(...schemas)` | 註冊每個用戶每個域的設定 |
| `setting.get(key)` | 讀取系統設定的當前值 |
| `setting.requestConfig(schema, dynamic?)` | 取得永遠反映最新設定的響應式代理 |

##### `ctx.i18n` — 國際化服務

`load()` 用法詳見上方的 [UI 與語言](#ui-與語言)。

| 方法 | 簽名 | 說明 |
|------|------|------|
| `i18n.load(lang, map)` | `lang: string`, `map: Record<string,string>` | 新增翻譯條目（插件卸載時移除） |
| `i18n.get(key, lang)` | `key: string`, `lang: string` → `string \| null` | 查詢特定語言中的單一鍵；找不到時回傳 `null` |
| `i18n.translate(str, languages)` | `str: string`, `languages: string[]` → `string` | 按語言優先順序解析 `str`；全部找不到時回退到原始字串 |
| `i18n.langs(interfaceOnly?)` | `interfaceOnly?: boolean` → `Record<string,string>` | 所有已註冊語言碼到其顯示名稱的映射 |

##### 其他屬性

| 屬性 | 型別 | 說明 |
|------|------|------|
| `ctx.db` | `MongoService` | MongoDB 客戶端；詳見上方 |
| `ctx.setting` | `SettingService` | 插件設定；詳見上方 |
| `ctx.i18n` | `I18nService` | 翻譯服務；詳見上方 |
| `ctx.loader` | `Loader` | 附加元件載入器；提供 `ctx.loader.reloadPlugin()` |
| `ctx.check` | `CheckService` | 健康檢查服務；使用 `ctx.check.register()` 註冊檢查項 |
| `ctx.geoip?` | `GeoIP` | GeoIP 查詢（僅在載入 geoip 插件時可用） |
| `ctx.domain?` | `DomainDoc` | 在每個請求建立的子 Context 上設定；包含當前域文件 |

### `Service`

可注入服務的基底類別。繼承它以建立你的插件提供的服務：

```typescript
import { Context, Service } from 'hydrooj';

class MyService extends Service {
    static inject = ['server']; // 此服務依賴的其他服務

    constructor(ctx: Context, config: MyConfig) {
        super(ctx, 'my-service'); // 在 ctx 上的名稱
    }

    doSomething() { /* ... */ }
}

// 在 apply 中：
ctx.plugin(MyService, config);
// 現在其他插件可以使用 ctx['my-service']
```

### `Fiber`

Cordis `Fiber` — 代表插件的生命週期作用域。  
由 `ctx.plugin()` 返回。

---

## 處理器類別

### `Handler`

HTTP 請求處理器的基底類別。

```typescript
import { Handler, param, Types, PERM, PRIV } from 'hydrooj';
```

**屬性：**

| 屬性 | 型別 | 說明 |
|------|------|------|
| `this.session` | `Record<string, any>` | 會話資料（可讀寫） |
| `this.args` | `Record<string, any>` | 合併後的路由/主體/查詢參數 |
| `this.request` | `HydroRequest` | 解析後的請求物件 |
| `this.response` | `HydroResponse` | 回應建構器 |
| `this.user` | `User` | 目前登入的用戶 |
| `this.domain` | `DomainDoc` | 目前域 |
| `this.UiContext` | `Record<string, any>` | 傳給模板的額外資料 |
| `this.ctx` | `Context` | 插件上下文 |

**方法：**

| 方法 | 說明 |
|------|------|
| `checkPerm(...perms)` | 若缺少任何權限則拋出 `PermissionError` |
| `checkPriv(...privs)` | 若缺少任何特權則拋出 `PrivilegeError` |
| `url(name, ...args)` | 根據路由名稱建構 URL |
| `back(body?)` | 重新導向到 HTTP `Referer` |
| `binary(data, filename?)` | 傳送二進位下載 |
| `holdFile(name)` | 防止上傳的暫存檔案被刪除 |
| `limitRate(op, period, max, key?)` | 速率限制此操作 |
| `paginate(cursor, page, limitOrKey)` | 分頁一個 MongoDB 遊標 |
| `renderTitle(str)` | 渲染帶有站點名稱的頁面標題 |

**`HydroRequest`：**

| 欄位 | 型別 |
|------|------|
| `method` | `string` |
| `host` / `hostname` | `string` |
| `ip` | `string` |
| `headers` | `Record<string, string>` |
| `cookies` | `any` |
| `body` | `any` |
| `files` | `Record<string, File>` |
| `query` | `any` |
| `path` / `originalPath` | `string` |
| `params` | `any` |
| `referer` | `string` |
| `json` | `boolean` |
| `websocket` | `boolean` |

**`HydroResponse`：**

| 欄位 | 型別 |
|------|------|
| `body` | `any` |
| `type` | `string`（Content-Type） |
| `status` | `number` |
| `template` | `string?` |
| `pjax` | `string \| [string, Record<string, any>][]?` |
| `redirect` | `string?` |
| `disposition` | `string?` |
| `etag` | `string?` |
| `attachment(name, stream?)` | 傳送檔案附件 |
| `addHeader(name, value)` | 新增回應標頭 |

### `ConnectionHandler`

WebSocket 處理器的基底類別。  
繼承 `Handler` 並額外提供：

| 方法 | 說明 |
|------|------|
| `send(data)` | 向客戶端傳送訊息 |
| `close(code?, reason?)` | 關閉連線 |

### `requireSudo`

方法裝飾器，強制用戶在繼續之前重新輸入密碼：

```typescript
import { requireSudo } from 'hydrooj';

class AdminHandler extends Handler {
    @requireSudo
    async postDeleteAll() { /* ... */ }
}
```

---

## 參數裝飾器

```typescript
import { get, query, post, route, param, subscribe } from 'hydrooj';
```

| 匯出 | 來源 | 備註 |
|------|------|------|
| `@get(name, type?, ...)` | 查詢字串 | |
| `@query(name, type?, ...)` | 查詢字串 | `@get` 的別名 |
| `@post(name, type?, ...)` | 請求主體 | |
| `@route(name, type?, ...)` | URL 路徑 | |
| `@param(name, type?, ...)` | 任意來源 | 依序檢查所有來源 |
| `@subscribe(eventName)` | — | WebSocket 訂閱裝飾器 |

所有裝飾器都接受相同的尾部引數（任意順序）：
- `Type<T>` — 來自 `Types` 的轉換器 + 驗證器
- `boolean` — 標記參數為可選
- `Validator` — 自訂 `(v) => boolean`
- `Converter<T>` — 自訂 `(v) => T`

---

## 參數型別

```typescript
import { Types } from 'hydrooj';
```

| 型別 | 輸出 | 備註 |
|------|------|------|
| `Types.String` | `string` | 非空 |
| `Types.ShortString` | `string` | ≤ 255 字元 |
| `Types.Title` | `string` | ≤ 64 字元，不能是空白 |
| `Types.Content` | `string` | ≤ 65 535 字元 |
| `Types.Key` | `string` | `[\w-]{1,255}` |
| `Types.Username` | `string` | 3–31 字元或 2 個 CJK 字元 |
| `Types.UidOrName` | `string` | 用戶名稱或數字 UID |
| `Types.Password` | `string` | 6–255 字元 |
| `Types.Email` | `string` | 合法電子郵件 |
| `Types.Filename` | `string` | 安全，無路徑穿越 |
| `Types.DomainId` | `string` | `[a-zA-Z]\w{3,31}` |
| `Types.ProblemId` | `string \| number` | 數字 ID 或字串 slug |
| `Types.Role` | `string` | 1–31 個字組字元 |
| `Types.Emoji` | `string` | 單個 emoji |
| `Types.Int` | `number` | 整數 |
| `Types.UnsignedInt` | `number` | ≥ 0 |
| `Types.PositiveInt` | `number` | ≥ 1 |
| `Types.Float` | `number` | 有限浮點數 |
| `Types.ObjectId` | `ObjectId` | MongoDB ObjectId |
| `Types.Boolean` | `boolean` | `false`/`off`/`no`/`0` → false |
| `Types.Date` | `string` | `YYYY-MM-DD` |
| `Types.Time` | `string` | `HH:MM` |
| `Types.Range(arr)` | `T` | 必須在陣列/物件中 |
| `Types.NumericArray` | `number[]` | |
| `Types.CommaSeperatedArray` | `string[]` | |
| `Types.Set` | `Set<any>` | |
| `Types.Any` | `any` | 不驗證 |
| `Types.ArrayOf(type)` | `T[]` | 指定型別的陣列 |
| `Types.AnyOf(...types)` | `T` | 符合第一個匹配型別 |

---

## 錯誤類別

所有錯誤都繼承 `HydroError`。  
在處理器中拋出它們 — Hydro 會將它們渲染為用戶看到的錯誤頁面或 JSON。

```typescript
import {
    // 框架錯誤
    HydroError, UserFacingError,
    BadRequestError, ForbiddenError, NotFoundError,
    MethodNotAllowedError, ValidationError,
    CsrfTokenError, InvalidOperationError, FileTooLargeError,
    CreateError,
    // Hydro 應用錯誤
    PermissionError, PrivilegeError,
    LoginError, AccessDeniedError,
    UserNotFoundError, UserAlreadyExistError,
    InvalidTokenError, BlacklistedError,
    VerifyPasswordError, CurrentPasswordError,
    OpcountExceededError,
    BuiltinLoginError, RequireProError,
    ProblemNotFoundError, ProblemAlreadyExistError,
    ProblemDataNotFoundError, ProblemConfigError,
    ProblemIsReferencedError, ProblemNotAllowPretestError,
    ProblemNotAllowLanguageError, ProblemNotAllowCopyError,
    ProblemAlreadyUsedByContestError,
    RecordNotFoundError, PretestRejudgeFailedError, HackRejudgeFailedError,
    HackFailedError,
    DocumentNotFoundError,
    SolutionNotFoundError, TrainingNotFoundError,
    ContestNotFoundError, ContestNotAttendedError, ContestAlreadyAttendedError,
    ContestNotLiveError, ContestNotEndedError, ContestScoreboardHiddenError,
    TrainingAlreadyEnrollError,
    DiscussionNotFoundError, DiscussionNodeNotFoundError, DiscussionLockedError,
    HomeworkNotLiveError, HomeworkNotAttendedError,
    DomainAlreadyExistsError, CannotDeleteSystemDomainError, OnlyOwnerCanDeleteDomainError,
    DomainJoinForbiddenError, DomainJoinAlreadyMemberError, InvalidJoinInvitationCodeError,
    RoleAlreadyExistError, NotAssignedError,
    MessageNotFoundError,
    FileLimitExceededError, FileUploadError, FileExistsError,
    CannotEditSuperAdminError,
    AlreadyVotedError,
    AuthOperationError,
    NoProblemError,
    SendMailError, RemoteOnlineJudgeError,
    NotLaunchedByPM2Error,
} from 'hydrooj';
```

### 建立自訂錯誤

```typescript
import { CreateError, UserFacingError } from 'hydrooj';

export const MyCustomError = CreateError(
    'MyCustomError',          // 錯誤名稱
    UserFacingError,          // 父類別
    '{0} 發生了錯誤。',        // 訊息模板
    400,                      // HTTP 狀態碼
);

// 用法：
throw new MyCustomError('某個值');
```

---

## 資料模型

所有模型都可以作為具名匯出使用：

```typescript
import {
    SystemModel, UserModel, ProblemModel, RecordModel,
    TokenModel, DomainModel, StorageModel, ScheduleModel,
    SolutionModel, MessageModel, OauthModel, BlackListModel,
    TaskModel,
    TrainingModel, OpcountModel, OplogModel, SettingModel,
    DiscussionModel, DocumentModel, BuiltinModel, ContestModel,
} from 'hydrooj';
```

詳細方法說明見 [models.md](./models.md)。

### `BuiltinModel` 中的常數

```typescript
import { PERM, PRIV, STATUS } from 'hydrooj';
```

**`STATUS`** — 評測結果狀態碼：

| 常數 | 值 | 含義 |
|------|-----|------|
| `STATUS.STATUS_WAITING` | 0 | 尚未評測 |
| `STATUS.STATUS_ACCEPTED` | 1 | 通過 |
| `STATUS.STATUS_WRONG_ANSWER` | 2 | 答案錯誤 |
| `STATUS.STATUS_TIME_LIMIT_EXCEEDED` | 3 | 超時 |
| `STATUS.STATUS_MEMORY_LIMIT_EXCEEDED` | 4 | 超記憶體 |
| `STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED` | 5 | 輸出超限 |
| `STATUS.STATUS_RUNTIME_ERROR` | 6 | 運行時錯誤 |
| `STATUS.STATUS_COMPILE_ERROR` | 7 | 編譯錯誤 |
| `STATUS.STATUS_SYSTEM_ERROR` | 9 | 系統錯誤 |
| `STATUS.STATUS_CANCELED` | 10 | 已取消 |
| `STATUS.STATUS_JUDGING` | 14 | 評測中 |
| `STATUS.STATUS_IGNORED` | 30 | 已忽略 |

---

## 工具函式

### `buildContent`

```typescript
import { buildContent } from 'hydrooj';

const html = buildContent(content, 'html');
const md = buildContent(content, 'markdown');
```

將 `Content` 值（可能是字串或 `{ zh: '...', en: '...' }` 映射）渲染為請求的格式，並選擇最佳語言。

### `avatar`

```typescript
import { avatar } from 'hydrooj';

const url = avatar('gravatar:foo@example.com', 128);
```

將頭像描述符解析為 URL。

### `difficultyAlgorithm`

```typescript
import { difficultyAlgorithm } from 'hydrooj';

const difficulty = difficultyAlgorithm(nSubmit, nAccept);
```

根據通過率統計返回難度分數（1–10）。

### `sendMail`

```typescript
import { sendMail } from 'hydrooj';

await sendMail(to, subject, html);
```

使用設定的 SMTP 伺服器傳送電子郵件。

### `nanoid`

```typescript
import { nanoid } from 'hydrooj';

const id = nanoid();         // 生成一個 21 字元的隨機 ID
const short = nanoid(10);
```

### `moment`

```typescript
import { moment, isMoment } from 'hydrooj';

const m = moment().tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
```

### `db`

```typescript
import { db } from 'hydrooj';

const coll = db.collection('my-collection');
```

直接使用 MongoDB 客戶端。

### `pwsh`（密碼雜湊）

```typescript
import { pwsh } from 'hydrooj';

const hash = await pwsh(password, salt);
```

---

## Pipeline 工具

用於處理大型資料集的輔助函式：

```typescript
import {
    iterateAllDomain,
    iterateAllUser,
    iterateAllContest,
    iterateAllPsdoc,
    iterateAllProblemInDomain,
    iterateAllProblem,
    iterateAllRecord,
} from 'hydrooj';
```

每個函式接受一個回呼 `(doc, current?, total?) => Promise<void>`，並分批遍歷對應集合，同時報告進度。

```typescript
// 範例：重建所有題目的難度
await iterateAllProblem(async (pdoc) => {
    const score = difficultyAlgorithm(pdoc.nSubmit, pdoc.nAccept);
    await ProblemModel.edit(pdoc.domainId, pdoc.docId, { difficulty: score });
});
```

---

## 型別工具

```typescript
import type {
    Atomic, Values, Intersect, NumberKeys,
    ArrayKeys, Flatten, Value, Projection,
    MaybeArray, UnionToIntersection, Optional,
} from 'hydrooj';
```

---

## Storage 服務

```typescript
import * as StorageService from 'hydrooj/service/storage';
```

| 方法 | 說明 |
|------|------|
| `put(path, stream, meta?)` | 上傳檔案 |
| `get(path)` | 以串流下載檔案 |
| `del(paths[])` | 刪除檔案 |
| `list(prefix)` | 依前綴列出檔案 |
| `getMeta(path)` | 取得檔案元數據 |
| `signDownloadLink(path, filename, expire, useAlternate?)` | 產生預簽名 URL |

---

## API 建構器（類 GraphQL 風格）

Hydro 支援使用 `Query`、`Mutation` 和 `Subscription` 的型別化 API 層：

```typescript
import { Query, Mutation, Subscription, APIS } from 'hydrooj';
import Schema from 'schemastery';

const myQuery = Query(
    Schema.object({ id: Schema.string() }),
    async (ctx, { id }) => {
        return await MyModel.get(id);
    },
);

APIS.my_query = myQuery;
```

這些端點暴露在 `/api` 路由下，同時支援 HTTP 和 WebSocket。

---

## 介面與型別宣告

### 文件介面

| 介面 | 說明 |
|------|------|
| `Udoc` | 原始用戶資料庫文件 |
| `User` | 載入後的用戶物件（含輔助方法） |
| `DomainDoc` | 域文件 |
| `ProblemDoc` | 題目文件 |
| `RecordDoc` | 評測記錄文件 |
| `Tdoc` | 比賽/作業文件 |
| `TrainingDoc` | 訓練計劃文件 |
| `DiscussionDoc` | 討論帖文件 |
| `MessageDoc` | 私信文件 |
| `TokenDoc` | 認證令牌文件 |
| `OplogDoc` | 操作記錄文件 |
| `ScoreboardRow` | 排行榜中的一行 |
| `ContestRule<T>` | 比賽規則定義 |

### 可擴充介面

附加元件可以擴充這些介面：

| 介面 | 用途 |
|------|------|
| `Collections` | 註冊自訂 MongoDB 集合 |
| `DocType` | 為 `DocumentModel` 註冊自訂文件類型 |
| `Model` | 在 `global.Hydro.model` 上註冊模型 |
| `EventMap` | 新增自訂事件 |
| `SystemKeys` | 新增型別化系統設定 |
| `ModuleInterfaces` | 新增自訂模組型別 |

### `HydroGlobal`

`global.Hydro` 命名空間：

```typescript
global.Hydro.version    // Record<string, string>
global.Hydro.model      // Model
global.Hydro.script     // Record<string, Script>
global.Hydro.module     // { hash, problemSearch, ... }
global.Hydro.ui         // { nodes, inject, getNodes }
global.Hydro.error      // 所有錯誤類別
global.Hydro.Logger     // Logger 建構函式
global.Hydro.logger     // 預設 logger 實例
global.Hydro.locales    // 翻譯映射
```

---

## 第三方重新匯出

這些常用函式庫從 `hydrooj` 重新匯出，方便使用：

| 匯出 | 來源 | 說明 |
|------|------|------|
| `_` | `lodash` | Lodash 工具函式庫 |
| `Schema` | `schemastery` | 設定結構建構器 |
| `ObjectId` | `mongodb` | MongoDB ObjectId 類別 |
| `Filter` | `mongodb` | MongoDB 篩選器型別 |
| `superagent` | `superagent` | HTTP 客戶端 |
| `Zip` | `@zip.js/zip.js` | ZIP 壓縮函式庫 |
| `AdmZip` | `adm-zip` | 舊版 ZIP 函式庫（已棄用） |
| `WebSocket` | `ws` | WebSocket 客戶端類別 |
| `WebSocketServer` | `ws` | WebSocket 伺服器類別 |

---

## 維護腳本

從管理後台呼叫的腳本：

```typescript
import { Context, Schema, iterateAllProblem, difficultyAlgorithm, ProblemModel } from 'hydrooj';

export async function apply(ctx: Context) {
    ctx.addScript(
        'my-addon/rebuildDifficulty',
        '重建題目難度分數',
        Schema.object({}),
        async (args, report) => {
            let count = 0;
            await iterateAllProblem(async (pdoc) => {
                const d = difficultyAlgorithm(pdoc.nSubmit, pdoc.nAccept);
                await ProblemModel.edit(pdoc.domainId, pdoc.docId, { difficulty: d });
                count++;
                if (count % 100 === 0) report({ message: `已處理 ${count} 道題目` });
            });
            report({ message: `完成。共處理 ${count} 道題目。` });
            return true;
        },
    );
}
```

---

## OAuth 提供者

註冊第三方登入提供者：

```typescript
import { Context, Service, Schema, definePlugin } from 'hydrooj';

class MyOAuthService extends Service {
    static inject = ['oauth'];
    static Config = Schema.object({
        clientId: Schema.string().required(),
        clientSecret: Schema.string().role('secret').required(),
    });

    constructor(ctx: Context, config) {
        super(ctx, 'oauth.myprovider');
        ctx.oauth.provide('myprovider', {
            text: '使用 MyProvider 登入',
            icon: '<svg>...</svg>',
            callback: async ({ state, code }) => {
                // 用 code 換取用戶資訊
                return {
                    _id: userInfo.id,          // 提供者的唯一 ID
                    email: userInfo.email,
                    uname: userInfo.username,
                    avatar: userInfo.avatarUrl,
                };
            },
        });

        // 新增繁體中文翻譯
        ctx.i18n.load('zh_TW', {
            'Login with MyProvider': '使用 MyProvider 登入',
        });
        ctx.i18n.load('zh', {
            'Login with MyProvider': '使用 MyProvider 登录',
        });
    }
}

export default definePlugin({
    apply(ctx) {
        ctx.plugin(MyOAuthService);
    },
});
```
