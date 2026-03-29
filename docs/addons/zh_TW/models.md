# 資料模型（Models）

Hydro 使用 MongoDB 作為資料庫。  
本文件說明如何使用內建模型，以及如何建立自訂模型。

> **English version:** [../models.md](../models.md)

## 目錄

- [直接存取資料庫](#直接存取資料庫)
- [DocumentModel — 通用文件儲存](#documentmodel--通用文件儲存)
- [建立自訂模型](#建立自訂模型)
- [內建模型參考](#內建模型參考)
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

---

## 直接存取資料庫

> **如需完整的直接資料庫存取教學**（CRUD、索引、分頁、TTL、原子操作），請參閱 [database.md](./database.md)。

低階 MongoDB 客戶端可在 `apply` 函式中透過 `ctx.db` 存取：

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

> **注意：** 舊版的 `import { db } from 'hydrooj'` 已被廢棄，請始終使用 `ctx.db`。

為自訂集合宣告 TypeScript 型別：

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

## DocumentModel — 通用文件儲存

`DocumentModel` 是一個通用儲存機制，透過 `docType` 欄位將多種文件類型多路儲存在單一 `document` MongoDB 集合中。  
它提供豐富功能：巢狀回覆、表情反應、每用戶狀態等。

```typescript
import { DocumentModel } from 'hydrooj';
```

### 核心方法

```typescript
// 建立文件
const docId: ObjectId = await DocumentModel.add(
    domainId,   // 例如 'system'
    content,    // 字串內容
    owner,      // 用戶 _id
    docType,    // 自訂的數字型別常數
    docId?,     // 可選的明確 id（ObjectId | null）
    parentType?,
    parentId?,
    args?,      // 其他欄位
);

// 讀取文件
const doc = await DocumentModel.get(domainId, docType, docId);

// 更新文件
await DocumentModel.set(domainId, docType, docId, $set);

// 刪除文件
await DocumentModel.deleteOne(domainId, docType, docId);
await DocumentModel.deleteMulti(domainId, docType, query);

// 計算文件數量
const count = await DocumentModel.count(domainId, docType, query);

// 遍歷文件
const cursor = DocumentModel.getMulti(domainId, docType, query);

// 遞增數字欄位
await DocumentModel.inc(domainId, docType, docId, field, value);
```

### 回覆 / 巢狀內容

```typescript
// 向文件的陣列中推入一條回覆
const [doc, replyId] = await DocumentModel.push(
    domainId, docType, docId,
    'reply',   // 欄位名稱
    content,   // 回覆內容
    owner,     // 回覆作者 uid
    extra?,    // 回覆上的額外欄位
);

// 移除回覆
await DocumentModel.pull(domainId, docType, docId, 'reply', replyId);

// 更新回覆
await DocumentModel.setSub(domainId, docType, docId, 'reply', replyId, $set);
```

### 每用戶狀態

```typescript
// 讀取（文件, 用戶）的狀態文件
const status = await DocumentModel.getStatus(domainId, docType, docId, uid);

// 設定狀態
await DocumentModel.setStatus(domainId, docType, docId, uid, $set);
```

### 定義新文件類型

選擇一個唯一的整數作為類型（0–69 由 Hydro 保留）：

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

## 建立自訂模型

Hydro 模型通常是一個含有靜態非同步方法的類別：

```typescript
import { db, DocumentModel, ObjectId } from 'hydrooj';

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

    static getMulti(query = {}) {
        return DocumentModel.getMulti('system', TYPE_MY_DOC, query).sort({ _id: -1 });
    }
}

// 掛載到 global.Hydro.model（可選但常見做法）
global.Hydro.model.myAddon = MyModel;

declare module 'hydrooj' {
    interface Model {
        myAddon: typeof MyModel;
    }
}
```

---

## 內建模型參考

### UserModel

```typescript
import UserModel from 'hydrooj/model/user'; // 或從 'hydrooj' 匯入
```

| 方法 | 簽名 | 說明 |
|------|------|------|
| `getById` | `(domainId, uid, scope?)` | 透過數字 ID 取得用戶 |
| `getByUname` | `(domainId, uname)` | 透過用戶名稱取得用戶 |
| `getByEmail` | `(domainId, email)` | 透過電子郵件取得用戶 |
| `getList` | `(domainId, uids[])` | 批次取得多個用戶 |
| `create` | `(mail, uname, password, uid?, regip?, priv?)` | 建立新用戶 |
| `setById` | `(uid, $set?, $unset?, $push?)` | 更新用戶欄位 |
| `setUname` | `(uid, uname)` | 修改用戶名稱 |
| `setEmail` | `(uid, email)` | 修改用戶電子郵件 |
| `setPassword` | `(uid, password)` | 修改用戶密碼 |
| `inc` | `(uid \| uids[], field, n?)` | 遞增數字欄位 |

`User` 類別（由 `getById` 等方法返回）的輔助方法：

```typescript
user.hasPerm(...perms: bigint[]): boolean
user.hasPriv(...privs: number[]): boolean
user.own(doc, checkPerm?: bigint | boolean): boolean
user.checkPassword(password): Promise<void>  // 失敗時拋出 LoginError
```

---

### ProblemModel

```typescript
import ProblemModel from 'hydrooj/model/problem'; // 或從 'hydrooj' 匯入
```

| 方法 | 說明 |
|------|------|
| `add(domainId, pid, title, content, owner, tag, hidden?)` | 建立題目 |
| `get(domainId, pid, uid?)` | 透過數字 ID 或字串 PID 取得題目 |
| `edit(domainId, docId, $set)` | 更新題目 |
| `del(domainId, docId)` | 刪除題目及其資料 |
| `getMulti(domainId, query)` | 題目遊標 |
| `count(domainId, query)` | 計算題目數量 |
| `addTestdata(domainId, docId, name, payload)` | 新增測試資料檔案 |
| `delTestdata(domainId, docId, names[])` | 刪除測試資料檔案 |
| `getStatus(domainId, docId, uid)` | 取得用戶對某題目的狀態 |
| `setStatus(domainId, docId, uid, $set)` | 更新用戶對某題目的狀態 |

---

### ContestModel

```typescript
import * as ContestModel from 'hydrooj/model/contest'; // 或從 'hydrooj' 匯入
```

| 方法 | 說明 |
|------|------|
| `add(domainId, title, content, owner, rule, beginAt, endAt, pids, rated?)` | 建立比賽 |
| `edit(domainId, tid, $set)` | 更新比賽 |
| `del(domainId, tid)` | 刪除比賽 |
| `get(domainId, tid)` | 取得比賽 |
| `getMulti(domainId, query)` | 比賽遊標 |
| `attend(domainId, tid, uid)` | 用戶報名比賽 |
| `getStatus(domainId, tid, uid)` | 取得用戶的比賽狀態 |
| `isRunning(tdoc, now?)` | 比賽是否進行中 |
| `isDone(tdoc, now?)` | 比賽是否已結束 |
| `canShowRecord(tdoc, now?)` | 提交記錄是否可見 |
| `canShowScoreboard(tdoc, now?)` | 排行榜是否可見 |

#### 自訂比賽規則

註冊新的計分規則：

```typescript
import { ContestModel } from 'hydrooj';

ContestModel.registerRule('myRule', {
    TEXT: '我的自訂規則',
    hidden: false,
    check: (args) => { /* 驗證設定 */ },
    statusSort: { score: -1 },
    submitAfterAccept: false,
    showScoreboard: (tdoc, now) => now > tdoc.endAt,
    showSelfRecord: () => true,
    showRecord: (tdoc, now) => now > tdoc.endAt,
    stat(tdoc, journal) {
        // 從提交日誌計算 ContestStat
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
import RecordModel from 'hydrooj/model/record'; // 或從 'hydrooj' 匯入
```

| 方法 | 說明 |
|------|------|
| `add(domainId, pid, uid, lang, code, pending, contest?, type?)` | 建立提交記錄 |
| `get(domainId, rid)` | 取得提交記錄 |
| `update(domainId, rid, $set, $push?, $unset?)` | 更新提交記錄 |
| `del(domainId, rid)` | 刪除提交記錄 |
| `getMulti(domainId, query)` | 提交記錄遊標 |
| `count(domainId, query)` | 計算提交記錄數量 |

---

### DomainModel

```typescript
import DomainModel from 'hydrooj/model/domain'; // 或從 'hydrooj' 匯入
```

| 方法 | 說明 |
|------|------|
| `get(domainId)` | 取得域文件 |
| `getByHost(host)` | 透過主機名稱取得域 |
| `add(domainId, owner, name, bulletin)` | 建立域 |
| `edit(domainId, $set)` | 更新域 |
| `del(domainId)` | 刪除域 |
| `setRoles(domainId, roles)` | 設定權限角色 |
| `getDomainUser(domainId, udoc)` | 取得用戶在域中的文件 |
| `setUserRole(domainId, uid, role)` | 修改用戶在域中的角色 |

---

### SystemModel

```typescript
import SystemModel from 'hydrooj/model/system'; // 或從 'hydrooj' 匯入
```

| 方法 | 說明 |
|------|------|
| `get<K>(key: K)` | 讀取系統設定 |
| `set(key, value)` | 寫入系統設定 |
| `getMany(...keys[])` | 一次讀取多個設定 |
| `findAll()` | 返回所有設定的映射 |

---

### StorageModel

```typescript
import * as StorageService from 'hydrooj/service/storage';
```

```typescript
// 上傳檔案
await StorageService.put('path/in/storage', readableStream, meta?);

// 下載檔案
const stream = await StorageService.get('path/in/storage');

// 產生預簽名 URL（供客戶端下載）
const url = await StorageService.signDownloadLink('path/in/storage', filename, expire, useAlternate?);

// 列出檔案
const files = await StorageService.list('prefix/');

// 刪除檔案
await StorageService.del(['path/1', 'path/2']);
```

---

### ScheduleModel / TaskModel

```typescript
import ScheduleModel from 'hydrooj/model/schedule';
import TaskModel from 'hydrooj/model/task';
```

**ScheduleModel** — 基於時間（「在 X 時間後執行」）：

```typescript
await ScheduleModel.add({
    type: 'my-addon/job',
    executeAfter: new Date(Date.now() + 60_000), // 60 秒後執行
    payload: { userId: 42 },
});
```

**TaskModel** — 評測任務佇列：

```typescript
await TaskModel.add({
    type: 'judge',
    priority: 10,
    domainId,
    rid: recordId,
});
await TaskModel.get(); // 取出下一個任務
```
