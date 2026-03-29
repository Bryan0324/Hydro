# 資料庫教學

本教學說明如何在附加元件中直接使用 Hydro 的 MongoDB 服務（`ctx.db`）。  
當你需要一個不在內建模型涵蓋範圍內的自訂集合時，請使用本教學的方式。

> 若要使用現有 Hydro 資料的高階封裝（用戶、題目、比賽……），請參閱 [models.md](./models.md)。  
> **English version:** [../database.md](../database.md)

---

## 目錄

1. [何時直接使用 `ctx.db`](#何時直接使用-ctxdb)
2. [宣告集合型別](#宣告集合型別)
3. [取得集合句柄](#取得集合句柄)
4. [基本 CRUD](#基本-crud)
5. [查詢與過濾](#查詢與過濾)
6. [原子更新](#原子更新)
7. [索引](#索引)
8. [TTL（自動過期）](#ttl自動過期)
9. [分頁](#分頁)
10. [排名](#排名)
11. [完整範例 — 書籤附加元件](#完整範例--書籤附加元件)

---

## 何時直接使用 `ctx.db`

Hydro 提供了豐富的模型輔助工具（見 [models.md](./models.md)），涵蓋了大多數常見模式。  
在以下情況請直接使用 `ctx.db`：

- 你需要一個附加元件專屬結構的**自訂集合**。
- 你需要執行模型層未公開的**複雜查詢或聚合**。
- 你正在建立**底層服務**或進行資料遷移。

> **重要：** 請始終使用 `ctx.db`，而非舊版的 `db` 預設匯入。  
> 舊版的 `import db from 'hydrooj'` 已被廢棄，未來版本可能會移除。

```typescript
// ✅ 正確
import { Context } from 'hydrooj';
export async function apply(ctx: Context) {
    const coll = ctx.db.collection('my-addon.items');
}

// ❌ 已廢棄
import { db } from 'hydrooj';
const coll = db.collection('my-addon.items');
```

---

## 宣告集合型別

在使用集合之前，請先向 TypeScript 註冊其文件型別，讓 `ctx.db.collection()` 回傳正確型別的 `Collection<T>`：

```typescript
import { ObjectId } from 'mongodb';

// 1. 定義文件的資料結構
export interface BookmarkDoc {
    _id: ObjectId;
    owner: number;           // 用戶 ID
    problemId: string;       // 例如 'P1001'
    domainId: string;
    note: string;
    createdAt: Date;
}

// 2. 向 Hydro 的 Collections 介面註冊
declare module 'hydrooj' {
    interface Collections {
        'my-addon.bookmarks': BookmarkDoc;
    }
}
```

> **命名規範：** 使用 `<附加元件名稱>.<集合名稱>` 格式，以避免與 Hydro 內建集合衝突
>（內建集合除了 `domain.user` 等內建組合外，從不包含點號）。

---

## 取得集合句柄

```typescript
export async function apply(ctx: Context) {
    // ctx.db.collection() 在 'db' 服務就緒後即可使用。
    // 在 apply() 內部，資料庫連線完成後才會呼叫 apply()，因此始終安全。
    const coll = ctx.db.collection('my-addon.bookmarks');

    // 若需要在 Service 建構子中使用集合，請惰性取得：
    // class MyService extends Service {
    //     get coll() { return this.ctx.db.collection('my-addon.bookmarks'); }
    // }
}
```

---

## 基本 CRUD

集合句柄上可使用所有標準的 [MongoDB Node.js 驅動](https://www.mongodb.com/docs/drivers/node/current/) 方法。

### 新增（Insert）

```typescript
const result = await coll.insertOne({
    owner: this.user._id,
    problemId: 'P1001',
    domainId: this.domain._id,
    note: '記得看題解',
    createdAt: new Date(),
});
const newId: ObjectId = result.insertedId;
```

一次新增多份文件：

```typescript
await coll.insertMany([
    { owner: 1, problemId: 'P1001', domainId: 'system', note: '', createdAt: new Date() },
    { owner: 1, problemId: 'P1002', domainId: 'system', note: '', createdAt: new Date() },
]);
```

### 讀取（Read）

```typescript
// 查找一份文件
const doc = await coll.findOne({ owner: uid, problemId: 'P1001' });
if (!doc) throw new Error('找不到書籤');

// 透過 _id 查找
import { ObjectId } from 'mongodb';
const doc = await coll.findOne({ _id: new ObjectId(idString) });
```

### 更新（Update）

```typescript
// 更新第一份符合條件的文件；$set 是合併操作，不會取代整份文件
await coll.updateOne(
    { _id: doc._id },
    { $set: { note: '更新後的備註', updatedAt: new Date() } },
);

// Upsert — 找不到時插入
await coll.updateOne(
    { owner: uid, problemId: 'P1001', domainId },
    {
        $set: { note, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
);

// 更新所有符合條件的文件
await coll.updateMany(
    { owner: uid },
    { $set: { domainId: newDomainId } },
);
```

### 刪除（Delete）

```typescript
// 刪除一份文件
await coll.deleteOne({ _id: doc._id });

// 刪除所有符合條件的文件
await coll.deleteMany({ owner: uid });
```

---

## 查詢與過濾

```typescript
// 取得用戶的所有書籤，按最新排序
const docs = await coll
    .find({ owner: uid, domainId })
    .sort({ createdAt: -1 })
    .toArray();

// 僅回傳特定欄位（投影）
const docs = await coll
    .find({ owner: uid })
    .project<Pick<BookmarkDoc, '_id' | 'problemId' | 'note'>>({ _id: 1, problemId: 1, note: 1 })
    .toArray();

// 限制筆數與跳過
const page = await coll
    .find({ domainId })
    .sort({ _id: -1 })
    .skip((pageNum - 1) * 20)
    .limit(20)
    .toArray();

// 計算符合條件的文件數
const total = await coll.countDocuments({ owner: uid });

// MongoDB 過濾運算子
const recentDocs = await coll
    .find({
        owner: uid,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    })
    .toArray();
```

---

## 原子更新

### `findOneAndUpdate` — 一次往返完成讀取 + 修改

```typescript
// 回傳**更新後**的文件
const updated = await coll.findOneAndUpdate(
    { _id: doc._id },
    { $set: { note: '新備註', updatedAt: new Date() } },
    { returnDocument: 'after' },
);
// updated 的型別為 BookmarkDoc | null
```

### 數字遞增（`$inc`）

```typescript
await coll.updateOne(
    { _id: doc._id },
    { $inc: { viewCount: 1 } },
);
```

### 陣列操作

```typescript
// 新增標籤（不重複）
await coll.updateOne(
    { _id: doc._id },
    { $addToSet: { tags: '困難' } },
);

// 新增標籤（允許重複）
await coll.updateOne(
    { _id: doc._id },
    { $push: { tags: '困難' } },
);

// 移除標籤
await coll.updateOne(
    { _id: doc._id },
    { $pull: { tags: '困難' } },
);
```

### 批量寫入（Bulk Write）

```typescript
await coll.bulkWrite([
    { updateOne: { filter: { _id: id1 }, update: { $set: { note: 'A' } } } },
    { deleteOne: { filter: { _id: id2 } } },
    { insertOne: { document: { owner: 1, problemId: 'P9', domainId: 'system', note: '', createdAt: new Date() } } },
]);
```

---

## 索引

索引讓查詢更快速。對所有用於查詢的欄位都應建立索引。  
請使用 `ctx.db.ensureIndexes()`——它是冪等的，索引定義變更時會自動重新建立。

```typescript
export async function apply(ctx: Context) {
    const coll = ctx.db.collection('my-addon.bookmarks');

    await ctx.db.ensureIndexes(
        coll,
        // 查詢某用戶在某域中的所有書籤
        { key: { owner: 1, domainId: 1, createdAt: -1 }, name: 'owner_domain' },
        // 快速查找特定書籤
        { key: { owner: 1, domainId: 1, problemId: 1 }, name: 'owner_domain_problem', unique: true },
    );
}
```

`ensureIndexes` 只在**主要** PM2 程序（`NODE_APP_INSTANCE === '0'`）上執行，
因此在每次插件啟動時呼叫是安全的。

### `clearIndexes` — 刪除過時索引

當你重新命名或移除索引時，請在 `ensureIndexes` **之前**呼叫 `clearIndexes`，以刪除舊索引：

```typescript
await ctx.db.clearIndexes(coll, ['old_index_name', 'another_stale_index']);
await ctx.db.ensureIndexes(coll, { key: { owner: 1 }, name: 'new_index' });
```

### 稀疏索引（Sparse Index）

**稀疏索引**只包含索引欄位存在的文件。對可選欄位使用此方式可節省空間：

```typescript
await ctx.db.ensureIndexes(coll,
    { key: { sharedWith: 1 }, name: 'shared', sparse: true },
);
```

---

## TTL（自動過期）

MongoDB 可透過 TTL 索引在指定時間後自動刪除文件。  
將 `expireAfterSeconds: 0` 設定在一個存放 `Date` 的欄位（如 `expireAt`）上。

```typescript
export interface SessionCacheDoc {
    _id: string;
    data: any;
    expireAt: Date;   // ← 當此日期過後，MongoDB 會自動刪除該文件
}

declare module 'hydrooj' {
    interface Collections {
        'my-addon.session_cache': SessionCacheDoc;
    }
}

export async function apply(ctx: Context) {
    const coll = ctx.db.collection('my-addon.session_cache');

    await ctx.db.ensureIndexes(coll,
        { key: { expireAt: -1 }, name: 'ttl', expireAfterSeconds: 0 },
    );

    // 插入一份 1 小時後過期的文件
    await coll.insertOne({
        _id: 'some-key',
        data: { userId: 42 },
        expireAt: new Date(Date.now() + 3600 * 1000),
    });
}
```

> **注意：** MongoDB 的背景 TTL 執行緒每 60 秒執行一次，因此刪除不是即時的。  
> 在非副本集部署中，Hydro 也會每小時執行自己的 `fixExpireAfter` 清理，以確保 TTL 正常運作。

---

## 分頁

`ctx.db.paginate()` 包裝一個 `FindCursor`，以一次高效的並行查詢回傳目前頁面的文件、
總頁數和文件總數。

```typescript
// 在 Handler 的 get() 方法中：
import { param, Types } from 'hydrooj';

class BookmarkListHandler extends Handler {
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, page = 1) {
        const PAGE_SIZE = 20;

        const cursor = ctx.db.collection('my-addon.bookmarks')
            .find({ owner: this.user._id, domainId })
            .sort({ createdAt: -1 });

        const [docs, numPages, total] = await this.ctx.db.paginate(cursor, page, PAGE_SIZE);

        this.response.template = 'bookmark_list.html';
        this.response.body = { docs, numPages, total, page };
    }
}
```

`paginate` 簽名：

```typescript
paginate<T>(
    cursor: FindCursor<T>,
    page: number,       // 從 1 開始；若 ≤ 0 則拋出 ValidationError
    pageSize: number,
): Promise<[docs: T[], numPages: number, count: number]>
```

---

## 排名

`ctx.db.ranked()` 接受一個已排序的陣列或遊標，並產生 `[名次, 文件]` 對，  
使用**並列名次**（類似競賽標準排名方式）。

```typescript
// 假設 scoreDocs 按分數由高到低排序
const ranked = await ctx.db.ranked(
    scoreDocs,
    (a, b) => a.score === b.score,  // 相等判斷 — 決定兩個項目是否共享名次
);

for (const [rank, doc] of ranked) {
    console.log(`第 ${rank} 名：用戶 ${doc.uid} — ${doc.score} 分`);
}
// 含有 .unrank = true 的文件名次為 0（不計入排名）
```

---

## 完整範例 — 書籤附加元件

一個最小但完整的附加元件，讓用戶可以收藏題目，展示集合宣告、CRUD、索引和分頁的整合使用：

```typescript
import { ObjectId } from 'mongodb';
import {
    Context, Handler, PERM, param, Types,
    DiscussionNotFoundError, ProblemModel,
} from 'hydrooj';

// ── 型別 ──────────────────────────────────────────────────────────────────
export interface BookmarkDoc {
    _id: ObjectId;
    owner: number;
    domainId: string;
    problemId: number;   // 數字題目 docId
    note: string;
    createdAt: Date;
}

declare module 'hydrooj' {
    interface Collections {
        'bookmark.items': BookmarkDoc;
    }
}

// ── 模型 ──────────────────────────────────────────────────────────────────
export class BookmarkModel {
    static async add(ctx: Context, owner: number, domainId: string, problemId: number, note = '') {
        const coll = ctx.db.collection('bookmark.items');
        const result = await coll.insertOne({
            _id: new ObjectId(),
            owner,
            domainId,
            problemId,
            note,
            createdAt: new Date(),
        });
        return result.insertedId;
    }

    static get(ctx: Context, id: ObjectId) {
        return ctx.db.collection('bookmark.items').findOne({ _id: id });
    }

    static del(ctx: Context, id: ObjectId) {
        return ctx.db.collection('bookmark.items').deleteOne({ _id: id });
    }

    static list(ctx: Context, owner: number, domainId: string) {
        return ctx.db.collection('bookmark.items')
            .find({ owner, domainId })
            .sort({ createdAt: -1 });
    }
}

// ── 處理器 ─────────────────────────────────────────────────────────────────
class BookmarkListHandler extends Handler {
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, page = 1) {
        const [docs, numPages, total] = await this.ctx.db.paginate(
            BookmarkModel.list(this.ctx, this.user._id, domainId),
            page,
            20,
        );
        this.response.template = 'bookmark_list.html';
        this.response.body = { docs, numPages, total, page };
    }
}

class BookmarkAddHandler extends Handler {
    @param('problemId', Types.ProblemId)
    @param('note', Types.Content, true)
    async postCreate(domainId: string, problemId: number, note = '') {
        this.checkPerm(PERM.PERM_VIEW_PROBLEM);
        const pdoc = await ProblemModel.get(domainId, problemId);
        if (!pdoc) throw new DiscussionNotFoundError(domainId, problemId);
        const id = await BookmarkModel.add(this.ctx, this.user._id, domainId, problemId, note);
        this.back({ id });
    }
}

class BookmarkDeleteHandler extends Handler {
    @param('id', Types.ObjectId)
    async postDelete(domainId: string, id: ObjectId) {
        const doc = await BookmarkModel.get(this.ctx, id);
        if (!doc || doc.owner !== this.user._id) this.checkPriv(0); // 403
        await BookmarkModel.del(this.ctx, id);
        this.back();
    }
}

// ── 插件進入點 ─────────────────────────────────────────────────────────────
export async function apply(ctx: Context) {
    // 1. 確保索引存在
    const coll = ctx.db.collection('bookmark.items');
    await ctx.db.ensureIndexes(
        coll,
        { key: { owner: 1, domainId: 1, createdAt: -1 }, name: 'owner_domain' },
        { key: { owner: 1, domainId: 1, problemId: 1 }, name: 'owner_problem', unique: true },
    );

    // 2. 註冊路由
    ctx.Route('bookmark_list', '/bookmark', BookmarkListHandler);
    ctx.Route('bookmark_add', '/bookmark/add', BookmarkAddHandler, PERM.PERM_VIEW_PROBLEM);
    ctx.Route('bookmark_del', '/bookmark/delete', BookmarkDeleteHandler);

    // 3. 翻譯
    ctx.i18n.load('zh', { 'My Bookmarks': '我的收藏' });
    ctx.i18n.load('zh_TW', { 'My Bookmarks': '我的書籤' });
}
```

---

## 延伸閱讀

- [MongoDB Node.js 驅動文件](https://www.mongodb.com/docs/drivers/node/current/) — 完整的 CRUD、聚合與交易參考
- [models.md](./models.md) — Hydro 高階模型層（UserModel、ProblemModel……）
- [api-reference.md](./api-reference.md#context-與-service) — `ctx.db` 方法簽名
