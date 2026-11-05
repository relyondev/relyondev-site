'use client';

import { useNav, useTheme } from '@payloadcms/ui';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function OnSiteIconRail() {
  const {navOpen} = useNav();
  const [links,setLinks] = useState<{href:string,label:string,id:string}[]>([]);
  const pathname = usePathname();
  useEffect(() => {
    const items = [...document.querySelectorAll<HTMLElement>('.nav .nav__link[id]')].map(node => ({
      href:node.getAttribute('href') ?? (node.id.startsWith('nav-global-')
        ? '/admin/globals/' + node.id.slice(11) : '/admin/collections/' + node.id.slice(4)),
      label:node.textContent?.trim() ?? '',id:node.id
    }));
    setLinks(items);
  },[pathname,navOpen]);
  if (navOpen || !links.length) return null;
  return createPortal(<nav className="onsite-icon-rail" aria-label="Compact navigation">
    <a href="/admin" title="Overview" aria-label="Overview" aria-current={pathname === '/admin' ? 'page' : undefined}>⊞</a>
    {links.map(item => <a key={item.id} href={item.href} title={item.label} aria-label={item.label}
      data-nav={item.id} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}><span aria-hidden="true">◇</span></a>)}
    <OnSiteThemeToggle/>
  </nav>,document.body);
}

export function OnSiteSidebarBrand() {
  const pathname = usePathname();
  const {navOpen} = useNav();
  return <div className="onsite-sidebar-brand">
    <span className="onsite-brand"><img src="/onsite.svg" width="34" height="34" alt=""/>On Site</span>
    <a className="nav__link onsite-overview-link" href="/admin" tabIndex={navOpen ? 0 : -1}
      aria-current={pathname === '/admin' ? 'page' : undefined}>
      <span className="nav__link-label">Overview</span>
    </a>
  </div>;
}

export function OnSiteThemeToggle() {
  const {theme,setTheme} = useTheme();
  const {navOpen} = useNav();
  const dark = theme === 'dark';
  return <button className="onsite-theme-toggle" type="button" role="switch"
    aria-label="Dark mode" aria-checked={dark}
    onClick={() => setTheme(dark ? 'light' : 'dark')}>
    <span className="onsite-theme-icon" aria-hidden="true">
      {dark ? <svg viewBox="0 0 24 24"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>
        : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>}
    </span>
    <span>{dark ? 'Dark mode' : 'Light mode'}</span>
    <span className="onsite-theme-track" aria-hidden="true"><span/></span>
  </button>;
}
