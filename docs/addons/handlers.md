# Handlers

Handlers are classes that process HTTP requests (or WebSocket connections).  
Every page or API endpoint in Hydro is backed by a handler.

## Table of Contents

- [Defining a Handler](#defining-a-handler)
- [Route Registration](#route-registration)
- [HTTP Methods](#http-methods)
- [Parameter Decorators](#parameter-decorators)
- [Built-in Types](#built-in-types)
- [Permission & Privilege Checks](#permission--privilege-checks)
- [Response Helpers](#response-helpers)
- [Rate Limiting](#rate-limiting)
- [WebSocket (ConnectionHandler)](#websocket-connectionhandler)
- [Requiring Sudo](#requiring-sudo)
- [Handler Lifecycle](#handler-lifecycle)

---

## Defining a Handler

Import `Handler` from `hydrooj` and extend it:

```typescript
import { Handler, param, Types } from 'hydrooj';

class MyHandler extends Handler {
    async get() {
        this.response.body = { hello: 'world' };
    }
}
```

---

## Route Registration

Register routes inside the `apply` function using `ctx.Route`:

```typescript
import { Context, PERM, PRIV } from 'hydrooj';

export async function apply(ctx: Context) {
    // Public route
    ctx.Route('my_page', '/my-page', MyHandler);

    // Route requiring a domain permission
    ctx.Route('my_admin', '/my-admin', MyAdminHandler, PERM.PERM_EDIT_DOMAIN);

    // Route requiring a system privilege
    ctx.Route('my_system', '/my-system', MySystemHandler, PRIV.PRIV_EDIT_SYSTEM);

    // Route with multiple requirements (user must satisfy ALL)
    ctx.Route('my_route', '/my-route/:id', MyRouteHandler, PERM.PERM_VIEW_PROBLEM);
}
```

> Route names must be unique across all addons. Use a prefix (e.g. your addon name) to avoid collisions.

---

## HTTP Methods

A handler may implement any combination of `get`, `post`, `put`, `delete`, and `patch` methods.
When a form submits with a hidden `_operation` field, Hydro calls the corresponding `post<Operation>` method.

```typescript
class MyHandler extends Handler {
    // Handles GET /my-page
    async get() {
        this.response.template = 'my_page.html';
        this.response.body = { items: [] };
    }

    // Handles all POST requests first; use for common auth checks
    async post() {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
    }

    // Handles POST with _operation=create
    @param('title', Types.Title)
    @param('content', Types.Content)
    async postCreate(domainId: string, title: string, content: string) {
        // ...
    }

    // Handles POST with _operation=delete
    @param('id', Types.ObjectId)
    async postDelete(domainId: string, id: ObjectId) {
        // ...
    }
}
```

---

## Parameter Decorators

Parameter decorators extract, validate and convert request parameters into handler method arguments.

```typescript
import { get, post, route, param, Types } from 'hydrooj';
```

| Decorator | Source | Description |
|-----------|--------|-------------|
| `@get(name, type?)` | URL query string | `?name=value` |
| `@query(name, type?)` | URL query string | Alias for `@get` |
| `@post(name, type?)` | Request body | Form or JSON body |
| `@route(name, type?)` | URL path segment | `:name` in the route pattern |
| `@param(name, type?)` | Any source | Checks query, body, then route params |

### Signature

```typescript
@get(name: string, type?: Type, isOptional?: boolean, validate?: Validator, convert?: Converter)
@get(name: string, type?: Type, validate?: Validator, convert?: Converter)
```

- If `isOptional` is `true`, the parameter is optional (passes `undefined` if missing).
- If `isOptional` is `'convert'`, the converter is applied even when the value is missing/empty.
- A `Validator` is `(value: any) => boolean`.
- A `Converter<T>` is `(value: any) => T`.

### Example

```typescript
class ArticleHandler extends Handler {
    @param('page', Types.PositiveInt, true)       // optional page number
    @param('keyword', Types.String, true)          // optional search keyword
    async get(domainId: string, page = 1, keyword?: string) {
        // ...
    }

    @route('aid', Types.ObjectId)                  // required :aid in URL
    @post('title', Types.Title)                    // required title in body
    @post('content', Types.Content)                // required content in body
    async postUpdate(domainId: string, aid: ObjectId, title: string, content: string) {
        // ...
    }
}
```

---

## Built-in Types

All types are available from `hydrooj` as `Types.*`:

### String types

| Type | Validation | Notes |
|------|-----------|-------|
| `Types.String` | Non-empty string | Basic string, no restrictions |
| `Types.ShortString` | 1–255 characters | |
| `Types.Title` | 1–64 characters | Must not be blank |
| `Types.Content` | Up to 65 535 characters | For rich text / Markdown |
| `Types.Key` | `[\w-]{1,255}` | Identifier-safe string |
| `Types.Username` | 3–31 characters (or 2 CJK chars) | |
| `Types.UidOrName` | Username or numeric UID | |
| `Types.Password` | 6–255 characters | |
| `Types.Email` | Valid email address | |
| `Types.Filename` | Safe filename | No path traversal characters |
| `Types.DomainId` | `[a-zA-Z]\w{3,31}` | |
| `Types.ProblemId` | Numeric or slug | Returns `number \| string` |
| `Types.Role` | 1–31 word characters | |
| `Types.Emoji` | Single emoji | |

### Numeric types

| Type | Validation |
|------|-----------|
| `Types.Int` | Integer (positive or negative) |
| `Types.UnsignedInt` | Non-negative integer |
| `Types.PositiveInt` | Strictly positive integer |
| `Types.Float` | Finite floating-point number |

### Other types

| Type | Description |
|------|-------------|
| `Types.ObjectId` | MongoDB `ObjectId` (from `mongodb` package) |
| `Types.Boolean` | Truthy/falsy; `false`/`off`/`no`/`0` → `false` |
| `Types.Date` | Date string `YYYY-M-D` → normalised `YYYY-MM-DD` |
| `Types.Time` | Time string `H:M` → normalised `HH:MM` |
| `Types.Range(values)` | Value must be in the given array or object keys |
| `Types.NumericArray` | Comma-separated or array of numbers |
| `Types.CommaSeperatedArray` | Comma-separated or array of strings |
| `Types.Set` | Array or single value → `Set` |
| `Types.Any` | No validation or conversion |
| `Types.ArrayOf(type)` | Array of items validated by another `Type` |
| `Types.AnyOf(...types)` | Value matching any one of the given types |

---

## Permission & Privilege Checks

From inside a handler use these methods:

```typescript
// Domain permission (bigint from PERM)
this.checkPerm(PERM.PERM_EDIT_DOMAIN);
this.checkPerm(PERM.PERM_CREATE_PROBLEM, PERM.PERM_EDIT_PROBLEM); // any of these

// System privilege (number from PRIV)
this.checkPriv(PRIV.PRIV_USER_PROFILE);     // must be logged in
this.checkPriv(PRIV.PRIV_EDIT_SYSTEM);      // must be superadmin
```

Both throw a `PermissionError` / `PrivilegeError` when the check fails.

You can also inspect them imperatively:

```typescript
if (this.user.hasPerm(PERM.PERM_VIEW_PROBLEM)) { /* ... */ }
if (this.user.hasPriv(PRIV.PRIV_USER_PROFILE)) { /* ... */ }
if (this.user.own(doc)) { /* owns the document */ }
```

### Common permissions (`PERM`)

| Constant | Description |
|----------|-------------|
| `PERM.PERM_VIEW` | View the domain |
| `PERM.PERM_VIEW_PROBLEM` | View problems |
| `PERM.PERM_SUBMIT_PROBLEM` | Submit solutions |
| `PERM.PERM_CREATE_PROBLEM` | Create problems |
| `PERM.PERM_EDIT_PROBLEM` | Edit any problem |
| `PERM.PERM_EDIT_PROBLEM_SELF` | Edit own problems |
| `PERM.PERM_VIEW_RECORD` | View other users' records |
| `PERM.PERM_READ_RECORD_CODE` | Read all record source code |
| `PERM.PERM_REJUDGE` | Rejudge records |
| `PERM.PERM_VIEW_CONTEST` | View contests |
| `PERM.PERM_CREATE_CONTEST` | Create contests |
| `PERM.PERM_ATTEND_CONTEST` | Attend contests |
| `PERM.PERM_VIEW_DISCUSSION` | View discussions |
| `PERM.PERM_CREATE_DISCUSSION` | Post discussions |
| `PERM.PERM_EDIT_DOMAIN` | Edit domain settings |
| `PERM.PERM_VIEW_RANKING` | View ranking |

### Common privileges (`PRIV`)

| Constant | Description |
|----------|-------------|
| `PRIV.PRIV_USER_PROFILE` | Logged-in user |
| `PRIV.PRIV_REGISTER_USER` | Can register new accounts |
| `PRIV.PRIV_EDIT_SYSTEM` | System administrator |
| `PRIV.PRIV_MANAGE_ALL_DOMAIN` | Can manage any domain |
| `PRIV.PRIV_CREATE_DOMAIN` | Can create domains |

---

## Response Helpers

| Property / Method | Description |
|-------------------|-------------|
| `this.response.body = obj` | JSON or template data |
| `this.response.template = 'file.html'` | Template to render |
| `this.response.redirect = '/url'` | Redirect to URL |
| `this.response.status = 404` | HTTP status code |
| `this.response.type = 'application/json'` | Content-Type override |
| `this.back(body?)` | Redirect back to referer (with optional body) |
| `this.binary(data, filename?)` | Send a file download |
| `this.holdFile(name)` | Keep an uploaded temp file alive after the request |
| `this.url(routeName, args?)` | Build a URL for a named route |

---

## Rate Limiting

```typescript
// Allow at most 60 calls to 'add_blog' per 3600 seconds, keyed by user IP
await this.limitRate('add_blog', 3600, 60);
```

`limitRate` throws `OpcountExceededError` when the limit is exceeded.

---

## WebSocket (ConnectionHandler)

For real-time bidirectional communication, extend `ConnectionHandler`:

```typescript
import { ConnectionHandler, param, subscribe, Types } from 'hydrooj';

class MyConnectionHandler extends ConnectionHandler {
    async prepare() {
        // Called when the WebSocket is opened
    }

    @param('channel', Types.String)
    async message(domainId: string, channel: string) {
        // Called for each message from the client
        this.send({ type: 'echo', channel });
    }

    async cleanup() {
        // Called when the WebSocket is closed
    }
}

// Register:
ctx.Connection('my_ws', '/ws/my-channel', MyConnectionHandler);
```

`ConnectionHandler` methods:

| Method | Description |
|--------|-------------|
| `this.send(data)` | Send data to the client |
| `this.close(code?, reason?)` | Close the connection |
| `this.ping()` | Send a ping frame |

---

## Requiring Sudo

Apply the `@requireSudo` decorator to any `post*` method that needs the user to re-confirm their password:

```typescript
import { requireSudo, Handler } from 'hydrooj';

class DangerousHandler extends Handler {
    @requireSudo
    async postDeleteAll() {
        // Only runs after the user confirms their password at /user/sudo
    }
}
```

---

## Handler Lifecycle

For each request, methods are called in this order:

1. **`_prepare(args)`** — Runs before the HTTP-method handler; use to load shared resources.  
   Decorated parameters are injected from the route context.
2. **`prepare(args)`** — Alias for `_prepare`.
3. **`get(args)` / `post(args)` / …** — The actual handler for the HTTP verb.
4. **`postMethod(args)`** — Sub-handler selected by `_operation` in POST body.
5. **`cleanup()`** — Runs after the response is sent (even on error).

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
