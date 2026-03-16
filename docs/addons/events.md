# Events

Hydro's event system is built on [Cordis](https://github.com/cordiverse/cordis).
Addons can listen to events emitted by the core system and emit their own.

## Subscribing to events

```typescript
import { Context, EventMap } from 'hydrooj';

export async function apply(ctx: Context) {
    // Listen to an event (auto-removed when the plugin is unloaded)
    ctx.on('app/ready', async () => {
        console.log('All plugins are loaded');
    });

    ctx.on('record/change', (rdoc) => {
        console.log('Record updated:', rdoc._id);
    });
}
```

Use `ctx.once` to subscribe to an event only once.

## Emitting events

```typescript
ctx.emit('my-addon/event', payload);
ctx.parallel('my-addon/event', payload); // runs all listeners concurrently

// Broadcast across all Hydro processes (PM2 cluster mode)
ctx.broadcast('record/change', rdoc);
```

## Defining custom events

Extend `EventMap` to add TypeScript types for your own events:

```typescript
declare module 'hydrooj' {
    interface EventMap {
        'my-addon/custom': (data: MyData) => void;
    }
}
```

---

## System Event Reference

### Application lifecycle

| Event | Payload | Description |
|-------|---------|-------------|
| `app/listen` | — | HTTP server is about to bind to a port |
| `app/started` | — | HTTP server is listening |
| `app/ready` | — | All plugins have finished loading |
| `app/exit` | — | Application is about to shut down |
| `app/before-reload` | `entries: Set<string>` | HMR: modules about to be reloaded |
| `app/reload` | `entries: Set<string>` | HMR: modules have been reloaded |
| `app/watch/change` | `path: string` | A watched file was modified |
| `app/watch/unlink` | `path: string` | A watched file was deleted |

### Scheduler

| Event | Payload | Description |
|-------|---------|-------------|
| `task/daily` | — | Fired once per day; use for housekeeping |
| `task/daily/finish` | `pref: Record<string, number>` | Fired after all `task/daily` listeners complete |

### Database

| Event | Payload | Description |
|-------|---------|-------------|
| `database/connect` | `db: Db` | MongoDB connection established |
| `database/config` | — | Database configuration has been read |

### System settings

| Event | Payload | Description |
|-------|---------|-------------|
| `system/setting` | `args: Record<string, any>` | System settings were changed |
| `system/setting-loaded` | — | All system settings have been loaded |

### Internal bus

| Event | Payload | Description |
|-------|---------|-------------|
| `bus/broadcast` | `event, payload, trace?` | Cross-process broadcast forwarding |
| `monitor/update` | `type, $set` | Server/judge monitor data updated |
| `monitor/collect` | `info` | Collect monitoring information |
| `api/update` | — | API graph has been updated |

### Users

| Event | Payload | Description |
|-------|---------|-------------|
| `user/message` | `uid[], mdoc` | A message was sent to user(s) |
| `user/get` | `udoc: User` | A `User` object was fetched from the database |
| `user/delcache` | `content: string \| true` | User cache invalidated |
| `user/import/parse` | `payload` | Import file is being parsed |
| `user/import/create` | `uid, udoc` | A user was created via import |

### Domains

| Event | Payload | Description |
|-------|---------|-------------|
| `domain/create` | `ddoc: DomainDoc` | A new domain was created |
| `domain/before-get` | `query` | Before fetching a domain |
| `domain/get` | `ddoc: DomainDoc` | A domain was fetched |
| `domain/before-update` | `domainId, $set` | Before updating a domain |
| `domain/update` | `domainId, $set, ddoc` | A domain was updated |
| `domain/delete` | `domainId` | A domain was deleted |
| `domain/delete-cache` | `domainId` | Domain cache was invalidated |

### Documents

| Event | Payload | Description |
|-------|---------|-------------|
| `document/add` | `doc` | Any document was added |
| `document/set` | `domainId, docType, docId, $set, $unset` | Any document was updated |

### Discussions

| Event | Payload | Description |
|-------|---------|-------------|
| `discussion/before-add` | `payload` | Before a discussion is posted |
| `discussion/add` | `payload` | A discussion was posted |

### Problems

| Event | Payload | Description |
|-------|---------|-------------|
| `problem/before-add` | `domainId, content, owner, docId, doc` | Before a problem is created |
| `problem/add` | `doc, docId` | A problem was created |
| `problem/before-edit` | `doc, $unset` | Before a problem is edited |
| `problem/edit` | `doc: ProblemDoc` | A problem was edited |
| `problem/before-del` | `domainId, docId` | Before a problem is deleted |
| `problem/delete` | `domainId, docId` | A problem was deleted |
| `problem/list` | `query, handler, sort?` | Problem list is being queried |
| `problem/get` | `doc, handler` | A problem was fetched |
| `problem/addTestdata` | `domainId, docId, name, payload` | Test data file added |
| `problem/renameTestdata` | `domainId, docId, name, newName` | Test data file renamed |
| `problem/delTestdata` | `domainId, docId, names[]` | Test data files deleted |
| `problem/addAdditionalFile` | `domainId, docId, name, payload` | Additional file added |
| `problem/renameAdditionalFile` | `domainId, docId, name, newName` | Additional file renamed |
| `problem/delAdditionalFile` | `domainId, docId, names[]` | Additional files deleted |

### Contests

| Event | Payload | Description |
|-------|---------|-------------|
| `contest/before-add` | `payload: Partial<Tdoc>` | Before a contest is created |
| `contest/add` | `payload, id: ObjectId` | A contest was created |
| `contest/before-edit` | `tdoc, $set` | Before a contest is edited |
| `contest/edit` | `payload: Tdoc` | A contest was edited |
| `contest/list` | `query, handler` | Contest list is being queried |
| `contest/scoreboard` | `tdoc, rows, udict, pdict` | Scoreboard was computed |
| `contest/balloon` | `domainId, tid, bdoc` | A balloon was issued |
| `contest/del` | `domainId, tid` | A contest was deleted |

### Records

| Event | Payload | Description |
|-------|---------|-------------|
| `record/change` | `rdoc, $set?, $push?, body?` | A record was updated (emitted synchronously) |
| `record/judge` | `rdoc, updated, pdoc?, updater?` | A record was judged (async) |

### Training plans

| Event | Payload | Description |
|-------|---------|-------------|
| `training/list` | `query, handler` | Training list is being queried |
| `training/get` | `tdoc, handler` | A training plan was fetched |

### Operations log

| Event | Payload | Description |
|-------|---------|-------------|
| `oplog/log` | `type, handler, args, data` | An operation was logged |

### WebSocket subscriptions

| Event | Payload | Description |
|-------|---------|-------------|
| `subscription/init` | `h, privileged` | A subscription connection was opened |
| `subscription/subscribe` | `channel, user, metadata` | A client subscribed to a channel |
| `subscription/enable` | `channel, h, privileged, onDispose` | A subscription was enabled |

---

## Example: housekeeping with `task/daily`

```typescript
export async function apply(ctx: Context) {
    ctx.on('task/daily', async () => {
        // runs once per day
        await MyModel.deleteExpired();
    });
}
```

## Example: reacting to new submissions

```typescript
export async function apply(ctx: Context) {
    ctx.on('record/judge', async (rdoc, updated) => {
        if (!updated) return;
        if (rdoc.status === STATUS.STATUS_ACCEPTED) {
            await notifyUser(rdoc.uid, rdoc._id);
        }
    });
}
```
