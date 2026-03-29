# ui-default 前端 API 參考

`@hydrooj/ui-default` 瀏覽器端 JavaScript Bundle 所有匯出項目的完整參考。

> **模組匯入路徑（頁面模組內）：** `import { ... } from 'vj/...'`（webpack 別名）  
> 或在與 Hydro 一起打包的附加元件 JS 中：`import { ... } from '@hydrooj/ui-default'`  
> **English version:** [../ui-default-api.md](../ui-default-api.md)

---

## 目錄

1. [頁面系統](#頁面系統)
   - [Page / NamedPage / AutoloadPage](#page--namedpage--autoloadpage)
   - [addPage](#addpage)
   - [initPageLoader](#initpageloader)
2. [懶載入](#懶載入)
   - [load（預設匯出）](#load預設匯出)
   - [provideFeature / getFeatures / loadFeatures](#providefeature--getfeatures--loadfeatures)
   - [loaded](#loaded)
3. [Context 與 Service](#context-與-service)
4. [對話框（Dialog）](#對話框dialog)
   - [Dialog / InfoDialog / ActionDialog / ConfirmDialog](#dialog--infodialog--actiondialog--confirmdialog)
   - [prompt](#prompt)
   - [confirm / alert](#confirm--alert)
5. [通知（Notification）](#通知notification)
6. [自動完成元件（AutoComplete）](#自動完成元件autocomplete)
7. [Socket](#socket)
8. [檔案工具](#檔案工具)
   - [uploadFiles](#uploadfiles)
   - [download / downloadProblemSet](#download--downloadproblemset)
9. [Monaco 編輯器](#monaco-編輯器)
10. [工具函式](#工具函式)
    - [i18n / substitute](#i18n--substitute)
    - [tpl / rawHtml](#tpl--rawhtml)
    - [request](#request)
    - [delay / secureRandomString](#delay--securerandomstring)
    - [zIndexManager](#zindexmanager)
    - [pjax](#pjax)
    - [滑動動畫](#滑動動畫)
    - [媒體查詢](#媒體查詢)
    - [View Transitions](#view-transitions)
    - [getTheme](#gettheme)
    - [mongoId / emulateAnchorClick](#mongoid--emulateanchorclick)
    - [ZIP 工具](#zip-工具)
    - [base64](#base64)
    - [openDB](#opendb)
    - [addSpeculationRules](#addspeculationrules)
    - [loadReactRedux](#loadreactredux)
    - [api](#api)
    - [getAvailableLangs](#getavailablelangs)
11. [@hydrooj/utils 重新匯出](#hydroojutils-重新匯出)
12. [第三方重新匯出](#第三方重新匯出)
13. [EventMap（可擴展）](#eventmap可擴展)

---

## 頁面系統

### Page / NamedPage / AutoloadPage

```typescript
import { Page, NamedPage, AutoloadPage } from '@hydrooj/ui-default';
```

頁面系統控制 Hydro 各頁面上執行的 JavaScript。

#### `Page`（基底類別）

```typescript
class Page {
  name: string | string[];           // 此實例匹配的頁面名稱
  moduleName?: string;               // 可選的懶載入模組名稱
  autoload: boolean;                 // false（AutoloadPage 覆寫為 true）
  afterLoading?: Callback;
  beforeLoading?: Callback;

  constructor(
    pagename: string | string[],
    afterLoading?: Callback,
    beforeLoading?: Callback,
  );
  // 或帶有明確模組名稱：
  constructor(
    pagename: string | string[],
    moduleName: string,
    afterLoading?: Callback,
    beforeLoading?: Callback,
  );

  isNameMatch(name: string): boolean;
}

type Callback = (pagename: string, loadPage: (name: string) => Promise<any>) => any;
```

#### `NamedPage`

`Page` 的子類別，無額外行為——專門用於只在特定命名頁面上執行的頁面的語義別名。

```typescript
import { NamedPage } from '@hydrooj/ui-default';

export default new NamedPage('problem_detail', async (pageName) => {
  console.log('執行於', pageName);
});
```

#### `AutoloadPage`

將 `autoload` 設為 `true`，表示此頁面在**每個** Hydro 頁面上執行（而非僅特定頁面）。

```typescript
import { AutoloadPage } from '@hydrooj/ui-default';

export default new AutoloadPage('myPlugin', async (pageName) => {
  // 在每個頁面 DOM 就緒後執行
  console.log('目前頁面：', pageName);
});
```

---

### `addPage`

```typescript
function addPage(page: Page | (() => Promise<void> | void)): void;
```

在運行時動態註冊額外的頁面實例（或回調函式）——例如從動態載入的腳本中呼叫。
透過此方式新增的頁面會被推入 `window.Hydro.extraPages`。

```typescript
import { addPage, AutoloadPage } from '@hydrooj/ui-default';

addPage(new AutoloadPage('myFeature', () => {
  document.title = '[已修改] ' + document.title;
}));
```

---

### `initPageLoader`

```typescript
import { initPageLoader } from '@hydrooj/ui-default';
async function initPageLoader(): Promise<void>;
```

啟動頁面載入流程。由 Hydro 入口點呼叫一次——除非你正在建立獨立頁面框架，否則無需在附加元件程式碼中呼叫。

---

## 懶載入

### `load`（預設匯出）

```typescript
import load from '@hydrooj/ui-default';
// 或
import { load } from '@hydrooj/ui-default';

async function load(name: string): Promise<any>;
```

按名稱動態載入懶載入模組。模組名稱必須列在 `window.lazyloadMetadata` 中。
內建懶載入模組包括 `'echarts'` 和 `'moment'`。

```typescript
const echarts = await load('echarts');
const moment = await load('moment');
const myPlugin = await load('my-lazy-plugin');
```

---

### `provideFeature` / `getFeatures` / `loadFeatures`

```typescript
import { provideFeature, getFeatures, loadFeatures } from '@hydrooj/ui-default';

// 註冊功能實作
function provideFeature(name: string, content: string | (() => Promise<any>)): void;

// 取得指定功能名稱的所有已註冊實作
async function getFeatures(name: string): Promise<any[]>;

// 載入所有已註冊的功能實作（冪等——每個最多執行一次）
async function loadFeatures(name: string, ...args: any[]): Promise<void>;
```

功能系統是一個用於可選附加元件功能的輕量級發布/訂閱機制。

```typescript
// 在附加元件 A 中——註冊功能
provideFeature('problem-sidebar', async () => {
  const { default: MySidebar } = await import('./MySidebar');
  MySidebar.attach();
});

// 在使用該功能的核心頁面中
await loadFeatures('problem-sidebar');
```

---

### `loaded`

```typescript
import { loaded } from '@hydrooj/ui-default';

const loaded: string[];  // 已由 loadFeatures() 載入的功能名稱
```

---

## Context 與 Service

```typescript
import { Context, ctx, Service } from '@hydrooj/ui-default';
```

| 匯出 | 型別 | 說明 |
|------|------|------|
| `Context` | 類別（繼承自 Cordis `Context`） | 瀏覽器運行時的依賴注入容器 |
| `ctx` | `Context` 實例 | 全域單例 context |
| `Service` | 類別（繼承自 Cordis `Service`） | 瀏覽器端服務的基底類別 |

```typescript
import { ctx, Service, Context } from '@hydrooj/ui-default';

class MyService extends Service {
  constructor(c: Context) {
    super(c, 'myService');
  }

  doSomething() { /* ... */ }
}

ctx.plugin(MyService);

// 之後：
ctx.myService.doSomething();
```

---

## 對話框（Dialog）

```typescript
import {
  Dialog, InfoDialog, ActionDialog, ConfirmDialog,
  prompt, confirm, alert,
} from '@hydrooj/ui-default';
```

### Dialog / InfoDialog / ActionDialog / ConfirmDialog

所有對話框類別均繼承自 `Dialog`：

```typescript
import { Dialog, InfoDialog, ActionDialog, ConfirmDialog } from '@hydrooj/ui-default';
import { tpl } from '@hydrooj/ui-default';

// 通用對話框（手動設定主體和操作按鈕）
const dlg = new Dialog({
  $body: $('<p>你好</p>'),
  $action: '<button data-action="ok">確定</button>',
  cancelByClickingBack: true,
  cancelByEsc: true,
});
const action = await dlg.open();  // 以 data-action 值解析

// InfoDialog — 單一確定按鈕，點擊背景或按 Esc 關閉
const info = new InfoDialog({
  $body: tpl.typoMsg('操作完成！'),
});
await info.open();

// ActionDialog — 取消 + 確定按鈕
const action2 = new ActionDialog({
  $body: $('<p>確定嗎？</p>'),
});
const result = await action2.open(); // 'ok' | 'cancel'

// ConfirmDialog — 否 + 是按鈕（canCancel: true 時增加取消按鈕）
const confirm2 = new ConfirmDialog({ $body: tpl.typoMsg('刪除此項目？'), canCancel: true });
const answer = await confirm2.open(); // 'yes' | 'no' | 'cancel'
```

**`DialogOptions`**

| 選項 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `$body` | `string \| HTMLElement \| jQuery` | `null` | 對話框主體內容 |
| `$action` | `any` | `null` | 操作按鈕 HTML |
| `classes` | `string` | `''` | 對話框包裝元素的額外 CSS 類別 |
| `width` | `string` | — | 固定寬度（CSS 值） |
| `height` | `string` | — | 固定高度（CSS 值） |
| `cancelByClickingBack` | `boolean` | `false` | 點擊外部時關閉 |
| `cancelByEsc` | `boolean` | `false` | 按 Escape 鍵時關閉 |
| `canCancel` | `boolean` | `false` | `ConfirmDialog` 專用——新增取消按鈕 |
| `onDispatch` | `(action) => boolean` | `() => true` | 回傳 `false` 可阻止關閉 |

---

### `prompt`

高階對話框，渲染表單欄位並回傳型別化的值。

```typescript
async function prompt<T extends string, R extends Record<T, Field>>(
  title: string,
  fields: R,
  options?: { cancelByClickingBack?: boolean; cancelByEsc?: boolean },
): Promise<{ [K in keyof R]: FieldValue<R[K]> } | null>;
```

**`Field` 型別：**

```typescript
interface Field {
  type: 'text' | 'checkbox' | 'user' | 'userId' | 'username' | 'domain';
  options?: string[] | Record<string, string>; // 用於類選擇欄位
  placeholder?: string;
  label?: string;
  autofocus?: boolean;
  required?: boolean;
  default?: string;
  columns?: number;  // 負值 = 全寬換行
}
```

```typescript
import { prompt } from '@hydrooj/ui-default';

const result = await prompt('重新命名', {
  name: { type: 'text', label: '新名稱', required: true, autofocus: true },
});
if (result) console.log('新名稱：', result.name);
```

使用者取消時回傳 `null`。

---

### `confirm` / `alert`

```typescript
async function confirm(text: string): Promise<boolean>;
async function alert(text: string): Promise<void>;
```

顯示 `ConfirmDialog` 或 `InfoDialog` 的便利封裝。

```typescript
import { confirm, alert } from '@hydrooj/ui-default';

if (await confirm('刪除此項目？')) {
  await doDelete();
} else {
  await alert('已取消。');
}
```

---

## 通知（Notification）

```typescript
import Notification from '@hydrooj/ui-default';
// 或具名匯入
import { Notification } from '@hydrooj/ui-default';
```

靜態輔助方法（立即回傳；提示訊息會自動隱藏）：

```typescript
Notification.success('儲存成功！');          // 綠色
Notification.info('處理中…');               // 藍色
Notification.warn('請檢查輸入。');           // 黃色
Notification.error('發生錯誤。');            // 紅色

// 可選自訂持續時間（毫秒，預設：3000）
Notification.success('完成！', 5000);
```

也可手動建立通知：

```typescript
const n = new Notification({
  message: '上傳中',
  type: 'loading',
  duration: 0,   // 0 = 不自動隱藏
});
n.show();
// 之後…
n.hide();
```

---

## 自動完成元件（AutoComplete）

```typescript
import {
  AutoComplete,
  UserSelectAutoComplete,
  ProblemSelectAutoComplete,
  DomainSelectAutoComplete,
  AssignSelectAutoComplete,
  CustomSelectAutoComplete,
} from '@hydrooj/ui-default';
```

這些類別繼承自 `DOMAttachedObject`，並附加到 `<input>` 元素上以提供非同步搜尋下拉選單。

| 類別 | 搜尋內容 |
|------|----------|
| `AutoComplete` | 基底類別——提供自訂 `items()` 函式 |
| `UserSelectAutoComplete` | Hydro 用戶 |
| `ProblemSelectAutoComplete` | 目前域中的題目 |
| `DomainSelectAutoComplete` | Hydro 域 |
| `AssignSelectAutoComplete` | 域角色指派 |
| `CustomSelectAutoComplete` | 任意靜態/非同步選項 |

```typescript
import { UserSelectAutoComplete } from '@hydrooj/ui-default';

// 附加到現有的 <input> 元素
const ac = UserSelectAutoComplete.getOrConstruct($('#user-input'));

// 讀取選定的值
const uid = ac.value();

// 以程式方式設定
ac.value('1000');
```

**常用 `AutoCompleteOptions`：**

| 選項 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `multi` | `boolean` | `false` | 允許多選 |
| `defaultItems` | `string` | — | 預設選定的項目 |
| `width` / `height` | `string` | — | 容器大小 |
| `allowEmptyQuery` | `boolean` | `false` | 空輸入時顯示建議 |
| `freeSolo` | `boolean` | `false` | 允許不在列表中的值 |
| `freeSoloConverter` | `Function` | — | 儲存前轉換自由輸入文字 |
| `onChange` | `(value) => any` | — | 值變更回調 |
| `items` | `() => Promise<any[]>` | — | 非同步項目提供者 |
| `render` | `() => string` | — | 項目渲染器 |
| `text` | `() => string` | — | 項目文字提取器 |

---

## Socket

```typescript
import Socket from '@hydrooj/ui-default';
// 或
import { Socket } from '@hydrooj/ui-default';
```

`ReconnectingWebSocket` 的薄封裝，可選支援 Shorty 壓縮。

```typescript
const sock = new Socket('/record/conn', false, true /* 啟用 shorty */);

sock.on('open', () => console.log('已連線'));
sock.on('message', (event, rawData) => {
  const msg = JSON.parse(rawData);
  console.log(msg);
});
sock.on('close', (code, reason) => console.log('已中斷', code, reason));

sock.send(JSON.stringify({ id: 42 }));
sock.close();
```

**建構子：**

```typescript
new Socket(url: string, nocookie?: boolean, shorty?: boolean);
```

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `url` | — | WebSocket URL（相對或絕對） |
| `nocookie` | `false` | 跨域 URL 時不附加 Session Cookie |
| `shorty` | `false` | 啟用 Shorty 壓縮（伺服器也需支援） |

---

## 檔案工具

### `uploadFiles`

```typescript
import { uploadFiles } from '@hydrooj/ui-default';

async function uploadFiles(
  endpoint?: string,
  files?: File[] | FileList,
  options?: UploadOptions,
): Promise<void>;
```

將一個或多個檔案上傳至 `endpoint`，並顯示進度對話框。完成後可選擇觸發 PJAX 導航。

**`UploadOptions`：**

| 選項 | 型別 | 說明 |
|------|------|------|
| `type` | `string` | 上傳類型（傳遞給伺服器） |
| `pjax` | `boolean` | 上傳後透過 PJAX 重新載入頁面 |
| `sidebar` | `boolean` | 顯示緊湊的側欄式進度條 |
| `singleFileUploadCallback` | `(file: File) => any` | 上傳前對每個檔案呼叫 |
| `filenameCallback` | `(file: File) => string` | 覆寫傳送至伺服器的檔案名稱 |

```typescript
import { uploadFiles } from '@hydrooj/ui-default';

const files = document.querySelector<HTMLInputElement>('#file-input').files;
await uploadFiles(`/d/${UiContext.domainId}/p/${pid}/files`, files, {
  type: 'additional_file',
  pjax: true,
});
```

---

### `download` / `downloadProblemSet`

```typescript
import { download, downloadProblemSet } from '@hydrooj/ui-default';

// 將任意檔案下載為 ZIP
async function download(
  filename: string,
  targets: { filename: string; url?: string; content?: string }[],
): Promise<void>;

// 便利函式：將一組題目匯出為 ZIP
async function downloadProblemSet(pids: number[], name?: string): Promise<void>;
```

```typescript
import { download } from '@hydrooj/ui-default';

await download('export.zip', [
  { filename: 'hello.txt', content: 'Hello world!' },
  { filename: 'data/input.txt', url: 'https://example.com/input.txt' },
]);
```

---

## Monaco 編輯器

```typescript
import { loadMonaco } from '@hydrooj/ui-default';

async function loadMonaco(features?: string[]): Promise<typeof import('monaco-editor')>;
```

懶載入 Monaco 編輯器 Bundle。傳入 `features` 以啟用額外語言支援：
`'typescript'`、`'markdown'`、`'yaml'`，或任何透過
`provideFeature('monaco-<feat>', ...)` 註冊的功能。

```typescript
import { loadMonaco } from '@hydrooj/ui-default';

const monaco = await loadMonaco(['typescript']);
const editor = monaco.editor.create(document.querySelector('#editor'), {
  language: 'typescript',
  value: 'const x: number = 42;',
});
```

---

## 工具函式

```typescript
import {
  i18n, substitute, tpl, rawHtml,
  request, delay, secureRandomString,
  zIndexManager, pjax,
  slideDown, slideUp,
  mediaQuery,
  withTransitionCallback, setTemporaryViewTransitionNames,
  getTheme,
  mongoId, emulateAnchorClick,
  createZipStream, createZipBlob, pipeStream, api,
  base64, openDB, addSpeculationRules, loadReactRedux,
  getAvailableLangs,
} from '@hydrooj/ui-default';
```

---

### `i18n` / `substitute`

```typescript
function i18n(str: string, ...params: any[]): string;
function substitute(str: string, obj: Record<string, any>): string;
```

`i18n` 在 `window.LOCALES` 中查找 `str`，並替換位置佔位符 `{0}`、`{1}` 等。

```typescript
i18n('你好 {0}！', '世界')           // → '你好 世界！'
i18n('你有 {0} 則訊息', 5)           // → '你有 5 則訊息'
substitute('{name} 得了 {pts} 分', { name: '小明', pts: 100 })  // → '小明 得了 100 分'
```

---

### `tpl` / `rawHtml`

```typescript
// 模板字面量（XSS 安全：替換值會進行 HTML 跳脫）
function tpl(pieces: TemplateStringsArray, ...substitutions: Substitution[]): string;

// React 元素 → HTML 字串（reactive=true 時回傳 HTMLDivElement）
function tpl(node: React.ReactNode, reactive?: boolean): string | HTMLDivElement;

// 附加的輔助方法
tpl.typoMsg(msg: string, raw?: boolean): string;

// 跳過特定替換值的 HTML 跳脫
function rawHtml(html: string): { templateRaw: true; html: string };

type Substitution = string | number | { templateRaw: true; html: string };
```

```typescript
import { tpl, rawHtml } from '@hydrooj/ui-default';

// 跳脫後的模板字面量
const html1 = tpl`<strong>${userInput}</strong>`;

// 混合跳脫與原始內容
const html2 = tpl`<p>${rawHtml('<em>安全標記</em>')}</p>`;

// React 節點 → 靜態 HTML 字串
const html3 = tpl(<span className="badge">新</span>);

// 響應式 React 掛載（回傳即時更新的 HTMLDivElement）
const div = tpl(<MyComponent />, true);
document.body.appendChild(div);

// 段落包裝的訊息
const msg = tpl.typoMsg('第一行\n第二行');
```

---

### `request`

基於 jQuery 的 AJAX 輔助工具。所有方法在網路錯誤或伺服器回傳錯誤物件時，均以使用者可讀的 `Error` 拒絕。

```typescript
const request = {
  // 低階 jQuery.ajax 封裝
  ajax(options: Record<string, any>): Promise<any>;

  // POST JSON 或表單資料
  post(url: string, data?: Record<string, any> | FormData | string, options?: object): Promise<any>;

  // POST FormData（檔案上傳）
  postFile(url: string, form: FormData, options?: object): Promise<any>;

  // GET 含查詢字串
  get(url: string, qs?: Record<string, any>, options?: object): Promise<any>;
};
```

```typescript
import { request } from '@hydrooj/ui-default';

// GET
const data = await request.get(`/d/${UiContext.domainId}/p`, { page: 1 });

// POST JSON
await request.post(`/d/${UiContext.domainId}/p/${pid}/edit`, { title: '新標題' });

// POST 表單格式
await request.post(`/d/${UiContext.domainId}/p/${pid}`, $('form').serialize());
```

---

### `delay` / `secureRandomString`

```typescript
function delay(ms: number): Promise<void>;

function secureRandomString(
  digit?: number,                 // 預設：32
  dict?: string,                  // 預設：a-zA-Z0-9
): string;
```

```typescript
import { delay, secureRandomString } from '@hydrooj/ui-default';

await delay(1000);  // 等待 1 秒

const token = secureRandomString(16);  // 16 字元隨機字串
```

---

### `zIndexManager`

單調遞增的 z-index 登錄表，確保所有模態框/覆蓋層正確堆疊。

```typescript
const zIndexManager = {
  getCurrent(): number;  // 最近發出的 z-index
  getNext(): number;     // 遞增並回傳
};
```

```typescript
import { zIndexManager } from '@hydrooj/ui-default';

element.style.zIndex = String(zIndexManager.getNext());
```

---

### `pjax`

```typescript
import { pjax } from '@hydrooj/ui-default';
```

為 Hydro SPA 配置的 [pjax](https://github.com/MoOx/pjax) 重新匯出實例。
使用 `pjax.reload()` 可在不完整導航的情況下刷新頁面內容。

---

### 滑動動畫

```typescript
async function slideDown(
  $element: JQuery,
  duration: number,
  fromCss?: Record<string, any>,
  toCss?: Record<string, any>,
): Promise<void>;

async function slideUp(
  $element: JQuery,
  duration: number,
  fromCss?: Record<string, any>,
  toCss?: Record<string, any>,
): Promise<void>;
```

使用 `easeOutCubic` 緩動的 jQuery 滑動動畫。

```typescript
import { slideDown, slideUp } from '@hydrooj/ui-default';

await slideDown($('#panel'), 300);
await slideUp($('#panel'), 200);
```

---

### 媒體查詢

```typescript
import { mediaQuery } from '@hydrooj/ui-default';

mediaQuery.isAbove(width: number): boolean;  // 視口寬度 ≥ width px
mediaQuery.isBelow(width: number): boolean;  // 視口寬度 ≤ width px
```

```typescript
if (mediaQuery.isBelow(768)) {
  // 行動版佈局
}
```

---

### View Transitions

```typescript
async function withTransitionCallback(callback: () => Promise<void> | void): Promise<void>;

async function setTemporaryViewTransitionNames(
  entries: [element: HTMLElement, name: string][],
  vtPromise: Promise<void>,
): Promise<void>;
```

[View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions/) 的封裝。
在不支援的瀏覽器上降級為直接呼叫 `callback()`。

```typescript
import { withTransitionCallback } from '@hydrooj/ui-default';

await withTransitionCallback(async () => {
  // DOM 變更——以淡入淡出動畫呈現
  container.innerHTML = newContent;
});
```

---

### `getTheme`

```typescript
function getTheme(): 'dark' | 'light';
```

根據 `UserContext.theme` 回傳目前的 Hydro 主題。

---

### `mongoId`

```typescript
function mongoId(idstring: string): {
  timestamp: number;
  machineid: number;
  pid: number;
  sequence: number;
};
```

將 ObjectId 字串解碼為其組成部分。

---

### `emulateAnchorClick`

```typescript
function emulateAnchorClick(
  ev: KeyboardEvent,
  targetUrl: string,
  alwaysOpenInNewWindow?: boolean,
): void;
```

開啟 `targetUrl`——根據 `ev` 中按下的修飾鍵（Ctrl / Shift / Meta）決定在同一分頁或新視窗中開啟。

---

### ZIP 工具

```typescript
const createZipStream: (underlyingSource: any) => ReadableStream;

async function createZipBlob(underlyingSource: any): Promise<Blob>;

async function pipeStream(
  read: ReadableStream,
  write: WritableStream,
  abort: { abort?: () => void },
): Promise<void>;
```

`download()` 內部使用的低階串流式 ZIP 工具。

---

### `base64`

```typescript
import { base64 } from '@hydrooj/ui-default';

base64.encode(str: string): string;
base64.decode(str: string): string;
```

---

### `openDB`

```typescript
import { openDB } from '@hydrooj/ui-default';

const db: IDBPDatabase;  // IDB 資料庫 Promise（來自 'idb'）
```

預先開啟的 IndexedDB 實例（`hydro` 資料庫，版本 1）。儲存空間：

| 物件倉儲 | 鍵 | 說明 |
|---------|-----|------|
| `solutions` | `id` | 本地儲存的草稿解答 |
| `scoreboard-star` | `id` | 已加星號的排行榜條目 |

```typescript
import { openDB } from '@hydrooj/ui-default';

const db = await openDB;
await db.put('solutions', { id: 'P1001#objective', value: myCode });
const item = await db.get('solutions', 'P1001#objective');
```

---

### `addSpeculationRules`

```typescript
function addSpeculationRules(rules: object): void;
```

為支援 [Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API) 的瀏覽器注入 `<script type="speculationrules">` 元素。
在不支援的瀏覽器上不執行任何操作。

```typescript
import { addSpeculationRules } from '@hydrooj/ui-default';

addSpeculationRules({
  prefetch: [{ source: 'list', urls: ['/d/system/p'] }],
});
```

---

### `loadReactRedux`

```typescript
async function loadReactRedux<S, A extends Action = UnknownAction>(
  storeReducer: Reducer<S, A>,
): Promise<{
  React: typeof React;
  createRoot: typeof ReactDOM.createRoot;
  Provider: typeof ReactRedux.Provider;
  store: Redux.Store<S, A>;
}>;
```

懶載入 React、ReactDOM 和 Redux，然後從你的 reducer 建立一個 store。
包含 `redux-thunk` 和 `redux-promise-middleware` 中介軟體，以及開發模式下的 Redux Logger。

```typescript
import { loadReactRedux } from '@hydrooj/ui-default';
import myReducer from './reducers';

const { React, createRoot, Provider, store } = await loadReactRedux(myReducer);
const root = createRoot(document.querySelector('#app'));
root.render(<Provider store={store}><App /></Provider>);
```

---

### `api`

```typescript
async function api(
  method: string,
  args: Record<string, any>,
  projection: Record<string, 1 | 0>,
): Promise<any>;
```

呼叫 Hydro 類 GraphQL 的 API 端點（`/d/:domainId/api/:method`）。

```typescript
import { api } from '@hydrooj/ui-default';

const problem = await api('problem', { id: 1000 }, {
  title: 1,
  content: 1,
  tag: 1,
});
console.log(problem.title);
```

---

### `getAvailableLangs`

```typescript
function getAvailableLangs(langsList?: string[]): Record<string, any>;
```

從 `window.LANGS` 回傳已啟用的程式語言，若提供 `langsList` 則按其過濾。
隱藏和停用的語言（除非明確列出）會被排除。

```typescript
import { getAvailableLangs } from '@hydrooj/ui-default';

const langs = getAvailableLangs();
// { 'c': { name: 'C', ... }, 'cpp': { ... }, ... }

const filtered = getAvailableLangs(['cpp', 'java']);
```

---

## @hydrooj/utils 重新匯出

以下來自 `@hydrooj/utils/lib/common` 的工具函式被直接重新匯出：

| 函式 | 簽名 | 說明 |
|------|------|------|
| `randomstring` | `(digit?, dict?) => string` | 隨機英數字串（非加密安全） |
| `sleep` | `(ms) => Promise<void>` | `delay` 的別名 |
| `noop` | `() => void` | 空操作函式 |
| `camelCase` | `(str) => string` | 轉換為 camelCase |
| `paramCase` | `(str) => string` | 轉換為 param-case（kebab） |
| `snakeCase` | `(str) => string` | 轉換為 snake_case |
| `parseTimeMS` | `(str \| number) => number` | 將人類可讀時間字串解析為毫秒 |
| `parseMemoryMB` | `(str \| number) => number` | 將記憶體字串解析為 MB |
| `formatSeconds` | `(seconds, showSeconds?) => string` | 格式化時長 |
| `size` | `(bytes, base?) => string` | 格式化位元組大小（例如 `'1.23 MB'`） |
| `randomPick` | `<T>(arr: T[]) => T` | 隨機選取一個元素 |
| `sortFiles` | `(files, key?) => sorted` | 自然排序檔案名稱 |
| `diffArray` | `(a, b) => { add, del }` | 計算陣列差異 |
| `getAlphabeticId` | `(n) => string` | 將數字轉換為字母 ID |

---

## 第三方重新匯出

以下程式庫從 `@hydrooj/ui-default` 重新匯出，使附加元件程式碼與核心 UI 共用**相同的實例**
（對 React 協調和 jQuery 事件命名空間很重要）：

| 匯出 | 程式庫 |
|------|--------|
| `$` | [jQuery](https://jquery.com/) |
| `_` | [Lodash](https://lodash.com/) |
| `React` | [React](https://react.dev/) |
| `ReactDOM` | [react-dom](https://react.dev/)（合併 main + client） |
| `redux` | [react-redux](https://react-redux.js.org/) 命名空間 |
| `jsxRuntime` | `react/jsx-runtime` |
| `AnsiUp` | [ansi_up](https://github.com/drudru/ansi_up) |

請始終從 `@hydrooj/ui-default` 匯入這些程式庫，而非單獨安裝，以確保單一實例語義。

```typescript
import { $, _, React, ReactDOM } from '@hydrooj/ui-default';
```

---

## EventMap（可擴展）

`EventMap` 是一個空介面，附加元件可以擴增它以在瀏覽器上下文中獲得型別安全的
`ctx.emit` / `ctx.on` 簽名：

```typescript
// 在附加元件的型別宣告中：
declare module '@hydrooj/ui-default' {
  interface EventMap {
    'my-addon/ready': (config: MyConfig) => void;
    'my-addon/update': (id: string, data: any) => void;
  }
}

// 然後在附加元件程式碼中：
ctx.on('my-addon/ready', (config) => { /* 已型別化 */ });
ctx.emit('my-addon/ready', myConfig);
```
