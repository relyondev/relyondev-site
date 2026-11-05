import { buildConfig, type Field, type CollectionConfig } from 'payload';
import { sqliteAdapter } from '@payloadcms/db-sqlite';
import { resolve } from 'node:path';
import { siteBuilder, reusableSections, pageTemplates } from './site-builder.ts';
import { withEmbeddings, withGlobalEmbeddings } from './hooks/generateEmbeddings.ts';
import { collectionFields } from './services/contentDocuments.ts';
import { semanticEndpoints } from './services/semanticEndpoints.ts';

const content: Field = { name:'content', type:'array', fields:[
  {name:'label',type:'text'}, {name:'text',type:'textarea'},
  {name:'link',type:'text'}, {name:'image',type:'upload',relationTo:'media'}
] };
const pageFields: Field[] = [
  {name:'path',type:'text',required:true,unique:true,admin:{readOnly:true}},
  {name:'originalTitle',type:'text',admin:{hidden:true}},
  {name:'copy',type:'array',fields:[
    {name:'original',type:'textarea',admin:{readOnly:true}},
    {name:'occurrence',type:'number',admin:{hidden:true}},
    {name:'value',type:'textarea'},
  ]},
  {name:'images',type:'array',fields:[
    {name:'original',type:'text',admin:{readOnly:true}},
    {name:'originalImage',type:'upload',relationTo:'media',admin:{hidden:true}},
    {name:'image',type:'upload',relationTo:'media'},
    {name:'alt',type:'text'},
    {name:'originalAlt',type:'text',admin:{hidden:true}},
  ]}
];
const projectFields: Field[] = [
  {name:'urlSlug',label:'URL Slug',type:'text',unique:true,validate:value =>
    !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value)) || 'Use lowercase letters, numbers, and hyphens.'},
  {name:'overview',label:'Project Overview',type:'textarea',localized:true},
  {name:'previewURL',label:'Preview Site Redirect Link',type:'text'},
  {name:'facts',label:'Project Facts',type:'group',fields:[
    {name:'industry',type:'text'},{name:'created',type:'text'},
    {name:'pages',type:'text'},{name:'platform',type:'text'}
  ]},
  ...(['brief','approach','outcome','about'] as const).map(name => ({
    name,label:({brief:'The Brief',approach:'The Approach',outcome:'The Outcome',about:'About the Project'})[name],
    type:'textarea' as const,localized:true
  })),
  ...(['pages','features'] as const).map(name => ({
    name,type:'array' as const,fields:[{name:'label',type:'text' as const,required:true}]
  }))
];

const read = () => true;
const visualEdit = {beforeDocumentControls:['/VisualEditBridge#VisualEditBridge']};
export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  typescript: { autoGenerate: false },
  endpoints: semanticEndpoints,
  db: sqliteAdapter({client:{url:'file:./relyon.sqlite'},push:process.env.PAYLOAD_SCHEMA_PUSH !== '0'}),
  admin:{importMap:{autoGenerate:false},user:'users',theme:'all',meta:{titleSuffix:' · On Site',icons:[{rel:'icon',url:'/onsite.svg'}]},
    components:{
      graphics:{Icon:'/OnSiteAdmin#OnSiteIcon',Logo:'/OnSiteAdmin#OnSiteLogo'},
      beforeNavLinks:['/OnSiteSidebar#OnSiteSidebarBrand'],
      afterNavLinks:['/OnSiteSidebar#OnSiteThemeToggle'],
      afterNav:['/OnSiteSidebar#OnSiteIconRail'],
      views:{dashboard:{Component:'/OnSiteAdmin#OnSiteDashboard'}}
    },livePreview:{
    globals:['homepage','site-builder'],collections:['site-pages','projects','posts','page-templates'],
    url:({data,collectionConfig,globalConfig}) => {
      const base = process.env.RELYON_FRONTEND_URL ?? 'http://localhost:3000';
      const path = globalConfig?.slug === 'homepage' || globalConfig?.slug === 'site-builder' ? '/'
        : collectionConfig?.slug === 'projects' && /^home-[a-z0-9_-]+$/.test(data?.sourceKey ?? '')
          ? '/works/' + data.sourceKey.slice(5)
          : collectionConfig?.slug === 'page-templates' ? data?.path || '/' : data?.path;
      if (typeof path !== 'string' || !/^\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]*$/.test(path)) return null;
      const url = new URL(path,base);
      url.searchParams.set('payload-preview','1');
      return url.href;
    },
    breakpoints:[
      {label:'Mobile',name:'mobile',width:390,height:844},
      {label:'Desktop',name:'desktop',width:1440,height:900},
    ],
  }},
  localization:{locales:['en','id'],defaultLocale:'en'},
  globals:[siteBuilder,{slug:'homepage',access:{read},admin:{group:'Site Content',components:{elements:visualEdit}},fields:[
    {name:'headline',type:'text',localized:true},
    {name:'intro',type:'textarea',localized:true},
    {name:'sections',type:'array',localized:true,fields:[
      {name:'kind',type:'text',required:true}, {name:'heading',type:'text'}, content
    ]}
  ]}].map(withGlobalEmbeddings),
  collections:[
    reusableSections,pageTemplates,
    {slug:'users',auth:true,admin:{group:'Workspace'},fields:[]},
    {slug:'media',access:{read},admin:{group:'Site Content'},upload:{staticDir:resolve('media'),mimeTypes:['image/*']},
      fields:[{name:'sourceKey',type:'text',unique:true},{name:'alt',type:'text'}]},
    {slug:'site-pages',access:{read},admin:{group:'Site Content',useAsTitle:'title',components:{edit:visualEdit}},fields:[
      {name:'title',type:'text',required:true},
      ...pageFields
    ]},
    ...(['posts','projects','testimonials'] as const).map(slug => ({
      slug, access:{read:({req}:any)=>req.user ? true : {_status:{equals:'published'}}},
      versions:{drafts:true}, admin:{group:'Publishing',useAsTitle:'title',...(slug === 'testimonials' ? {} : {components:{edit:visualEdit}})},
      fields:[
        {name:'title',label:slug === 'projects' ? 'Project Name' : 'Title',type:'text' as const,required:true,localized:true},
        {name:'summary',type:'textarea' as const,localized:true},
        {name:'body',type:'textarea' as const,localized:true},
        {name:'sourceKey',type:'text' as const,unique:true}, content,
        ...(slug === 'posts' ? [
          ...pageFields,
          {name:'cover',type:'upload' as const,relationTo:'media'},
          {name:'originalCover',type:'upload' as const,relationTo:'media',admin:{hidden:true}},
          {name:'originalHeading',type:'text' as const,admin:{hidden:true}},
          {name:'originalSummary',type:'textarea' as const,admin:{hidden:true}},
        ] : []),
        ...(slug === 'projects' ? projectFields : [])
      ]
    }))
  ].map(collection => collectionFields[collection.slug] ? withEmbeddings(collection as CollectionConfig) : collection as CollectionConfig)
});
