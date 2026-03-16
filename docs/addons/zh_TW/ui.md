# UI 注入（UI Injection）

附加元件可以在不修改核心模板的情況下，向 Hydro UI 的預先定義位置注入導航連結、按鈕和選單項目。

> **English version:** [../ui.md](../ui.md)

## 目錄

- [ctx.injectUI](#ctxinjectui)
- [注入目標（Injection Targets）](#注入目標injection-targets)
- [Nav — 頂部導航欄](#nav--頂部導航欄)
- [UserDropdown — 使用者下拉選單](#userdropdown--使用者下拉選單)
- [DomainManage — 域管理側欄](#domainmanage--域管理側欄)
- [ControlPanel — 管理後台側欄](#controlpanel--管理後台側欄)
- [ProblemAdd — 新增題目按鈕](#problemadd--新增題目按鈕)
- [Notification — 系統通知](#notification--系統通知)
- [權限與特權守衛](#權限與特權守衛)
- [排序控制](#排序控制)
- [國際化（ctx.i18n）](#國際化ctxi18n)
- [完整範例](#完整範例)

---

## `ctx.injectUI`

```typescript
ctx.injectUI(
    target: UIInjectableFields,
    routeName: string,
    args?: Record<string, any>,
    ...permPrivChecker: Array<bigint | number | Function | bigint[] | number[]>
): void
```

| 參數 | 說明 |
|------|------|
| `target` | 注入位置（見下文） |
| `routeName` | 用於建構 URL 的路由名稱 |
| `args` | 傳遞給模板渲染器的額外選項（見各目標的說明） |
| `...permPrivChecker` | 零個或多個權限/特權/自訂函式；只有當訪問用戶滿足**全部**條件時才顯示該節點 |

插件卸載時，注入的節點會自動移除。

---

## 注入目標（Injection Targets）

可注入的 UI 位置（`UIInjectableFields`）如下：

| 目標 | UI 中的位置 |
|------|------------|
| `Nav` | 頂部導航欄 |
| `UserDropdown` | 使用者頭像下拉選單 |
| `DomainManage` | 域管理側欄 |
| `ControlPanel` | 管理後台側欄 |
| `ProblemAdd` | 「新增題目」下拉按鈕 |
| `Notification` | 系統通知區域 |

---

## `Nav` — 頂部導航欄

在主導航欄中新增一個條目。

```typescript
ctx.injectUI('Nav', 'blog_main', {
    prefix: 'blog',          // 用於渲染標籤的 i18n 鍵前綴
});
```

可選的 `args`：

| 鍵 | 型別 | 說明 |
|----|------|------|
| `prefix` | `string` | 用於查詢顯示名稱的 i18n 前綴 |
| `query` | `(handler) => Record<string, any>` | 附加到 URL 的動態查詢參數 |
| `before` | `string` | 將此條目放在指定條目之前 |

---

## `UserDropdown` — 使用者下拉選單

在點擊使用者頭像時出現的下拉選單中新增一個條目。

```typescript
ctx.injectUI(
    'UserDropdown',
    'blog_main',
    (handler) => ({
        icon: 'book',
        displayName: 'Blog',
        uid: handler.user._id.toString(),
    }),
    PRIV.PRIV_USER_PROFILE,  // 僅登入用戶可見
);
```

第三個引數可以是普通物件**或**一個函式 `(handler) => args`。

可選的 `args`：

| 鍵 | 型別 | 說明 |
|----|------|------|
| `icon` | `string` | SemanticUI 圖示名稱 |
| `displayName` | `string` | 選單條目標籤（純字串或 i18n 鍵） |
| `uid` | `string` | 作為 `:uid` 傳給路由建構器 |

---

## `DomainManage` — 域管理側欄

在域管理面板的側欄中新增一個條目。

```typescript
ctx.injectUI('DomainManage', 'domain_my_page', {
    family: '我的插件',    // 分組標題
    icon: 'plug',           // SemanticUI 圖示名稱
});
```

可選的 `args`：

| 鍵 | 型別 | 說明 |
|----|------|------|
| `family` | `string` | 側欄分組標題 |
| `icon` | `string` | SemanticUI 圖示名稱 |

---

## `ControlPanel` — 管理後台側欄

在系統級管理後台中新增一個條目。

```typescript
ctx.injectUI('ControlPanel', 'manage_my_page', {
    // 無必填額外引數
});
```

---

## `ProblemAdd` — 新增題目按鈕

在題目列表頁面的「建立題目」下拉選單中新增一個條目。

```typescript
ctx.injectUI('ProblemAdd', 'problem_import_myformat', {
    icon: 'download',
    text: '從我的格式匯入',
});
```

可選的 `args`：

| 鍵 | 型別 | 說明 |
|----|------|------|
| `icon` | `string` | SemanticUI 圖示名稱 |
| `text` | `string` | 按鈕標籤（純字串或 i18n 鍵） |

---

## 權限與特權守衛

可變引數 `...permPrivChecker` 可以讓你對缺乏必要存取權限的用戶隱藏 UI 節點：

```typescript
import { PERM, PRIV } from 'hydrooj';

// 只有域管理員可見
ctx.injectUI('DomainManage', 'domain_my_page', { family: '插件' }, PERM.PERM_EDIT_DOMAIN);

// 只有超級管理員可見
ctx.injectUI('ControlPanel', 'manage_my_page', {}, PRIV.PRIV_EDIT_SYSTEM);

// 自訂判斷條件
ctx.injectUI('Nav', 'my_page', {}, (handler) => handler.user._id > 0);

// 同時要求一個域權限和一個特權（用戶必須全部滿足）
ctx.injectUI('DomainManage', 'my_page', {}, PERM.PERM_EDIT_DOMAIN, PRIV.PRIV_USER_PROFILE);
```

---

## 排序控制

使用 `args.before` 可以將條目插入到現有指定條目之前：

```typescript
ctx.injectUI('Nav', 'my_page', { before: 'ranking' });
```

---

## 國際化（`ctx.i18n`）

```typescript
ctx.i18n.load(language: string, translations: Record<string, string>): void
```

支援的語言代碼包括 `zh`、`zh_TW`、`en`、`kr`、`ja`、`fr`、`de`、`ru` 等。

翻譯會被合併到全局語言庫中，並在插件卸載時自動移除。

```typescript
ctx.i18n.load('zh', {
    'my_page': '我的頁面',
    'my_item_created': '項目 {0} 已建立。',
});

ctx.i18n.load('zh_TW', {
    'my_page': '我的頁面',
    'my_item_created': '項目 {0} 已建立。',
});

ctx.i18n.load('en', {
    'my_page': 'My Page',
    'my_item_created': 'Item {0} was created.',
});
```

使用 `{0}`、`{1}`、… 作為位置佔位符。

---

## 完整範例

```typescript
import { Context, PERM, PRIV } from 'hydrooj';
import { BlogUserHandler, BlogDetailHandler, BlogEditHandler } from './handlers';

export async function apply(ctx: Context) {
    ctx.Route('blog_main', '/blog/:uid', BlogUserHandler);
    ctx.Route('blog_detail', '/blog/:uid/:did', BlogDetailHandler);
    ctx.Route('blog_edit', '/blog/:uid/:did/edit', BlogEditHandler, PRIV.PRIV_USER_PROFILE);

    // 在使用者下拉選單中注入連結
    ctx.injectUI(
        'UserDropdown',
        'blog_main',
        (h) => ({ icon: 'book', displayName: '部落格', uid: h.user._id.toString() }),
        PRIV.PRIV_USER_PROFILE,
    );

    // 新增繁體中文翻譯
    ctx.i18n.load('zh_TW', {
        Blog: '部落格',
        blog_main: '部落格',
        blog_detail: '部落格文章',
        blog_edit: '編輯文章',
    });

    // 新增簡體中文翻譯
    ctx.i18n.load('zh', {
        Blog: '博客',
        blog_main: '博客',
        blog_detail: '博客详情',
        blog_edit: '编辑博客',
    });

    // 新增英文翻譯
    ctx.i18n.load('en', {
        blog_main: 'Blog',
        blog_detail: 'Blog Detail',
        blog_edit: 'Edit Blog',
    });
}
```
