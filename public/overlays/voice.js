  const $r = document.getElementById('root');
  const $cb = document.getElementById('cb');
  const $bm = document.getElementById('bm');
  const $bd = document.getElementById('bd');
  const $bl = document.getElementById('bl');

  const MIC_OFF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ed4245" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  const DEAF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ed4245" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const MIC_ON_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  const MIC_OFF_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
  const DEAF_ON_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-4h3v2zM3 19a2 2 0 0 0 2 2h1v-4H3v2z"/></svg>';
  const DEAF_OFF_BTN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-4h3v2zM3 19a2 2 0 0 0 2 2h1v-4H3v2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  // Tıklama geçirgen pencerede fare olayı gelmez: yalnızca düğme çubuğu tıklanabilir,
  // satırlar + çubuk "üzerine gelindi" (tam opaklık) için Rust'a bildirilir.
  function box(el) {
    if (!el || el.style.display === 'none') return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
  }
  let hitQueued = false;
  function reportHit() {
    if (hitQueued) return;
    hitQueued = true;
    requestAnimationFrame(() => {
      hitQueued = false;
      // Yalnızca düğmelerin kendisi tıklanabilir (çubuk pencere genişliğinde; şeridin tamamı altındaki oyunu engellerdi)
      const click = [$bm, $bd, $bl].map(box).filter(Boolean);
      const hover = [box($r), box($cb)].filter(Boolean);
      window.netrex.reportHit(click, hover, false);
    });
  }
  if (window.ResizeObserver) { new ResizeObserver(reportHit).observe($r); new ResizeObserver(reportHit).observe($cb); }
  window.addEventListener('resize', reportHit);

  // Ayarlar (düğmeler) pencere açıkken de değişebilir: Rust "voice-overlay-config" gönderir
  window.netrex.onVoiceOverlayConfig((c) => {
    if ($bm) $bm.style.display = c.controlMute ? '' : 'none';
    if ($bd) $bd.style.display = c.controlDeafen ? '' : 'none';
    if ($bl) $bl.style.display = c.controlLeave ? '' : 'none';
    reportHit();
  });
  let baseOpacityValue = 1, fullOnHover = false;
  window.netrex.onOverlayHover((inside) => {
    document.body.style.opacity = (fullOnHover && inside) ? '1' : String(baseOpacityValue);
  });

  // Controls
  if ($bm) $bm.addEventListener('click', () => window.netrex?.voiceOverlayAction?.('toggle-mute', {}));
  if ($bd) $bd.addEventListener('click', () => window.netrex?.voiceOverlayAction?.('toggle-deafen', {}));
  if ($bl) $bl.addEventListener('click', () => window.netrex?.voiceOverlayAction?.('leave', {}));

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#5865f2'; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function ini(n) { return n ? n.trim().charAt(0).toUpperCase() : '?'; }

  function render(d) {
    if (!d) return;
    const pp = d.participants || [];
    const max = d.settings?.maxVisibleUsers || 5;
    const selfOk = d.settings?.showSelf !== false;
    const silOk = d.settings?.showSilentUsers !== false;
    const spkOnly = d.settings?.showOnlySpeaking || false;

    let list = pp.slice();
    if (!selfOk) list = list.filter(p => !p.isLocal);
    if (spkOnly || !silOk) list = list.filter(p => p.isSpeaking || p.isLocal);

    list.sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
      return 0;
    });

    const vis = list.slice(0, max);
    const over = list.length - vis.length;

    if (vis.length === 0) {
      $r.innerHTML = '';
      if (d.settings?.visibilityMode === 'always') {
        $cb.style.display = 'flex';
      } else {
        $cb.style.display = 'none';
        return; // strictly stop processing if entirely invisible and not 'always' mode
      }
    } else {
      $cb.style.display = 'flex';
    }

    // Scale
    let scale = 1;
    if (d.settings?.size === 'small') scale = 0.85;
    else if (d.settings?.size === 'large') scale = 1.15;
    document.body.style.zoom = scale;

    // Opacity
    const baseOpacity = d.settings?.opacity ?? 1;
    document.body.style.opacity = String(baseOpacity);
    document.body.style.transition = 'opacity 0.2s';
    
    baseOpacityValue = baseOpacity;
    fullOnHover = !!d.settings?.fullOpacityOnHover;

    // Update mute/deafen button states
    if ($bm && d.localState) {
      const m = d.localState.isMuted;
      $bm.className = 'btn' + (m ? ' on' : '');
      $bm.innerHTML = m ? MIC_OFF_BTN : MIC_ON_BTN;
    }
    if ($bd && d.localState) {
      const df = d.localState.isDeafened;
      $bd.className = 'btn' + (df ? ' on' : '');
      $bd.innerHTML = df ? DEAF_OFF_BTN : DEAF_ON_BTN;
    }

    // DOM Reconciliation for smooth CSS transitions
    const existingMap = new Map();
    Array.from($r.children).forEach(el => {
      if (el.className === 'ov') el.remove();
      else existingMap.set(el.id, el);
    });

    vis.forEach((p) => {
      const spkClass = p.isSpeaking ? 'ur spk' : 'ur';
      const c = safeColor(p.profileColor);
      
      let icons = '';
      if (p.isMuted) icons += '<div class="si">' + MIC_OFF + '</div>';
      if (p.isDeafened) icons += '<div class="si">' + DEAF + '</div>';

      let el = existingMap.get('p_' + p.id);
      
      if (!el) {
        // Create new element smoothly
        el = document.createElement('div');
        el.id = 'p_' + p.id;
        el.className = spkClass;
        el.style.opacity = '0';
        el.style.transform = 'translateY(4px)';
        el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        
        const av = safeUrl(p.avatar)
          ? '<img src="' + esc(safeUrl(p.avatar)) + '" referrerpolicy="no-referrer"/>' +
            '<div class="fl" style="display:none;background:' + c + '">' + esc(ini(p.name)) + '</div>'
          : '<div class="fl" style="background:' + c + '">' + esc(ini(p.name)) + '</div>';

        el.innerHTML = 
          '<div class="ac">' + av + '</div>' +
          '<div class="nm">' + esc(p.name || '?') + '</div>' +
          '<div class="ics" style="display:flex;gap:4px;">' + icons + '</div>';
          
        const img = el.querySelector('.ac img');
        if (img) img.addEventListener('error', () => { img.style.display = 'none'; if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex'; });
        $r.appendChild(el);
        
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
      } else {
        // Update existing element
        el.className = spkClass;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        
        const nmEl = el.querySelector('.nm');
        if (nmEl && nmEl.innerText !== (p.name || '?')) nmEl.innerText = (p.name || '?');
        
        const icsEl = el.querySelector('.ics');
        if (icsEl && icsEl.innerHTML !== icons) icsEl.innerHTML = icons;
        
        existingMap.delete('p_' + p.id);
      }
    });

    // Remove old elements that shouldn't be visible anymore smoothly
    existingMap.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.95)';
      setTimeout(() => el.remove(), 250);
    });

    if (over > 0) {
      const ovEl = document.createElement('div');
      ovEl.className = 'ov';
      ovEl.innerText = '+' + over;
      $r.appendChild(ovEl);
    }
  }

  if (window.netrex?.onVoiceOverlayUpdate) {
    // Her veri güncellemesinden sonra tıklanabilir alanları yeniden bildir: ResizeObserver ilk açılışta
    // tetiklenmeyebiliyor (ilk oluşturmada ölçüldü), düğmeler olduğu gibi kalsa bile Rust'ın bilgisi güncel kalsın.
    window.netrex.onVoiceOverlayUpdate((data) => { render(data); reportHit(); });
  }
