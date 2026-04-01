import { Filter, ObjectId } from 'mongodb';
import { Context } from 'hydrooj';

export interface GroupDoc {
    _id: ObjectId;
    domainId: string;
    tid: ObjectId;
    name: string;
    captain: number;
    members: number[];
    createdAt: Date;
    maxSize?: number;
}

declare module 'hydrooj' {
    interface Collections {
        'group-contest.groups': GroupDoc;
    }
}

export class GroupModel {
    static async add(
        ctx: Context,
        domainId: string,
        tid: ObjectId,
        name: string,
        captain: number,
        maxSize?: number,
    ): Promise<ObjectId> {
        const coll = ctx.db.collection('group-contest.groups');
        const doc: Omit<GroupDoc, '_id'> = {
            domainId,
            tid,
            name,
            captain,
            members: [captain],
            createdAt: new Date(),
            ...(maxSize !== undefined ? { maxSize } : {}),
        };
        const res = await coll.insertOne(doc as GroupDoc);
        return res.insertedId;
    }

    static get(ctx: Context, domainId: string, gid: ObjectId): Promise<GroupDoc | null> {
        return ctx.db.collection('group-contest.groups').findOne({ _id: gid, domainId });
    }

    static getByContest(ctx: Context, domainId: string, tid: ObjectId): Promise<GroupDoc[]> {
        return ctx.db.collection('group-contest.groups').find({ domainId, tid }).toArray();
    }

    static getByMember(ctx: Context, domainId: string, tid: ObjectId, uid: number): Promise<GroupDoc | null> {
        return ctx.db.collection('group-contest.groups').findOne({ domainId, tid, members: uid });
    }

    static async join(ctx: Context, domainId: string, gid: ObjectId, uid: number): Promise<void> {
        const coll = ctx.db.collection('group-contest.groups');
        const group = await coll.findOne({ _id: gid, domainId });
        if (!group) throw new Error('Group not found');
        if (group.maxSize !== undefined && group.members.length >= group.maxSize) {
            throw new Error('Group is full');
        }
        // Check if user is already in another group in the same contest
        const existing = await coll.findOne({ domainId, tid: group.tid, members: uid });
        if (existing) throw new Error('Already in a group');
        await coll.updateOne({ _id: gid }, { $addToSet: { members: uid } });
    }

    static async leave(ctx: Context, domainId: string, gid: ObjectId, uid: number): Promise<void> {
        const coll = ctx.db.collection('group-contest.groups');
        const group = await coll.findOne({ _id: gid, domainId });
        if (!group) throw new Error('Group not found');
        if (group.captain === uid) throw new Error('Captain cannot leave the group');
        await coll.updateOne({ _id: gid }, { $pull: { members: uid } });
    }

    static edit(
        ctx: Context,
        domainId: string,
        gid: ObjectId,
        $set: Partial<Pick<GroupDoc, 'name' | 'maxSize'>>,
    ): Promise<GroupDoc | null> {
        return ctx.db.collection('group-contest.groups').findOneAndUpdate(
            { _id: gid, domainId },
            { $set },
            { returnDocument: 'after' },
        );
    }

    static async del(ctx: Context, domainId: string, gid: ObjectId): Promise<void> {
        await ctx.db.collection('group-contest.groups').deleteOne({ _id: gid, domainId });
    }

    static async delByContest(ctx: Context, domainId: string, tid: ObjectId): Promise<void> {
        await ctx.db.collection('group-contest.groups').deleteMany({ domainId, tid });
    }

    static getMulti(
        ctx: Context,
        domainId: string,
        query: Filter<GroupDoc> = {},
    ) {
        return ctx.db.collection('group-contest.groups').find({ domainId, ...query });
    }

    static async ensureIndexes(ctx: Context): Promise<void> {
        await ctx.db.ensureIndexes(
            ctx.db.collection('group-contest.groups'),
            { key: { domainId: 1, tid: 1 }, name: 'by_contest' },
            { key: { domainId: 1, tid: 1, members: 1 }, name: 'by_member' },
        );
    }
}
