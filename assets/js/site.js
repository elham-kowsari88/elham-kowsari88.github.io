/* ================================================================
   Site Engine — Client-Side Markdown Renderer
   Loads .md files from /content/, parses YAML frontmatter,
   renders to HTML sections using marked.js
   ================================================================ */

(function () {
  'use strict';

  // ============================================================
  // YAML Frontmatter Parser (lightweight, no dependency)
  // ============================================================
  function parseFrontmatter(text) {
    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return { meta: {}, content: text };

    const yamlStr = match[1];
    const content = match[2];
    const meta = {};

    let currentKey = null;
    let currentList = null;
    let currentObj = null;

    yamlStr.split('\n').forEach(line => {
      // Continuation key-value in a list object (e.g., "    url: https://...")
      // This is a key-value pair indented MORE than the list dash but without a dash
      const contMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/);
      if (contMatch && currentObj !== null && currentList !== null) {
        const key = contMatch[1];
        const val = contMatch[2].replace(/^["']|["']$/g, '').trim();
        currentObj[key] = val;
        return;
      }

      // List item with key-value (e.g., "  - label: Google Scholar")
      const listObjMatch = line.match(/^\s{2,}-\s+(\w+):\s*(.*)$/);
      if (listObjMatch && currentList !== null) {
        const key = listObjMatch[1];
        const val = listObjMatch[2].replace(/^["']|["']$/g, '').trim();
        // Always start new object on dash item
        if (currentObj) currentList.push(currentObj);
        currentObj = {};
        currentObj[key] = val;
        return;
      }

      // Simple list item (e.g., "  - item")
      const listItemMatch = line.match(/^\s{2,}-\s+(.+)$/);
      if (listItemMatch && currentList !== null) {
        if (currentObj) {
          currentList.push(currentObj);
          currentObj = null;
        }
        currentList.push(listItemMatch[1].replace(/^["']|["']$/g, ''));
        return;
      }

      // Top-level key-value pair
      const kvMatch = line.match(/^(\w[\w_]*):\s*(.*)$/);
      if (kvMatch) {
        // Save pending object
        if (currentObj && currentList !== null) {
          currentList.push(currentObj);
          currentObj = null;
        }

        const key = kvMatch[1];
        let val = kvMatch[2].trim();

        if (val === '' || val === '|') {
          // Start of a list or multiline
          meta[key] = [];
          currentKey = key;
          currentList = meta[key];
          currentObj = null;
          return;
        }

        // Remove quotes
        val = val.replace(/^["']|["']$/g, '');
        meta[key] = val;
        currentKey = key;
        currentList = null;
        currentObj = null;
      }
    });

    // Save last pending object
    if (currentObj && currentList !== null) {
      currentList.push(currentObj);
    }

    return { meta, content };
  }

  // ============================================================
  // Markdown Content Loader
  // ============================================================
  const contentFiles = [
    'hero',
    'about',
    'projects',
    'publications',
    'cv',
    'news',
    'contact'
  ];

  const sectionIds = {
    hero: 'home',
    about: 'about',
    projects: 'projects',
    publications: 'publications',
    cv: 'cv',
    news: 'news',
    contact: 'contact'
  };

  async function loadMarkdown(filename) {
    try {
      const response = await fetch(`content/${filename}.md?v=${Date.now()}`);
      if (!response.ok) throw new Error(`Failed to load ${filename}.md`);
      const text = await response.text();
      return parseFrontmatter(text);
    } catch (err) {
      console.warn(`Could not load content/${filename}.md:`, err.message);
      return null;
    }
  }

  // ============================================================
  // Section Renderers
  // ============================================================

  // SVG icons for social links
  const socialIcons = {
    scholar: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg>',
    researchgate: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.586 0c-.818 0-1.508.19-2.073.565-.563.377-.97.936-1.213 1.68a3.193 3.193 0 0 0-.112.437 8.365 8.365 0 0 0-.078.53 9 9 0 0 0-.05.727c-.01.282-.013.621-.013 1.016a31.121 31.121 0 0 0 .014 1.017 9 9 0 0 0 .05.727 7.946 7.946 0 0 0 .077.53h-.005a3.334 3.334 0 0 0 .113.438c.245.743.65 1.303 1.214 1.68.565.376 1.256.564 2.075.564.8 0 1.536-.213 2.105-.603.57-.39.94-.916 1.175-1.65.076-.235.135-.558.177-.93a10.9 10.9 0 0 0 .043-1.207v-.82h-3.5v1.3h2.05c0 .31-.014.574-.044.79a2.4 2.4 0 0 1-.154.59c-.123.29-.3.52-.528.69a1.38 1.38 0 0 1-.862.26c-.373 0-.68-.1-.928-.296a1.94 1.94 0 0 1-.59-.828 4.574 4.574 0 0 1-.28-.95 7.4 7.4 0 0 1-.106-.924 9.7 9.7 0 0 1-.027-1.186c0-.413.01-.784.027-1.186.016-.267.05-.536.106-.924.055-.387.143-.7.28-.95.136-.249.34-.46.59-.828.248-.197.555-.296.927-.296.348 0 .63.093.852.28.222.186.39.43.504.741.078.21.135.471.174.79h1.6c-.04-.458-.126-.865-.26-1.22-.243-.637-.597-1.13-1.065-1.48A2.96 2.96 0 0 0 19.586 0zM8.217 5.836c-1.69 0-3.036.086-4.297.086C2.612 5.922 1.5 6.273 1.5 8.25v1.5c0 1.977 1.112 2.328 2.42 2.328h4.297c1.69 0 2.783-.544 2.783-2.328V8.25c0-1.784-1.093-2.414-2.783-2.414z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>'
  };

  function renderHero(data) {
    if (!data) return '';
    const { meta, content } = data;
    const links = (meta.links || []).map(link => {
      const icon = socialIcons[link.icon] || '';
      return `<a class="social-pill" href="${link.url}" target="_blank" rel="noopener">${icon}<span>${link.label}</span></a>`;
    }).join('');

    const photoHtml = meta.photo
      ? `<img src="${meta.photo}" alt="${meta.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="placeholder" style="display:none">${meta.photo_placeholder || 'EK'}</div>`
      : `<div class="placeholder">${meta.photo_placeholder || 'EK'}</div>`;

    return `
      <section id="home" class="hero fade-in">
        <div class="hero-card">
          <div class="hero-inner">
            <div class="profile-photo">${photoHtml}</div>
            <div class="hero-text">
              <h1>${meta.name || ''}</h1>
              <div class="hero-tagline">${meta.title || ''}</div>
              <div class="hero-meta">
                <span>${meta.position || ''}</span>
                <span class="separator"></span>
                <span>${meta.affiliation || ''}</span>
                <span class="separator"></span>
                <span>${meta.location || ''}</span>
              </div>
              <div class="hero-about">${marked.parse(content)}</div>
              <div class="social-links">${links}</div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderSection(data, id, sectionClass) {
    if (!data) return '';
    const { meta, content } = data;
    const html = marked.parse(content);

    let extra = '';

    // CV download button
    if (id === 'cv' && meta.cv_download) {
      extra = `<a class="cv-download" href="${meta.cv_download}" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download CV (PDF)
      </a>`;
    }

    // Scholar link for publications
    if (id === 'publications' && meta.scholar_url) {
      extra += `<div style="margin-top:var(--space-6)">
        <a class="cv-download" href="${meta.scholar_url}" target="_blank" rel="noopener">
          View Full Record on Google Scholar
        </a>
      </div>`;
    }

    return `
      <section id="${id}" class="section fade-in ${sectionClass || ''}">
        <div class="section-header">
          <h2>${meta.title || ''}</h2>
          ${meta.subtitle ? `<p class="section-subtitle">${meta.subtitle}</p>` : ''}
        </div>
        ${extra}
        <div class="section-content md-content">${html}</div>
      </section>`;
  }

  // ============================================================
  // Post-process: Enhance rendered HTML
  // ============================================================
  function postProcess() {
    // 1. Wrap images in figure cards
    document.querySelectorAll('.md-content img').forEach(img => {
      // Skip if already wrapped
      if (img.closest('.figure-card')) return;

      const figure = document.createElement('figure');
      figure.className = 'figure-card';

      const link = document.createElement('a');
      link.href = img.src;
      link.target = '_blank';
      link.rel = 'noopener';

      const caption = document.createElement('figcaption');
      caption.textContent = img.alt || '';

      link.appendChild(img.cloneNode());
      figure.appendChild(link);
      if (img.alt) figure.appendChild(caption);

      img.replaceWith(figure);
    });

    // 2. Group consecutive figure-cards into grids
    document.querySelectorAll('.md-content').forEach(container => {
      const figures = container.querySelectorAll('figure.figure-card');
      let currentGrid = null;
      let prevElement = null;

      figures.forEach(fig => {
        const parent = fig.parentElement;
        // Check if the figure's parent paragraph has only this figure
        const inP = parent.tagName === 'P';
        const target = inP ? parent : fig;

        if (prevElement && target.previousElementSibling === prevElement) {
          // Consecutive figures — add to existing grid
          if (!currentGrid) {
            currentGrid = document.createElement('div');
            currentGrid.className = 'figure-grid';
            target.parentElement.insertBefore(currentGrid, target);
            // Move previous figure into grid
            if (prevElement.classList.contains('figure-card')) {
              currentGrid.appendChild(prevElement);
            } else if (prevElement.querySelector('.figure-card')) {
              currentGrid.appendChild(prevElement.querySelector('.figure-card'));
              prevElement.remove();
            }
          }
          currentGrid.appendChild(inP ? fig : fig);
          if (inP && parent.childNodes.length === 0) parent.remove();
        } else {
          currentGrid = null;
        }
        prevElement = currentGrid || target;
      });
    });

    // 3. Handle custom video directive: ::video[src]{title="..."}
    document.querySelectorAll('.md-content p').forEach(p => {
      const videoMatch = p.textContent.match(/^::video\[(.+?)\](?:\{title="(.+?)"\})?$/);
      if (videoMatch) {
        const src = videoMatch[1];
        const title = videoMatch[2] || '';
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        wrapper.innerHTML = `
          ${title ? `<div class="video-title">${title}</div>` : ''}
          <video controls preload="metadata">
            <source src="${src}" type="video/mp4">
            Your browser does not support the video tag.
          </video>`;
        p.replaceWith(wrapper);
      }
    });

    // 4. Highlight own name in publications
    document.querySelectorAll('#publications .md-content em').forEach(em => {
      if (em.textContent.includes('E. Kowsari') || em.textContent.includes('Kowsari')) {
        em.classList.add('self-author');
        em.style.color = 'var(--accent)';
        em.style.fontWeight = '600';
        em.style.fontStyle = 'normal';
      }
    });

    // 5. Style publication tags (backtick code elements)
    document.querySelectorAll('#publications .md-content code').forEach(code => {
      const text = code.textContent.trim().toLowerCase();
      code.classList.add('pub-tag');
      if (text === 'journal') code.classList.add('journal');
      else if (text === 'conference') code.classList.add('conference');
      else if (text === 'under-review') code.classList.add('under-review');
      // Remove the backtick styling
      code.style.fontFamily = 'var(--font-sans)';
      code.style.background = 'none';
      code.style.padding = '2px 10px';
    });

    // 6. Style project cards
    document.querySelectorAll('#projects .md-content > h2').forEach(h2 => {
      // Wrap from this h2 to the next h2 or hr in a card
      const card = document.createElement('div');
      card.className = 'card';
      h2.parentElement.insertBefore(card, h2);

      let sibling = h2;
      while (sibling && sibling.tagName !== 'HR') {
        const next = sibling.nextElementSibling;
        card.appendChild(sibling);
        sibling = next;
        if (sibling && sibling.tagName === 'H2') break;
      }
    });

    // Remove leftover <hr> in projects
    document.querySelectorAll('#projects .md-content > hr').forEach(hr => hr.remove());

    // 7. Style contact section
    const contactSection = document.querySelector('#contact .md-content');
    if (contactSection) {
      const items = contactSection.querySelectorAll('li');
      if (items.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'contact-grid';

        items.forEach(li => {
          const html = li.innerHTML;
          // Split only on the FIRST colon that's outside an HTML tag/attribute
          // Use the first <strong> or <b> text as label, rest as value
          const strongMatch = html.match(/^<strong>(.*?)<\/strong>:?\s*([\s\S]*)$/i);
          let label = '', value = '';
          if (strongMatch) {
            label = strongMatch[1].replace(/<[^>]+>/g, '');
            value = strongMatch[2];
          } else {
            // Fallback: split on first colon only, but not inside URLs
            const colonIdx = html.search(/:\s/);
            if (colonIdx > 0) {
              label = html.substring(0, colonIdx).replace(/<[^>]+>/g, '');
              value = html.substring(colonIdx + 1).trim();
            } else {
              value = html;
            }
          }

          const card = document.createElement('div');
          card.className = 'contact-card';
          card.innerHTML = `
            <div class="label">${label}</div>
            <div class="value">${value}</div>`;
          grid.appendChild(card);
        });

        // Find the UL containing these items and replace it
        const ul = items[0].parentElement;
        ul.replaceWith(grid);
      }
    }

    // 8. Animate elements on scroll
    initScrollAnimations();
  }

  // ============================================================
  // Scroll Animations
  // ============================================================
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  }

  // ============================================================
  // Theme Toggle
  // ============================================================
  function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleIcon(theme);

    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateToggleIcon(next);
    });
  }

  function updateToggleIcon(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }

  // ============================================================
  // Mobile Navigation
  // ============================================================
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      const isOpen = links.classList.contains('open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close on link click
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ============================================================
  // Active Nav Link Tracking
  // ============================================================
  function initActiveTracking() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { threshold: 0.2, rootMargin: '-80px 0px -50% 0px' });

    sections.forEach(section => observer.observe(section));
  }

  // ============================================================
  // Main Init
  // ============================================================
  async function init() {
    // Configure marked
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });

    // Load all content in parallel
    const results = await Promise.all(
      contentFiles.map(f => loadMarkdown(f))
    );

    const [hero, about, projects, publications, cv, news, contact] = results;

    // Render into main content area
    const main = document.getElementById('main-content');
    if (!main) return;

    main.innerHTML = [
      renderHero(hero),
      renderSection(about, 'about'),
      renderSection(projects, 'projects'),
      renderSection(publications, 'publications'),
      renderSection(cv, 'cv'),
      renderSection(news, 'news'),
      renderSection(contact, 'contact')
    ].join('');

    // Post-process rendered HTML
    postProcess();

    // Init interactive features
    initThemeToggle();
    initMobileNav();
    initActiveTracking();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
