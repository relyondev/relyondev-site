// Apply the Relyon Dev identity immediately so the source snapshot never
// flashes the reference brand while the page is loading.
(() => {
  for (const href of ['/brand/fonts.css','/brand/relyon.css']) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; document.head.append(link);
  }
  const logo = '<img class="rd-logo rd-logo-official" src="/brand/logo-v2.svg" alt="Relyon Dev" width="180" height="45">';
  let scheduled = false;
  const previewMode = new URLSearchParams(location.search).get('payload-preview') === '1';
  const adminOrigins = new Set(['http://127.0.0.1:3001','http://localhost:3001']);
  let liveDocument;
  let editorOrigin;
  const visualFields = new WeakMap();
  function markVisual(element, path, value) {
    if (!previewMode || !liveDocument || !element || !path || typeof value !== 'string') return;
    visualFields.set(element,{path,value});
    element.setAttribute('data-relyon-visual-edit','');
  }
  const sourceLabels = new WeakMap();
  function previewValues(data, collection, global) {
    if (global === 'homepage' && location.pathname === '/') {
      liveDocument = {type:'homepage',data};
      applyHomepage();
    } else if (['site-pages','posts','projects'].includes(collection) && location.pathname !== '/') {
      const expectedPath = collection === 'projects' ? '/works/' + data.sourceKey?.slice(5) : data.path;
      if (expectedPath !== location.pathname.replace(/\/$/, '')) return;
      liveDocument = {type:collection,data};
      applyPage();
    }
  }
  if (previewMode) {
    const editor = window.parent !== window ? window.parent : window.opener;
    window.addEventListener('message',event => {
      const message = event.data;
      if (event.source !== editor || !adminOrigins.has(event.origin) || !message) return;
      if (message.type === 'relyon-visual-edit-result') {
        if (!message.ok) alert('This field changed in Payload. Reopen the editor and try again.');
        return;
      }
      if (message.type !== 'payload-live-preview' || !message.data || typeof message.data !== 'object') return;
      editorOrigin = event.origin;
      if (message.globalSlug === 'site-builder' || message.collectionSlug === 'page-templates') {
        document.dispatchEvent(new CustomEvent('relyon-builder-preview',{detail:message}));
      }
      previewValues(message.data,message.collectionSlug,message.globalSlug);
    });
    document.addEventListener('click',event => {
      const element = event.target.closest?.('[data-relyon-visual-edit]');
      const field = visualFields.get(element);
      if (!editorOrigin || !field || document.querySelector('.rd-visual-dialog')) return;
      event.preventDefault();
      event.stopPropagation();
      const dialog = document.createElement('dialog');
      dialog.className = 'rd-visual-dialog';
      const form = document.createElement('form');
      form.method = 'dialog';
      const label = document.createElement('label');
      label.textContent = 'Edit in Payload';
      const input = document.createElement('textarea');
      input.value = field.value;
      input.rows = 6;
      label.append(input);
      const cancel = document.createElement('button');
      cancel.value = 'cancel';
      cancel.textContent = 'Cancel';
      const apply = document.createElement('button');
      apply.value = 'apply';
      apply.textContent = 'Apply to form';
      form.append(label,cancel,apply);
      dialog.append(form);
      dialog.addEventListener('close',() => {
        if (dialog.returnValue === 'apply') editor?.postMessage({
          type:'relyon-visual-edit',path:field.path,previous:field.value,value:input.value
        },editorOrigin);
        dialog.remove();
      },{once:true});
      document.body.append(dialog);
      dialog.showModal();
      input.focus();
    },true);
    for (const origin of adminOrigins) editor?.postMessage({type:'payload-live-preview',ready:true},origin);
  }
  let projectTitles;
  let postCards;
  async function refreshPostCards() {
    if (!location.pathname.startsWith('/blog')) return;
    try {
      const response = await fetch('/content/post-cards',{cache:'no-store'});
      if (!response.ok) return;
      postCards = await response.json();
      applyPostCards();
    } catch {
      // Keep the packaged cards while Payload is offline.
    }
  }
  function applyPostCards() {
    if (!postCards) return;
    for (const link of document.querySelectorAll('a[href^="/blog/"]')) {
      const post = postCards[link.pathname.replace(/\/$/,'')];
      if (!post) continue;
      const heading = link.querySelector('h2,h3,h4');
      if (!heading) continue;
      editText(heading,post.title);
      if (post.summary) editText(link.querySelector('p'),post.summary);
      const img = link.querySelector('img');
      if (img && post.title && img.alt !== post.title) img.alt = post.title;
      if (img && post.cover) {
        const src = '/content/media/' + encodeURIComponent(post.cover);
        if (img.getAttribute('src') !== src) {
          img.removeAttribute('srcset');
          img.setAttribute('src',src);
        }
      }
    }
  }
  async function refreshProjectTitles() {
    try {
      const response = await fetch('/content/project-titles', {cache:'no-store'});
      if (!response.ok) return;
      projectTitles = await response.json();
      applyProjectTitles();
    } catch {
      // Keep the packaged titles while Payload is unavailable.
    }
  }
  function applyProjectTitles() {
    if (!projectTitles) return;
    for (const link of document.querySelectorAll('a[href^="/works/"]')) {
      const title = projectTitles[link.pathname.replace(/\/$/, '')];
      if (!title) continue;
      const images = [...link.querySelectorAll('img[alt]')].filter(img => img.alt);
      const labels = [link.getAttribute('aria-label'), ...images.map(img => img.alt)].filter(Boolean);
      const heading = link.querySelector('h2,h3,h4')
        ?? [...(link.parentElement?.querySelectorAll('h2,h3,h4') ?? [])]
          .find(element => labels.some(label => compact(label) === compact(element.textContent)));
      editText(heading, title);
      if (link.hasAttribute('aria-label') && link.getAttribute('aria-label') !== title) {
        link.setAttribute('aria-label', title);
      }
      for (const img of images) if (img.alt !== title) img.alt = title;
      if (link.childElementCount === 0 && link.textContent.trim()) editText(link, title);
    }
  }
  let homepageData;
  let homepageLocale;
  let pagePath;
  let pageData;
  const originalText = new WeakMap();
  const originalImages = new WeakMap();
  const excluded = 'header,footer,nav,script,style,svg,noscript,template';
  async function refreshPage(path) {
    if (!/^\/(about-us|works|services|blog|templates)(\/|$)/.test(path)) return;
    try {
      const response = await fetch('/content/page?path=' + encodeURIComponent(path), {cache:'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      if (pagePath !== path) return;
      pageData = data;
      applyPage();
    } catch {
      // Keep the original page when the local CMS is offline.
    }
  }
  function applyPage() {
    if (!pageData || pageData.path !== pagePath) return;
    const live = previewMode && liveDocument;
    const activePage = live?.type === 'site-pages' || live?.type === 'posts'
      ? {...pageData,...live.data} : pageData;
    const project = live?.type === 'projects' ? {...pageData.project,...live.data} : pageData.project;
    const projectTitle = project?.title ?? pageData.projectTitle;
    const postTitle = live?.type === 'posts' ? live.data.title : pageData.postTitle;
    if (projectTitle) editText(document.querySelector('main h1, article h1, h1'), projectTitle,
      live?.type === 'projects' ? 'title' : undefined);
    const title = pageData.title === pageData.originalTitle && pageData.projectTitle
      ? pageData.originalTitle.replace(/^[^—|]+/, pageData.projectTitle + ' ')
      : pageData.title;
    if (title && title !== pageData.originalTitle && document.title !== title) {
      document.title = title;
    }
    const updates = new Map();
    for (const [index,row] of (activePage.copy ?? []).entries()) {
      if (typeof row.value !== 'string' || (!live && row.value === row.original)) continue;
      if (!updates.has(row.original)) updates.set(row.original, new Map());
      updates.get(row.original).set(row.occurrence, {value:row.value,index});
    }
    if (updates.size) {
      const counts = new Map();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.closest(excluded)) continue;
        const source = originalText.get(node) ?? node.textContent;
        const key = source.trim();
        if (!updates.has(key)) continue;
        const occurrence = counts.get(key) ?? 0;
        counts.set(key, occurrence + 1);
        const replacement = updates.get(key).get(occurrence);
        if (replacement === undefined) continue;
        originalText.set(node, source);
        if (live?.type === 'posts' || live?.type === 'site-pages') {
          const parent = node.parentElement;
          const textNodes = [...parent.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
          if (textNodes.length === 1 && !parent.closest('h1')) {
            markVisual(parent,'copy.' + replacement.index + '.value',replacement.value);
          }
        }
        const value = source.replace(key, () => replacement.value);
        if (node.textContent !== value) node.textContent = value;
      }
    }
    const images = new Map((activePage.images ?? []).map(row => [row.original, row]));
    for (const img of document.querySelectorAll('img[src]')) {
      if (img.closest(excluded)) continue;
      const original = originalImages.get(img) ?? img.getAttribute('src');
      const row = images.get(original);
      if (!row) continue;
      if (row.alt !== row.originalAlt && img.alt !== (row.alt ?? '')) img.alt = row.alt ?? '';
      const id = value => typeof value === 'object' ? value?.id : value;
      const imageID = id(row.image);
      if (imageID === id(row.originalImage)) {
        if (previewMode && img.getAttribute('src') !== original) img.setAttribute('src', original);
        continue;
      }
      const path = row.image?.filename ? '/content/media/' + encodeURIComponent(row.image.filename)
        : previewMode && /^\d+$/.test(String(imageID)) ? '/content/preview-image/' + imageID : null;
      if (!path) continue;
      originalImages.set(img, original);
      if (img.getAttribute('src') === path) continue;
      img.removeAttribute('srcset');
      img.closest('picture')?.querySelectorAll('source').forEach(source => source.removeAttribute('srcset'));
      img.setAttribute('src', path);
    }
    applyProjectFields(project);
    if (postTitle) {
      editText(document.querySelector('main h1, article h1, h1'),postTitle,
        live?.type === 'posts' ? 'title' : undefined);
      const title = postTitle + ' | Relyon Dev';
      if (document.title !== title) document.title = title;
    }
    if (pageData.postSummary) document.querySelector('meta[name="description"]')?.setAttribute('content',pageData.postSummary);
  }
  function applyProjectFields(project) {
    if (!project?.urlSlug) return;
    const find = (selector, text) => [...document.querySelectorAll(selector)]
      .find(element => compact(element.textContent) === compact(text));
    for (const [label, key] of Object.entries({
      'Project Overview':'overview','The Brief':'brief','The Approach':'approach','The Outcome':'outcome'
    })) {
      editText(find('h2',label)?.nextElementSibling, project[key], liveDocument?.type === 'projects' ? key : undefined);
    }
    for (const key of ['industry','created','pages','platform']) {
      editText(find('dt',key)?.parentElement.querySelector('dd'), project.facts?.[key],
        liveDocument?.type === 'projects' ? 'facts.' + key : undefined);
    }
    const about = find('h2','About the Project')?.parentElement;
    if (about && project.about) {
      if (liveDocument?.type === 'projects') markVisual(about.querySelector('p'),'about',project.about);
      const paragraphs = [...about.querySelectorAll('p')];
      const copy = project.about.split(/\n\s*\n/);
      paragraphs.forEach((paragraph,index) => {
        if (index < paragraphs.length - 1) editText(paragraph,copy[index]);
        else editText(paragraph,copy.slice(index).join(' '));
      });
    }
    for (const key of ['pages','features']) {
      const list = find('h3',key)?.nextElementSibling;
      if (!list?.matches('ul') || !Array.isArray(project[key])) continue;
      const labels = project[key].map(item => item.label);
      const entries = [...list.querySelectorAll(':scope > li')];
      if (liveDocument?.type === 'projects') entries.forEach((item,index) =>
        markVisual(item,key + '.' + index + '.label',labels[index]));
      if (entries.map(entry => entry.textContent.trim()).join('\n') === labels.join('\n')) continue;
      for (const [index,label] of labels.entries()) {
        const item = entries[index] ?? document.createElement('li');
        if (!entries[index]) {
          item.className = entries[0]?.className ?? '';
          item.textContent = label;
          list.append(item);
        } else editText(item,label);
      }
      entries.slice(labels.length).forEach(item => item.remove());
    }
    const preview = [...document.querySelectorAll('a[href]')].find(anchor =>
      /^preview\s*site/i.test(anchor.textContent.trim()) || /^preview site$/i.test(anchor.getAttribute('aria-label') ?? ''));
    if (preview && project.previewURL && /^(https?:\/\/|\/(?![\/\\]))/i.test(project.previewURL) &&
        preview.getAttribute('href') !== project.previewURL) preview.setAttribute('href',project.previewURL);
  }
  const homepageSelectors = [
    '#hero', 'section[aria-label="Tools and platforms we build with"]',
    'section[aria-labelledby="intro-heading"]', '#works', '#services', '#services',
    '#pricing', '#approach', '#testimonials', '#testimonials', '#faqs', null,
    'footer', 'footer'
  ];
  const compact = value => value?.replace(/\s+/g, '').toLowerCase();
  const blocksText = blocks => Array.isArray(blocks)
    ? blocks.map(block => block.children?.map(child => child.text ?? '').join('') ?? '').join('\n\n')
    : blocks;
  function editText(element, value, fieldPath) {
    markVisual(element,fieldPath,value);
    if (!element || typeof value !== 'string' ||
        element.textContent.trim().replace(/\s+/g,' ') === value.trim().replace(/\s+/g,' ')) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.textContent.trim() && !node.parentElement.closest('svg, script, style')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const first = walker.nextNode();
    if (!first) return;
    first.textContent = value;
    while (walker.nextNode()) walker.currentNode.textContent = '';
  }
  function matchText(container, original, replacement) {
    if (!original || typeof replacement !== 'string' || (!previewMode && original === replacement)) return;
    const candidates = [...container.querySelectorAll('h1,h2,h3,h4,p,li,a,button,span,figcaption')];
    const target = candidates.reverse().find(node => compact(sourceLabels.get(node) ?? node.textContent) === compact(original));
    if (target) sourceLabels.set(target,original);
    editText(target, replacement);
  }
  function applyHomepage() {
    if (!homepageData || location.pathname !== '/') return;
    const [published, source] = homepageData;
    const data = previewMode && liveDocument?.type === 'homepage' ? {...published,...liveDocument.data} : published;
    const originalSections = source.landingPage.sections;
    data.sections?.forEach((entry, index) => {
      const original = originalSections[index];
      const selector = homepageSelectors[index];
      const container = selector && document.querySelector(selector);
      if (!container || !original || original.__component !== 'sections.' + entry.kind) return;
      const title = index === 0 ? data.headline : entry.heading;
      if (index === 0) {
        if (previewMode || compact(title) !== compact(original.heading)) editText(container.querySelector('h1'), title,'headline');
        if (previewMode || compact(data.intro) !== compact(blocksText(original.body))) editText(container.querySelector('.hh-sub'), data.intro,'intro');
      } else matchText(container, original.heading, title);
      const rows = [...[blocksText(original.body), blocksText(original.intro), original.eyebrow, original.caption]
        .filter(Boolean).map(text => ({text})),
        ...[original.primaryAction, original.secondaryAction, original.action].filter(Boolean),
        ...(original.items ?? original.logos ?? []).map(item => ({
          label:item.title ?? item.question ?? item.name,
          text:item.description ?? blocksText(item.answer), href:item.action?.href
        }))];
      rows.forEach((row, rowIndex) => {
        const next = entry.content?.[rowIndex];
        if (!next) return;
        matchText(container, row.label, next.label);
        row.text?.split('\n\n').forEach((text, i) => {
          if (index !== 0 || rowIndex !== 0) matchText(container, text, next.text?.split('\n\n')[i]);
        });
        if (row.href && next.link && next.link !== row.href) {
          const before = new URL(row.href, location.href);
          const after = new URL(next.link, location.href);
          if (after.origin !== location.origin) return;
          for (const anchor of container.querySelectorAll('a[href]')) {
            if (anchor.pathname === before.pathname) anchor.href = after.href;
          }
        }
      });
    });
  }
  async function refreshHomepage() {
    if (location.pathname !== '/') return;
    const locale = language;
    try {
      const [data, source] = await Promise.all([
        fetch('/content/homepage?locale=' + locale, {cache:'no-store'}),
        fetch('/brand/homepage-source.json')
      ]);
      if (!data.ok || !source.ok) return;
      const result = await Promise.all([data.json(), source.json()]);
      if (locale !== language) return;
      homepageData = result;
      applyHomepage();
    } catch {
      // The packaged page remains available when the local CMS is stopped.
    }
  }
  let language = localStorage.getItem('rd-language') === 'id' ? 'id' : 'en';
  const labels = new Map(Object.entries({
    Home: 'Beranda', 'About Us': 'Tentang Kami', Works: 'Portofolio',
    Services: 'Layanan', Blogs: 'Blog', Templates: 'Templat',
    Connect: 'Hubungi Kami', 'Let’s Connect': 'Hubungi Kami',
    'Get in touch': 'Hubungi kami', 'See our work': 'Lihat portofolio',
    'Our Works': 'Portofolio Kami', 'Start a project': 'Mulai proyek',
    Pricing: 'Harga', 'Our Approach': 'Pendekatan Kami',
    Testimonials: 'Testimoni', 'Frequently Asked Questions': 'Pertanyaan Umum',
    Contact: 'Kontak', 'Skip to content': 'Lewati ke konten'
  }));
  const originalLabels = new WeakMap();
  function applyLanguage() {
    document.documentElement.lang = language;
    document.querySelectorAll('header button[role="switch"]').forEach(toggle => {
      let button = toggle.nextElementSibling;
      if (!button?.classList.contains('rd-language')) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'rd-language';
        button.addEventListener('click', () => {
          language = language === 'en' ? 'id' : 'en';
          localStorage.setItem('rd-language', language);
          applyLanguage();
        });
        toggle.after(button);
      }
      const next = language === 'en' ? 'ID' : 'EN';
      if (button.textContent !== next) button.textContent = next;
      button.setAttribute('aria-label', next === 'ID' ? 'Ganti ke Bahasa Indonesia' : 'Switch to English');
    });
    for (const element of document.querySelectorAll('header a, main a, main h2, footer a, footer h3')) {
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const original = originalLabels.get(node) ?? node.textContent;
        const translated = labels.get(original.trim());
        if (!translated) continue;
        originalLabels.set(node, original);
        const value = language === 'id' ? original.replace(original.trim(), translated) : original;
        if (node.textContent !== value) node.textContent = value;
      }
    }
  }
  function apply() {
    scheduled = false;
    applyLanguage();
    const path = location.pathname.replace(/\/$/, '') || '/';
    if (pagePath !== path) {
      pagePath = path;
      pageData = undefined;
      void refreshPage(path);
      void refreshPostCards();
    }
    applyPage();
    if (location.pathname === '/' && homepageLocale !== language) {
      homepageLocale = language;
      void refreshHomepage();
    }
    document.querySelectorAll('header a[href="/"],footer a[href="/"]').forEach(a => {
      if (a.querySelector('svg') && !a.dataset.rdLogo) {
        a.dataset.rdLogo = 'true';
        a.setAttribute('aria-label', 'Relyon Dev — home');
        a.insertAdjacentHTML('beforeend', a.closest('footer') ? logo.replace('logo-v2.svg','logo-primary.svg') : logo);
      }
    });
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => {
      if (link.getAttribute('href') !== '/brand/favicon.svg') {
        link.href = '/brand/favicon.svg';
        link.type = 'image/svg+xml';
        link.removeAttribute('sizes');
      }
    });
    if (document.title.includes('Relyon Developer')) document.title = document.title.replaceAll('Relyon Developer','Relyon Dev');
    if (location.pathname === '/') {
      const heading = document.querySelector('h1');
      if (heading) {
        const words = {'Crafted':'Build','Websites':'Digital','Lasting':'Solutions','Impressions':'Together'};
        const walk = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        while(walk.nextNode()) {
          const node = walk.currentNode;
          const key = node.textContent.trim();
          if (words[key]) node.textContent = node.textContent.replace(key,words[key]);
        }
      }
    }
    applyHomepage();
    applyProjectTitles();
    applyPostCards();
  }
  new MutationObserver(() => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(apply); }
  }).observe(document.documentElement, {childList:true,subtree:true});
  apply();
  void refreshProjectTitles();
  let refreshingContent = false;
  async function refreshPublishedContent() {
    if (previewMode || document.hidden || refreshingContent) return;
    refreshingContent = true;
    try {
      await Promise.allSettled([
        refreshProjectTitles(), refreshPostCards(),
        refreshHomepage(), refreshPage(location.pathname.replace(/\/$/, '') || '/')
      ]);
    } finally { refreshingContent = false; }
  }
  // Refresh content without reloading the page or interrupting forms and scrolling.
  window.addEventListener('focus', refreshPublishedContent);
  document.addEventListener('visibilitychange', refreshPublishedContent);
  setInterval(refreshPublishedContent, 15000);
})();
