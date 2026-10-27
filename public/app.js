import {themePresentation, themeProgressKey} from './theme.mjs';
import {homeworkStorageKey, homeworkItemKey} from './homework.mjs';
import {afterSchoolForDay} from './after-school.mjs';
import {fetchJsonWithTimeout} from './network.mjs';
import {norwayCalendar, isExpiredSchoolDay, hasCalendarDateChanged, hourlyRefreshDue, REFRESH_INTERVAL_MS} from './calendar.mjs';

// Skolesekken 3.0 «Morgenklar» — production UI for existing Netlify APIs.
// Unlike the design prototype, this app never presents sample/seed data as the current plan.
(() => {
  'use strict';
  const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
  const SECTIONS = {
    '3': 'https://www.minskole.no/fagerholt/seksjon/22636',
    '7': 'https://www.minskole.no/fagerholt/seksjon/22640'
  };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const start = norwayCalendar();
  const openedAt = Date.now();
  const search = new URLSearchParams(location.search);
  const initialMode = ['3', '7'].includes(search.get('klasse')) ? search.get('klasse') : 'both';
  const state = {
    mode: initialMode, day: start.day, grades: {'3': null, '7': null},
    statuses: {'3': 'loading', '7': 'loading'},
    fetching: false, weather: null, weatherStatus: 'loading',
    errors: {'3': null, '7': null}, weatherError: null,
    subjects: {'3': null, '7': null}, themeOpen: {},
  };
  const mondayOfWeek = (year, week) => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const mon = new Date(jan4);
    mon.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() + 6) % 7 + (week - 1) * 7);
    return mon;
  };
  const monday = mondayOfWeek(start.year, start.week);
  const schoolDate = (index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    return date;
  };
  const dayStr = (index) => schoolDate(index).toLocaleDateString('nb-NO', {timeZone: 'UTC', day: 'numeric', month: 'short'});
  const fullDate = (index) => schoolDate(index).toLocaleDateString('nb-NO', {timeZone: 'UTC', day: 'numeric', month: 'long'});
  const todayText = () => start.date.toLocaleDateString('nb-NO', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'});
  const dayName = () => DAYS[state.day];
  const source = (grade) => {
    const p = state.grades[grade]?.pdf;
    if (typeof p === 'string') {
      try {
        const u = new URL(p);
        if (u.protocol === 'https:' && ['minskole.no', 'www.minskole.no'].includes(u.hostname)) return p;
      } catch { /* use trusted grade page instead */ }
    }
    return SECTIONS[grade];
  };
  const cachedKey = (grade) => `skolesekken.cache.v6.${start.year}.${start.week}.${grade}`;
  const isCurrent = (grade, data) => Boolean(data && data.year === start.year && data.week === start.week &&
    String(data.grade) === grade && data.status !== 'unpublished' && data.status !== 'error' &&
    (grade !== '3' || data.group?.key === 'rød'));
  const cacheGet = (grade) => {
    try { const val = JSON.parse(localStorage.getItem(cachedKey(grade)) || 'null'); return isCurrent(grade, val) ? val : null; }
    catch { return null; }
  };
  const cacheSet = (grade, val) => { try { localStorage.setItem(cachedKey(grade), JSON.stringify(val)); } catch {} };
  const getLocal = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const setLocal = (key, val) => { try { localStorage.setItem(key, val); } catch {} };
  const packKey = (grade, day) => `skolesekken.pack.v6.${start.year}.${start.week}.${grade}.${day}`;
  const packed = (grade, day) => {
    try { return JSON.parse(getLocal(packKey(grade, day)) || '{}') || {}; } catch { return {}; }
  };
  const packItems = (grade, day) => {
    const g = state.grades[grade];
    if (!g) return [];
    const items = [...(g.everyday || []), ...(g.days?.[day]?.bring || [])].filter(i =>
      i && typeof i.label === 'string' && !/^(penal|skiftetøy)$/i.test(i.label.trim()));
    return [...new Map(items.map(i => [i.label.trim().toLocaleLowerCase('nb-NO'), i])).values()];
  };
  function storePack(grade, day, label, checked) {
    const saved = packed(grade, day);
    saved[label] = checked;
    setLocal(packKey(grade, day), JSON.stringify(saved));
    render();
  }
  function statusText(grade) {
    const status = state.statuses[grade];
    return ({ok: 'Ukeplan oppdatert', partial: 'Delvis lest ukeplan', unreadable: 'Ufullstendig ukeplan',
      loading: 'Henter ukeplan…', refreshing: 'Oppdaterer · lagret ukeplan', unpublished: 'Ukeplan ikke publisert', cached: 'Lagret kopi · samme uke',
      error: 'Ukeplan utilgjengelig'})[status] || 'Venter på ukeplan';
  }
  function statusClass(grade) {
    const status = state.statuses[grade];
    return ['partial', 'unreadable', 'unpublished', 'cached', 'refreshing'].includes(status) ? 'warn' : status === 'error' ? 'bad' : '';
  }
  function errorExplanation(code, grade) {
    if (code === 'missing_api') return `${grade}. klasse: Netlify-funksjonene ser ikke ut til å være publisert. Appen må publiseres fra hele GitHub-prosjektet, ikke bare public-mappen.`;
    if (code === 'timeout') return `${grade}. klasse: Skolen eller Netlify bruker for lang tid. Prøv Oppdater, eller åpne ukeplanen hos skolen.`;
    if (code === 'offline') return `${grade}. klasse: Ingen kontakt med serveren. Sjekk nettverket eller prøv igjen.`;
    return `${grade}. klasse: Ukeplanen kan ikke hentes akkurat nå. Bruk lenken til skolen.`;
  }
  function noticesForSelectedView() {
    const grades = state.mode === 'both' ? ['3', '7'] : [state.mode];
    const warnings = [];
    for (const grade of grades) {
      const status = state.statuses[grade];
      const data = state.grades[grade];
      const name = `${grade}. klasse`;
      if (['partial', 'unreadable'].includes(status)) {
        warnings.push({kind:'warning', text:`${name}: ${data?.warning || 'PDF-en kunne ikke leses fullstendig.'} Kontroller originalen.`});
      } else if (status === 'unpublished') {
        warnings.push({kind:'warning', text:`${name}: Skolen har ikke publisert en lesbar plan for uke ${start.week}.`});
      } else if (status === 'cached') {
        warnings.push({kind:'warning', text:`${name}: Viser lagret kopi for uke ${start.week}. ${errorExplanation(state.errors[grade], grade)}`});
      } else if (status === 'error') {
        warnings.push({kind:'danger', text:errorExplanation(state.errors[grade], grade)});
      }
    }
    return warnings;
  }
  function renderWarnings() {
    $('warnings').innerHTML = noticesForSelectedView().map(w =>
      `<div class="warning ${w.kind === 'danger' ? 'danger' : ''}">${esc(w.text)}</div>`).join('');
  }
  function setMode(mode) {
    if (!['both', '3', '7'].includes(mode)) return;
    state.mode = mode;
    $('notices-details').open = false;
    try { history.replaceState(null, '', `${location.pathname}${mode === 'both' ? '' : `?klasse=${mode}`}`); } catch {}
    render();
  }
  function renderIntro() {
    document.body.dataset.mode = state.mode;
    $('week-number').textContent = `UKE ${start.week}`;
    $('current-date').textContent = todayText();
    $('header-kicker').textContent = `${dayName().toUpperCase()} ${fullDate(state.day).toUpperCase()}`;
    const intros = {
      both: ['Hei, familie! 👋', 'To skolebarn, én oversikt over dagen. Se hva som skjer og hva som skal pakkes.'],
      '3': ['Klar for skoledagen? 🚀', '3. klasse · rød gruppe. Her er det viktigste å huske i dag.'],
      '7': ['Din dag, på ett sted ✌️', '7. klasse. Skole, aktiviteter og kjøring – uten å måtte lete.']
    };
    const [title, desc] = intros[state.mode];
    $('header-title').textContent = title;
    $('header-desc').textContent = desc;
    $('top-source').href = source(state.mode === '7' ? '7' : '3');
    for (const button of document.querySelectorAll('button[data-mode]')) {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-selected', String(active));
    }
  }
  function renderWeather() {
    const forecast = state.weather?.days?.[schoolDate(state.day).toISOString().slice(0, 10)] ?? null;
    $('weather-icon').textContent = forecast?.icon ?? '🌤️';
    $('weather-number').textContent = typeof forecast?.temperature === 'number' ? `${Math.round(forecast.temperature)}°C` : '— °C';
    $('weather-desc').textContent = forecast?.description || (state.weatherStatus === 'loading' ? 'Henter prognose…' : state.weatherStatus === 'missing_api' ? 'Vær-API mangler på Netlify' : state.weatherStatus === 'timeout' ? 'Værtjenesten svarte ikke · prøv Oppdater' : 'Værvarsel ikke tilgjengelig');
    $('weather-extra').textContent = forecast ? [
      typeof forecast.rainMm === 'number' ? `💧 ${forecast.rainApproximate ? 'ca. ' : ''}${String(forecast.rainMm).replace('.', ',')} mm` : null,
      state.weatherStatus === 'stale' ? 'Eldre varsel' : 'Yr · kl. 08–15'
    ].filter(Boolean).join(' · ') : 'Ingen oppdiktede værdata';
  }
  function renderWeekdays() {
    $('weekdays').innerHTML = DAYS.map((name, i) => {
      const expired = isExpiredSchoolDay(i, start.dow);
      const active = state.day === i;
      return `<button type="button" class="weekday${active && !expired ? ' active' : ''}" data-day="${i}" `+
        `${expired ? 'disabled title="Dagen er utgått"' : ''} aria-pressed="${active && !expired}" aria-label="${esc(name)} ${esc(dayStr(i))}${expired ? ' – utgått' : ''}">`+
        `<span class="day-label">${name.slice(0, 3)}</span><span class="day-number">${expired ? 'Utgått' : esc(dayStr(i))}</span></button>`;
    }).join('');
    $('weekdays').querySelectorAll('button:not(:disabled)').forEach(b => b.addEventListener('click', () => {
      const index = Number(b.dataset.day);
      if (isExpiredSchoolDay(index, norwayCalendar().dow)) return;
      state.day = index;
      render();
    }));
  }
  const eventEmoji = (e) => ({bus:'🚌',waves:'🏊',trees:'🌳',activity:'🏃',music:'🎵',sparkles:'✨',scissors:'🛠️',sun:'☀️',gift:'🎁',book:'📚'})[e?.icon] || '📚';
  const afterSchool = (grade) => afterSchoolForDay({grade, year:start.year, week:start.week, dayIndex:state.day});
  function familyCard(grade) {
    const g = state.grades[grade];
    const status = state.statuses[grade];
    const d = g?.days?.[dayName()];
    const ev = d?.events?.[0];
    const items = packItems(grade, dayName());
    const saved = packed(grade, dayName());
    const checked = items.filter(item => saved[item.label]).length;
    const activity = afterSchool(grade);
    const gradeColor = grade === '3' ? 'third' : 'seventh';
    const sub = grade === '3' ? 'Rød gruppe' : 'Skole og fritid';
    const focus = g ? `<div class="focus ${grade === '7' ? 'purple' : ''}"><span class="focus-icon">${eventEmoji(ev)}</span><div><strong>${esc(ev?.title || d?.subtitle || 'Ingen aktivitet oppgitt')}</strong><small>${esc(ev?.time || 'Skoledagen')}${d?.end ? ` · Slutt ${esc(d.end)}` : ''}</small></div></div>` :
      `<div class="empty-state">${status === 'loading' ? 'Henter skoleplan…' : status === 'unpublished' ? 'Ukeplanen er ikke publisert ennå.' : 'Kunne ikke vise dagens skoleplan. Se skolens side.'}</div>`;
    const activityHtml = activity ? `<div class="focus purple"><span class="focus-icon">${esc(activity.emoji)}</span><div><strong>${esc(activity.title)} · etter skolen</strong><small>${esc(activity.driverLabel)}</small></div></div>` : '';
    const pills = g ? (items.length ? items.map(i => `<span class="thing-pill">${saved[i.label] ? '✓ ' : ''}${esc(i.label)}</span>`).join('') :
      '<span class="thing-pill">Ingen ekstra ting oppgitt</span>') : '<span class="thing-pill">Venter på ukeplanen</span>';
    return `<article class="family-card ${gradeColor}"><div class="family-name"><span class="avatar">${grade === '3' ? '🎨' : '🎧'}</span><div>${grade}. klasse<div class="class-sub">${sub}</div></div></div>`+
      `<div class="status-word ${statusClass(grade)}">${esc(statusText(grade))}</div>${focus}${activityHtml}`+
      `${g && d?.alert ? `<div class="family-notices">📣 ${esc(d.alert)}</div>` : ''}`+
      `<div class="family-item-label">I skolesekken${g ? ` · ${checked}/${items.length} pakket` : ''}</div><div class="pill-group">${pills}</div>`+
      `<div class="family-foot"><small>${grade === '3' ? '🎒 Sjekk sekken' : '📅 Skole og aktiviteter'}</small><button type="button" class="openbtn" data-open="${grade}">Vis dagen →</button></div></article>`;
  }
  function renderFamily() {
    $('family-day').textContent = `${dayName()} ${fullDate(state.day)}`;
    $('family-cards').innerHTML = ['3', '7'].map(familyCard).join('');
    $('family-cards').querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.open)));
    const themeCards = ['3', '7'].map(grade => {
      const presentation = themePresentation(state.grades[grade]?.weekTheme);
      if (!presentation) return '';
      const key = themeProgressKey(start.year, start.week, grade, presentation.theme);
      let stored;
      try { stored = JSON.parse(getLocal(key) || '{}'); } catch { stored = {}; }
      const done = Boolean(stored?.done);
      return `<article class="family-theme tone-${esc(presentation.tone)}">`+
        `<div class="family-theme-label"><span>${esc(presentation.emoji)} ${grade}. klasse · UKAS TEMA</span>`+
        `${done ? '<span class="family-theme-done">✓ Gjennomført</span>' : ''}</div>`+
        `<h3>${esc(presentation.title)}</h3>`+
        `${presentation.subtitle ? `<p class="family-theme-subtitle">${esc(presentation.subtitle)}</p>` : ''}`+
        `<p class="family-theme-quest"><span aria-hidden="true">🎯</span> ${esc(presentation.quest)}</p>`+
        `<button type="button" class="family-theme-link" data-theme-grade="${grade}">${done ? 'Se oppdraget igjen' : 'Se og gjør oppdraget'} <span aria-hidden="true">→</span></button>`+
        `</article>`;
    }).filter(Boolean);
    $('family-themes').innerHTML = themeCards.length ? `<div class="family-themes-heading"><span>✨ UKAS TEMA</span><small>Små handlinger gjør en forskjell</small></div>`+
      `<div class="family-theme-grid">${themeCards.join('')}</div>` : '';
    $('family-themes').querySelectorAll('[data-theme-grade]').forEach(button => button.addEventListener('click', () => {
      setMode(button.dataset.themeGrade);
      $('theme-section').scrollIntoView?.({behavior:'smooth', block:'center'});
    }));
    $('family-bottom').innerHTML = `<div class="family-small"><h3>📚 Lekser og beskjeder</h3><p>Velg 3. eller 7. klasse for lekser fordelt på fag og dagens skolebeskjeder.</p>`+
      `<p><a href="${SECTIONS['3']}" target="_blank" rel="noopener noreferrer">3. trinn ↗</a> · <a href="${SECTIONS['7']}" target="_blank" rel="noopener noreferrer">7. trinn ↗</a></p></div>`;
  }
  function renderProgram(grade) {
    const g = state.grades[grade];
    const d = g?.days?.[dayName()];
    const activity = afterSchool(grade);
    const schoolEvents = (d?.events || []).map(e => `<div class="event-row ${['waves', 'trees'].includes(e.icon) ? 'orange' : ''}">`+
      `<div class="event-symbol">${eventEmoji(e)}</div><div><div class="event-time">${esc(e.time || 'Skoledagen')}</div>`+
      `<div class="event-title">${esc(e.title || 'Aktivitet')}</div>${e.detail ? `<p class="event-desc">${esc(e.detail)}</p>` : ''}</div></div>`).join('');
    const empty = !g ? (state.statuses[grade] === 'loading' ? 'Henter dagens skoleplan…' : 'Ingen bekreftet skoleplan for denne uken. Se skolens side.') : 'Ingen egne aktiviteter er oppført for denne dagen. Se originalen for full timeplan.';
    $('day-program').innerHTML = `<div class="section-label">${grade}. klasse${grade === '3' ? ' · Rød gruppe' : ''} · ${dayName()}</div>`+
      `<div class="card-heading"><h2>📅 Dette skjer</h2>${d?.end ? `<span class="endtime">Slutt ${esc(d.end)}</span>` : ''}</div>`+
      `${g && d?.alert ? `<div class="notice-alert">📣 ${esc(d.alert)}</div>` : ''}`+
      `<div class="event-list">${schoolEvents || `<div class="empty-state">${esc(empty)}</div>`}</div>`+
      (activity ? `<div class="after-block"><div class="head"><span>${esc(activity.emoji)}</span><strong>${esc(activity.title)} · etter skolen</strong></div>`+
        `<div class="driver"><div><span class="day-flag">${activity.type === 'dance' ? 'Oppmøte for kjøring' : 'Kjøreansvar'}</span>`+
        `<div><strong>${esc(activity.driverLabel)}</strong></div><small>${esc(activity.detail)}</small></div></div></div>` : '');
  }
  function renderBag(grade) {
    const g = state.grades[grade];
    const day = dayName();
    const items = packItems(grade, day);
    const saved = packed(grade, day);
    const checked = items.filter(item => saved[item.label]).length;
    const pct = items.length ? Math.round(100 * checked / items.length) : 0;
    $('bag-section').innerHTML = `<div class="bag-top"><span class="bag-symbol">🎒</span><div><div class="section-label">Før du går hjemmefra</div><h2>Pakk sekken</h2></div></div>`+
      `<p class="bag-caption">Kryss av det som er pakket til ${day.toLowerCase()}.</p>`+
      `<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${checked}" aria-label="Pakkestatus"><div class="progress-fill" style="width:${pct}%"></div></div>`+
      (items.length ? items.map(item => `<label class="pack-row ${saved[item.label] ? 'is-checked' : ''}"><input type="checkbox" data-pack="${esc(item.label)}" ${saved[item.label] ? 'checked' : ''}><span>${esc(item.label)}`+
        (item.note ? `<span class="pack-note">${esc(item.note)}</span>` : '') + '</span></label>').join('') :
        `<div class="empty-state">${!g ? 'Pakkelisten vises når skolen har publisert en lesbar ukeplan.' : 'Ingen ekstra utstyr registrert for dagen.'}</div>`) +
      `<div class="pack-footer"><span>${checked} av ${items.length} pakket</span>${items.length && checked === items.length ? '<span class="ready-chip">✓ Sekken er klar!</span>' : ''}</div>`;
    $('bag-section').querySelectorAll('input[data-pack]').forEach(input => input.addEventListener('change', () => storePack(grade, day, input.dataset.pack, input.checked)));
  }
  // Real, per-item checkbox completion, separate for each child and week.
  function homeworkDone(grade) {
    try {
      const value = JSON.parse(getLocal(homeworkStorageKey(start.year, start.week, grade)) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function setHomeworkDone(grade, item, done) {
    const saved = homeworkDone(grade);
    saved[homeworkItemKey(item)] = done;
    setLocal(homeworkStorageKey(start.year, start.week, grade), JSON.stringify(saved));
    renderHomework(grade);
  }
  function renderHomework(grade) {
    const homework = (state.grades[grade]?.homework || []).filter(h => h?.subject && h?.detail);
    const subjects = [...new Set(homework.map(h => h.subject))];
    if (!subjects.includes(state.subjects[grade])) state.subjects[grade] = subjects[0] || null;
    const saved = homeworkDone(grade);
    const doneCount = homework.filter(h => saved[homeworkItemKey(h)]).length;
    const current = homework.filter(h => h.subject === state.subjects[grade]);
    const allDone = homework.length > 0 && doneCount === homework.length;
    $('homework-section').innerHTML = `<div class="section-label">Din egen sjekkliste</div><h3><span class="emoji">📚</span> Ukens lekser</h3>` +
      (subjects.length ? `<div class="hw-progress-info"><span>${doneCount} av ${homework.length} lekser gjort</span>` +
        (allDone ? '<strong>🎉 Alle leksene er ferdige!</strong>' : '<span>Huk av når du er ferdig</span>') + `</div>` +
        `<div class="hw-progress-track" role="progressbar" aria-label="Ferdige lekser" aria-valuemin="0" aria-valuemax="${homework.length}" aria-valuenow="${doneCount}">` +
        `<div class="hw-progress-fill" style="width:${Math.round(doneCount * 100 / homework.length)}%"></div></div>` +
        `<div class="hw-list" role="group" aria-label="Velg leksefag">${subjects.map(subject => {
          const items = homework.filter(h => h.subject === subject);
          const completed = items.filter(h => saved[homeworkItemKey(h)]).length;
          return `<button type="button" class="hw-btn ${subject === state.subjects[grade] ? 'selected' : ''}" data-subject="${esc(subject)}" aria-pressed="${subject === state.subjects[grade]}">` +
            `${esc(subject)} <span class="hw-subject-count">${completed}/${items.length}</span></button>`;
        }).join('')}</div>` +
        `<div class="hw-checklist">${current.map((item, index) => {
          const checked = Boolean(saved[homeworkItemKey(item)]);
          return `<label class="hw-check-row ${checked ? 'is-done' : ''}">` +
            `<input type="checkbox" data-homework-index="${index}" ${checked ? 'checked' : ''}>` +
            `<span class="hw-check-content"><span class="hw-check-copy">${esc(item.detail)}</span>` +
            `<span class="hw-check-hint">${checked ? '✓ Leksen er gjort' : 'Trykk for å markere som gjort'}</span></span></label>`;
        }).join('')}</div>` : '<div class="empty-state">Ingen lekser hentet fra ukens plan.</div>');
    $('homework-section').querySelectorAll('[data-subject]').forEach(button => button.addEventListener('click', () => {
      state.subjects[grade] = button.dataset.subject;
      renderHomework(grade);
    }));
    $('homework-section').querySelectorAll('input[data-homework-index]').forEach(input => input.addEventListener('change', () => {
      const item = current[Number(input.dataset.homeworkIndex)];
      if (item) setHomeworkDone(grade, item, input.checked);
    }));
  }
  function renderTheme(grade) {
    const presentation = themePresentation(state.grades[grade]?.weekTheme);
    const section = $('theme-section');
    if (!presentation) {
      section.innerHTML = '';
      section.classList.add('theme-hidden');
      return;
    }
    section.classList.remove('theme-hidden');
    section.className = `secondary-card theme-card tone-${presentation.tone}`;
    const key = themeProgressKey(start.year, start.week, grade, presentation.theme);
    let stored;
    try { stored = JSON.parse(getLocal(key) || '{}'); } catch { stored = {}; }
    const done = Boolean(stored?.done);
    section.innerHTML = `<div class="theme-layout">`+
      `<div class="theme-heading"><div class="theme-meta"><span>✨ UKAS TEMA</span><span>UKE ${start.week}</span></div>`+
      `<div class="theme-face"><span class="theme-emoji" aria-hidden="true">${esc(presentation.emoji)}</span>`+
      `<div><h2 class="theme-name">${esc(presentation.title)}</h2>`+
      `${presentation.subtitle ? `<p class="theme-subtitle">${esc(presentation.subtitle)}</p>` : ''}</div></div>`+
      `<p class="theme-school-note">Dette øver vi på denne uka.</p></div>`+
      `<div class="theme-mission ${done ? 'is-done' : ''}"><div class="mission-eyebrow">🎯 DITT OPPDRAG DENNE UKA</div>`+
      `<p class="mission-description">${esc(presentation.quest)}</p>`+
      (done ? `<div class="mission-celebrate" role="status">🎉 Så bra! Du gjennomførte oppdraget!</div>`+
        `<button type="button" id="mission-reset" class="mission-reset">Angre avkrysning</button>` :
        `<button type="button" id="mission-toggle" class="mission-complete">✓ Jeg har gjort det!</button>`) +
      `<p class="quest-caption">Frivillig forslag fra Skolesekken – ikke skolelekse.</p></div></div>`;
    if (done) $('mission-reset').addEventListener('click', () => {
      setLocal(key, JSON.stringify({done:false}));
      renderTheme(grade);
    });
    else $('mission-toggle').addEventListener('click', () => {
      setLocal(key, JSON.stringify({done:true}));
      renderTheme(grade);
    });
  }
  function renderNotices(grade) {
    const notices = state.grades[grade]?.notices || [];
    $('notice-count').textContent = notices.length || '';
    $('notices').innerHTML = notices.length ? notices.map(n =>
      `<article class="note"><strong>${esc(n.title || 'Beskjed')}</strong>${n.detail ? `<p>${esc(n.detail)}</p>` : ''}</article>`).join('') :
      '<p class="empty-state">Ingen ukebeskjeder hentet. Se originalplanen hvis du er i tvil.</p>';
  }
  function renderDetail() {
    const grade = state.mode;
    $('grade-status').textContent = statusText(grade);
    $('grade-status').className = `status-word ${statusClass(grade)}`;
    $('pdf-link').href = source(grade);
    $('pdf-link').textContent = state.grades[grade]?.pdf ? 'Original ukeplan (PDF) ↗' : 'Åpne skolens trinnside ↗';
    renderProgram(grade);
    renderBag(grade);
    renderHomework(grade);
    renderTheme(grade);
    renderNotices(grade);
  }
  function render() {
    renderIntro();
    renderWeather();
    renderWeekdays();
    renderWarnings();
    $('family-view').classList.toggle('hidden', state.mode !== 'both');
    $('detail-view').classList.toggle('hidden', state.mode === 'both');
    if (state.mode === 'both') renderFamily(); else renderDetail();
    $('refresh').disabled = state.fetching;
  }
  const weatherCacheKey = 'skolesekken.weather.v1';

  // Show verified SAME-WEEK cached plans immediately; fetching can continue in parallel.
  function restoreCachedData() {
    for (const grade of ['3', '7']) {
      const data = cacheGet(grade);
      if (data) {
        state.grades[grade] = data;
        state.statuses[grade] = 'refreshing';
      }
    }
    try {
      const cached = JSON.parse(getLocal(weatherCacheKey) || 'null');
      if (cached?.data?.days && Date.now() - cached.savedAt < 4 * 3600000) {
        state.weather = cached.data;
        state.weatherStatus = 'stale';
      }
    } catch { /* No reliable stored forecast. */ }
  }

  async function loadGrade(grade, fresh = false) {
    try {
      const url = `/api/plan?grade=${grade}${fresh ? `&fresh=1&_=${Date.now()}` : ''}`;
      const result = await fetchJsonWithTimeout(url, {timeoutMs: 18000, cache: fresh ? 'no-store' : 'default'});
      if (result?.status === 'error') throw Object.assign(new Error(result.warning || 'Ukeplan utilgjengelig'), {code: 'server'});
      if (result.week !== start.week || result.year !== start.year) throw Object.assign(new Error('Feil ukenummer'), {code:'invalid_api'});
      state.errors[grade] = null;
      if (result.status === 'unpublished') {
        state.grades[grade] = null;
        state.statuses[grade] = 'unpublished';
      } else {
        if (!isCurrent(grade, result)) throw Object.assign(new Error('Ugyldig klasse- eller gruppedata'), {code:'invalid_api'});
        state.grades[grade] = result;
        state.statuses[grade] = result.status || 'partial';
        cacheSet(grade, result);
      }
    } catch(err) {
      state.errors[grade] = err?.code || 'server';
      const backup = cacheGet(grade);
      state.grades[grade] = backup;
      state.statuses[grade] = backup ? 'cached' : 'error';
      console.warn(`Ukeplan ${grade}. trinn:`, err);
    }
    render();
  }

  async function loadWeather(fresh = false) {
    if (!state.weather) state.weatherStatus = 'loading';
    renderWeather();
    try {
      const result = await fetchJsonWithTimeout(`/api/weather${fresh ? `?fresh=1&_=${Date.now()}` : ''}`, {
        timeoutMs: 9000, cache: fresh ? 'no-store' : 'default'
      });
      if (!result?.days || typeof result.days !== 'object') throw Object.assign(new Error('Manglende værmelding'),{code:'invalid_api'});
      state.weather = result;
      state.weatherStatus = result.stale ? 'stale' : 'ok';
      state.weatherError = null;
      setLocal(weatherCacheKey, JSON.stringify({savedAt:Date.now(), data:result}));
    } catch(err) {
      state.weatherError = err?.code || 'server';
      let backup;
      try { backup = JSON.parse(getLocal(weatherCacheKey) || 'null'); } catch { backup = null; }
      if (backup?.data?.days && Date.now() - backup.savedAt < 4 * 3600000) {
        state.weather = backup.data;
        state.weatherStatus = 'stale';
      } else {
        state.weather = null;
        state.weatherStatus = state.weatherError === 'missing_api' ? 'missing_api' :
          state.weatherError === 'timeout' ? 'timeout' : 'error';
      }
      console.warn('Værvarsel:', err);
    }
    renderWeather();
  }

  async function refreshAll(fresh = false) {
    if (state.fetching) return;
    state.fetching = true;
    for (const grade of ['3', '7']) {
      state.statuses[grade] = state.grades[grade] ? 'refreshing' : 'loading';
    }
    render();
    try { await Promise.all([loadGrade('3', fresh), loadGrade('7', fresh), loadWeather(fresh)]); }
    finally { state.fetching = false; render(); }
  }
  document.querySelectorAll('button[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelector('.logo').addEventListener('click', (event) => { event.preventDefault(); setMode('both'); });
  $('refresh').addEventListener('click', () => refreshAll(true));
  restoreCachedData();
  render();
  refreshAll();
  window.__skolesekkenStarted = true;

  // Refresh on every hour, local Norwegian date rollover, and return from sleeping tabs.
  let reloading = false;
  function reloadWhenDue() {
    if (reloading) return;
    if (hasCalendarDateChanged(start, norwayCalendar()) || hourlyRefreshDue(openedAt, Date.now())) {
      reloading = true;
      location.reload();
    }
  }
  setInterval(reloadWhenDue, REFRESH_INTERVAL_MS);
  setInterval(reloadWhenDue, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reloadWhenDue(); });
  window.addEventListener('focus', reloadWhenDue);
})();
