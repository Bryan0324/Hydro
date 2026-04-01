# @hydrooj/group-contest

A Hydro OJ addon that adds a **group (team) layer** on top of existing contests. Contestants form groups, and the leaderboard aggregates member scores per problem (OI-style best submission) into a group total.

---

## Features

- Contestants can create or join a group for any contest that uses the `group` rule.
- One user can only belong to one group per contest.
- The group leaderboard shows each group's total score, computed as the sum of the best per-problem score across all members.
- Group captains (or contest admins) can rename, resize, or delete their group.
- Daily cleanup automatically removes empty groups.
- Multilingual support: `zh` (Simplified Chinese), `zh_TW` (Traditional Chinese), `en` (English).

---

## Package Structure

```
packages/group-contest/
├── package.json
├── tsconfig.json
├── templates/
│   ├── group_contest_list.html        # Group list page
│   ├── group_contest_detail.html      # Group detail / management page
│   └── group_contest_scoreboard.html  # Group-level scoreboard
└── src/
    ├── index.ts     # apply() entry — routes, events, UI injection, i18n
    ├── model.ts     # GroupModel — MongoDB data access layer
    ├── handler.ts   # HTTP route handlers
    └── rule.ts      # Custom contest rule "group" (inherits OI rule)
```

---

## Data Model

Groups are stored in the dedicated MongoDB collection `group-contest.groups`.

### `GroupDoc` Fields

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `ObjectId` | Unique group ID |
| `domainId` | `string` | Domain identifier |
| `tid` | `ObjectId` | Contest ID |
| `name` | `string` | Group name |
| `captain` | `number` | UID of the group captain |
| `members` | `number[]` | UIDs of all members (includes captain) |
| `createdAt` | `Date` | Creation timestamp |
| `maxSize` | `number?` | Maximum allowed members (optional) |

### Indexes

| Index | Purpose |
|-------|---------|
| `{ domainId, tid }` | List all groups for a contest |
| `{ domainId, tid, members }` | Look up which group a user belongs to |

---

## Contest Rule: `group`

Select **"Group (OI)"** when creating a contest to enable group scoring.

### Scoring Logic

For each problem, the group's score is the **best (highest) score** achieved by any member of that group. The group's total score is the sum of these per-problem bests.

```
groupScore = Σ max(memberScore[problem]) for each problem
```

Per-problem weights defined in `tdoc.score` are applied before comparison.

### Visibility

Records, self-records, and the scoreboard are all hidden until the contest ends (same as OI rule).

---

## HTTP Routes

| Route Name | URL | Method | Description |
|---|---|---|---|
| `group_contest_list` | `/contest/:tid/group` | `GET` | List all groups and members |
| `group_contest_list` | `/contest/:tid/group` | `POST _operation=create` | Create a new group (captain) |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `GET` | View group details |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=join` | Join the group |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=leave` | Leave the group |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=edit` | Edit group name / max size |
| `group_contest_detail` | `/contest/:tid/group/:gid` | `POST _operation=delete` | Delete the group |
| `group_contest_scoreboard` | `/contest/:tid/group/scoreboard` | `GET` | View group-level scoreboard |

### Permission Rules

- **Create group**: requires `PERM_ATTEND_CONTEST` + the user must have already registered for the contest.
- **Join group**: same requirements as create. A user can only be in one group per contest.
- **Edit / Delete group**: only the group captain or a contest admin (`PERM_EDIT_CONTEST`) can do this.
- **Leave group**: any non-captain member. The captain cannot leave without deleting the group.
- **Edit `maxSize`**: the new value must be ≥ current member count.

---

## Events

| Event | Behaviour |
|-------|-----------|
| `contest/register` | When a user registers for a `group`-rule contest, they receive an inbox message reminding them to join or create a group. |
| `task/daily` | Empty groups (0 members) are deleted automatically. |

---

## i18n Keys

| Key | English |
|-----|---------|
| `group_contest_list` | Group List |
| `group_contest_detail` | Group Detail |
| `group_contest_scoreboard` | Group Scoreboard |
| `Group` | Group |
| `Group Score` | Group Score |
| `Create Group` | Create Group |
| `Join Group` | Join Group |
| `Leave Group` | Leave Group |
| `Edit Group` | Edit Group |
| `Delete Group` | Delete Group |
| `Already in a group` | Already in a group |
| `Group is full` | Group is full |
| `Captain cannot leave the group` | Captain cannot leave the group |
| `You must attend the contest first` | You must attend the contest first |

---

## Installation

This addon is part of the monorepo. To use it, register it as a Hydro addon:

```bash
hydrooj addon add @hydrooj/group-contest
```

Or add it to your Hydro configuration manually.

---

## License

AGPL-3.0-or-later
