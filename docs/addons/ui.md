# UI Injection

Addons can inject navigation links, buttons, and menu entries into predefined
locations in the Hydro UI without modifying the core templates.

## `ctx.injectUI`

```typescript
ctx.injectUI(
    target: UIInjectableFields,
    routeName: string,
    args?: Record<string, any>,
    ...permPrivChecker: Array<bigint | number | Function | bigint[] | number[]>
): void
```

| Parameter | Description |
|-----------|-------------|
| `target` | The injection point (see below) |
| `routeName` | Name of the route to link to (used to build the URL) |
| `args` | Extra options passed to the template renderer (see per-target docs below) |
| `...permPrivChecker` | Zero or more permissions/privileges/custom functions; the node is only shown when the visiting user satisfies **all** of them |

The injection is automatically removed when the plugin is unloaded.

---

## Injection Targets

The injectable UI locations (`UIInjectableFields`) are:

| Target | Location in the UI |
|--------|--------------------|
| `Nav` | Top navigation bar |
| `UserDropdown` | User avatar drop-down menu |
| `DomainManage` | Domain management sidebar |
| `ControlPanel` | Admin control panel sidebar |
| `ProblemAdd` | "Add Problem" drop-down button |
| `Notification` | System-wide notification area |

---

## `Nav` — Top navigation bar

Add an entry to the main navigation bar.

```typescript
ctx.injectUI('Nav', 'blog_main', {
    prefix: 'blog',          // i18n key prefix used to render the label
});
```

Optional `args`:

| Key | Type | Description |
|-----|------|-------------|
| `prefix` | `string` | i18n prefix used to look up the display name |
| `query` | `(handler) => Record<string, any>` | Dynamic query params appended to the URL |
| `before` | `string` | Place this entry before the named entry |

---

## `UserDropdown` — User avatar menu

Add an entry to the drop-down that appears when clicking the user avatar.

```typescript
ctx.injectUI(
    'UserDropdown',
    'blog_main',
    (handler) => ({
        icon: 'book',
        displayName: 'Blog',
        uid: handler.user._id.toString(),
    }),
    PRIV.PRIV_USER_PROFILE,  // only show when logged in
);
```

The third argument may be a plain object **or** a function `(handler) => args`.

Optional `args`:

| Key | Type | Description |
|-----|------|-------------|
| `icon` | `string` | SemanticUI icon name |
| `displayName` | `string` | Menu entry label (plain string or i18n key) |
| `uid` | `string` | Passed as `:uid` to the route builder |

---

## `DomainManage` — Domain management sidebar

Add an entry to the domain management panel's sidebar.

```typescript
ctx.injectUI('DomainManage', 'domain_my_page', {
    family: 'My Plugin',   // group heading
    icon: 'plug',          // SemanticUI icon name
});
```

Optional `args`:

| Key | Type | Description |
|-----|------|-------------|
| `family` | `string` | Sidebar section heading |
| `icon` | `string` | SemanticUI icon name |

---

## `ControlPanel` — Admin control panel sidebar

Add an entry to the system-level admin control panel.

```typescript
ctx.injectUI('ControlPanel', 'manage_my_page', {
    // no required extra args
});
```

---

## `ProblemAdd` — Problem creation button

Add an entry to the "Create problem" drop-down on the problem list page.

```typescript
ctx.injectUI('ProblemAdd', 'problem_import_myformat', {
    icon: 'download',
    text: 'Import from MyFormat',
});
```

Optional `args`:

| Key | Type | Description |
|-----|------|-------------|
| `icon` | `string` | SemanticUI icon name |
| `text` | `string` | Button label (plain string or i18n key) |

---

## Permission / privilege guards

The variadic `...permPrivChecker` arguments let you hide UI nodes from users
that lack the required access:

```typescript
import { PERM, PRIV } from 'hydrooj';

// Only domain admins see this entry
ctx.injectUI('DomainManage', 'domain_my_page', { family: 'Plugins' }, PERM.PERM_EDIT_DOMAIN);

// Only superadmins
ctx.injectUI('ControlPanel', 'manage_my_page', {}, PRIV.PRIV_EDIT_SYSTEM);

// Custom predicate
ctx.injectUI('Nav', 'my_page', {}, (handler) => handler.user._id > 0);

// Require BOTH a permission AND a privilege
ctx.injectUI('DomainManage', 'my_page', {}, PERM.PERM_EDIT_DOMAIN, PRIV.PRIV_USER_PROFILE);
```

---

## Ordering

Use `args.before` to insert an entry before an existing named node:

```typescript
ctx.injectUI('Nav', 'my_page', { before: 'ranking' });
```

---

## Full Example

```typescript
import { Context, PERM, PRIV } from 'hydrooj';
import { BlogUserHandler, BlogDetailHandler, BlogEditHandler } from './handlers';

export async function apply(ctx: Context) {
    ctx.Route('blog_main', '/blog/:uid', BlogUserHandler);
    ctx.Route('blog_detail', '/blog/:uid/:did', BlogDetailHandler);
    ctx.Route('blog_edit', '/blog/:uid/:did/edit', BlogEditHandler, PRIV.PRIV_USER_PROFILE);

    // Inject a link into the user dropdown menu
    ctx.injectUI(
        'UserDropdown',
        'blog_main',
        (h) => ({ icon: 'book', displayName: 'Blog', uid: h.user._id.toString() }),
        PRIV.PRIV_USER_PROFILE,
    );

    // Add i18n translations
    ctx.i18n.load('zh', {
        Blog: '博客',
        blog_main: '博客',
        blog_detail: '博客详情',
        blog_edit: '编辑博客',
    });
    ctx.i18n.load('en', {
        blog_main: 'Blog',
        blog_detail: 'Blog Detail',
        blog_edit: 'Edit Blog',
    });
}
```

---

## Internationalization (`ctx.i18n`)

```typescript
ctx.i18n.load(language: string, translations: Record<string, string>): void
```

Supported language codes include `zh`, `zh_TW`, `en`, `kr`, `ja`, `fr`, `de`, `ru`, …

Translations are merged into the global locale store and automatically
removed when the plugin is unloaded.

```typescript
ctx.i18n.load('en', {
    'my_page': 'My Page',
    'my_item_created': 'Item {0} was created.',
});
```

Use `{0}`, `{1}`, … as positional placeholders.
