# Models

Hydro uses MongoDB as its database.  
This document explains how to use the built-in models and how to create your own.

## Table of Contents

- [Direct Database Access](#direct-database-access)
- [DocumentModel — Generic Document Storage](#documentmodel--generic-document-storage)
- [Creating a Custom Model](#creating-a-custom-model)
- [Built-in Model Reference](#built-in-model-reference)
  - [UserModel](#usermodel)
  - [ProblemModel](#problemmodel)
  - [ContestModel](#contestmodel)
  - [RecordModel](#recordmodel)
  - [DomainModel](#domainmodel)
  - [DiscussionModel](#discussionmodel)
  - [SystemModel](#systemmodel)
  - [TokenModel](#tokenmodel)
  - [MessageModel](#messagemodel)
  - [StorageModel](#storagemodel)
  - [ScheduleModel / TaskModel](#schedulemodel--taskmodel)
  - [OplogModel](#oplogmodel)
  - [OpcountModel](#opcountmodel)
  - [OauthModel](#oauthmodel)
  - [BlackListModel](#blacklistmodel)
  - [SolutionModel](#solutionmodel)
  - [TrainingModel](#trainingmodel)
  - [SettingModel](#settingmodel)

---

## Direct Database Access

> **For a full tutorial on direct database access** (CRUD, indexes, pagination, TTL, atomic ops)
> see [database.md](./database.md).

The low-level MongoDB client is available as `ctx.db` inside your `apply` function:

```typescript
import { Context } from 'hydrooj';

export async function apply(ctx: Context) {
    const coll = ctx.db.collection('my-addon.items');
    await coll.insertOne({ name: 'foo', value: 42 });
    const doc = await coll.findOne({ name: 'foo' });
    await coll.updateOne({ _id: doc._id }, { $set: { value: 99 } });
    await coll.deleteOne({ _id: doc._id });
}
```

> **Note:** The legacy `import { db } from 'hydrooj'` is deprecated — always use `ctx.db`.

Register the TypeScript type for your collection:

```typescript
interface MyItemDoc {
    _id: ObjectId;
    name: string;
    value: number;
}

declare module 'hydrooj' {
    interface Collections {
        'my-addon.items': MyItemDoc;
    }
}
```

---

## DocumentModel — Generic Document Storage

`DocumentModel` is a generic store that multiplexes many document types into a single
`document` MongoDB collection, distinguished by `docType`.  
It provides rich features: nested replies, reactions, status-per-user, and more.

```typescript
import { DocumentModel } from 'hydrooj';
```

### Core methods

```typescript
// Create a document
const docId: ObjectId = await DocumentModel.add(
    domainId,   // e.g. 'system'
    content,    // string content
    owner,      // user _id
    docType,    // your numeric type constant
    docId?,     // optional explicit id (ObjectId | null)
    parentType?,
    parentId?,
    args?,      // additional fields
);

// Read a document
const doc = await DocumentModel.get(domainId, docType, docId);

// Update a document
await DocumentModel.set(domainId, docType, docId, $set);

// Delete a document
await DocumentModel.deleteOne(domainId, docType, docId);
await DocumentModel.deleteMulti(domainId, docType, query);

// Count documents
const count = await DocumentModel.count(domainId, docType, query);

// Iterate documents
const cursor = DocumentModel.getMulti(domainId, docType, query);

// Increment a numeric field
await DocumentModel.inc(domainId, docType, docId, field, value);

// Increment multiple fields and update others atomically
await DocumentModel.incAndSet(domainId, docType, docId, field, value, $set);
```

### Reply / nested content

```typescript
// Push a reply onto a document's array
const [doc, replyId] = await DocumentModel.push(
    domainId, docType, docId,
    'reply',   // field name
    content,   // reply content
    owner,     // reply author uid
    extra?,    // additional fields on the reply
);

// Pull a reply
await DocumentModel.pull(domainId, docType, docId, 'reply', replyId);

// Update a reply
await DocumentModel.setSub(domainId, docType, docId, 'reply', replyId, $set);
```

### Per-user status

```typescript
// Read status document for (doc, user)
const status = await DocumentModel.getStatus(domainId, docType, docId, uid);

// Set status
await DocumentModel.setStatus(domainId, docType, docId, uid, $set);

// Delete all status docs for a document
await DocumentModel.deleteMultiStatus(domainId, docType, query);
```

### Defining a new document type

Pick a unique integer for your type (0–69 are reserved by Hydro):

```typescript
export const TYPE_MY_DOC = 100 as const;

export interface MyDoc {
    docType: typeof TYPE_MY_DOC;
    docId: ObjectId;
    domainId: string;
    owner: number;
    title: string;
    content: string;
    createdAt: Date;
}

declare module 'hydrooj' {
    interface DocType {
        [TYPE_MY_DOC]: MyDoc;
    }
}
```

---

## Creating a Custom Model

A Hydro model is typically a class with static async methods:

```typescript
import {
    db, DocumentModel, Filter, ObjectId,
    NumberKeys, TYPE_MY_DOC, MyDoc,
} from 'hydrooj'; // use your own types

export class MyModel {
    static async add(owner: number, title: string, content: string): Promise<ObjectId> {
        return DocumentModel.add('system', content, owner, TYPE_MY_DOC, null, null, null, { title });
    }

    static get(id: ObjectId): Promise<MyDoc> {
        return DocumentModel.get('system', TYPE_MY_DOC, id);
    }

    static edit(id: ObjectId, $set: Partial<MyDoc>): Promise<MyDoc> {
        return DocumentModel.set('system', TYPE_MY_DOC, id, $set);
    }

    static del(id: ObjectId): Promise<void> {
        return DocumentModel.deleteOne('system', TYPE_MY_DOC, id) as any;
    }

    static getMulti(query: Filter<MyDoc> = {}) {
        return DocumentModel.getMulti('system', TYPE_MY_DOC, query).sort({ _id: -1 });
    }
}

// Make available on global.Hydro.model (optional but conventional)
global.Hydro.model.myAddon = MyModel;

declare module 'hydrooj' {
    interface Model {
        myAddon: typeof MyModel;
    }
}
```

---

## Built-in Model Reference

### UserModel

```typescript
import UserModel from 'hydrooj/model/user'; // or from 'hydrooj'
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `getById` | `(domainId, uid, scope?)` | Fetch user by numeric ID |
| `getByUname` | `(domainId, uname)` | Fetch user by username |
| `getByEmail` | `(domainId, email)` | Fetch user by email |
| `getList` | `(domainId, uids[])` | Fetch multiple users |
| `create` | `(mail, uname, password, uid?, regip?, priv?)` | Create a new user |
| `setById` | `(uid, $set?, $unset?, $push?)` | Update user fields |
| `setUname` | `(uid, uname)` | Rename a user |
| `setEmail` | `(uid, email)` | Change a user's email |
| `setPassword` | `(uid, password)` | Change a user's password |
| `inc` | `(uid \| uids[], field, n?)` | Increment a numeric field |

The `User` class (returned by `getById` etc.) has these helpers:

```typescript
user.hasPerm(...perms: bigint[]): boolean
user.hasPriv(...privs: number[]): boolean
user.own(doc, checkPerm?: bigint | boolean): boolean
user.checkPassword(password): Promise<void>  // throws LoginError on failure
```

---

### ProblemModel

```typescript
import ProblemModel from 'hydrooj/model/problem'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(domainId, pid, title, content, owner, tag, hidden?)` | Create a problem |
| `get(domainId, pid, uid?)` | Fetch a problem by numeric ID or string PID |
| `edit(domainId, docId, $set)` | Update a problem |
| `del(domainId, docId)` | Delete a problem and its data |
| `getMulti(domainId, query)` | Cursor of problems |
| `count(domainId, query)` | Count problems |
| `addTestdata(domainId, docId, name, payload)` | Attach a test-data file |
| `delTestdata(domainId, docId, names[])` | Remove test-data files |
| `addAdditionalFile(domainId, docId, name, payload)` | Attach an additional file |
| `getStatus(domainId, docId, uid)` | Get a user's status for a problem |
| `setStatus(domainId, docId, uid, $set)` | Update a user's status |

---

### ContestModel

```typescript
import * as ContestModel from 'hydrooj/model/contest'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(domainId, title, content, owner, rule, beginAt, endAt, pids, rated?)` | Create a contest |
| `edit(domainId, tid, $set)` | Update a contest |
| `del(domainId, tid)` | Delete a contest |
| `get(domainId, tid)` | Fetch a contest |
| `getMulti(domainId, query)` | Cursor of contests |
| `attend(domainId, tid, uid)` | Register user for contest |
| `getStatus(domainId, tid, uid)` | Get user's contest status |
| `getScoreboard(ctx, domainId, tid, config)` | Compute the scoreboard |
| `isRunning(tdoc, now?)` | Whether the contest is live |
| `isDone(tdoc, now?)` | Whether the contest has ended |
| `canShowRecord(tdoc, now?)` | Whether records are visible |
| `canShowScoreboard(tdoc, now?)` | Whether scoreboard is visible |

#### Custom contest rules

Register a new scoring rule:

```typescript
import { ContestModel } from 'hydrooj';

ContestModel.registerRule('myRule', {
    TEXT: 'My Custom Rule',
    hidden: false,
    check: (args) => { /* validate config */ },
    statusSort: { score: -1 },
    submitAfterAccept: false,
    showScoreboard: (tdoc, now) => now > tdoc.endAt,
    showSelfRecord: () => true,
    showRecord: (tdoc, now) => now > tdoc.endAt,
    stat(tdoc, journal) {
        // compute ContestStat from the submission journal
        return { detail: {}, score: 0 };
    },
    async scoreboardHeader(config, _, tdoc, pdict) {
        return [];
    },
    async scoreboardRow(config, _, tdoc, pdict, udoc, rank, tsdoc) {
        return [];
    },
    async scoreboard(config, _, tdoc, pdict, cursor) {
        return [[], {}];
    },
    async ranked(tdoc, cursor) {
        return [];
    },
    applyProjection: (tdoc, rdoc) => rdoc,
});
```

---

### RecordModel

```typescript
import RecordModel from 'hydrooj/model/record'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(domainId, pid, uid, lang, code, pending, contest?, type?)` | Create a submission |
| `get(domainId, rid)` | Fetch a record |
| `update(domainId, rid, $set, $push?, $unset?)` | Update a record |
| `del(domainId, rid)` | Delete a record |
| `getMulti(domainId, query)` | Cursor of records |
| `count(domainId, query)` | Count records |
| `getList(domainId, rids[], privileges)` | Fetch multiple records |

---

### DomainModel

```typescript
import DomainModel from 'hydrooj/model/domain'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `get(domainId)` | Fetch a domain document |
| `getByHost(host)` | Fetch a domain by host name |
| `add(domainId, owner, name, bulletin)` | Create a domain |
| `edit(domainId, $set)` | Update a domain |
| `del(domainId)` | Delete a domain |
| `list(query, projection?)` | Cursor of domains |
| `setRoles(domainId, roles)` | Set permission roles |
| `getDomainUser(domainId, udoc)` | Get a user's domain-level document |
| `setUserRole(domainId, uid, role)` | Change a user's role in the domain |
| `getMultiUserInDomain(domainId, query)` | Cursor of domain users |

---

### DiscussionModel

```typescript
import * as DiscussionModel from 'hydrooj/model/discussion'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(domainId, parentType, parentId, owner, title, content, ip?, meta?)` | Post a discussion |
| `get(domainId, did)` | Fetch a discussion |
| `edit(domainId, did, title, content)` | Edit a discussion |
| `del(domainId, did)` | Delete a discussion |
| `getMulti(domainId, query)` | Cursor of discussions |
| `addReply(domainId, did, owner, content, ip)` | Reply to a discussion |
| `delReply(domainId, did, drid)` | Delete a reply |
| `react(domainId, docType, docId, emoji, uid, like)` | Add/remove a reaction |

---

### SystemModel

```typescript
import SystemModel from 'hydrooj/model/system'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `get<K>(key: K)` | Read a system setting |
| `set(key, value)` | Write a system setting |
| `getMany(...keys[])` | Read multiple settings at once |
| `findAll()` | Return all settings as a map |

---

### TokenModel

```typescript
import TokenModel from 'hydrooj/model/token'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(tokenType, expireSeconds, data?, id?)` | Create a token |
| `get(id, tokenType)` | Fetch a token |
| `update(id, tokenType, expireSeconds, data)` | Update a token |
| `del(id, tokenType)` | Delete a token |
| `getMostRecent(tokenType, id)` | Get the most recently used token |

---

### MessageModel

```typescript
import MessageModel from 'hydrooj/model/message'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `send(from, to, content, flag?)` | Send a message |
| `get(mid)` | Fetch a message |
| `del(mid)` | Delete a message |
| `getMulti(uid)` | Cursor of messages for a user |
| `setFlag(mid, flag)` | Update message flags (e.g. mark as read) |

---

### StorageModel

```typescript
import StorageModel from 'hydrooj/model/storage'; // or from 'hydrooj'
import * as StorageService from 'hydrooj/service/storage'; // for actual I/O
```

`StorageModel` manages metadata; `StorageService` handles the actual blob I/O.

```typescript
// Upload a file
await StorageService.put('path/in/storage', readableStream, meta?);

// Download a file
const stream = await StorageService.get('path/in/storage');

// Generate a pre-signed URL (for client-side download)
const url = await StorageService.signDownloadLink('path/in/storage', filename, expire, useAlternate?);

// List files
const files = await StorageService.list('prefix/');

// Delete files
await StorageService.del(['path/1', 'path/2']);
```

---

### ScheduleModel / TaskModel

```typescript
import ScheduleModel from 'hydrooj/model/schedule'; // or from 'hydrooj'
import TaskModel from 'hydrooj/model/task';
```

**ScheduleModel** — time-based ("run after X"):

```typescript
await ScheduleModel.add({
    type: 'my-addon/job',
    subType: 'optional-subtype',
    executeAfter: new Date(Date.now() + 60_000), // run in 60 seconds
    payload: { userId: 42 },
});
await ScheduleModel.getAndDelete('my-addon/job');
await ScheduleModel.del(id);
```

**TaskModel** — priority queue for judge tasks:

```typescript
await TaskModel.add({
    type: 'judge',
    priority: 10,
    domainId,
    rid: recordId,
});
await TaskModel.get(); // dequeue next task
await TaskModel.del(id);
```

---

### OplogModel

```typescript
import * as OplogModel from 'hydrooj/model/oplog'; // or from 'hydrooj'
```

Append-only audit log:

```typescript
// Inside a handler:
await OplogModel.log(this, 'blog.edit', this.ddoc);
```

---

### OpcountModel

```typescript
import * as OpcountModel from 'hydrooj/model/opcount'; // or from 'hydrooj'
```

Per-operation rate limiting (used internally by `Handler.limitRate`):

```typescript
await OpcountModel.inc('add_blog', request.ip, 3600, 60);
// throws OpcountExceededError if limit exceeded
```

---

### OauthModel

```typescript
import OauthModel from 'hydrooj/model/oauth'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `get(domainId, provider, sub)` | Lookup OAuth link |
| `set(domainId, provider, sub, uid)` | Create/update OAuth link |
| `del(domainId, provider, sub)` | Remove OAuth link |

---

### BlackListModel

```typescript
import BlackListModel from 'hydrooj/model/blacklist'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(id, expireAt?)` | Blacklist an IP or email domain |
| `get(id)` | Check if an entry is blacklisted |
| `del(id)` | Remove from blacklist |
| `getMulti()` | Cursor of all entries |

---

### SolutionModel

```typescript
import SolutionModel from 'hydrooj/model/solution'; // or from 'hydrooj'
```

Wraps `DocumentModel` for problem editorial/solution documents.

---

### TrainingModel

```typescript
import * as TrainingModel from 'hydrooj/model/training'; // or from 'hydrooj'
```

| Method | Description |
|--------|-------------|
| `add(domainId, title, content, owner, dag)` | Create a training plan |
| `get(domainId, tid)` | Fetch a training plan |
| `edit(domainId, tid, $set)` | Edit a training plan |
| `del(domainId, tid)` | Delete a training plan |
| `getMulti(domainId, query)` | Cursor of training plans |
| `getStatus(domainId, tid, uid)` | Get a user's training progress |
| `enroll(domainId, tid, uid)` | Enroll a user |

---

### SettingModel

```typescript
import * as SettingModel from 'hydrooj/model/setting'; // or from 'hydrooj'
```

Manages per-user and per-domain-user preference settings.

```typescript
// Define a new user setting
SettingModel.Setting(
    family,        // group key (e.g. 'pref_lang')
    key,           // setting key
    defaultValue,
    type,          // 'text' | 'select' | 'textarea' | ...
    name,          // display name
    desc,          // description
    flag,          // FLAG_PUBLIC | FLAG_PRIVATE | FLAG_DISABLED
);
```
