import type { CollectionConfig, Field, GlobalConfig } from 'payload';

const color = (name: string, label: string): Field => ({
  name,label,type:'text',validate:value => !value || /^#[0-9a-f]{6}$/i.test(String(value)) || 'Enter a six-digit hex color.',
});
const localLink = (name = 'href'): Field => ({
  name,type:'text',validate:value => !value || /^\/(?![\/\\])[^\\\s]*$/.test(String(value)) || 'Enter a local path, such as /contact.',
});
const links = (name: string): Field => ({name,type:'array',fields:[
  {name:'label',type:'text',required:true},localLink(),
]});
const read = () => true;

export const siteBuilder: GlobalConfig = {
  slug:'site-builder',label:'Site Builder',admin:{group:'Site Builder'},access:{read},
  fields:[{type:'tabs',tabs:[
    {label:'Design system',name:'design',fields:[
      color('primary','Primary button background'),color('accent','Accent color'),
      color('darkBackground','Dark background'),color('lightBackground','Light background'),
      {name:'font',type:'select',options:['Poppins','System','Georgia']},
      {name:'radius',label:'Button corner radius (px)',type:'number',min:0,max:60},
    ]},
    {label:'Header',name:'header',fields:[
      {name:'lightLogo',type:'upload',relationTo:'media'},
      {name:'darkLogo',type:'upload',relationTo:'media'},
      links('navigation'),{name:'actionLabel',type:'text'},localLink('actionHref'),
    ]},
    {label:'Footer',name:'footer',fields:[
      {name:'heading',type:'text'}, {name:'copyright',type:'text'},
      {name:'columns',type:'array',fields:[{name:'heading',type:'text',required:true},links('links')]},
    ]},
  ]}],
};

export const reusableSections: CollectionConfig = {
  slug:'reusable-sections',admin:{group:'Site Builder',useAsTitle:'name'},access:{read},
  fields:[
    {name:'name',type:'text',required:true},
    {name:'kind',type:'select',required:true,defaultValue:'text',options:['hero','text','image','cta','faq']},
    {name:'heading',type:'text'}, {name:'body',type:'textarea'},
    {name:'image',type:'upload',relationTo:'media'},
    {name:'actionLabel',type:'text'}, localLink('actionHref'),
    {name:'alignment',type:'select',options:['left','center','right'],defaultValue:'left'},
    {name:'spacing',type:'select',options:['compact','normal','spacious'],defaultValue:'normal'},
    {name:'questions',type:'array',fields:[
      {name:'question',type:'text',required:true},{name:'answer',type:'textarea',required:true},
    ]},
  ],
};

export const pageTemplates: CollectionConfig = {
  slug:'page-templates',admin:{group:'Site Builder',useAsTitle:'name',
    description:'Visual Builder: add reusable sections, drag to reorder, and open Live Preview to review the layout.'},access:{read},
  fields:[
    {name:'name',type:'text',required:true},
    {name:'path',type:'text',unique:true,validate:value =>
      !value || /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(String(value)) || 'Enter an existing local page path.'},
    {name:'enabled',label:'Show sections on the website',type:'checkbox',defaultValue:false},
    {name:'sections',type:'array',labels:{singular:'Section',plural:'Sections'},
      fields:[{name:'section',type:'relationship',relationTo:'reusable-sections',required:true}]},
  ],
};
