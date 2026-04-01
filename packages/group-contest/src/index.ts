import { Context, ContestModel, MessageModel, PERM } from 'hydrooj';
import {
    GroupContestDetailHandler,
    GroupContestListHandler,
    GroupContestScoreboardHandler,
} from './handler';
import { GroupModel } from './model';
import { buildGroupRule } from './rule';

export async function apply(ctx: Context) {
    // 1. Ensure indexes
    await GroupModel.ensureIndexes(ctx);

    // 2. Register "group" contest rule
    buildGroupRule(ctx);

    // 3. Register routes (scoreboard must be before :gid detail route)
    ctx.Route('group_contest_scoreboard', '/contest/:tid/group/scoreboard', GroupContestScoreboardHandler, PERM.PERM_VIEW_CONTEST);
    ctx.Route('group_contest_list', '/contest/:tid/group', GroupContestListHandler, PERM.PERM_VIEW_CONTEST);
    ctx.Route('group_contest_detail', '/contest/:tid/group/:gid', GroupContestDetailHandler, PERM.PERM_VIEW_CONTEST);

    // 4. UI injection: add link to contest management sidebar
    ctx.injectUI('DomainManage', 'group_contest_list', { family: 'Group Contest', icon: 'users' }, PERM.PERM_EDIT_DOMAIN);

    // 5. Listen to contest/register: remind users to join a group
    ctx.on('contest/register', async (tdoc: any, tsdoc: any) => {
        if (tdoc.rule !== 'group') return;
        await MessageModel.send(1, [tsdoc.uid], JSON.stringify({
            message: 'You have registered for group contest {0}. Please join or create a group.',
            params: [tdoc.title],
        }), MessageModel.FLAG_I18N | MessageModel.FLAG_UNREAD);
    });

    // 6. Clean up empty groups daily
    ctx.on('task/daily', async () => {
        const coll = ctx.db.collection('group-contest.groups');
        await coll.deleteMany({ members: { $size: 0 } });
    });

    // 7. i18n
    ctx.i18n.load('zh', {
        group_contest_list: '分组列表',
        group_contest_detail: '分组详情',
        group_contest_scoreboard: '分组排行榜',
        'Group': '分组',
        'Group Score': '组总分',
        'Create Group': '创建分组',
        'Join Group': '加入分组',
        'Leave Group': '退出分组',
        'Edit Group': '编辑分组',
        'Delete Group': '删除分组',
        'Group created': '分组已创建',
        'Joined group': '已加入分组',
        'Left group': '已退出分组',
        'Already in a group': '您已经在一个分组中',
        'Group is full': '分组已满',
        'Captain cannot leave the group': '队长不能退出分组',
        'You must attend the contest first': '请先报名参加比赛',
        'Group Name': '分组名称',
        'Max Size': '最大人数',
        'Members': '成员',
        'Captain': '队长',
        'No groups yet': '暂无分组',
        'Group (OI)': '分组制（OI）',
    });

    ctx.i18n.load('zh_TW', {
        group_contest_list: '分組列表',
        group_contest_detail: '分組詳情',
        group_contest_scoreboard: '分組排行榜',
        'Group': '分組',
        'Group Score': '組總分',
        'Create Group': '建立分組',
        'Join Group': '加入分組',
        'Leave Group': '退出分組',
        'Edit Group': '編輯分組',
        'Delete Group': '刪除分組',
        'Group created': '分組已建立',
        'Joined group': '已加入分組',
        'Left group': '已退出分組',
        'Already in a group': '您已在一個分組中',
        'Group is full': '分組已滿',
        'Captain cannot leave the group': '隊長不能退出分組',
        'You must attend the contest first': '請先報名參加比賽',
        'Group Name': '分組名稱',
        'Max Size': '最大人數',
        'Members': '成員',
        'Captain': '隊長',
        'No groups yet': '暫無分組',
        'Group (OI)': '分組制（OI）',
    });

    ctx.i18n.load('en', {
        group_contest_list: 'Group List',
        group_contest_detail: 'Group Detail',
        group_contest_scoreboard: 'Group Scoreboard',
        'Group (OI)': 'Group (OI)',
    });
}
