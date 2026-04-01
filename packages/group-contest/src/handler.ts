import { ObjectId } from 'mongodb';
import {
    ContestModel, ContestNotFoundError, Handler, NotFoundError,
    param, PERM, PRIV, Tdoc, Types, UserModel,
} from 'hydrooj';
import { GroupDoc, GroupModel } from './model';

type GroupDetail = { score: number; rid: ObjectId | null };

export class GroupContestBaseHandler extends Handler {
    tdoc: Tdoc;

    @param('tid', Types.ObjectId)
    async _prepare(domainId: string, tid: ObjectId) {
        this.tdoc = await ContestModel.get(domainId, tid);
        if (!this.tdoc) throw new ContestNotFoundError(domainId, tid);
    }

    protected checkGroupAdmin(group: GroupDoc) {
        const isAdmin = this.user.hasPerm(PERM.PERM_EDIT_CONTEST) || this.user.own(this.tdoc);
        if (group.captain !== this.user._id && !isAdmin) {
            this.checkPerm(PERM.PERM_EDIT_CONTEST);
        }
    }
}

export class GroupContestListHandler extends GroupContestBaseHandler {
    @param('tid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId) {
        const groups = await GroupModel.getByContest(this.ctx, domainId, tid);
        let myGroup = null;
        if (this.user._id > 0) {
            myGroup = await GroupModel.getByMember(this.ctx, domainId, tid, this.user._id);
        }
        // Collect all uids to build udict
        const uids = new Set<number>();
        for (const g of groups) {
            uids.add(g.captain);
            for (const uid of g.members) uids.add(uid);
        }
        const udict = await UserModel.getList(domainId, Array.from(uids));
        this.response.template = 'group_contest_list.html';
        this.response.body = {
            tdoc: this.tdoc,
            groups,
            myGroup,
            udict,
        };
    }

    @param('tid', Types.ObjectId)
    @param('name', Types.Title)
    @param('maxSize', Types.PositiveInt, true)
    async postCreate(domainId: string, tid: ObjectId, name: string, maxSize?: number) {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
        this.checkPerm(PERM.PERM_ATTEND_CONTEST);
        // User must have attended the contest
        const tsdoc = await ContestModel.getStatus(domainId, tid, this.user._id);
        if (!tsdoc?.attend) throw new NotFoundError('You must attend the contest first');
        // Must not already be in a group
        const existing = await GroupModel.getByMember(this.ctx, domainId, tid, this.user._id);
        if (existing) throw new Error('Already in a group');
        await GroupModel.add(this.ctx, domainId, tid, name, this.user._id, maxSize);
        this.back();
    }
}

export class GroupContestDetailHandler extends GroupContestBaseHandler {
    @param('tid', Types.ObjectId)
    @param('gid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId, gid: ObjectId) {
        const group = await GroupModel.get(this.ctx, domainId, gid);
        if (!group || !group.tid.equals(tid)) throw new NotFoundError('group', gid);
        let myGroup = null;
        if (this.user._id > 0) {
            myGroup = await GroupModel.getByMember(this.ctx, domainId, tid, this.user._id);
        }
        const uids = new Set<number>([group.captain, ...group.members]);
        const udict = await UserModel.getList(domainId, Array.from(uids));
        this.response.template = 'group_contest_detail.html';
        this.response.body = {
            tdoc: this.tdoc,
            group,
            myGroup,
            udict,
        };
    }

    @param('tid', Types.ObjectId)
    @param('gid', Types.ObjectId)
    async postJoin(domainId: string, tid: ObjectId, gid: ObjectId) {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
        this.checkPerm(PERM.PERM_ATTEND_CONTEST);
        const tsdoc = await ContestModel.getStatus(domainId, tid, this.user._id);
        if (!tsdoc?.attend) throw new NotFoundError('You must attend the contest first');
        await GroupModel.join(this.ctx, domainId, gid, this.user._id);
        this.back();
    }

    @param('tid', Types.ObjectId)
    @param('gid', Types.ObjectId)
    async postLeave(domainId: string, tid: ObjectId, gid: ObjectId) {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
        await GroupModel.leave(this.ctx, domainId, gid, this.user._id);
        this.back();
    }

    @param('tid', Types.ObjectId)
    @param('gid', Types.ObjectId)
    @param('name', Types.Title)
    @param('maxSize', Types.PositiveInt, true)
    async postEdit(domainId: string, tid: ObjectId, gid: ObjectId, name: string, maxSize?: number) {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
        const group = await GroupModel.get(this.ctx, domainId, gid);
        if (!group || !group.tid.equals(tid)) throw new NotFoundError('group', gid);
        this.checkGroupAdmin(group);
        if (maxSize !== undefined && maxSize < group.members.length) {
            throw new Error(`Max size ${maxSize} cannot be less than current member count ${group.members.length}`);
        }
        await GroupModel.edit(this.ctx, domainId, gid, { name, ...(maxSize !== undefined ? { maxSize } : {}) });
        this.back();
    }

    @param('tid', Types.ObjectId)
    @param('gid', Types.ObjectId)
    async postDelete(domainId: string, tid: ObjectId, gid: ObjectId) {
        this.checkPriv(PRIV.PRIV_USER_PROFILE);
        const group = await GroupModel.get(this.ctx, domainId, gid);
        if (!group || !group.tid.equals(tid)) throw new NotFoundError('group', gid);
        this.checkGroupAdmin(group);
        await GroupModel.del(this.ctx, domainId, gid);
        this.response.redirect = this.url('group_contest_list', { tid });
    }
}

export class GroupContestScoreboardHandler extends GroupContestBaseHandler {
    @param('tid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId) {
        if (this.tdoc.rule !== 'group') throw new NotFoundError('This contest does not use the group rule');
        const groups = await GroupModel.getByContest(this.ctx, domainId, tid);
        // Get all statuses
        const tsdocs = await ContestModel.getMultiStatus(domainId, { docId: tid }).toArray();

        // Build member->group map
        const memberToGroup: Record<number, GroupDoc> = {};
        for (const g of groups) {
            for (const uid of g.members) memberToGroup[uid] = g;
        }

        // Aggregate group scores (OI-style: sum best per problem)
        const groupScores: Record<string, { group: GroupDoc; score: number; detail: Record<number, GroupDetail> }> = {};
        for (const g of groups) {
            groupScores[g._id.toHexString()] = { group: g, score: 0, detail: {} };
        }

        for (const tsdoc of tsdocs) {
            const g = memberToGroup[tsdoc.uid];
            if (!g) continue;
            const gid = g._id.toHexString();
            const gs = groupScores[gid];
            if (!gs) continue;
            for (const pid of this.tdoc.pids) {
                const memberPidDetail = tsdoc.detail?.[pid];
                if (!memberPidDetail) continue;
                const memberScore = memberPidDetail.score || 0;
                const rate = (this.tdoc.score?.[pid] || 100) / 100;
                const weighted = Math.round(memberScore * rate);
                if (!gs.detail[pid] || weighted > (gs.detail[pid].score || 0)) {
                    gs.detail[pid] = { score: weighted, rid: memberPidDetail.rid || null };
                }
            }
        }

        for (const gid of Object.keys(groupScores)) {
            let total = 0;
            for (const pid of this.tdoc.pids) {
                total += groupScores[gid].detail[pid]?.score || 0;
            }
            groupScores[gid].score = total;
        }

        const sorted = Object.values(groupScores).sort((a, b) => b.score - a.score);

        this.response.template = 'group_contest_scoreboard.html';
        this.response.body = {
            tdoc: this.tdoc,
            groups: sorted,
        };
    }
}
