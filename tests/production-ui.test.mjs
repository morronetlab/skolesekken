import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {themePresentation, themeProgressKey} from '../public/theme.mjs';
import {rainwearExpected} from '../public/rain.mjs';
import {homeworkStorageKey, homeworkItemKey} from '../public/homework.mjs';
import {afterSchoolForDay} from '../public/after-school.mjs';
import {fetchJsonWithTimeout as loadJson} from '../public/network.mjs';
import {norwayCalendar, isExpiredSchoolDay, hasCalendarDateChanged, hourlyRefreshDue, REFRESH_INTERVAL_MS} from '../public/calendar.mjs';

// Smoke-test the actual frontend script with a small DOM adapter and mocked APIs.
// Full responsive layout still needs verification in a real browser after deploy.
test('3.0 app starts, fetches two grades and displays live API data rather than seed data', async () => {
  class MockElement {
    constructor(dataset = {}) {
      this.dataset = dataset; this._innerHTML = ''; this.textContent = ''; this.href = '';
      this.style = {}; this.open = false; this.disabled = false; this.attrs = {};
      this.handlers = {}; this.controls = {};
      this.classList = {toggle() {},add() {},remove() {}};
    }
    setAttribute(name, value) { this.attrs[name] = value; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    set innerHTML(value) { this._innerHTML = value; this.controls = {}; }
    get innerHTML() { return this._innerHTML; }
    querySelectorAll(selector) {
      if (!['input[data-homework-index]', 'input[data-pack]', '[data-subject]'].includes(selector)) return [];
      if (!this.controls[selector]) {
        const regex = selector === 'input[data-homework-index]'
          ? /<input type="checkbox" data-homework-index="(\d+)"(\s+checked)?\s*>/g
          : selector === 'input[data-pack]' ? /<input type="checkbox" data-pack="([^"]+)"(\s+checked)?\s*>/g
          : /<button[^>]*data-subject="([^"]+)"[^>]*>/g;
        this.controls[selector] = [...this.innerHTML.matchAll(regex)].map(match => {
          const node = new MockElement(selector === 'input[data-homework-index]'
            ? {homeworkIndex:match[1]} : selector === 'input[data-pack]' ? {pack:match[1]} : {subject:match[1]});
          node.checked = Boolean(match[2]);
          return node;
        });
      }
      return this.controls[selector];
    }
  }
  const nodes = new Map();
  // Catch class selectors used accidentally with getElementById.
  const get = id => {
    if (id.startsWith('.')) return null;
    return nodes.get(id) || (nodes.set(id, new MockElement()),nodes.get(id));
  };
  const buttons = ['both','3','7'].map(mode=>new MockElement({mode}));
  const logo = new MockElement();
  const pageBody = new MockElement({mode:'both'});
  const document = {
    body: pageBody, visibilityState:'visible',
    getElementById:get,
    querySelectorAll: selector => selector === '[data-mode]' ? [pageBody,...buttons] : selector === 'button[data-mode]' ? buttons : [],
    querySelector: selector => selector === '.logo' ? logo : null,
    addEventListener(){}
  };
  const local = new Map();
  const localStorage = {getItem: k => local.get(k)??null, setItem:(k,v)=>local.set(k,v)};
  const yearWeek = norwayCalendar();
  const fixture = grade=>({
    grade,year:yearWeek.year,week:yearWeek.week,status:'ok',
    group:grade==='3'?{key:'rød'}:undefined,
    days:{[ ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag'][yearWeek.day] ]:{end:'14:00', events:[{title:'Testaktivitet fra API',icon:'book',time:'09:00'}],bring:[{label:'Drikkeflaske'}]}},
    everyday:[],homework:[{subject:'Norsk',detail:'Les til fredag'},{subject:'Engelsk',detail:'Read together'}],
    notices:[],weekTheme:grade==='3'?'Solidaritet · Jeg bryr meg':'Respekt · Alle har en stemme'
  });
  const calls=[];
  const fetch = async url => {
    calls.push(url);
    const data = url.startsWith('/api/weather') ? {days:{[yearWeek.dateKey]:{rainMm:1.2,temperature:7,symbol:'rain_day',description:'Regn'}}} : fixture(url.includes('grade=7')?'7':'3');
    return {ok:true, json:async()=>data};
  };
  const raw=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const body=raw.replace(/^import [^\n]*\n/gm, '');
  const fn=new Function('themePresentation','themeProgressKey','homeworkStorageKey','homeworkItemKey','afterSchoolForDay','norwayCalendar',
    'isExpiredSchoolDay','hasCalendarDateChanged','hourlyRefreshDue','REFRESH_INTERVAL_MS','fetchJsonWithTimeout','rainwearExpected',
    'document','window','localStorage','history','location','fetch','setInterval',body);
  const win={addEventListener(){}};
  fn(themePresentation,themeProgressKey,homeworkStorageKey,homeworkItemKey,afterSchoolForDay,norwayCalendar,isExpiredSchoolDay,
    hasCalendarDateChanged,hourlyRefreshDue,REFRESH_INTERVAL_MS,
    (url,opts)=>loadJson(url,{...opts,fetchImpl:fetch}),rainwearExpected,document,win,localStorage,
    {replaceState(){}},{search:'',pathname:'/',reload(){}},fetch,()=>0);
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(calls.some(s=>s.includes('grade=3')));
  assert.ok(calls.some(s=>s.includes('grade=7')));
  assert.ok(calls.some(s=>s.startsWith('/api/weather')));
  assert.equal(win.__skolesekkenStarted, true, 'App must finish bootstrapping');
  assert.equal(get('rain-reminder').hidden,false,'Rainwear warning must be visible on wet school day');
  assert.match(get('rain-reminder').innerHTML,/Husk regntøy før dere går ut!/);
  assert.equal(get('theme-section').innerHTML,'','Family view must not show a weekly theme');
  assert.equal(pageBody.handlers.click, undefined, 'Never bind mode switch to body: bubbling checkbox clicks would cancel native change events');
  assert.match(get('family-cards').innerHTML,/Testaktivitet fra API/);
  assert.doesNotMatch(get('family-cards').innerHTML,/Solidaritet · Jeg bryr meg/);
  buttons[2].handlers.click();
  assert.match(get('day-program').innerHTML,/Testaktivitet fra API/);
  // Test schoolbag checkbox behavior independently of homework controls.
  const bagUI = get('bag-section');
  assert.match(bagUI.innerHTML, /0 av 1 pakket/);
  const bagCheckbox = bagUI.querySelectorAll('input[data-pack]')[0];
  assert.equal(bagCheckbox.dataset.pack, 'Drikkeflaske');
  assert.equal(typeof bagCheckbox.handlers.change, 'function');
  bagCheckbox.checked = true;
  bagCheckbox.handlers.change();
  assert.match(bagUI.innerHTML, /1 av 1 pakket/);
  const packStorageKey = `skolesekken.pack.v6.${yearWeek.year}.${yearWeek.week}.7.${['Mandag','Tirsdag','Onsdag','Torsdag','Fredag'][yearWeek.day]}`;
  assert.equal(JSON.parse(local.get(packStorageKey)).Drikkeflaske, true);
  buttons[1].handlers.click();
  assert.match(bagUI.innerHTML, /0 av 1 pakket/);
  buttons[2].handlers.click();
  assert.match(bagUI.innerHTML, /1 av 1 pakket/);
  const bagUndo = bagUI.querySelectorAll('input[data-pack]')[0];
  bagUndo.checked = false;
  bagUndo.handlers.change();
  assert.match(bagUI.innerHTML, /0 av 1 pakket/);
  assert.equal(JSON.parse(local.get(packStorageKey)).Drikkeflaske, false);
  assert.match(get('homework-section').innerHTML,/Engelsk/);
  assert.match(get('homework-section').innerHTML,/input type="checkbox" data-homework-index/);
  assert.match(get('homework-section').innerHTML,/0 av 2 lekser gjort/);
  // Simulate actual change events, subject switching and child-specific persistence.
  const homeworkUI = get('homework-section');
  const norwegianInput = homeworkUI.querySelectorAll('input[data-homework-index]')[0];
  assert.equal(typeof norwegianInput.handlers.change, 'function');
  norwegianInput.checked = true;
  norwegianInput.handlers.change();
  assert.match(homeworkUI.innerHTML, /1 av 2 lekser gjort/);
  assert.match(homeworkUI.innerHTML, /✓ Leksen er gjort/);
  const englishTab = homeworkUI.querySelectorAll('[data-subject]').find(b => b.dataset.subject === 'Engelsk');
  englishTab.handlers.click();
  assert.match(homeworkUI.innerHTML, /1 av 2 lekser gjort/);
  const englishInput = homeworkUI.querySelectorAll('input[data-homework-index]')[0];
  englishInput.checked = true;
  englishInput.handlers.change();
  assert.match(homeworkUI.innerHTML, /2 av 2 lekser gjort/);
  assert.match(homeworkUI.innerHTML, /Alle leksene er ferdige!/);
  buttons[1].handlers.click();
  assert.match(homeworkUI.innerHTML, /0 av 2 lekser gjort/);
  buttons[2].handlers.click();
  assert.match(homeworkUI.innerHTML, /2 av 2 lekser gjort/);
  const englishAgain = homeworkUI.querySelectorAll('[data-subject]').find(b => b.dataset.subject === 'Engelsk');
  englishAgain.handlers.click();
  const undo = homeworkUI.querySelectorAll('input[data-homework-index]')[0];
  undo.checked = false;
  undo.handlers.change();
  assert.match(homeworkUI.innerHTML, /1 av 2 lekser gjort/);
  assert.ok(local.has(homeworkStorageKey(yearWeek.year,yearWeek.week,'7')));
  assert.match(get('theme-section').innerHTML,/Respekt/);
  assert.doesNotMatch(get('theme-section').innerHTML,/Solidaritet/);
  assert.match(get('theme-section').innerHTML,/DITT OPPDRAG DENNE UKA/);
  assert.match(get('theme-section').innerHTML,/Jeg har gjort det!/);
  get('mission-toggle').handlers.click();
  assert.match(get('theme-section').innerHTML,/Oppdraget er utført!/);
  get('mission-expand').handlers.click();
  assert.match(get('theme-section').innerHTML,/Du gjennomførte oppdraget/);
  assert.equal(typeof get('mission-reset').handlers.click, 'function');
  get('mission-reset').handlers.click();
  assert.match(get('theme-section').innerHTML,/Jeg har gjort det!/);
});
