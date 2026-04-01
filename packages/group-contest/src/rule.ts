import { ObjectId } from 'mongodb';
import {
    BaseUserDict, ContestModel, ProblemDict,
    ScoreboardConfig, ScoreboardRow, Tdoc,
} from 'hydrooj';
import { GroupDoc, GroupModel } from './model';

// Build the group rule - based on OI-style scoring (sum of best submissions per problem)
export function buildGroupRule(ctx: any) {
    const oiRule = ContestModel.RULES.oi;

    ContestModel.RULES.group = ContestModel.buildContestRule(
        {
            TEXT: 'Group (OI)',
            check: () => { },
            submitAfterAccept: true,
            statusSort: { score: -1 },
            showScoreboard: (tdoc: Tdoc, now: Date) => now > tdoc.endAt,
            showSelfRecord: (tdoc: Tdoc, now: Date) => now > tdoc.endAt,
            showRecord: (tdoc: Tdoc, now: Date) => now > tdoc.endAt,
            async scoreboardHeader(config: ScoreboardConfig, _: (s: string) => string, tdoc: Tdoc, pdict: ProblemDict) {
                const columns: ScoreboardRow = [
                    { type: 'rank', value: '#' },
                    { type: 'string', value: _('Group') },
                    { type: 'total_score', value: _('Group Score') },
                ];
                for (let i = 1; i <= tdoc.pids.length; i++) {
                    const pid = tdoc.pids[i - 1];
                    columns.push({
                        type: 'problem',
                        value: String.fromCharCode(64 + i),
                        raw: pid,
                    });
                }
                return columns;
            },
            async scoreboardRow(
                config: ScoreboardConfig,
                _: (s: string) => string,
                tdoc: Tdoc,
                pdict: ProblemDict,
                udoc: any,
                rank: number,
                tsdoc: any,
                meta?: any,
            ) {
                const row: ScoreboardRow = [
                    { type: 'rank', value: rank.toString() },
                    { type: 'string', value: tsdoc.groupName || '' },
                    { type: 'total_score', value: tsdoc.score || 0 },
                ];
                for (const pid of tdoc.pids) {
                    const best = tsdoc.detail?.[pid];
                    row.push({
                        type: 'record',
                        value: best?.score !== undefined ? String(best.score) : '-',
                        raw: best?.rid || null,
                        score: best?.score,
                    });
                }
                return row;
            },
            async scoreboard(
                config: ScoreboardConfig,
                _: (s: string) => string,
                tdoc: Tdoc,
                pdict: ProblemDict,
                cursor: any,
            ): Promise<[ScoreboardRow[], BaseUserDict]> {
                // Get all individual statuses
                const allTsdocs: any[] = await cursor.toArray();

                // Get all groups for this contest
                const groups: GroupDoc[] = await GroupModel.getByContest(ctx, tdoc.domainId, tdoc.docId);

                // Build member -> group map
                const memberToGroup: Record<number, GroupDoc> = {};
                for (const g of groups) {
                    for (const uid of g.members) {
                        memberToGroup[uid] = g;
                    }
                }

                // Aggregate scores by group (OI-style: best member score per problem)
                const groupScores: Record<string, {
                    group: GroupDoc;
                    score: number;
                    detail: Record<number, { score: number; rid: ObjectId | null }>;
                }> = {};

                for (const g of groups) {
                    const gid = g._id.toHexString();
                    groupScores[gid] = { group: g, score: 0, detail: {} };
                    for (const pid of tdoc.pids) {
                        groupScores[gid].detail[pid] = { score: 0, rid: null };
                    }
                }

                for (const tsdoc of allTsdocs) {
                    const g = memberToGroup[tsdoc.uid];
                    if (!g) continue;
                    const gid = g._id.toHexString();
                    const gs = groupScores[gid];
                    if (!gs) continue;

                    for (const pid of tdoc.pids) {
                        const memberPidDetail = tsdoc.detail?.[pid];
                        if (!memberPidDetail) continue;
                        const memberScore = memberPidDetail.score || 0;
                        const rate = (tdoc.score?.[pid] || 100) / 100;
                        const weighted = Math.round(memberScore * rate);
                        if (weighted > (gs.detail[pid]?.score || 0)) {
                            gs.detail[pid] = { score: weighted, rid: memberPidDetail.rid || null };
                        }
                    }
                }

                for (const gid of Object.keys(groupScores)) {
                    let total = 0;
                    for (const pid of tdoc.pids) {
                        total += groupScores[gid].detail[pid]?.score || 0;
                    }
                    groupScores[gid].score = total;
                }

                const sorted = Object.values(groupScores).sort((a, b) => b.score - a.score);

                const columns = await this.scoreboardHeader(config, _, tdoc, pdict);
                const rows: ScoreboardRow[] = [columns];

                let rank = 1;
                for (let i = 0; i < sorted.length; i++) {
                    if (i > 0 && sorted[i].score !== sorted[i - 1].score) rank = i + 1;
                    const gs = sorted[i];
                    const fakeTsdoc = {
                        uid: gs.group.captain,
                        groupName: gs.group.name,
                        score: gs.score,
                        detail: gs.detail,
                    };
                    // eslint-disable-next-line no-await-in-loop
                    const row = await this.scoreboardRow(config, _, tdoc, pdict, null, rank, fakeTsdoc, {});
                    rows.push(row);
                }

                return [rows, {}];
            },
            async ranked(tdoc: Tdoc, cursor: any) {
                const docs = await cursor.toArray();
                return docs.map((d: any, i: number) => [i + 1, d] as [number, any]);
            },
        },
        oiRule, // inherit stat, applyProjection from OI rule
    );
}
