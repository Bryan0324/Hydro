# ui-default Frontend API Reference

Complete reference of everything exported from `@hydrooj/ui-default` — the browser-side
JavaScript bundle that runs in the Hydro UI.

> **Import path (inside a page module):** `import { ... } from 'vj/...'` (webpack alias)  
> Or in addon JavaScript that is bundled with Hydro: `import { ... } from '@hydrooj/ui-default'`  
> **繁體中文版：** [zh_TW/ui-default-api.md](./zh_TW/ui-default-api.md)

---

## Table of Contents

1. [Page System](#page-system)
   - [Page / NamedPage / AutoloadPage](#page--namedpage--autoloadpage)
   - [addPage](#addpage)
   - [initPageLoader](#initpageloader)
2. [Lazy Loading](#lazy-loading)
   - [load (default export)](#load-default-export)
   - [provideFeature / getFeatures / loadFeatures](#providefeature--getfeatures--loadfeatures)
   - [loaded](#loaded)
3. [Context & Service](#context--service)
4. [Dialog](#dialog)
   - [Dialog / InfoDialog / ActionDialog / ConfirmDialog](#dialog--infodialog--actiondialog--confirmdialog)
   - [prompt](#prompt)
   - [confirm / alert](#confirm--alert)
5. [Notification](#notification)
6. [AutoComplete Components](#autocomplete-components)
7. [Socket](#socket)
8. [File Utilities](#file-utilities)
   - [uploadFiles](#uploadfiles)
   - [download / downloadProblemSet](#download--downloadproblemset)
9. [Monaco Editor](#monaco-editor)
10. [Utility Functions](#utility-functions)
    - [i18n / substitute](#i18n--substitute)
    - [tpl / rawHtml](#tpl--rawhtml)
    - [request](#request)
    - [delay / secureRandomString](#delay--securerandomstring)
    - [zIndexManager](#zindexmanager)
    - [pjax](#pjax)
    - [Slide animations](#slide-animations)
    - [Media queries](#media-queries)
    - [View Transitions](#view-transitions)
    - [getTheme](#gettheme)
    - [mongoId / emulateAnchorClick](#mongoid--emulateanchorclick)
    - [Zip helpers](#zip-helpers)
    - [base64](#base64)
    - [openDB](#opendb)
    - [addSpeculationRules](#addspeculationrules)
    - [loadReactRedux](#loadreactredux)
    - [api](#api)
    - [getAvailableLangs](#getavailablelangs)
11. [@hydrooj/utils re-exports](#hydroojutils-re-exports)
12. [Third-party re-exports](#third-party-re-exports)
13. [EventMap (extensible)](#eventmap-extensible)

---

## Page System

### Page / NamedPage / AutoloadPage

```typescript
import { Page, NamedPage, AutoloadPage } from '@hydrooj/ui-default';
```

The page system controls which JavaScript runs on each Hydro page.

#### `Page` (base class)

```typescript
class Page {
  name: string | string[];           // Page name(s) this instance matches
  moduleName?: string;               // Optional lazy-module name
  autoload: boolean;                 // false (override in AutoloadPage)
  afterLoading?: Callback;
  beforeLoading?: Callback;

  constructor(
    pagename: string | string[],
    afterLoading?: Callback,
    beforeLoading?: Callback,
  );
  // or with explicit module name:
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

Subclass of `Page` with no extra behaviour — a semantic alias for pages that only run
on specific named pages.

```typescript
import { NamedPage } from '@hydrooj/ui-default';

export default new NamedPage('problem_detail', async (pageName) => {
  console.log('running on', pageName);
});
```

#### `AutoloadPage`

Sets `autoload = true`, meaning the page runs on **every** Hydro page (not just a named one).

```typescript
import { AutoloadPage } from '@hydrooj/ui-default';

export default new AutoloadPage('myPlugin', async (pageName) => {
  // Runs on every page after DOM is ready
  console.log('current page:', pageName);
});
```

---

### `addPage`

```typescript
function addPage(page: Page | (() => Promise<void> | void)): void;
```

Register an additional page instance (or a callback) at runtime — for example from inside
a dynamically loaded script. Pages added this way are pushed onto `window.Hydro.extraPages`.

```typescript
import { addPage, AutoloadPage } from '@hydrooj/ui-default';

addPage(new AutoloadPage('myFeature', () => {
  document.title = '[Modified] ' + document.title;
}));
```

---

### `initPageLoader`

```typescript
import { initPageLoader } from '@hydrooj/ui-default';
async function initPageLoader(): Promise<void>;
```

Bootstrap the page loading pipeline. Called once by the Hydro entry point — you do not need
to call this in addon code unless you are building a standalone page harness.

---

## Lazy Loading

### `load` (default export)

```typescript
import load from '@hydrooj/ui-default';
// or
import { load } from '@hydrooj/ui-default';

async function load(name: string): Promise<any>;
```

Dynamically load a lazy module by name. Module names must be listed in
`window.lazyloadMetadata`. Built-in lazy modules include `'echarts'` and `'moment'`.

```typescript
const echarts = await load('echarts');
const moment = await load('moment');
const myPlugin = await load('my-lazy-plugin');
```

---

### `provideFeature` / `getFeatures` / `loadFeatures`

```typescript
import { provideFeature, getFeatures, loadFeatures } from '@hydrooj/ui-default';

// Register a feature implementation
function provideFeature(name: string, content: string | (() => Promise<any>)): void;

// Get all registered implementations for a feature name
async function getFeatures(name: string): Promise<any[]>;

// Load all registered feature implementations (idempotent — runs each at most once)
async function loadFeatures(name: string, ...args: any[]): Promise<void>;
```

The feature system is a lightweight publish/subscribe mechanism for optional addon features.

```typescript
// In addon A — register a feature
provideFeature('problem-sidebar', async () => {
  const { default: MySidebar } = await import('./MySidebar');
  MySidebar.attach();
});

// In the core page that uses the feature
await loadFeatures('problem-sidebar');
```

---

### `loaded`

```typescript
import { loaded } from '@hydrooj/ui-default';

const loaded: string[];  // Names of features already loaded by loadFeatures()
```

---

## Context & Service

```typescript
import { Context, ctx, Service } from '@hydrooj/ui-default';
```

| Export | Type | Description |
|--------|------|-------------|
| `Context` | class (extends Cordis `Context`) | DI container for the browser runtime |
| `ctx` | `Context` instance | The global singleton context |
| `Service` | class (extends Cordis `Service`) | Base class for browser-side services |

```typescript
import { ctx, Service, Context } from '@hydrooj/ui-default';

class MyService extends Service {
  constructor(c: Context) {
    super(c, 'myService');
  }

  doSomething() { /* ... */ }
}

ctx.plugin(MyService);

// Later:
ctx.myService.doSomething();
```

---

## Dialog

```typescript
import {
  Dialog, InfoDialog, ActionDialog, ConfirmDialog,
  prompt, confirm, alert,
} from '@hydrooj/ui-default';
```

### Dialog / InfoDialog / ActionDialog / ConfirmDialog

All dialog classes extend `Dialog`:

```typescript
import { Dialog, InfoDialog, ActionDialog, ConfirmDialog } from '@hydrooj/ui-default';
import { tpl } from '@hydrooj/ui-default';

// Generic dialog (manually set body and action buttons)
const dlg = new Dialog({
  $body: $('<p>Hello</p>'),
  $action: '<button data-action="ok">OK</button>',
  cancelByClickingBack: true,
  cancelByEsc: true,
});
const action = await dlg.open();  // resolves with the data-action value

// Info dialog — single OK button, closes on background click / Esc
const info = new InfoDialog({
  $body: tpl.typoMsg('Operation completed!'),
});
await info.open();

// Action dialog — Cancel + OK buttons
const action2 = new ActionDialog({
  $body: $('<p>Are you sure?</p>'),
});
const result = await action2.open(); // 'ok' | 'cancel'

// Confirm dialog — No + Yes buttons (or Cancel + No + Yes if canCancel: true)
const confirm2 = new ConfirmDialog({ $body: tpl.typoMsg('Delete this item?'), canCancel: true });
const answer = await confirm2.open(); // 'yes' | 'no' | 'cancel'
```

**`DialogOptions`**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `$body` | `string \| HTMLElement \| jQuery` | `null` | Dialog body content |
| `$action` | `any` | `null` | Action buttons HTML |
| `classes` | `string` | `''` | Extra CSS classes on the dialog wrapper |
| `width` | `string` | — | Fixed width (CSS value) |
| `height` | `string` | — | Fixed height (CSS value) |
| `cancelByClickingBack` | `boolean` | `false` | Close when clicking outside |
| `cancelByEsc` | `boolean` | `false` | Close on Escape key |
| `canCancel` | `boolean` | `false` | `ConfirmDialog` — add a Cancel button |
| `onDispatch` | `(action) => boolean` | `() => true` | Return `false` to prevent closing |

---

### `prompt`

A higher-level dialog that renders form fields and returns typed values.

```typescript
async function prompt<T extends string, R extends Record<T, Field>>(
  title: string,
  fields: R,
  options?: { cancelByClickingBack?: boolean; cancelByEsc?: boolean },
): Promise<{ [K in keyof R]: FieldValue<R[K]> } | null>;
```

**`Field` type:**

```typescript
interface Field {
  type: 'text' | 'checkbox' | 'user' | 'userId' | 'username' | 'domain';
  options?: string[] | Record<string, string>; // for select-like fields
  placeholder?: string;
  label?: string;
  autofocus?: boolean;
  required?: boolean;
  default?: string;
  columns?: number;  // negative = full-width row break
}
```

```typescript
import { prompt } from '@hydrooj/ui-default';

const result = await prompt('Rename', {
  name: { type: 'text', label: 'New name', required: true, autofocus: true },
});
if (result) console.log('New name:', result.name);
```

Returns `null` if the user cancels.

---

### `confirm` / `alert`

```typescript
async function confirm(text: string): Promise<boolean>;
async function alert(text: string): Promise<void>;
```

Convenience wrappers that display a `ConfirmDialog` or `InfoDialog`.

```typescript
import { confirm, alert } from '@hydrooj/ui-default';

if (await confirm('Delete this item?')) {
  await doDelete();
} else {
  await alert('Cancelled.');
}
```

---

## Notification

```typescript
import Notification from '@hydrooj/ui-default';
// or
import { Notification } from '@hydrooj/ui-default';  // named re-export
```

Static helper methods (all return immediately; the toast auto-hides):

```typescript
Notification.success('Saved!');                // green
Notification.info('Processing…');              // blue
Notification.warn('Check your input.');        // yellow
Notification.error('An error occurred.');      // red

// Optional custom duration in milliseconds (default: 3000)
Notification.success('Done!', 5000);
```

You can also create a manual notification:

```typescript
const n = new Notification({
  message: 'Upload in progress',
  type: 'loading',
  duration: 0,   // 0 = no auto-hide
});
n.show();
// later…
n.hide();
```

---

## AutoComplete Components

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

These extend `DOMAttachedObject` and attach to `<input>` elements to provide
async-search dropdowns.

| Class | What it searches |
|-------|-----------------|
| `AutoComplete` | Base class — provide a custom `items()` function |
| `UserSelectAutoComplete` | Hydro users |
| `ProblemSelectAutoComplete` | Problems in the current domain |
| `DomainSelectAutoComplete` | Hydro domains |
| `AssignSelectAutoComplete` | Domain role assignments |
| `CustomSelectAutoComplete` | Arbitrary static/async options |

```typescript
import { UserSelectAutoComplete } from '@hydrooj/ui-default';

// Attach to an existing <input> element
const ac = UserSelectAutoComplete.getOrConstruct($('#user-input'));

// Read the selected value
const uid = ac.value();

// Programmatically set
ac.value('1000');
```

**Common `AutoCompleteOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `multi` | `boolean` | `false` | Allow multiple selections |
| `defaultItems` | `string` | — | Pre-selected items |
| `width` / `height` | `string` | — | Container size |
| `allowEmptyQuery` | `boolean` | `false` | Show suggestions on empty input |
| `freeSolo` | `boolean` | `false` | Allow values not in the list |
| `freeSoloConverter` | `Function` | — | Transform free-solo text before storing |
| `onChange` | `(value) => any` | — | Value change callback |
| `items` | `() => Promise<any[]>` | — | Async item provider |
| `render` | `() => string` | — | Item renderer |
| `text` | `() => string` | — | Item text extractor |

---

## Socket

```typescript
import Socket from '@hydrooj/ui-default';
// or
import { Socket } from '@hydrooj/ui-default';
```

Thin wrapper around `ReconnectingWebSocket` with optional Shorty compression.

```typescript
const sock = new Socket('/record/conn', false, true /* enable shorty */);

sock.on('open', () => console.log('connected'));
sock.on('message', (event, rawData) => {
  const msg = JSON.parse(rawData);
  console.log(msg);
});
sock.on('close', (code, reason) => console.log('closed', code, reason));

sock.send(JSON.stringify({ id: 42 }));
sock.close();
```

**Constructor:**

```typescript
new Socket(url: string, nocookie?: boolean, shorty?: boolean);
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `url` | — | WebSocket URL (relative or absolute) |
| `nocookie` | `false` | Skip adding the session cookie to cross-origin URLs |
| `shorty` | `false` | Enable Shorty compression (server must also support it) |

---

## File Utilities

### `uploadFiles`

```typescript
import { uploadFiles } from '@hydrooj/ui-default';

async function uploadFiles(
  endpoint?: string,
  files?: File[] | FileList,
  options?: UploadOptions,
): Promise<void>;
```

Uploads one or more files to `endpoint` with a progress dialog. On completion it optionally
triggers a PJAX navigation.

**`UploadOptions`:**

| Option | Type | Description |
|--------|------|-------------|
| `type` | `string` | Upload type (passed to the server) |
| `pjax` | `boolean` | Reload the page via PJAX after upload |
| `sidebar` | `boolean` | Show a compact sidebar-style progress bar |
| `singleFileUploadCallback` | `(file: File) => any` | Called for each file before upload |
| `filenameCallback` | `(file: File) => string` | Override the filename sent to the server |

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

// Download arbitrary files as a ZIP
async function download(
  filename: string,
  targets: { filename: string; url?: string; content?: string }[],
): Promise<void>;

// Convenience: export a set of problems as a ZIP
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

## Monaco Editor

```typescript
import { loadMonaco } from '@hydrooj/ui-default';

async function loadMonaco(features?: string[]): Promise<typeof import('monaco-editor')>;
```

Lazily loads the Monaco editor bundle. Pass `features` to enable extra language support:
`'typescript'`, `'markdown'`, `'yaml'`, or any feature registered via
`provideFeature('monaco-<feat>', ...)`.

```typescript
import { loadMonaco } from '@hydrooj/ui-default';

const monaco = await loadMonaco(['typescript']);
const editor = monaco.editor.create(document.querySelector('#editor'), {
  language: 'typescript',
  value: 'const x: number = 42;',
});
```

---

## Utility Functions

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

`i18n` looks up `str` in `window.LOCALES` and substitutes positional `{0}`, `{1}`, … placeholders.

```typescript
i18n('Hello {0}!', 'world')         // → 'Hello world!'
i18n('You have {0} messages', 5)    // → 'You have 5 messages'
substitute('{name} scored {pts}', { name: 'Alice', pts: 100 })  // → 'Alice scored 100'
```

---

### `tpl` / `rawHtml`

```typescript
// Template literal (XSS-safe: substitutions are HTML-escaped)
function tpl(pieces: TemplateStringsArray, ...substitutions: Substitution[]): string;

// React element → HTML string (or HTMLDivElement when reactive=true)
function tpl(node: React.ReactNode, reactive?: boolean): string | HTMLDivElement;

// Attached helper
tpl.typoMsg(msg: string, raw?: boolean): string;

// Bypass HTML escaping for a specific substitution
function rawHtml(html: string): { templateRaw: true; html: string };

type Substitution = string | number | { templateRaw: true; html: string };
```

```typescript
import { tpl, rawHtml } from '@hydrooj/ui-default';

// Escaped template literal
const html1 = tpl`<strong>${userInput}</strong>`;

// Mixing escaped and raw content
const html2 = tpl`<p>${rawHtml('<em>safe-markup</em>')}</p>`;

// React node → static HTML string
const html3 = tpl(<span className="badge">NEW</span>);

// Reactive React mount (returns a live HTMLDivElement)
const div = tpl(<MyComponent />, true);
document.body.appendChild(div);

// Paragraph-wrapped message
const msg = tpl.typoMsg('Line 1\nLine 2');
```

---

### `request`

AJAX helper built on jQuery. All methods return Promises that reject with a user-readable
`Error` on network errors or server-returned error objects.

```typescript
const request = {
  // Low-level jQuery.ajax wrapper
  ajax(options: Record<string, any>): Promise<any>;

  // POST JSON or form data
  post(url: string, data?: Record<string, any> | FormData | string, options?: object): Promise<any>;

  // POST a FormData (file upload)
  postFile(url: string, form: FormData, options?: object): Promise<any>;

  // GET with query string
  get(url: string, qs?: Record<string, any>, options?: object): Promise<any>;
};
```

```typescript
import { request } from '@hydrooj/ui-default';

// GET
const data = await request.get(`/d/${UiContext.domainId}/p`, { page: 1 });

// POST JSON
await request.post(`/d/${UiContext.domainId}/p/${pid}/edit`, { title: 'New title' });

// POST form-encoded
await request.post(`/d/${UiContext.domainId}/p/${pid}`, $('form').serialize());
```

---

### `delay` / `secureRandomString`

```typescript
function delay(ms: number): Promise<void>;

function secureRandomString(
  digit?: number,                 // default: 32
  dict?: string,                  // default: a-zA-Z0-9
): string;
```

```typescript
import { delay, secureRandomString } from '@hydrooj/ui-default';

await delay(1000);  // wait 1 second

const token = secureRandomString(16);  // 16-character random string
```

---

### `zIndexManager`

Monotonically-increasing z-index registry that keeps all modals / overlays correctly stacked.

```typescript
const zIndexManager = {
  getCurrent(): number;  // most recently issued z-index
  getNext(): number;     // increment and return
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

Re-exported [pjax](https://github.com/MoOx/pjax) instance configured for the Hydro SPA.
Use `pjax.reload()` to refresh the page content without a full navigation.

---

### Slide animations

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

jQuery-based slide animations using `easeOutCubic` easing.

```typescript
import { slideDown, slideUp } from '@hydrooj/ui-default';

await slideDown($('#panel'), 300);
await slideUp($('#panel'), 200);
```

---

### Media queries

```typescript
import { mediaQuery } from '@hydrooj/ui-default';

mediaQuery.isAbove(width: number): boolean;  // viewport width ≥ width px
mediaQuery.isBelow(width: number): boolean;  // viewport width ≤ width px
```

```typescript
if (mediaQuery.isBelow(768)) {
  // mobile layout
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

Wrappers for the [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions/).
Falls back to a plain `callback()` in browsers that don't support it.

```typescript
import { withTransitionCallback } from '@hydrooj/ui-default';

await withTransitionCallback(async () => {
  // DOM mutation — animates with a cross-fade
  container.innerHTML = newContent;
});
```

---

### `getTheme`

```typescript
function getTheme(): 'dark' | 'light';
```

Returns the current Hydro theme based on `UserContext.theme`.

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

Decodes an ObjectId string into its component parts.

---

### `emulateAnchorClick`

```typescript
function emulateAnchorClick(
  ev: KeyboardEvent,
  targetUrl: string,
  alwaysOpenInNewWindow?: boolean,
): void;
```

Opens `targetUrl` — either in the same tab or a new window depending on the modifier keys
held in `ev` (Ctrl / Shift / Meta).

---

### Zip helpers

```typescript
const createZipStream: (underlyingSource: any) => ReadableStream;

async function createZipBlob(underlyingSource: any): Promise<Blob>;

async function pipeStream(
  read: ReadableStream,
  write: WritableStream,
  abort: { abort?: () => void },
): Promise<void>;
```

Low-level streaming ZIP utilities used internally by `download()`.

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

const db: IDBPDatabase;  // IDB database promise (from 'idb')
```

Pre-opened IndexedDB instance (`hydro` database, version 1). Stores:

| Object Store | Key | Description |
|---|---|---|
| `solutions` | `id` | Locally-saved draft solutions |
| `scoreboard-star` | `id` | Starred scoreboard entries |

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

Injects a `<script type="speculationrules">` element for browsers that support the
[Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API).
No-ops on unsupported browsers.

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

Lazily imports React, ReactDOM, and Redux then creates a store from your reducer.
Includes `redux-thunk` and `redux-promise-middleware` middleware, plus the Redux Logger
in development mode.

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

Calls the Hydro GraphQL-style API endpoint (`/d/:domainId/api/:method`).

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

Returns enabled programming languages from `window.LANGS`, filtered by `langsList` if provided.
Hidden and disabled languages are excluded unless explicitly listed.

```typescript
import { getAvailableLangs } from '@hydrooj/ui-default';

const langs = getAvailableLangs();
// { 'c': { name: 'C', ... }, 'cpp': { ... }, ... }

const filtered = getAvailableLangs(['cpp', 'java']);
```

---

## @hydrooj/utils re-exports

The following utility functions from `@hydrooj/utils/lib/common` are re-exported directly:

| Function | Signature | Description |
|----------|-----------|-------------|
| `randomstring` | `(digit?, dict?) => string` | Random alphanumeric string (non-crypto) |
| `sleep` | `(ms) => Promise<void>` | Alias for `delay` |
| `noop` | `() => void` | No-op function |
| `camelCase` | `(str) => string` | Convert to camelCase |
| `paramCase` | `(str) => string` | Convert to param-case (kebab) |
| `snakeCase` | `(str) => string` | Convert to snake_case |
| `parseTimeMS` | `(str \| number) => number` | Parse human time string to milliseconds |
| `parseMemoryMB` | `(str \| number) => number` | Parse memory string to MB |
| `formatSeconds` | `(seconds, showSeconds?) => string` | Format duration |
| `size` | `(bytes, base?) => string` | Format byte size (e.g. `'1.23 MB'`) |
| `randomPick` | `<T>(arr: T[]) => T` | Pick a random element |
| `sortFiles` | `(files, key?) => sorted` | Sort filenames naturally |
| `diffArray` | `(a, b) => { add, del }` | Compute array diff |
| `getAlphabeticId` | `(n) => string` | Convert number to alphabetic ID |

---

## Third-party re-exports

The following libraries are re-exported from `@hydrooj/ui-default` so that addon code
shares the **same instance** as the core UI (important for React reconciliation and jQuery
event namespacing):

| Export | Library |
|--------|---------|
| `$` | [jQuery](https://jquery.com/) |
| `_` | [Lodash](https://lodash.com/) |
| `React` | [React](https://react.dev/) |
| `ReactDOM` | [react-dom](https://react.dev/) (merged main + client) |
| `redux` | [react-redux](https://react-redux.js.org/) namespace |
| `jsxRuntime` | `react/jsx-runtime` |
| `AnsiUp` | [ansi_up](https://github.com/drudru/ansi_up) |

Always import these from `@hydrooj/ui-default` rather than installing them separately
to guarantee single-instance semantics.

```typescript
import { $, _, React, ReactDOM } from '@hydrooj/ui-default';
```

---

## EventMap (extensible)

`EventMap` is an empty interface that addons can augment to get type-safe `ctx.emit` / `ctx.on`
signatures in the browser context:

```typescript
// In your addon's type declarations:
declare module '@hydrooj/ui-default' {
  interface EventMap {
    'my-addon/ready': (config: MyConfig) => void;
    'my-addon/update': (id: string, data: any) => void;
  }
}

// Then in your addon code:
ctx.on('my-addon/ready', (config) => { /* typed */ });
ctx.emit('my-addon/ready', myConfig);
```
