(() => {
  const applied = new WeakMap();
  let state = {};
  let path;
  let liveSettings;
  let liveTemplate;
  const local = value => typeof value === 'string' && /^\/(?![\/\\])[^\\\s]*$/.test(value);
  const asset = media => media?.filename ? '/content/media/' + encodeURIComponent(media.filename)
    : /^\d+$/.test(String(media)) ? '/content/preview-image/' + media : null;
  const settings = () => liveSettings ?? state.settings;

  function element(tag,text,className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function link(item,className) {
    if (!item?.label || !local(item.href)) return null;
    const node = element('a',item.label,className);
    node.href = item.href;
    return node;
  }
  function once(node, value, update) {
    if (!node) return;
    const key = JSON.stringify(value);
    if (applied.get(node) === key) return;
    applied.set(node,key);
    update(node);
  }
  function setText(node,value) {
    if (node && value && node.textContent !== value) node.textContent = value;
  }
  function applySettings() {
    const data = settings();
    if (!data) return;
    const {design,header,footer} = data;
    const root = document.documentElement.style;
    for (const [key,property] of Object.entries({
      primary:'--rd-builder-primary',accent:'--rd-builder-accent',
      darkBackground:'--rd-builder-dark',lightBackground:'--rd-builder-light'
    })) {
      const color = design?.[key];
      if (/^#[0-9a-f]{6}$/i.test(color ?? '')) root.setProperty(property,color);
      else root.removeProperty(property);
    }
    const fonts = {Poppins:'Poppins, sans-serif',System:'system-ui, sans-serif',Georgia:'Georgia, serif'};
    if (Object.hasOwn(fonts,design?.font)) root.setProperty('--rd-builder-font',fonts[design.font]);
    else root.removeProperty('--rd-builder-font');
    if (typeof design?.radius === 'number' && design.radius >= 0 && design.radius <= 60) {
      root.setProperty('--rd-builder-radius',design.radius + 'px');
    } else root.removeProperty('--rd-builder-radius');
    const nav = document.querySelector('header.fixed');
    if (nav && header) {
      const logo = nav.querySelector('img.rd-logo-official');
      if (logo) {
        for (const [mode,key] of [['light','lightLogo'],['dark','darkLogo']]) {
          const url = asset(header[key]);
          if (url) logo.style.setProperty('--rd-builder-logo-' + mode,'url("' + url + '")');
          else logo.style.removeProperty('--rd-builder-logo-' + mode);
        }
      }
      for (const menu of document.querySelectorAll('nav[aria-label="Primary"],nav[aria-label="Mobile"]')) {
        if (!header.navigation?.length) continue;
        once(menu,header.navigation,node => {
          const className = node.querySelector('a')?.className;
          const items = header.navigation.map(item => link(item,className)).filter(Boolean);
          if (items.length) node.replaceChildren(...items);
        });
      }
      for (const action of nav.querySelectorAll('a[href="/contact"],a[data-rd-builder-action]')) {
        if (!header.actionLabel && !local(header.actionHref)) continue;
        once(action,[header.actionLabel,header.actionHref],node => {
          node.dataset.rdBuilderAction = '';
          if (header.actionLabel) {
            const walker = document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (walker.currentNode.textContent.trim()) {
                walker.currentNode.textContent = header.actionLabel;
                break;
              }
            }
          }
          if (local(header.actionHref)) node.href = header.actionHref;
        });
      }
    }
    const end = document.querySelector('footer');
    if (end && footer) {
      setText(end.querySelector('h2'),footer.heading);
      if (footer.copyright) {
        const walker = document.createTreeWalker(end,NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode.textContent.trim().startsWith('©')) {
            if (walker.currentNode.textContent !== footer.copyright) walker.currentNode.textContent = footer.copyright;
            break;
          }
        }
      }
      const column = end.querySelector('h3')?.parentElement;
      if (footer.columns?.length && column) {
        once(column.parentElement,footer.columns,node => {
          const headingClass = column.querySelector('h3')?.className;
          const listClass = column.querySelector('ul')?.className;
          const linkClass = column.querySelector('a')?.className;
          node.replaceChildren(...footer.columns.map(item => {
            const box = element('div',null,column.className);
            const list = element('ul',null,listClass);
            for (const entry of item.links ?? []) {
              const anchor = link(entry,linkClass);
              if (anchor) { const row = element('li'); row.append(anchor); list.append(row); }
            }
            box.append(element('h3',item.heading,headingClass),list);
            return box;
          }));
        });
      }
    }
  }

  function renderTemplate() {
    const template = liveTemplate ?? state.template;
    const current = document.querySelector('[data-rd-builder-sections]');
    const sections = template?.sections?.map(row => row.section).filter(section => section && typeof section === 'object');
    if (!sections?.length) { current?.remove(); return; }
    const container = current ?? element('div');
    container.dataset.rdBuilderSections = '';
    once(container,sections,node => node.replaceChildren(...sections.map(item => {
      const section = element('section',null,'rd-builder-section');
      section.dataset.spacing = item.spacing ?? 'normal';
      section.style.textAlign = ['left','right','center'].includes(item.alignment) ? item.alignment : 'left';
      if (item.heading) section.append(element('h2',item.heading));
      if (item.body) section.append(element('p',item.body));
      const src = asset(item.image);
      if (src) {
        const img = element('img');
        img.src = src;
        img.alt = item.image?.alt ?? '';
        img.loading = 'lazy';
        section.append(img);
      }
      if (item.kind === 'faq') for (const row of item.questions ?? []) {
        const details = element('details');
        details.append(element('summary',row.question),element('p',row.answer));
        section.append(details);
      }
      const action = link({label:item.actionLabel,href:item.actionHref},'rd-builder-button');
      if (action) section.append(action);
      return section;
    })));
    if (!container.isConnected) {
      const footer = document.querySelector('footer');
      if (footer) footer.before(container);
      else document.body.append(container);
    }
  }

  async function load() {
    const next = location.pathname.replace(/\/$/,'') || '/';
    if (path === next) return;
    path = next;
    state = {};
    try {
      const response = await fetch('/content/site-builder?path=' + encodeURIComponent(next),{cache:'no-store'});
      if (!response.ok || next !== path) return;
      state = await response.json();
      applySettings();
      renderTemplate();
    } catch { /* The original design is the offline fallback. */ }
  }
  let previewRevision = 0;
  document.addEventListener('relyon-builder-preview',async event => {
    const {globalSlug,collectionSlug,data} = event.detail;
    if (globalSlug === 'site-builder') {
      liveSettings = data;
      applySettings();
    } else if (collectionSlug === 'page-templates') {
      const revision = ++previewRevision;
      const sections = await Promise.all((data.sections ?? []).map(async row => {
        if (row.section && typeof row.section === 'object' && row.section.kind) return row;
        const id = row.section?.id ?? row.section;
        if (!/^\d+$/.test(String(id))) return {};
        try {
          const result = await fetch('/content/builder-section/' + id);
          return result.ok ? {section:await result.json()} : {};
        } catch { return {}; }
      }));
      if (revision !== previewRevision) return;
      liveTemplate = {...data,sections};
      renderTemplate();
    }
  });
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      void load();
      applySettings();
      renderTemplate();
    });
  }).observe(document.body,{childList:true,subtree:true});
  void load();
})();
