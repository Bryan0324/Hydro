# Hydro 附加元件開發指南

本指南說明如何為 [Hydro](https://github.com/hydro-dev/Hydro) 線上評測系統建立附加元件（插件）。

> **English version:** [../README.md](../README.md)

## 目錄

1. [簡介](#簡介)
2. [快速開始](#快速開始)
3. [插件結構](#插件結構)
4. [路由處理器](./handlers.md) — HTTP 與 WebSocket 請求處理
5. [資料模型](./models.md) — 資料庫模型
6. [事件系統](./events.md) — 事件系統
7. [UI 注入](./ui.md) — 注入使用者介面
8. [API 參考](./api-reference.md) — 完整 API 清單

---

## 簡介

Hydro 附加元件是 npm 套件，可為平台新增各種功能：  
路由、資料模型、UI 元件、比賽規則、OAuth 登入方式、腳本等。  
它們在啟動時由 `hydrooj` 透過基於 [Cordis](https://github.com/cordiverse/cordis) 的插件系統載入。

---

## 快速開始

### 前置需求

- Node.js ≥ 18
- 一個可用的 Hydro 實例（用於測試）
- TypeScript（建議使用）

### 建立新附加元件

```bash
mkdir my-hydro-addon
cd my-hydro-addon
npm init -y
npm install hydrooj typescript --save-peer
```

建立 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

更新 `package.json`：

```json
{
  "name": "my-hydro-addon",
  "version": "1.0.0",
  "main": "src/index.ts",
  "peerDependencies": {
    "hydrooj": "*"
  }
}
```

### 最簡插件

建立 `src/index.ts`：

```typescript
import { Context } from 'hydrooj';

export async function apply(ctx: Context) {
    // 插件邏輯寫在這裡
    ctx.on('app/started', () => {
        console.log('我的附加元件已載入！');
    });
}
```

### 使用 `definePlugin`（建議方式）

`definePlugin` 提供設定結構的 TypeScript 型別推導：

```typescript
import { Context, definePlugin, Schema } from 'hydrooj';

export default definePlugin({
    name: 'my-addon',
    schema: Schema.object({
        greeting: Schema.string().default('你好'),
    }),
    apply(ctx: Context, config) {
        ctx.on('app/started', () => {
            console.log(config.greeting);
        });
    },
});
```

### 安裝附加元件

透過設定檔或管理面板在 Hydro 中註冊附加元件：

```bash
hydrooj addon add /path/to/my-hydro-addon
# 或（若已發布到 npm）
hydrooj addon add my-hydro-addon
```

---

## 插件結構

每個附加元件可以是以下兩種形式之一：

### 1. 具名匯出 `apply`

```typescript
export async function apply(ctx: Context) { /* ... */ }
```

### 2. 透過 `definePlugin` 匯出預設值

```typescript
export default definePlugin({
    name: 'my-plugin',
    apply(ctx, config) { /* ... */ },
});
```

### `Context` 物件

`ctx` 參數是插件的依賴注入容器（Cordis `Context`）。  
透過它註冊的所有效果（路由、事件監聽器、UI 注入、計時器、設定）都會在插件卸載或重載時**自動清除**。

`Context` 的主要方法：

| 方法 | 說明 |
|------|------|
| `ctx.Route(name, path, Handler, ...perms)` | 註冊 HTTP 路由 |
| `ctx.Connection(name, path, Handler, ...perms)` | 註冊 WebSocket 連線路由 |
| `ctx.on(event, handler)` | 訂閱事件（插件卸載時自動移除） |
| `ctx.once(event, handler)` | 單次訂閱；第一次呼叫後自動移除 |
| `ctx.emit(event, ...args)` | 在當前程序本地觸發事件（同步，不等待） |
| `ctx.parallel(event, ...args)` | 觸發並並發等待所有非同步監聽器 |
| `ctx.serial(event, ...args)` | 按順序觸發並等待監聽器；回傳第一個非 `undefined` 值 |
| `ctx.broadcast(event, ...args)` | 跨 PM2 叢集程序廣播 |
| `ctx.injectUI(target, name, args?, ...perms)` | 注入 UI 節點 |
| `ctx.i18n.load(lang, translations)` | 新增翻譯（插件卸載時移除） |
| `ctx.i18n.get(key, lang)` | 查詢單一翻譯鍵 |
| `ctx.i18n.translate(str, languages)` | 按語言優先順序解析字串 |
| `ctx.addScript(name, desc, schema, run)` | 註冊維護腳本 |
| `ctx.provideModule(type, id, module)` | 註冊模組（例如雜湊函數） |
| `ctx.setImmediate(fn, ...args)` | 延遲回呼；插件卸載時自動取消 |
| `ctx.plugin(plugin, config?)` | 載入子插件；回傳 `Fiber` |
| `ctx.inject(deps, fn)` | 等待服務就緒後在子作用域中執行 `fn` |
| `ctx.effect(() => cleanup)` | 註冊帶有清理函式的副作用 |
| `ctx.extend(patch)` | 回傳附帶額外屬性的子 Context |
| `ctx.get(serviceName)` | 按名稱查詢服務（若尚未就緒則回傳 `undefined`） |
| `ctx.handlerMixin(mixin)` | 將方法混入每個 HTTP Handler |
| `ctx.wsHandlerMixin(mixin)` | 將方法混入每個 WebSocket ConnectionHandler |
| `ctx.withHandlerClass(name, cb)` | 按路由名稱修改特定處理器類別 |
| `ctx.addCaptureRoute(prefix, cb)` | 以 Koa 中介軟體攔截某 URL 前綴下的所有請求 |

`ctx` 上可用的服務屬性：

| 屬性 | 型別 | 說明 |
|------|------|------|
| `ctx.db` | `MongoService` | MongoDB 客戶端，含 `collection()`、`paginate()`、`ensureIndexes()` |
| `ctx.setting` | `SettingService` | 插件設定：`get()`、`requestConfig()`、`SystemSetting()`、`DomainSetting()` 等 |
| `ctx.i18n` | `I18nService` | 翻譯服務：`load()`、`get()`、`translate()`、`langs()` |
| `ctx.loader` | `Loader` | 附加元件載入器 |
| `ctx.check` | `CheckService` | 健康檢查服務 |
| `ctx.geoip?` | `GeoIP` | GeoIP 查詢（若已載入 geoip 插件） |
| `ctx.domain?` | `DomainDoc` | 當前域（在每個請求的子 Context 上設定） |

各方法與屬性的完整說明，請參閱 [api-reference.md → Context 與 Service](./api-reference.md#context-與-service)。

### 生命週期事件

Hydro 啟動時，事件觸發順序如下：

1. `database/connect` — MongoDB 連線建立
2. `database/config` — 資料庫設定讀取完成
3. `app/listen` — HTTP 伺服器即將開始監聽
4. `app/started` — HTTP 伺服器已開始監聽
5. `app/ready` — 所有插件載入完成
6. `task/daily` — 每天執行一次

---

## TypeScript 型別擴展

附加元件可以擴充 Hydro 的全域介面：

```typescript
declare module 'hydrooj' {
    // 自訂 MongoDB 集合
    interface Collections {
        'my-addon.items': MyItemDoc;
    }
    // 自訂文件類型（給 DocumentModel 使用）
    interface DocType {
        [MY_DOC_TYPE]: MyDoc;
    }
    // 在 global.Hydro.model 上新增模型
    interface Model {
        myAddon: typeof MyAddonModel;
    }
}
```

---

## 範例

- [`packages/blog`](../../../packages/blog/index.ts) — 簡單的部落格（自訂文件與路由）
- [`packages/center`](../../../packages/center) — 透過 Service 類別上報資料
- [`packages/login-with-github`](../../../packages/login-with-github) — OAuth 登入提供者
- [`packages/telegram`](../../../packages/telegram) — Telegram 整合

---

> **另請參閱：**  
> [handlers.md](./handlers.md) · [models.md](./models.md) · [events.md](./events.md) · [ui.md](./ui.md) · [api-reference.md](./api-reference.md)
