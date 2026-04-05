/**
 * DevPod Unified Theme System
 * Single source of truth for all pages. Vanilla JS, zero deps.
 */
window.DevpodTheme = (function () {
  'use strict';
  var SK = 'devpod-theme', CK = 'devpod-scheme';

  var K = [
    '--dp-bg','--dp-bg-secondary','--dp-bg-tertiary','--dp-bg-hover','--dp-bg-active',
    '--dp-border','--dp-border-subtle',
    '--dp-text','--dp-text-secondary','--dp-text-tertiary',
    '--dp-accent','--dp-accent-hover',
    '--dp-success','--dp-error','--dp-warning','--dp-info',
    '--dp-gutter-bg','--dp-gutter-text',
    '--dp-diff-add-bg','--dp-diff-add-gutter','--dp-diff-del-bg','--dp-diff-del-gutter',
    '--dp-diff-hunk-bg','--dp-diff-hunk-text',
    '--dp-syntax-keyword','--dp-syntax-string','--dp-syntax-comment','--dp-syntax-function','--dp-syntax-number',
    '--dp-statusbar','--dp-statusbar-text','--dp-monaco-theme'
  ];

  var S = {
    default: {
      label:'Default', accent:'#e5e5e5',
      d:['#0a0a0a','#111111','#171717','#1c1c1c','#222222','#262626','#1a1a1a','#e5e5e5','#a3a3a3','#525252','#ffffff','#e5e5e5','#22c55e','#ef4444','#f59e0b','#a3a3a3','#0e0e0e','#3a3a3a','#0a2010','#0f3018','#200a0a','#3a1010','#0d1018','#a3a3a3','#e5e5e5','#86efac','#525252','#e5e5e5','#fca5a5','#171717','#e5e5e5','vs-dark'],
      l:['#ffffff','#fafafa','#f5f5f5','#eeeeee','#e5e5e5','#d4d4d4','#e5e5e5','#0a0a0a','#525252','#a3a3a3','#0a0a0a','#171717','#16a34a','#dc2626','#d97706','#525252','#fafafa','#a3a3a3','#f0fdf4','#dcfce7','#fef2f2','#fecaca','#f5f5f5','#525252','#0a0a0a','#16a34a','#9ca3af','#525252','#ea580c','#0a0a0a','#ffffff','light']
    },
    github: {
      label:'GitHub', accent:'#58a6ff',
      d:['#0d1117','#161b22','#1c2128','#1c2128','#282e33','#30363d','#21262d','#e6edf3','#8b949e','#484f58','#58a6ff','#79c0ff','#3fb950','#f85149','#d29922','#58a6ff','#0d1117','#3b4252','#12261e','#1a4028','#2d1215','#421c1f','#121d2f','#79c0ff','#ff7b72','#a5d6ff','#8b949e','#d2a8ff','#79c0ff','#1f6feb','#fff','vs-dark'],
      l:['#fff','#f6f8fa','#eaeef2','#eaeef2','#d0d7de','#d0d7de','#e1e4e8','#1f2328','#656d76','#8c959f','#0969da','#0550ae','#1a7f37','#cf222e','#9a6700','#0969da','#f6f8fa','#8c959f','#dafbe1','#aceebb','#ffebe9','#ffcecb','#ddf4ff','#0969da','#cf222e','#0a3069','#8c959f','#8250df','#0550ae','#0969da','#fff','light']
    },
    retro: {
      label:'Playful', accent:'#c084fc', structural:true,
      d:['#ffdf6b','#ffffff','#fff8dc','#fff3b0','#fde68a','#000000','#000000','#000000','#333333','#555555','#c084fc','#a855f7','#4ade80','#f43f5e','#f97316','#22d3ee','#ffffff','#555555','#d9f99d','#bef264','#fce7f3','#fbcfe8','#fef9c3','#2563eb','#2563eb','#f43f5e','#555555','#000000','#4ade80','#c084fc','#000000','light'],
      l:['#ffdf6b','#ffffff','#fff8dc','#fff3b0','#fde68a','#000000','#000000','#000000','#333333','#555555','#c084fc','#a855f7','#4ade80','#f43f5e','#f97316','#22d3ee','#ffffff','#555555','#d9f99d','#bef264','#fce7f3','#fbcfe8','#fef9c3','#2563eb','#2563eb','#f43f5e','#555555','#000000','#4ade80','#c084fc','#000000','light']
    },
    midnight: {
      label:'Midnight', accent:'#22d3ee',
      d:['#0f172a','#131c33','#1a2540','#1e2d4d','#243555','#1e3a5f','#172e4a','#e2e8f0','#94a3b8','#475569','#22d3ee','#67e8f9','#34d399','#fb7185','#fbbf24','#60a5fa','#0f172a','#334155','#0d2818','#134028','#2a0f18','#401525','#0c1a30','#22d3ee','#c084fc','#86efac','#475569','#67e8f9','#fda4af','#0e7490','#fff','vs-dark'],
      l:['#f0f9ff','#e0f2fe','#d1ecfc','#c5e7fa','#b0ddf7','#93c5e8','#b6d9f2','#0c4a6e','#1e6b94','#6b9dbb','#0d9488','#0f766e','#16a34a','#dc2626','#d97706','#0284c7','#e0f2fe','#6b9dbb','#dcfce7','#bbf7d0','#fef2f2','#fecaca','#e0f4ff','#0d9488','#7c3aed','#0f766e','#6b9dbb','#0284c7','#b45309','#0f766e','#fff','light']
    },
    rose: {
      label:'Rosé Pine', accent:'#eb6f92',
      d:['#191724','#1f1d2e','#26233a','#2a2740','#312e48','#2a2740','#211f30','#e0def4','#908caa','#6e6a86','#eb6f92','#f4a0b5','#31748f','#eb6f92','#f6c177','#9ccfd8','#191724','#44405a','#14242e','#1a3440','#2e1420','#401a2a','#1c1830','#c4a7e7','#c4a7e7','#f6c177','#6e6a86','#eb6f92','#9ccfd8','#eb6f92','#fff','vs-dark'],
      l:['#faf4ed','#f2e9e1','#eaddd3','#e2d5c8','#d7ccc0','#d4c8bc','#e0d5c8','#286983','#575279','#9893a5','#d7827e','#c5645f','#56949f','#b4637a','#ea9d34','#56949f','#f2e9e1','#9893a5','#e4f0e8','#c9e4d0','#f5e0e4','#f0c8d0','#f0e8e0','#907aa9','#907aa9','#ea9d34','#9893a5','#d7827e','#56949f','#d7827e','#191724','light']
    }
  };

  var schemeKeys = ['default','github','retro','midnight','rose'];
  var curMode = 'dark', curScheme = 'default', mqDark = null, pickerIds = [];

  // SVG icons — no emojis
  var icons = {
    sun: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>',
    moon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8.5a5.5 5.5 0 0 1-7-7A5.5 5.5 0 1 0 13.5 8.5z"/></svg>',
    monitor: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="14" height="9" rx="1.5"/><path d="M5.5 14h5M8 11v3"/></svg>',
    chevron: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4l2 2 2-2"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l3 3 5-5"/></svg>',
    palette: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="4.5" r="1" fill="currentColor"/><circle cx="5" cy="7" r="1" fill="currentColor"/><circle cx="11" cy="7" r="1" fill="currentColor"/><circle cx="6.5" cy="10.5" r="1" fill="currentColor"/></svg>'
  };

  function resolved() {
    if (curMode === 'system') return (mqDark && mqDark.matches) ? 'dark' : 'light';
    return curMode;
  }

  function apply() {
    var v = resolved(), sc = S[curScheme], vals = v === 'dark' ? sc.d : sc.l;
    var r = document.documentElement;
    for (var i = 0; i < K.length; i++) r.style.setProperty(K[i], vals[i]);
    r.setAttribute('data-dp-mode', v);
    r.setAttribute('data-dp-scheme', curScheme);

    // Neo-Brutalist structural overrides for Playful theme
    if (sc.structural) {
      r.style.setProperty('--dp-border-width', '3px');
      r.style.setProperty('--dp-radius', '8px');
      r.style.setProperty('--dp-radius-lg', '16px');
      r.style.setProperty('--dp-shadow', '4px 4px 0px #000000');
      r.style.setProperty('--dp-shadow-hover', '8px 8px 0px #000000');
      r.style.setProperty('--dp-shadow-active', '0px 0px 0px #000000');
      r.style.setProperty('--dp-font-weight-heading', '800');
      r.style.setProperty('--dp-letter-spacing', '-0.04em');
      r.style.setProperty('--dp-padding-panel', '32px');
      r.setAttribute('data-dp-structural', 'brutalist');
    } else {
      r.style.setProperty('--dp-border-width', '1px');
      r.style.setProperty('--dp-radius', '4px');
      r.style.setProperty('--dp-radius-lg', '8px');
      r.style.setProperty('--dp-shadow', 'none');
      r.style.setProperty('--dp-shadow-hover', 'none');
      r.style.setProperty('--dp-shadow-active', 'none');
      r.style.setProperty('--dp-font-weight-heading', '700');
      r.style.setProperty('--dp-letter-spacing', '-0.02em');
      r.style.setProperty('--dp-padding-panel', '24px');
      r.removeAttribute('data-dp-structural');
    }

    try { window.dispatchEvent(new CustomEvent('devpod-theme-change', { detail: { mode: curMode, scheme: curScheme, resolved: v } })); } catch(e){}
    for (var p = 0; p < pickerIds.length; p++) refreshPicker(pickerIds[p]);
  }

  function save() { try { localStorage.setItem(SK, curMode); localStorage.setItem(CK, curScheme); } catch(e){} }
  function load() { try { var m = localStorage.getItem(SK), s = localStorage.getItem(CK); if (m==='light'||m==='dark'||m==='system') curMode=m; if (s&&S[s]) curScheme=s; } catch(e){} }
  function setMode(m) { if(m!=='light'&&m!=='dark'&&m!=='system') return; curMode=m; save(); apply(); }
  function setScheme(s) { if(!S[s]) return; curScheme=s; save(); apply(); }
  function getMode() { return curMode; }
  function getScheme() { return curScheme; }

  function setupSys() {
    if (!window.matchMedia) return;
    mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    var h = function(){ if(curMode==='system') apply(); };
    mqDark.addEventListener ? mqDark.addEventListener('change',h) : mqDark.addListener(h);
  }

  function refreshPicker(id) {
    var c = document.getElementById(id); if(!c) return;
    // Mode buttons
    var mb = c.querySelectorAll('[data-m]');
    for(var i=0;i<mb.length;i++){
      var b=mb[i], a=b.getAttribute('data-m')===curMode;
      b.style.background = a ? 'var(--dp-accent)' : 'transparent';
      b.style.color = a ? 'var(--dp-statusbar-text)' : 'var(--dp-text-tertiary)';
    }
    // Scheme label
    var label = c.querySelector('[data-scheme-label]');
    if (label) label.textContent = S[curScheme].label;
    // Dropdown items
    var items = c.querySelectorAll('[data-s]');
    for(var j=0;j<items.length;j++){
      var it=items[j], k=it.getAttribute('data-s'), active=k===curScheme;
      var chk = it.querySelector('.dp-check');
      if(chk) chk.style.opacity = active ? '1' : '0';
      it.style.background = active ? 'var(--dp-bg-active)' : 'transparent';
    }
  }

  // ── Picker UI ──
  // A compact control: [mode toggle] [scheme dropdown]

  function mountPicker(id) {
    pickerIds.push(id);
    var c = document.getElementById(id); if(!c) return;

    var h = '';
    // Container
    h += '<div style="display:flex;align-items:center;gap:6px;position:relative;">';

    // Mode toggle — 3 small icon buttons in a pill
    h += '<div style="display:flex;border:1px solid var(--dp-border);border-radius:6px;overflow:hidden;">';
    var modes = [['light',icons.sun,'Light'],['dark',icons.moon,'Dark'],['system',icons.monitor,'Auto']];
    for(var i=0;i<3;i++) {
      h += '<button data-m="'+modes[i][0]+'" title="'+modes[i][2]+'" style="border:none;padding:5px 7px;cursor:pointer;display:flex;align-items:center;transition:all .15s;background:transparent;color:var(--dp-text-tertiary);line-height:0;'+(i<2?'border-right:1px solid var(--dp-border);':'')+'">'+modes[i][1]+'</button>';
    }
    h += '</div>';

    // Scheme dropdown — button that opens a menu
    h += '<div style="position:relative;" class="dp-scheme-wrap">';
    h += '<button class="dp-scheme-btn" style="display:flex;align-items:center;gap:5px;border:1px solid var(--dp-border);border-radius:6px;padding:4px 8px 4px 6px;cursor:pointer;background:transparent;color:var(--dp-text-secondary);font-family:inherit;font-size:11px;font-weight:500;line-height:1;transition:all .15s;">';
    h += '<span style="width:8px;height:8px;border-radius:50%;background:var(--dp-accent);flex-shrink:0;"></span>';
    h += '<span data-scheme-label>'+S[curScheme].label+'</span>';
    h += icons.chevron;
    h += '</button>';

    // Dropdown menu
    h += '<div class="dp-scheme-menu" style="display:none;position:absolute;top:calc(100% + 4px);right:0;min-width:160px;background:var(--dp-bg-secondary);border:1px solid var(--dp-border);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:999;">';
    for(var j=0;j<schemeKeys.length;j++){
      var k=schemeKeys[j], sc=S[k];
      h += '<button data-s="'+k+'" style="display:flex;align-items:center;gap:8px;width:100%;border:none;border-radius:4px;padding:6px 8px;cursor:pointer;background:transparent;color:var(--dp-text);font-family:inherit;font-size:12px;text-align:left;transition:background .1s;" onmouseenter="this.style.background=\'var(--dp-bg-hover)\'" onmouseleave="this.style.background=this.getAttribute(\'data-s\')===DevpodTheme.getScheme()?\'var(--dp-bg-active)\':\'transparent\'">';
      h += '<span style="width:10px;height:10px;border-radius:50%;background:'+sc.accent+';flex-shrink:0;"></span>';
      h += '<span style="flex:1;">'+sc.label+'</span>';
      h += '<span class="dp-check" style="opacity:0;color:var(--dp-accent);">'+icons.check+'</span>';
      h += '</button>';
    }
    h += '</div></div></div>';

    c.innerHTML = h;

    // Mode click handlers
    var mb=c.querySelectorAll('[data-m]');
    for(var mi=0;mi<mb.length;mi++) mb[mi].addEventListener('click',function(){setMode(this.getAttribute('data-m'));});

    // Scheme click handlers
    var sb=c.querySelectorAll('[data-s]');
    for(var si=0;si<sb.length;si++) sb[si].addEventListener('click',function(){setScheme(this.getAttribute('data-s'));closeMenus();});

    // Dropdown toggle
    var btn = c.querySelector('.dp-scheme-btn');
    var menu = c.querySelector('.dp-scheme-menu');
    if (btn && menu) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var open = menu.style.display !== 'none';
        closeMenus();
        if (!open) menu.style.display = 'block';
      });
    }

    refreshPicker(id);
  }

  function closeMenus() {
    var menus = document.querySelectorAll('.dp-scheme-menu');
    for (var i = 0; i < menus.length; i++) menus[i].style.display = 'none';
  }

  // Close dropdown on outside click
  document.addEventListener('click', closeMenus);

  function init() { setupSys(); load(); apply(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();

  return { init:init, setMode:setMode, setScheme:setScheme, getMode:getMode, getScheme:getScheme, mountPicker:mountPicker, schemes:S, schemeKeys:schemeKeys };
})();
