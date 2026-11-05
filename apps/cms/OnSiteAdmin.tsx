import type { PayloadRequest, Where } from 'payload';
import { SemanticSearchDashboard } from './components/admin/SemanticSearchDashboard';

const admin = '/admin';

export function OnSiteIcon() {
  return <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true">
    <rect width="36" height="36" rx="11" fill="#162e51"/>
    <path d="m7 21 11 6 11-6v4l-11 6-11-6z" fill="#2866ad"/>
    <path d="m7 16 11 6 11-6v4l-11 6-11-6z" fill="#338bea"/>
    <path d="m7 15 11-6 11 6-11 6z" fill="#63bbff"/>
  </svg>;
}

export function OnSiteLogo() {
  return <span className="onsite-brand"><OnSiteIcon/><span>On Site</span></span>;
}

const groups = [
  {name:'Site Builder',caption:'Appearance and page composition',tone:'violet',links:[
    ['Design, Header & Footer','Manage shared styles, navigation, and footer links.','/globals/site-builder'],
    ['Page Templates','Arrange reusable sections and preview a layout.','/collections/page-templates'],
    ['Reusable Sections','Create heroes, text, images, calls to action, and FAQs.','/collections/reusable-sections'],
  ]},
  {name:'Site content',caption:'Pages and layout content',tone:'blue',links:[
    ['Homepage','Edit hero copy and landing page sections.','/globals/homepage'],
    ['Site Pages','Manage page copy and images.','/collections/site-pages'],
    ['Media','Browse and upload site imagery.','/collections/media'],
  ]},
  {name:'Publishing',caption:'Work, articles, and social proof',tone:'mint',links:[
    ['Projects','Update project details and portfolio titles.','/collections/projects'],
    ['Posts','Edit and publish blog articles.','/collections/posts'],
    ['Testimonials','Manage quotes and attribution.','/collections/testimonials'],
  ]},
  {name:'Workspace',caption:'Site access and tools',tone:'violet',links:[
    ['Users','Manage workspace accounts.','/collections/users'],
    ['My account','Open your account settings.','/account'],
  ]},
];

export async function OnSiteDashboard({initPageResult}: {initPageResult:{req:PayloadRequest}}) {
  const {req} = initPageResult;
  const published: Where = {_status:{equals:'published'}};
  const draft: Where = {_status:{equals:'draft'}};
  const metrics = [
    {label:'Published posts',collection:'posts',where:published,filter:'published'},
    {label:'Draft posts',collection:'posts',where:draft,filter:'draft'},
    {label:'Site pages',collection:'site-pages'},
    {label:'Media assets',collection:'media'},
  ] as const;
  const counts = await Promise.allSettled(metrics.map(metric => req.payload.count({
    collection:metric.collection,where:'where' in metric ? metric.where : undefined,
    req,overrideAccess:false,
  })));
  return <main className="onsite-dashboard">
    <header className="onsite-dashboard-header">
      <OnSiteLogo/>
      <span className="onsite-site-tag">Relyon Dev</span>
    </header>
    <div className="onsite-intro">
      <div>
        <div className="onsite-eyebrow">CONTENT WORKSPACE</div>
        <h1>Website overview</h1>
        <p>Manage your pages, projects, and publishing from one place.</p>
      </div>
      <a className="onsite-primary" href={admin + '/collections/posts/create'}>＋ New post</a>
    </div>
    <section className="onsite-metrics" aria-label="Editorial overview">
      {metrics.map((metric,index) => {
        const result = counts[index];
        const query = 'filter' in metric ? '?' + new URLSearchParams({'where[_status][equals]':metric.filter}) : '';
        return <a className="onsite-card" key={metric.label} href={admin + '/collections/' + metric.collection + query}>
          <span className="onsite-card-description">{metric.label}</span>
          <strong className="onsite-metric-value">{result.status === 'fulfilled' ? result.value.totalDocs : 'Unavailable'}</strong>
        </a>;
      })}
    </section>
    <SemanticSearchDashboard/>
    <div className="onsite-grid">
      {groups.map(group => <section className="onsite-column" data-tone={group.tone} key={group.name}>
        <h2><span aria-hidden="true"/>{group.name}</h2>
        <p>{group.caption}</p>
        <div className="onsite-cards">
          {group.links.map(([title,description,path]) => <a className="onsite-card" key={path} href={admin + path}>
            <span className="onsite-card-title">{title}<span aria-hidden="true">↗</span></span>
            <span className="onsite-card-description">{description}</span>
          </a>)}
        </div>
      </section>)}
    </div>
  </main>;
}
