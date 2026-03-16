# 事件系統（Events）

Hydro 使用一個由 Cordis 提供的型別安全事件匯流排。  
插件可以訂閱任何已定義的事件，並透過 `ctx.emit` 觸發自訂事件。

> **English version:** [../events.md](../events.md)

## 目錄

- [訂閱事件](#訂閱事件)
- [觸發事件](#觸發事件)
- [事件參考：系統生命週期](#事件參考系統生命週期)
- [事件參考：使用者與認證](#事件參考使用者與認證)
- [事件參考：題目](#事件參考題目)
- [事件參考：提交記錄](#事件參考提交記錄)
- [事件參考：比賽](#事件參考比賽)
- [事件參考：討論](#事件參考討論)
- [事件參考：訓練](#事件參考訓練)
- [事件參考：域](#事件參考域)
- [事件參考：排程任務](#事件參考排程任務)
- [事件參考：Handler 生命週期](#事件參考handler-生命週期)
- [宣告自訂事件](#宣告自訂事件)

---

## 訂閱事件

使用 `ctx.on` 或 `ctx.once` 訂閱事件。  
透過 `ctx` 訂閱的監聽器會在插件卸載時自動移除。

```typescript
ctx.on('app/started', () => {
    console.log('Hydro 已啟動');
});

ctx.once('database/connect', (db) => {
    console.log('資料庫已連線');
});

// 也支援非同步監聽器
ctx.on('user/create', async (user) => {
    await sendWelcomeEmail(user);
});
```

---

## 觸發事件

```typescript
ctx.emit('my-event', arg1, arg2);
await ctx.serial('my-event', arg1); // 等待所有監聽器完成後再繼續
```

`ctx.serial` 等待所有監聽器（包括非同步監聽器）完成後才繼續。  
`ctx.emit` 觸發監聽器但不等待。

---

## 事件參考：系統生命週期

| 事件 | 引數 | 說明 |
|------|------|------|
| `database/connect` | `db: Db` | MongoDB 客戶端已連線 |
| `database/config` | — | 資料庫設定已載入 |
| `app/started` | — | HTTP 伺服器開始監聽 |
| `app/listen` | — | 伺服器即將開始監聽 |
| `app/ready` | — | 所有插件初始化完成 |
| `app/exit` | — | 程序正在關閉 |
| `task/daily` | — | 每日任務執行（每天一次） |

---

## 事件參考：使用者與認證

| 事件 | 引數 | 說明 |
|------|------|------|
| `user/create` | `udoc: User` | 新用戶建立後 |
| `user/login` | `uid: number, args` | 用戶登入後 |
| `user/logout` | `uid: number` | 用戶登出後 |
| `user/message` | `uid: number, mdoc: Message` | 新私信發送給用戶 |
| `user/delcache` | `uidOrName: string \| number` | 某用戶的快取失效 |

---

## 事件參考：題目

| 事件 | 引數 | 說明 |
|------|------|------|
| `problem/add` | `doc: ProblemDoc, id: ObjectId` | 題目建立後 |
| `problem/edit` | `doc: ProblemDoc` | 題目更新後 |
| `problem/del` | `domainId: string, docId: number` | 題目刪除後 |

---

## 事件參考：提交記錄

| 事件 | 引數 | 說明 |
|------|------|------|
| `record/change` | `rdoc: RecordDoc, $set?, $push?` | 提交記錄更新時 |
| `record/judge` | `rdoc: RecordDoc, updated: boolean` | 評測完成後 |

---

## 事件參考：比賽

| 事件 | 引數 | 說明 |
|------|------|------|
| `contest/add` | `doc: ContestDoc, id: ObjectId` | 比賽建立後 |
| `contest/edit` | `doc: ContestDoc` | 比賽更新後 |
| `contest/del` | `domainId: string, docId: ObjectId` | 比賽刪除後 |
| `contest/register` | `tdoc: ContestDoc, tsdoc: ContestStatusDoc` | 用戶報名比賽後 |

---

## 事件參考：討論

| 事件 | 引數 | 說明 |
|------|------|------|
| `discussion/add` | `ddoc: DiscussionDoc` | 討論建立後 |
| `discussion/del` | `ddoc: DiscussionDoc` | 討論刪除後 |

---

## 事件參考：訓練

| 事件 | 引數 | 說明 |
|------|------|------|
| `training/add` | `doc: TrainingDoc` | 訓練建立後 |
| `training/del` | `domainId: string, docId: ObjectId` | 訓練刪除後 |

---

## 事件參考：域

| 事件 | 引數 | 說明 |
|------|------|------|
| `domain/create` | `ddoc: DomainDoc` | 域建立後 |
| `domain/del` | `domainId: string` | 域刪除後 |

---

## 事件參考：排程任務

| 事件 | 引數 | 說明 |
|------|------|------|
| `task/daily` | — | 每日排程任務（每天一次） |

使用 `bus.on` 監聽排程任務並觸發：

```typescript
ctx.on('task/daily', async () => {
    // 每天執行的清理邏輯
    await MyModel.deleteOldEntries();
});
```

---

## 事件參考：Handler 生命週期

這些事件在每次 HTTP 請求中觸發。

| 事件 | 引數 | 說明 |
|------|------|------|
| `handler/create` | `thisObj: Handler, route: string` | 處理器實例化後 |
| `handler/init` | `thisObj: Handler` | 認證/共用初始化完成後 |
| `handler/before-solve` | `thisObj: Handler, method: string` | 在 `get`/`post`/… 之前 |
| `handler/before` | `thisObj: Handler, method: string` | `before-solve` 的別名 |
| `handler/after` | `thisObj: Handler, method: string` | 在 `get`/`post`/… 之後 |
| `handler/finish` | `thisObj: Handler` | 回應傳送後（即使出錯也會觸發） |
| `handler/error` | `thisObj: Handler, error: Error` | 處理器拋出未捕獲錯誤時 |

### 使用 Handler 事件的範例

```typescript
ctx.on('handler/after', (thisObj) => {
    // 每次請求後記錄審計日誌
    if (thisObj instanceof MyHandler) {
        AuditModel.log(thisObj.user._id, thisObj.request.path);
    }
});
```

---

## 宣告自訂事件

在模組中擴充 `EventMap` 介面，讓 TypeScript 理解自訂事件的型別：

```typescript
declare module 'hydrooj' {
    interface EventMap {
        'my-addon/item-created': (item: MyItemDoc) => void;
        'my-addon/item-deleted': (id: ObjectId) => void;
    }
}

// 觸發
ctx.emit('my-addon/item-created', newItem);

// 訂閱（完全型別安全）
ctx.on('my-addon/item-created', (item) => {
    console.log('新增了一個項目：', item._id);
});
```
