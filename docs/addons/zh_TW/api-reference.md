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

```typescript
import { Context } from 'hydrooj';
```

#### 路由

| 方法 | 說明 |
|------|------|
| `ctx.Route(name, path, HandlerClass, ...perms)` | 註冊 HTTP 路由 |
| `ctx.Connection(name, path, HandlerClass, ...perms)` | 註冊 WebSocket 路由 |

#### 事件

| 方法 | 說明 |
|------|------|
| `ctx.on(event, handler)` | 訂閱事件（插件卸載時自動移除） |
| `ctx.once(event, handler)` | 單次訂閱 |
| `ctx.emit(event, ...args)` | 在本地觸發事件 |
| `ctx.parallel(event, ...args)` | 觸發並發等待所有非同步監聽器 |
| `ctx.broadcast(event, ...args)` | 跨所有程序廣播（PM2 叢集） |

#### UI 與語言

| 方法 | 說明 |
|------|------|
| `ctx.injectUI(target, name, args?, ...guards)` | 注入 UI 節點（見 [ui.md](./ui.md)） |
| `ctx.i18n.load(lang, translations)` | 新增翻譯（插件卸載時移除） |

#### 生命週期與依賴注入

| 方法 | 說明 |
|------|------|
| `ctx.plugin(plugin, config?)` | 載入子插件 |
| `ctx.inject(deps, fn)` | 等待服務就緒後呼叫 `fn` |
| `ctx.effect(() => cleanup)` | 註冊清理函式 |

#### Hydro 特有方法

| 方法 | 說明 |
|------|------|
| `ctx.addScript(name, desc, schema, run)` | 註冊維護腳本（見下文） |
| `ctx.provideModule(type, id, module)` | 註冊模組（如 `hash`、`problemSearch`） |
| `ctx.setImmediate(fn, ...args)` | 排程延遲回呼（插件卸載時移除） |

#### 屬性

| 屬性 | 型別 | 說明 |
|------|------|------|
| `ctx.db` | `Database` | 含 `.paginate()` 輔助方法的資料庫 |
| `ctx.loader` | `Loader` | 附加元件載入器 |
| `ctx.check` | `CheckService` | 健康檢查服務 |
| `ctx.geoip?` | `GeoIP` | GeoIP 查詢（若已載入 geoip 插件） |

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
