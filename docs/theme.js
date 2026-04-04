/**
 * DevPod Unified Theme System — single source of truth.
 * Vanilla JS, zero deps, applies CSS vars to :root, persists in localStorage.
 */
window.DevpodTheme = (function () {
  'use strict';
  var SK = 'devpod-theme', CK = 'devpod-scheme';

  // CSS variable names in order — keeps definitions compact
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

  // Scheme values as arrays matching K order. [dark, light]
  // Each scheme: { label, accent, d: [...dark values], l: [...light values] }
  var S = {
    linear: {
      label:'Linear', accent:'#818cf8',
      d:['#0a0a0b','#111113','#18181b','#1c1c1f','#27272a','#27272a','#1e1e22','#e4e4e7','#a1a1aa','#52525b','#818cf8','#a5b4fc','#34d399','#f87171','#fbbf24','#60a5fa','#0f0f11','#3f3f46','#052e16','#064e3b','#2c0b0e','#450a0a','#0c0a1e','#818cf8','#c084fc','#86efac','#52525b','#93c5fd','#fda4af','#818cf8','#fff','vs-dark'],
      l:['#fff','#f8f9fa','#f0f1f3','#edeef0','#e4e5e9','#e0e1e6','#ebebef','#1d1d1f','#6b6f76','#b0b3bb','#6366f1','#4f46e5','#16a34a','#dc2626','#d97706','#2563eb','#f8f9fa','#b0b3bb','#ecfdf5','#d1fae5','#fef2f2','#fecaca','#eff6ff','#2563eb','#7c3aed','#16a34a','#9ca3af','#2563eb','#ea580c','#6366f1','#fff','light']
    },
    github: {
      label:'GitHub', accent:'#58a6ff',
      d:['#0d1117','#161b22','#1c2128','#1c2128','#282e33','#30363d','#21262d','#e6edf3','#8b949e','#484f58','#58a6ff','#79c0ff','#3fb950','#f85149','#d29922','#58a6ff','#0d1117','#3b4252','#12261e','#1a4028','#2d1215','#421c1f','#121d2f','#79c0ff','#ff7b72','#a5d6ff','#8b949e','#d2a8ff','#79c0ff','#1f6feb','#fff','vs-dark'],
      l:['#fff','#f6f8fa','#eaeef2','#eaeef2','#d0d7de','#d0d7de','#e1e4e8','#1f2328','#656d76','#8c959f','#0969da','#0550ae','#1a7f37','#cf222e','#9a6700','#0969da','#f6f8fa','#8c959f','#dafbe1','#aceebb','#ffebe9','#ffcecb','#ddf4ff','#0969da','#cf222e','#0a3069','#8c959f','#8250df','#0550ae','#0969da','#fff','light']
    },
    retro: {
      label:'Retro Peppy', accent:'#fbbf24',
      d:['#1a1a0a','#22220e','#2a2a12','#302e14','#3a3818','#4a4820','#3a3818','#f5f0d0','#c8c090','#807850','#fbbf24','#fcd34d','#4ade80','#ec4899','#f97316','#38bdf8','#1e1e0c','#6b6530','#1a2e10','#264a18','#30101a','#4a1828','#2a2200','#fbbf24','#38bdf8','#ec4899','#807850','#fbbf24','#4ade80','#fbbf24','#1a1a0a','vs-dark'],
      l:['#fef9c3','#fef3a0','#fde68a','#fde274','#fcd34d','#e5b800','#f0d050','#1c1508','#5c4a10','#8a7520','#f97316','#ea580c','#16a34a','#db2777','#d97706','#0284c7','#fef3a0','#8a7520','#d9f99d','#bef264','#fce7f3','#fbcfe8','#fff7c2','#b45309','#7c3aed','#db2777','#8a7520','#b45309','#16a34a','#f97316','#1c1508','light']
    },
    midnight: {
      label:'Midnight', accent:'#22d3ee',
      d:['#0f172a','#131c33','#1a2540','#1e2d4d','#243555','#1e3a5f','#172e4a','#e2e8f0','#94a3b8','#475569','#22d3ee','#67e8f9','#34d399','#fb7185','#fbbf24','#60a5fa','#0f172a','#334155','#0d2818','#134028','#2a0f18','#401525','#0c1a30','#22d3ee','#c084fc','#86efac','#475569','#67e8f9','#fda4af','#0e7490','#fff','vs-dark'],
      l:['#f0f9ff','#e0f2fe','#d1ecfc','#c5e7fa','#b0ddf7','#93c5e8','#b6d9f2','#0c4a6e','#1e6b94','#6b9dbb','#0d9488','#0f766e','#16a34a','#dc2626','#d97706','#0284c7','#e0f2fe','#6b9dbb','#dcfce7','#bbf7d0','#fef2f2','#fecaca','#e0f4ff','#0d9488','#7c3aed','#0f766e','#6b9dbb','#0284c7','#b45309','#0f766e','#fff','light']
    },
    rose: {
      label:'Rose Pine', accent:'#eb6f92',
      d:['#191724','#1f1d2e','#26233a','#2a2740','#312e48','#2a2740','#211f30','#e0def4','#908caa','#6e6a86','#eb6f92','#f4a0b5','#31748f','#eb6f92','#f6c177','#9ccfd8','#191724','#44405a','#14242e','#1a3440','#2e1420','#401a2a','#1c1830','#c4a7e7','#c4a7e7','#f6c177','#6e6a86','#eb6f92','#9ccfd8','#eb6f92','#fff','vs-dark'],
      l:['#faf4ed','#f2e9e1','#eaddd3','#e2d5c8','#d7ccc0','#d4c8bc','#e0d5c8','#286983','#575279','#9893a5','#d7827e','#c5645f','#56949f','#b4637a','#ea9d34','#56949f','#f2e9e1','#9893a5','#e4f0e8','#c9e4d0','#f5e0e4','#f0c8d0','#f0e8e0','#907aa9','#907aa9','#ea9d34','#9893a5','#d7827e','#56949f','#d7827e','#191724','light']
    }
  };

  var schemeKeys = ['linear','github','retro','midnight','rose'];
  var curMode = 'dark', curScheme = 'linear', mqDark = null, pickerId = null;

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
    try { window.dispatchEvent(new CustomEvent('devpod-theme-change', { detail: { mode: curMode, scheme: curScheme, resolved: v } })); } catch(e){}
    refreshPicker();
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

  function refreshPicker() {
    if (!pickerId) return;
    var c = document.getElementById(pickerId); if(!c) return;
    var mb = c.querySelectorAll('[data-m]');
    for(var i=0;i<mb.length;i++){var b=mb[i],a=b.getAttribute('data-m')===curMode; b.style.background=a?'var(--dp-bg-active)':'transparent'; b.style.color=a?'var(--dp-text)':'var(--dp-text-tertiary)';}
    var sb = c.querySelectorAll('[data-s]');
    for(var j=0;j<sb.length;j++){var d=sb[j],k=d.getAttribute('data-s'); d.style.outline=(k===curScheme)?'2px solid var(--dp-accent)':'2px solid transparent'; d.style.outlineOffset='2px';}
  }

  function mountPicker(id) {
    pickerId = id;
    var c = document.getElementById(id); if(!c) return;
    var h = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;">';
    // Mode buttons
    h += '<div style="display:flex;gap:2px;background:var(--dp-bg-secondary);border:1px solid var(--dp-border);border-radius:6px;padding:2px;">';
    var modes = [['light','\u2600\uFE0F','Light'],['dark','\uD83C\uDF19','Dark'],['system','\uD83D\uDDA5\uFE0F','System']];
    for(var i=0;i<3;i++) h+='<button data-m="'+modes[i][0]+'" title="'+modes[i][2]+'" style="border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:13px;line-height:1;transition:all .15s;background:transparent;color:var(--dp-text-tertiary);">'+modes[i][1]+'</button>';
    h += '</div>';
    // Scheme buttons
    h += '<div style="display:flex;align-items:center;gap:4px;">';
    for(var j=0;j<schemeKeys.length;j++){var k=schemeKeys[j],sc=S[k]; h+='<button data-s="'+k+'" title="'+sc.label+'" style="border:none;border-radius:6px;padding:3px 8px;cursor:pointer;display:flex;align-items:center;gap:4px;background:var(--dp-bg-secondary);transition:all .15s;font-family:inherit;font-size:11px;font-weight:500;color:var(--dp-text-secondary);"><span style="width:10px;height:10px;border-radius:50%;background:'+sc.accent+';display:inline-block;flex-shrink:0;"></span><span class="dp-picker-label">'+sc.label+'</span></button>';}
    h += '</div></div>';
    c.innerHTML = h;
    var mb=c.querySelectorAll('[data-m]'); for(var mi=0;mi<mb.length;mi++) mb[mi].addEventListener('click',function(){setMode(this.getAttribute('data-m'));});
    var sb=c.querySelectorAll('[data-s]'); for(var si=0;si<sb.length;si++) sb[si].addEventListener('click',function(){setScheme(this.getAttribute('data-s'));});
    refreshPicker();
  }

  function getThemePickerHTML() {
    return '<div id="dp-theme-picker-inline"></div><script>DevpodTheme&&DevpodTheme.mountPicker("dp-theme-picker-inline");<\/script>';
  }

  function init() { setupSys(); load(); apply(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();

  return { init:init, setMode:setMode, setScheme:setScheme, getMode:getMode, getScheme:getScheme, mountPicker:mountPicker, getThemePickerHTML:getThemePickerHTML, schemes:S, schemeKeys:schemeKeys };
})();
