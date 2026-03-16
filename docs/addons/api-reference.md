# API Reference

Complete reference of everything exported from `hydrooj` (the main addon entry point).

> **Import path:** `import { ... } from 'hydrooj';`

---

## Table of Contents

- [Plugin Utilities](#plugin-utilities)
- [Context & Service](#context--service)
- [Handler Classes](#handler-classes)
- [Parameter Decorators](#parameter-decorators)
- [Parameter Types](#parameter-types)
- [Error Classes](#error-classes)
- [Models](#models)
- [Utilities](#utilities)
- [Pipeline Utilities](#pipeline-utilities)
- [Type Utilities](#type-utilities)
- [Storage Service](#storage-service)
- [API Builder (GraphQL-style)](#api-builder-graphql-style)
- [Interfaces & Type Declarations](#interfaces--type-declarations)
- [Third-party Re-exports](#third-party-re-exports)

---

## Plugin Utilities

### `definePlugin(args)`

Wraps a plugin definition with full TypeScript typing.

```typescript
import { definePlugin, Schema } from 'hydrooj';

export default definePlugin({
    name: 'my-plugin',           // optional: shown in logs
    schema: Schema.object({      // or use Config:
        apiKey: Schema.string().required(),
    }),
    apply(ctx, config) {
        // config is typed as { apiKey: string }
    },
});
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string?` | Plugin name |
| `apply` | `(ctx, config) => void \| Promise<void>` | Plugin entry point |
| `schema` / `Config` | `Schema<T>?` | Configuration schema ([Schemastery](https://github.com/shigma/schemastery)) |
| `inject` | `(keyof Context)[] \| Record<string, any>?` | Services to wait for before `apply` is called |

---

## Context & Service

### `Context`

The plugin's dependency-injection container (extends [Cordis](https://github.com/cordiverse/cordis) `Context`).

```typescript
import { Context } from 'hydrooj';
```

#### Routing

| Method | Description |
|--------|-------------|
| `ctx.Route(name, path, HandlerClass, ...perms)` | Register an HTTP route |
| `ctx.Connection(name, path, HandlerClass, ...perms)` | Register a WebSocket route |

#### Events

| Method | Description |
|--------|-------------|
| `ctx.on(event, handler)` | Subscribe to an event (removed on plugin unload) |
| `ctx.once(event, handler)` | Subscribe once |
| `ctx.emit(event, ...args)` | Emit an event locally |
| `ctx.parallel(event, ...args)` | Emit and await all async listeners concurrently |
| `ctx.broadcast(event, ...args)` | Broadcast across all processes (PM2 cluster) |

#### UI & Locale

| Method | Description |
|--------|-------------|
| `ctx.injectUI(target, name, args?, ...guards)` | Inject a UI node (see [ui.md](./ui.md)) |
| `ctx.i18n.load(lang, translations)` | Add translations (removed on plugin unload) |

#### Lifecycle & DI

| Method | Description |
|--------|-------------|
| `ctx.plugin(plugin, config?)` | Load a sub-plugin |
| `ctx.inject(deps, fn)` | Wait for services, then call `fn` |
| `ctx.effect(() => cleanup)` | Register a cleanup function |

#### Hydro-specific

| Method | Description |
|--------|-------------|
| `ctx.addScript(name, desc, schema, run)` | Register a maintenance script (see below) |
| `ctx.provideModule(type, id, module)` | Register a module (e.g. `hash`, `problemSearch`) |
| `ctx.setImmediate(fn, ...args)` | Schedule a deferred callback (removed on plugin unload) |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx.db` | `Database` | Database with `.paginate()` helper |
| `ctx.loader` | `Loader` | Addon loader |
| `ctx.check` | `CheckService` | Health check service |
| `ctx.geoip?` | `GeoIP` | GeoIP lookup (if geoip plugin is loaded) |

### `Service`

Base class for injectable services. Extend it to create a service your plugin provides:

```typescript
import { Context, Service } from 'hydrooj';

class MyService extends Service {
    static inject = ['server']; // services this service depends on

    constructor(ctx: Context, config: MyConfig) {
        super(ctx, 'my-service'); // name under which this is available on ctx
    }

    doSomething() { /* ... */ }
}

// In apply:
ctx.plugin(MyService, config);
// Now other plugins can access ctx['my-service']
```

### `Fiber`

A Cordis `Fiber` — represents a plugin's lifecycle scope.  
Returned by `ctx.plugin()`.

---

## Handler Classes

### `Handler`

Base class for HTTP request handlers.

```typescript
import { Handler, param, Types, PERM, PRIV } from 'hydrooj';
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `this.session` | `Record<string, any>` | Session data (read/write) |
| `this.args` | `Record<string, any>` | Merged route / body / query params |
| `this.request` | `HydroRequest` | Parsed request object |
| `this.response` | `HydroResponse` | Response builder |
| `this.user` | `User` | Currently logged-in user |
| `this.domain` | `DomainDoc` | Current domain |
| `this.UiContext` | `Record<string, any>` | Extra data passed to the template |
| `this.ctx` | `Context` | Plugin context |

**Methods:**

| Method | Description |
|--------|-------------|
| `checkPerm(...perms)` | Throw `PermissionError` if any perm is missing |
| `checkPriv(...privs)` | Throw `PrivilegeError` if any priv is missing |
| `url(name, ...args)` | Build a URL for a named route |
| `back(body?)` | Redirect to the HTTP `Referer` |
| `binary(data, filename?)` | Send a binary download |
| `holdFile(name)` | Prevent an uploaded temp file from being deleted |
| `limitRate(op, period, max, key?)` | Rate-limit this operation |
| `paginate(cursor, page, limitOrKey)` | Paginate a MongoDB cursor |
| `renderTitle(str)` | Render a page title with the site name |

**`HydroRequest`:**

| Field | Type |
|-------|------|
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

**`HydroResponse`:**

| Field | Type |
|-------|------|
| `body` | `any` |
| `type` | `string` (Content-Type) |
| `status` | `number` |
| `template` | `string?` |
| `pjax` | `string \| [string, Record<string, any>][]?` |
| `redirect` | `string?` |
| `disposition` | `string?` |
| `etag` | `string?` |
| `attachment(name, stream?)` | Send file attachment |
| `addHeader(name, value)` | Add a response header |

### `ConnectionHandler`

Base class for WebSocket handlers.  
Extends `Handler` plus:

| Method | Description |
|--------|-------------|
| `send(data)` | Send a message to the client |
| `close(code?, reason?)` | Close the connection |

### `requireSudo`

Method decorator that forces the user to re-enter their password before proceeding:

```typescript
import { requireSudo } from 'hydrooj';

class AdminHandler extends Handler {
    @requireSudo
    async postDeleteAll() { /* ... */ }
}
```

---

## Parameter Decorators

```typescript
import { get, query, post, route, param, subscribe } from 'hydrooj';
```

| Export | Source | Notes |
|--------|--------|-------|
| `@get(name, type?, ...)` | Query string | |
| `@query(name, type?, ...)` | Query string | Alias for `@get` |
| `@post(name, type?, ...)` | Request body | |
| `@route(name, type?, ...)` | URL path | |
| `@param(name, type?, ...)` | Any source | Checks all sources |
| `@subscribe(eventName)` | — | WebSocket subscription decorator |

All accept the same tail arguments (any order):
- `Type<T>` — converter + validator from `Types`
- `boolean` — marks the parameter as optional
- `Validator` — custom `(v) => boolean`
- `Converter<T>` — custom `(v) => T`

---

## Parameter Types

```typescript
import { Types } from 'hydrooj';
```

| Type | Output | Notes |
|------|--------|-------|
| `Types.String` | `string` | Non-empty |
| `Types.ShortString` | `string` | ≤ 255 chars |
| `Types.Title` | `string` | ≤ 64 chars, non-blank |
| `Types.Content` | `string` | ≤ 65 535 chars |
| `Types.Key` | `string` | `[\w-]{1,255}` |
| `Types.Username` | `string` | 3–31 chars or 2 CJK |
| `Types.UidOrName` | `string` | Username or numeric UID |
| `Types.Password` | `string` | 6–255 chars |
| `Types.Email` | `string` | Valid email |
| `Types.Filename` | `string` | Safe, no path traversal |
| `Types.DomainId` | `string` | `[a-zA-Z]\w{3,31}` |
| `Types.ProblemId` | `string \| number` | Numeric ID or string slug |
| `Types.Role` | `string` | 1–31 word chars |
| `Types.Emoji` | `string` | Single emoji |
| `Types.Int` | `number` | Integer |
| `Types.UnsignedInt` | `number` | ≥ 0 |
| `Types.PositiveInt` | `number` | ≥ 1 |
| `Types.Float` | `number` | Finite float |
| `Types.ObjectId` | `ObjectId` | MongoDB ObjectId |
| `Types.Boolean` | `boolean` | `false`/`off`/`no`/`0` → false |
| `Types.Date` | `string` | `YYYY-MM-DD` |
| `Types.Time` | `string` | `HH:MM` |
| `Types.Range(arr)` | `T` | Must be in array/object |
| `Types.NumericArray` | `number[]` | |
| `Types.CommaSeperatedArray` | `string[]` | |
| `Types.Set` | `Set<any>` | |
| `Types.Any` | `any` | No validation |
| `Types.ArrayOf(type)` | `T[]` | Array of typed values |
| `Types.AnyOf(...types)` | `T` | First matching type |

---

## Error Classes

All errors extend `HydroError`.  
Throw them inside handlers — Hydro will render them as user-facing error pages or JSON.

```typescript
import {
    // Framework
    HydroError, UserFacingError,
    BadRequestError, ForbiddenError, NotFoundError,
    MethodNotAllowedError, ValidationError,
    CsrfTokenError, InvalidOperationError, FileTooLargeError,
    CreateError,  // factory for custom error types
    // Hydro application
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

### Creating a custom error

```typescript
import { CreateError, UserFacingError } from 'hydrooj';

export const MyCustomError = CreateError(
    'MyCustomError',    // error name
    UserFacingError,    // parent class
    'Something went wrong with {0}.', // message template
    400,                // HTTP status
);

// Usage:
throw new MyCustomError('some value');
```

---

## Models

All models are available as named exports:

```typescript
import {
    // Default-exported models
    SystemModel,
    UserModel,
    ProblemModel,
    RecordModel,
    TokenModel,
    DomainModel,
    StorageModel,
    ScheduleModel,
    SolutionModel,
    MessageModel,
    OauthModel,
    BlackListModel,
    TaskModel,
    // Namespace-imported models
    TrainingModel,
    OpcountModel,
    OplogModel,
    SettingModel,
    DiscussionModel,
    DocumentModel,
    BuiltinModel,
    ContestModel,
} from 'hydrooj';
```

See [models.md](./models.md) for detailed method documentation.

### Constants from `BuiltinModel`

```typescript
import { PERM, PRIV, STATUS } from 'hydrooj';
```

**`PERM`** — domain-level permissions (bigints).  
**`PRIV`** — system-level privileges (numbers).  
**`STATUS`** — judge result status codes:

| Constant | Value | Meaning |
|----------|-------|---------|
| `STATUS.STATUS_WAITING` | 0 | Not yet judged |
| `STATUS.STATUS_ACCEPTED` | 1 | Accepted |
| `STATUS.STATUS_WRONG_ANSWER` | 2 | Wrong answer |
| `STATUS.STATUS_TIME_LIMIT_EXCEEDED` | 3 | TLE |
| `STATUS.STATUS_MEMORY_LIMIT_EXCEEDED` | 4 | MLE |
| `STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED` | 5 | OLE |
| `STATUS.STATUS_RUNTIME_ERROR` | 6 | Runtime error |
| `STATUS.STATUS_COMPILE_ERROR` | 7 | Compile error |
| `STATUS.STATUS_SYSTEM_ERROR` | 9 | System error |
| `STATUS.STATUS_CANCELED` | 10 | Canceled |
| `STATUS.STATUS_JUDGING` | 14 | In progress |
| `STATUS.STATUS_IGNORED` | 30 | Ignored |

---

## Utilities

### `buildContent`

```typescript
import { buildContent } from 'hydrooj';

const html = buildContent(content, 'html');
const md = buildContent(content, 'markdown');
```

Renders a `Content` value (which may be a string or a `{ zh: '...', en: '...' }` map)
to the requested format, picking the best locale match.

### `avatar`

```typescript
import { avatar } from 'hydrooj';

const url = avatar('gravatar:foo@example.com', 128);
```

Resolves an avatar descriptor to a URL.

### `difficultyAlgorithm`

```typescript
import { difficultyAlgorithm } from 'hydrooj';

const difficulty = difficultyAlgorithm(nSubmit, nAccept);
```

Returns a difficulty score (1–10) based on acceptance statistics.

### `rating`

```typescript
import { rating } from 'hydrooj';
// Internal rating calculation utilities
```

### `sendMail`

```typescript
import { sendMail } from 'hydrooj';

await sendMail(to, subject, html);
```

Sends an email using the configured SMTP server.

### `mime`

```typescript
import { mime } from 'hydrooj';

const type = mime.lookup('problem.zip'); // 'application/zip'
```

### `testdataConfig` (`parseConfig`)

```typescript
import { testdataConfig } from 'hydrooj';

const config = await testdataConfig(stream);
// Parses problem test-data config.yaml
```

### `nanoid`

```typescript
import { nanoid } from 'hydrooj';

const id = nanoid(); // generates a random 21-character ID
const short = nanoid(10);
```

### `moment`

```typescript
import { moment, isMoment } from 'hydrooj';

const m = moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
```

### `db`

```typescript
import { db } from 'hydrooj';

const coll = db.collection('my-collection');
```

Direct MongoDB client.

### `pwsh` (password hashing)

```typescript
import { pwsh } from 'hydrooj';

const hash = await pwsh(password, salt);
```

---

## Pipeline Utilities

Helper functions for processing large datasets:

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

Each function takes a callback `(doc, current?, total?) => Promise<void>` and iterates the
relevant collection in batches, reporting progress.

```typescript
// Example: rebuild difficulty for all problems
await iterateAllProblem(async (pdoc) => {
    const score = difficultyAlgorithm(pdoc.nSubmit, pdoc.nAccept);
    await ProblemModel.edit(pdoc.domainId, pdoc.docId, { difficulty: score });
});
```

---

## Type Utilities

```typescript
import type {
    Atomic,
    Values,
    Intersect,
    NumberKeys,
    ArrayKeys,
    Flatten,
    Value,
    Projection,
    MaybeArray,
    UnionToIntersection,
    Optional,
} from 'hydrooj';
```

---

## Storage Service

```typescript
import * as StorageService from 'hydrooj'; // re-exported as StorageService
// or:
import * as StorageService from 'hydrooj/service/storage';
```

| Method | Description |
|--------|-------------|
| `put(path, stream, meta?)` | Upload a file |
| `get(path)` | Download a file as a stream |
| `del(paths[])` | Delete files |
| `list(prefix)` | List files by prefix |
| `getMeta(path)` | Get file metadata |
| `signDownloadLink(path, filename, expire, useAlternate?)` | Generate a pre-signed URL |

---

## API Builder (GraphQL-style)

Hydro supports a typed API layer using `Query`, `Mutation`, and `Subscription`:

```typescript
import { Query, Mutation, Subscription, APIS } from 'hydrooj';
import Schema from 'schemastery';

// Define an API endpoint
const myQuery = Query(
    Schema.object({ id: Schema.string() }),
    async (ctx, { id }) => {
        return await MyModel.get(id);
    },
);

// Register it
APIS.my_query = myQuery;
```

These are exposed at the `/api` endpoint and support both HTTP and WebSocket.

### `Query(schema, func, hooks?)`

Read-only API call.

### `Mutation(schema, func, hooks?)`

Write API call.

### `Subscription(schema, func)`

Real-time subscription — `func` returns a cleanup function and calls `emit` to push updates.

---

## Interfaces & Type Declarations

Key TypeScript interfaces exported from `hydrooj`:

### Documents

| Interface | Description |
|-----------|-------------|
| `Udoc` | Raw user database document |
| `User` | Loaded user object with helper methods |
| `DomainDoc` | Domain document |
| `ProblemDoc` | Problem document |
| `RecordDoc` | Judge record document |
| `Tdoc` | Contest/homework document |
| `TrainingDoc` | Training plan document |
| `DiscussionDoc` | Discussion post document |
| `DiscussionReplyDoc` | Discussion reply |
| `DiscussionTailReplyDoc` | Nested reply |
| `MessageDoc` | Private message |
| `BlacklistDoc` | Blacklist entry |
| `TokenDoc` | Authentication token |
| `OplogDoc` | Audit log entry |
| `FileNode` | Storage file metadata |
| `Schedule` | Scheduled task |
| `Task` | Queue task |
| `ScoreboardNode` | A single cell in a scoreboard |
| `ScoreboardRow` | A row in a scoreboard |
| `ContestRule<T>` | Contest rule definition |
| `ContestRules` | Map of all contest rules |
| `ProblemImporter` | Problem importer function type |
| `Script` | Maintenance script definition |
| `GeoIP` | GeoIP provider interface |

### Extensible interfaces

These can be augmented by addons:

| Interface | Purpose |
|-----------|---------|
| `Collections` | Register custom MongoDB collections |
| `DocType` | Register custom document types for `DocumentModel` |
| `Model` | Register models on `global.Hydro.model` |
| `EventMap` | Add custom events |
| `SystemKeys` | Add typed system settings |
| `ModuleInterfaces` | Add custom module types |

### `HydroGlobal`

The `global.Hydro` namespace:

```typescript
global.Hydro.version    // Record<string, string>
global.Hydro.model      // Model
global.Hydro.script     // Record<string, Script>
global.Hydro.module     // { hash, problemSearch, ... }
global.Hydro.ui         // { nodes, inject, getNodes }
global.Hydro.error      // all error classes
global.Hydro.Logger     // Logger constructor
global.Hydro.logger     // default logger instance
global.Hydro.locales    // translation maps
```

---

## Third-party Re-exports

These popular libraries are re-exported from `hydrooj` for convenience:

| Export | Source | Description |
|--------|--------|-------------|
| `_` | `lodash` | Lodash utility library |
| `Schema` | `schemastery` | Configuration schema builder |
| `ObjectId` | `mongodb` | MongoDB ObjectId class |
| `ObjectID` | `mongodb` | Alias for `ObjectId` (deprecated) |
| `Filter` | `mongodb` | MongoDB filter type |
| `superagent` | `superagent` | HTTP client |
| `Zip` (ZipReader/ZipWriter) | `@zip.js/zip.js` | ZIP archive library |
| `AdmZip` | `adm-zip` | Legacy ZIP library (deprecated) |
| `WebSocket` | `ws` | WebSocket client class |
| `WebSocketServer` | `ws` | WebSocket server class |

---

## Maintenance Scripts

Register a script callable from the admin control panel:

```typescript
import { Context, Schema, iterateAllProblem, difficultyAlgorithm, ProblemModel } from 'hydrooj';

export async function apply(ctx: Context) {
    ctx.addScript(
        'my-addon/rebuildDifficulty',
        'Rebuild problem difficulty scores',
        Schema.object({}),
        async (args, report) => {
            let count = 0;
            await iterateAllProblem(async (pdoc) => {
                const d = difficultyAlgorithm(pdoc.nSubmit, pdoc.nAccept);
                await ProblemModel.edit(pdoc.domainId, pdoc.docId, { difficulty: d });
                count++;
                if (count % 100 === 0) report({ message: `Processed ${count} problems` });
            });
            report({ message: `Done. Processed ${count} problems.` });
            return true;
        },
    );
}
```

---

## OAuth Providers

Register a third-party login provider:

```typescript
import { Context, Service, Schema } from 'hydrooj';

class MyOAuthService extends Service {
    static inject = ['oauth'];
    static Config = Schema.object({
        clientId: Schema.string().required(),
        clientSecret: Schema.string().role('secret').required(),
    });

    constructor(ctx: Context, config) {
        super(ctx, 'oauth.myprovider');
        ctx.oauth.provide('myprovider', {
            text: 'Login with MyProvider',
            icon: '<svg>...</svg>',
            callback: async ({ state, code }) => {
                // Exchange code for user info
                return {
                    _id: userInfo.id,          // unique ID from the provider
                    email: userInfo.email,
                    uname: userInfo.username,
                    avatar?: userInfo.avatarUrl,
                };
            },
        });
    }
}

export default definePlugin({
    apply(ctx) {
        ctx.plugin(MyOAuthService);
    },
});
```
