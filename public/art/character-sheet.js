/* Presentation only: retain the original nodes, values and event handlers. */
(() => {
  'use strict';
  function arrange(sheet) {
    if (sheet.dataset.presentation === 'crew') return;
    const hero = sheet.querySelector(':scope > .char-sheet-hero');
    const stats = sheet.querySelector(':scope > .sheet-stats');
    if (!hero || !stats) return;
    sheet.dataset.presentation = 'crew';
    const profile = document.createElement('div');
    profile.className = 'sheet-profile';
    const details = document.createElement('div');
    details.className = 'sheet-profile-details';
    const children = [...sheet.children];
    const start = children.indexOf(hero), end = children.indexOf(stats);
    hero.before(profile);
    profile.append(hero, details);
    const previews = [...hero.querySelectorAll('.art-preview-button,.ultimate-preview-button')];
    if (previews.length) {
      const controls = document.createElement('nav');
      controls.className = 'sheet-preview-actions';
      controls.setAttribute('aria-label', 'Animaciones del personaje');
      controls.append(...previews);
      hero.append(controls);
    }
    for (const node of children.slice(start + 1, end + 1)) details.append(node);
    const statsTitle = document.createElement('h3');
    statsTitle.className = 'sheet-stats-title';
    statsTitle.textContent = 'Características';
    stats.before(statsTitle);
    // Keep the existing EVA/CRIT explanation with the statistics.
    const note = children[end + 1];
    if (note?.classList.contains('sheet-line')) {
      note.classList.add('sheet-stats-note');
      details.append(note);
    }
    const sections = [...sheet.querySelectorAll(':scope > .sheet-section')];
    if (sections.length) {
      const abilities = document.createElement('div');
      abilities.className = 'sheet-abilities';
      sections[0].before(abilities);
      for (const section of sections) {
        if (section.querySelector('.sheet-move')) section.classList.add('sheet-attacks');
        abilities.append(section);
      }
    }
    sheet.querySelector(':scope > .actions')?.classList.add('sheet-footer');
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches('.char-sheet')) arrange(root);
    root.querySelectorAll('.char-sheet').forEach(arrange);
  }
  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
  }).observe(document.body, {childList:true, subtree:true});
})();
