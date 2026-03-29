# Database Tutorial

This guide explains how to use Hydro's MongoDB service (`ctx.db`) directly from an addon.
Use this when you need a custom collection that is not covered by any of the built-in models.

> For high-level wrappers around existing Hydro data (users, problems, contests, …) see [models.md](./models.md).  
> **繁體中文版：** [zh_TW/database.md](./zh_TW/database.md)

---

## Table of Contents

1. [When to use `ctx.db` directly](#when-to-use-ctxdb-directly)
2. [Declaring a collection type](#declaring-a-collection-type)
3. [Getting a collection handle](#getting-a-collection-handle)
4. [Basic CRUD](#basic-crud)
5. [Querying and filtering](#querying-and-filtering)
6. [Atomic updates](#atomic-updates)
7. [Indexes](#indexes)
8. [TTL (auto-expiry)](#ttl-auto-expiry)
9. [Pagination](#pagination)
10. [Ranking](#ranking)
11. [Complete example — Bookmark addon](#complete-example--bookmark-addon)

---

## When to use `ctx.db` directly

Hydro provides a rich set of model helpers (see [models.md](./models.md)) that cover most common
patterns. Use `ctx.db` directly when:

- You need a **custom collection** with a schema specific to your addon.
- You need to run a **complex query or aggregation** that the model layer doesn't expose.
- You are building a **low-level service** or migrating data.

> **Important:** Always use `ctx.db` instead of the legacy `db` default import.
> The old `import db from 'hydrooj'` export is deprecated and may be removed in a future version.

```typescript
// ✅ Correct
import { Context } from 'hydrooj';
export async function apply(ctx: Context) {
    const coll = ctx.db.collection('my-addon.items');
}

// ❌ Deprecated
import { db } from 'hydrooj';
const coll = db.collection('my-addon.items');
```

---

## Declaring a collection type

Before using a collection, register its document type with TypeScript so that `ctx.db.collection()`
returns a properly typed `Collection<T>`:

```typescript
import { ObjectId } from 'mongodb';

// 1. Define the document shape
export interface BookmarkDoc {
    _id: ObjectId;
    owner: number;           // user ID
    problemId: string;       // e.g. 'P1001'
    domainId: string;
    note: string;
    createdAt: Date;
}

// 2. Register it with Hydro's Collections interface
declare module 'hydrooj' {
    interface Collections {
        'my-addon.bookmarks': BookmarkDoc;
    }
}
```

> **Naming convention:** use `<addon-name>.<collection-name>` to avoid conflicts with
> Hydro's built-in collections (which never contain a dot except for built-in pairs like
> `domain.user`).

---

## Getting a collection handle

```typescript
export async function apply(ctx: Context) {
    // ctx.db.collection() is available as soon as the 'db' service is ready.
    // Inside apply() this is always safe because apply() is called after the database connects.
    const coll = ctx.db.collection('my-addon.bookmarks');

    // If you need the collection inside a Service constructor, store ctx and call it lazily:
    // class MyService extends Service {
    //     get coll() { return this.ctx.db.collection('my-addon.bookmarks'); }
    // }
}
```

---

## Basic CRUD

All standard [MongoDB Node.js driver](https://www.mongodb.com/docs/drivers/node/current/) methods
are available on the collection handle.

### Insert

```typescript
const result = await coll.insertOne({
    owner: this.user._id,
    problemId: 'P1001',
    domainId: this.domain._id,
    note: 'Remember to read the editorial',
    createdAt: new Date(),
});
const newId: ObjectId = result.insertedId;
```

Insert multiple documents at once:

```typescript
await coll.insertMany([
    { owner: 1, problemId: 'P1001', domainId: 'system', note: '', createdAt: new Date() },
    { owner: 1, problemId: 'P1002', domainId: 'system', note: '', createdAt: new Date() },
]);
```

### Read

```typescript
// Find one document
const doc = await coll.findOne({ owner: uid, problemId: 'P1001' });
if (!doc) throw new Error('Bookmark not found');

// Find one by _id
import { ObjectId } from 'mongodb';
const doc = await coll.findOne({ _id: new ObjectId(idString) });
```

### Update

```typescript
// Update the first matching document; $set merges — does not replace
await coll.updateOne(
    { _id: doc._id },
    { $set: { note: 'Updated note', updatedAt: new Date() } },
);

// Upsert — insert if not found
await coll.updateOne(
    { owner: uid, problemId: 'P1001', domainId },
    {
        $set: { note, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
);

// Update all matching documents
await coll.updateMany(
    { owner: uid },
    { $set: { domainId: newDomainId } },
);
```

### Delete

```typescript
// Delete one document
await coll.deleteOne({ _id: doc._id });

// Delete all matching documents
await coll.deleteMany({ owner: uid });
```

---

## Querying and filtering

```typescript
// All bookmarks for a user, newest first
const docs = await coll
    .find({ owner: uid, domainId })
    .sort({ createdAt: -1 })
    .toArray();

// Only return specific fields (projection)
const docs = await coll
    .find({ owner: uid })
    .project<Pick<BookmarkDoc, '_id' | 'problemId' | 'note'>>({ _id: 1, problemId: 1, note: 1 })
    .toArray();

// Limit and skip
const page = await coll
    .find({ domainId })
    .sort({ _id: -1 })
    .skip((pageNum - 1) * 20)
    .limit(20)
    .toArray();

// Count matching documents
const total = await coll.countDocuments({ owner: uid });

// MongoDB filter operators
const recentDocs = await coll
    .find({
        owner: uid,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    })
    .toArray();
```

---

## Atomic updates

### `findOneAndUpdate` — read + modify in one round-trip

```typescript
// Return the document **after** the update
const updated = await coll.findOneAndUpdate(
    { _id: doc._id },
    { $set: { note: 'new note', updatedAt: new Date() } },
    { returnDocument: 'after' },
);
// updated is BookmarkDoc | null
```

### Numeric increment (`$inc`)

```typescript
await coll.updateOne(
    { _id: doc._id },
    { $inc: { viewCount: 1 } },
);
```

### Array operations

```typescript
// Add a tag (no duplicates)
await coll.updateOne(
    { _id: doc._id },
    { $addToSet: { tags: 'hard' } },
);

// Add a tag (allows duplicates)
await coll.updateOne(
    { _id: doc._id },
    { $push: { tags: 'hard' } },
);

// Remove a tag
await coll.updateOne(
    { _id: doc._id },
    { $pull: { tags: 'hard' } },
);
```

### Bulk write — batching multiple operations

```typescript
await coll.bulkWrite([
    { updateOne: { filter: { _id: id1 }, update: { $set: { note: 'A' } } } },
    { deleteOne: { filter: { _id: id2 } } },
    { insertOne: { document: { owner: 1, problemId: 'P9', domainId: 'system', note: '', createdAt: new Date() } } },
]);
```

---

## Indexes

Indexes make queries fast. Always declare indexes for fields you query on.
Use `ctx.db.ensureIndexes()` — it is idempotent and handles re-creation when
the index definition changes.

```typescript
export async function apply(ctx: Context) {
    const coll = ctx.db.collection('my-addon.bookmarks');

    await ctx.db.ensureIndexes(
        coll,
        // Look up all bookmarks for a user in a domain
        { key: { owner: 1, domainId: 1, createdAt: -1 }, name: 'owner_domain' },
        // Look up a specific bookmark quickly
        { key: { owner: 1, domainId: 1, problemId: 1 }, name: 'owner_domain_problem', unique: true },
    );
}
```

`ensureIndexes` only runs on the **primary** PM2 process (`NODE_APP_INSTANCE === '0'`),
so it is safe to call in every plugin startup.

### `clearIndexes` — drop obsolete indexes

When you rename or remove an index, call `clearIndexes` **before** `ensureIndexes`
so the old index is dropped:

```typescript
await ctx.db.clearIndexes(coll, ['old_index_name', 'another_stale_index']);
await ctx.db.ensureIndexes(coll, { key: { owner: 1 }, name: 'new_index' });
```

### Sparse indexes

A **sparse index** only includes documents where the indexed field exists.
Use this for optional fields to save space:

```typescript
await ctx.db.ensureIndexes(coll,
    { key: { sharedWith: 1 }, name: 'shared', sparse: true },
);
```

---

## TTL (auto-expiry)

MongoDB can automatically delete documents after a set time using a TTL index.
Set `expireAfterSeconds: 0` and store a `Date` field called (e.g.) `expireAt`.

```typescript
export interface SessionCacheDoc {
    _id: string;
    data: any;
    expireAt: Date;   // ← MongoDB will delete documents when this date passes
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

    // Insert a document that expires in 1 hour
    await coll.insertOne({
        _id: 'some-key',
        data: { userId: 42 },
        expireAt: new Date(Date.now() + 3600 * 1000),
    });
}
```

> **Note:** MongoDB's background TTL thread runs every 60 seconds, so deletion is not instant.
> Hydro also runs its own `fixExpireAfter` cleanup hourly for non-replica-set deployments
> where MongoDB's TTL thread may not fire reliably.

---

## Pagination

`ctx.db.paginate()` wraps a `FindCursor` and returns the current page, the number of pages,
and the total document count — all in one efficient parallel query.

```typescript
// In a Handler's get() method:
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

`paginate` signature:

```typescript
paginate<T>(
    cursor: FindCursor<T>,
    page: number,       // 1-based; throws ValidationError if ≤ 0
    pageSize: number,
): Promise<[docs: T[], numPages: number, count: number]>
```

---

## Ranking

`ctx.db.ranked()` takes a sorted array or cursor and produces `[rank, doc]` pairs with
**shared ranks** for ties (like standard competition ranking).

```typescript
// Assume scoreDocs is sorted by score descending
const ranked = await ctx.db.ranked(
    scoreDocs,
    (a, b) => a.score === b.score,  // equality — determines when two items share a rank
);

for (const [rank, doc] of ranked) {
    console.log(`#${rank}: user ${doc.uid} — ${doc.score} pts`);
}
// Documents with .unrank = true get rank 0 (not counted)
```

---

## Complete example — Bookmark addon

A minimal but complete addon that lets users bookmark problems, demonstrating collection
declaration, CRUD, indexes, and pagination together:

```typescript
import { ObjectId } from 'mongodb';
import {
    Context, Handler, PERM, param, Types,
    DiscussionNotFoundError, ProblemModel,
} from 'hydrooj';

// ── Types ──────────────────────────────────────────────────────────────────
export interface BookmarkDoc {
    _id: ObjectId;
    owner: number;
    domainId: string;
    problemId: number;   // numeric problem docId
    note: string;
    createdAt: Date;
}

declare module 'hydrooj' {
    interface Collections {
        'bookmark.items': BookmarkDoc;
    }
}

// ── Model ──────────────────────────────────────────────────────────────────
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

// ── Handlers ───────────────────────────────────────────────────────────────
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

// ── Plugin entry point ─────────────────────────────────────────────────────
export async function apply(ctx: Context) {
    // 1. Ensure indexes are present
    const coll = ctx.db.collection('bookmark.items');
    await ctx.db.ensureIndexes(
        coll,
        { key: { owner: 1, domainId: 1, createdAt: -1 }, name: 'owner_domain' },
        { key: { owner: 1, domainId: 1, problemId: 1 }, name: 'owner_problem', unique: true },
    );

    // 2. Register routes
    ctx.Route('bookmark_list', '/bookmark', BookmarkListHandler);
    ctx.Route('bookmark_add', '/bookmark/add', BookmarkAddHandler, PERM.PERM_VIEW_PROBLEM);
    ctx.Route('bookmark_del', '/bookmark/delete', BookmarkDeleteHandler);

    // 3. Translations
    ctx.i18n.load('zh', { 'My Bookmarks': '我的收藏' });
    ctx.i18n.load('zh_TW', { 'My Bookmarks': '我的書籤' });
}
```

---

## Further reading

- [MongoDB Node.js driver docs](https://www.mongodb.com/docs/drivers/node/current/) — full CRUD, aggregation, and transaction reference
- [models.md](./models.md) — high-level Hydro model layer (UserModel, ProblemModel, …)
- [api-reference.md](./api-reference.md#context--service) — `ctx.db` method signatures
