import {
    Context,
    DiscussionModel,
    DocumentModel,
    Handler,
    ProblemModel,
} from 'hydrooj';

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

interface UrlEntry {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: string;
}

function formatUrlEntry(entry: UrlEntry): string {
    const parts = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
    parts.push('  </url>');
    return parts.join('\n');
}

class SitemapHandler extends Handler {
    noCheckPermView = true;

    async get() {
        const domainId = this.domain._id;
        const protocol = this.context.protocol;
        const { host } = this.request;
        const base = `${protocol}://${host}`;

        const urls: UrlEntry[] = [
            { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
            { loc: `${base}/p`, changefreq: 'daily', priority: '0.8' },
            { loc: `${base}/contest`, changefreq: 'daily', priority: '0.8' },
            { loc: `${base}/discuss`, changefreq: 'daily', priority: '0.7' },
        ];

        // Problems
        const problems = await ProblemModel.getMulti(domainId, { hidden: false }, ['docId', 'pid']).toArray();
        for (const p of problems) {
            urls.push({
                loc: `${base}/p/${p.pid || p.docId}`,
                changefreq: 'weekly',
                priority: '0.6',
            });
        }

        // Contests
        const contests = await DocumentModel.getMulti(
            domainId, DocumentModel.TYPE_CONTEST, {}, ['docId'],
        ).toArray();
        for (const c of contests) {
            urls.push({
                loc: `${base}/contest/${c.docId.toHexString()}`,
                changefreq: 'weekly',
                priority: '0.6',
            });
        }

        // Discussions
        const discussions = await DiscussionModel.getMulti(
            domainId, { hidden: false }, ['docId'],
        ).toArray();
        for (const d of discussions) {
            urls.push({
                loc: `${base}/discuss/${d.docId.toHexString()}`,
                changefreq: 'weekly',
                priority: '0.5',
            });
        }

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls.map(formatUrlEntry),
            '</urlset>',
        ].join('\n');

        this.response.type = 'application/xml';
        this.response.body = xml;
    }
}

export async function apply(ctx: Context) {
    ctx.Route('sitemap', '/sitemap.xml', SitemapHandler);
}
