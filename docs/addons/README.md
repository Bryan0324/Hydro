# Hydro Addon Development Guide

This guide explains how to create addons (plugins) for the [Hydro](https://github.com/hydro-dev/Hydro) online judge platform.

> **繁體中文版：** [zh_TW/README.md](./zh_TW/README.md)

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Plugin Structure](#plugin-structure)
4. [Handlers](./handlers.md) — HTTP & WebSocket request handlers
5. [Models](./models.md) — Database models
6. [Events](./events.md) — Event system
7. [UI Injection](./ui.md) — Injecting into the UI
8. [API Reference](./api-reference.md) — Complete exported API

---

## Introduction

Hydro addons are npm packages that extend the platform with new features:
routes, models, UI components, contest rules, OAuth providers, scripts, and more.
They are loaded by `hydrooj` at startup through the plugin system powered by [Cordis](https://github.com/cordiverse/cordis).

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- A running Hydro instance (for testing)
- TypeScript (recommended)

### Creating a new addon

```bash
mkdir my-hydro-addon
cd my-hydro-addon
npm init -y
npm install hydrooj typescript --save-peer
```

Create a `tsconfig.json`:

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

Update `package.json`:

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

### Minimal addon

Create `src/index.ts`:

```typescript
import { Context } from 'hydrooj';

export async function apply(ctx: Context) {
    // Your addon logic goes here
    ctx.on('app/started', () => {
        console.log('My addon is loaded!');
    });
}
```

### Using `definePlugin` (recommended)

`definePlugin` provides TypeScript typing for configuration schemas:

```typescript
import { Context, definePlugin, Schema } from 'hydrooj';

export default definePlugin({
    name: 'my-addon',
    schema: Schema.object({
        greeting: Schema.string().default('Hello'),
    }),
    apply(ctx: Context, config) {
        ctx.on('app/started', () => {
            console.log(config.greeting);
        });
    },
});
```

### Installing your addon

Register the addon in Hydro's config or via the admin panel:

```bash
hydrooj addon add /path/to/my-hydro-addon
# or
hydrooj addon add my-hydro-addon  # if published to npm
```

---

## Plugin Structure

Every addon is either:

### 1. A named export `apply`

```typescript
export async function apply(ctx: Context) { /* ... */ }
```

### 2. A default export via `definePlugin`

```typescript
export default definePlugin({
    name: 'my-plugin',
    apply(ctx, config) { /* ... */ },
});
```

### The `Context` object

The `ctx` parameter is the plugin's dependency-injection container (a Cordis `Context`).  
All effects registered through it (routes, event listeners, UI injections, timers, settings) are
automatically cleaned up when the plugin is unloaded or hot-reloaded.

Key `Context` methods:

| Method | Description |
|--------|-------------|
| `ctx.Route(name, path, Handler, ...perms)` | Register an HTTP route |
| `ctx.Connection(name, path, Handler, ...perms)` | Register a WebSocket connection route |
| `ctx.on(event, handler)` | Subscribe to an event (removed on plugin unload) |
| `ctx.once(event, handler)` | Subscribe once; removed after first call |
| `ctx.emit(event, ...args)` | Emit an event locally (synchronous, no await) |
| `ctx.parallel(event, ...args)` | Emit and await all async listeners concurrently |
| `ctx.serial(event, ...args)` | Emit and await listeners in order; returns first non-`undefined` value |
| `ctx.broadcast(event, ...args)` | Broadcast across PM2 cluster processes |
| `ctx.injectUI(target, name, args?, ...perms)` | Inject a UI node |
| `ctx.i18n.load(lang, translations)` | Add translations (removed on plugin unload) |
| `ctx.i18n.get(key, lang)` | Look up a single translation key |
| `ctx.i18n.translate(str, languages)` | Resolve a string against a language priority list |
| `ctx.addScript(name, desc, schema, run)` | Register a maintenance script |
| `ctx.provideModule(type, id, module)` | Register a module (e.g. hash provider) |
| `ctx.setImmediate(fn, ...args)` | Deferred callback; cancelled on plugin unload |
| `ctx.plugin(plugin, config?)` | Load a sub-plugin; returns a `Fiber` |
| `ctx.inject(deps, fn)` | Wait for services and run `fn` in a child scope |
| `ctx.effect(() => cleanup)` | Register a side-effect with a teardown function |
| `ctx.extend(patch)` | Return a child context with extra properties |
| `ctx.get(serviceName)` | Look up a service by name (or `undefined` if not ready) |
| `ctx.handlerMixin(mixin)` | Mix methods into every HTTP Handler |
| `ctx.wsHandlerMixin(mixin)` | Mix methods into every WebSocket ConnectionHandler |
| `ctx.withHandlerClass(name, cb)` | Modify a specific handler class by its route name |
| `ctx.addCaptureRoute(prefix, cb)` | Intercept all requests under a URL prefix with Koa middleware |

Service properties available on `ctx`:

| Property | Type | Description |
|----------|------|-------------|
| `ctx.db` | `MongoService` | MongoDB client with `collection()`, `paginate()`, `ensureIndexes()` |
| `ctx.setting` | `SettingService` | Plugin settings: `get()`, `requestConfig()`, `SystemSetting()`, `DomainSetting()`, etc. |
| `ctx.i18n` | `I18nService` | Translations: `load()`, `get()`, `translate()`, `langs()` |
| `ctx.loader` | `Loader` | Addon loader |
| `ctx.check` | `CheckService` | Health check service |
| `ctx.geoip?` | `GeoIP` | GeoIP lookup (if geoip plugin is loaded) |
| `ctx.domain?` | `DomainDoc` | Current domain (set on per-request child contexts) |

For full details on each method and property, see [api-reference.md → Context & Service](./api-reference.md#context--service).

### Lifecycle events

When Hydro starts, it fires these events in order:

1. `database/connect` — MongoDB connected
2. `database/config` — Database configuration loaded
3. `app/listen` — HTTP server is about to start listening
4. `app/started` — HTTP server is listening
5. `app/ready` — All plugins have finished loading
6. `task/daily` — Runs once per day

---

## Declaring TypeScript extensions

Addons can augment Hydro's global interfaces:

```typescript
declare module 'hydrooj' {
    // Register a custom collection
    interface Collections {
        'my-addon.items': MyItemDoc;
    }
    // Register a custom document type
    interface DocType {
        [MY_DOC_TYPE]: MyDoc;
    }
    // Register a model on global.Hydro.model
    interface Model {
        myAddon: typeof MyAddonModel;
    }
}
```

---

## Examples

- [`packages/blog`](../../packages/blog/index.ts) — Simple blog with custom documents and routes
- [`packages/center`](../../packages/center) — Data reporting via a Service class
- [`packages/login-with-github`](../../packages/login-with-github) — OAuth provider
- [`packages/telegram`](../../packages/telegram) — Telegram integration

---

> **See also:**  
> [handlers.md](./handlers.md) · [models.md](./models.md) · [events.md](./events.md) · [ui.md](./ui.md) · [api-reference.md](./api-reference.md)
