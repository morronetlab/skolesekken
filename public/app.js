import {themePresentation, themeProgressKey} from './theme.mjs';
import {afterSchoolForDay} from './after-school.mjs';
import {norwayCalendar, isExpiredSchoolDay, hasCalendarDateChanged, hourlyRefreshDue, REFRESH_INTERVAL_MS} from './calendar.mjs';
(() => {
'use strict';
const DAYS=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag'];
const DAY_EMOJI=['🌤️','🎨','📚','✨','🎉'];
const SECTIONS={'3':'https://www.minskole.no/fagerholt/seksjon/22636','7':'https://www.minskole.no/fagerholt/seksjon/22640'};
const $=id=>document.getElementById(id);
const clean=s=>String(s??'');
const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${['bag','check','refresh','book','calendar','trees','waves','activity','music','sparkles','bus','sun','scissors','gift'].includes(name)?name:'book'}"/></svg>`;
const now=norwayCalendar();
const openedAtMs=Date.now();
const query=new URLSearchParams(location.search);
const state={grade:query.get('klasse')==='7'?'7':'3',day:now.day,week:now.week,year:now.year,grades:{},statuses:{},busy:false,weather:null,weatherStatus:'loading',weatherUpdated:0,themeOpen:{},themeDone:{}};
const mondayOfWeek=(year,week)=>{const jan4=new Date(Date.UTC(year,0,4));const mon=new Date(jan4);mon.setUTCDate(jan4.getUTCDate()-(jan4.getUTCDay()+6)%7+(week-1)*7);return mon;};
const fmtDay=d=>d.toLocaleDateString('nb-NO',{timeZone:'UTC',day:'numeric',month:'2-digit'});
const fmtFull=d=>d.toLocaleDateString('nb-NO',{timeZone:'UTC',day:'numeric',month:'long'});
const isSmall=()=>matchMedia('(max-width:750px)').matches;
const dataCurrent=g=>g&&g.week===now.week&&g.year===now.year&&g.status!=='unpublished'&&g.status!=='error'&&(g.grade==='7'||g.group?.key==='rød');
const cacheKey=(grade)=>`skolesekken.cache.v6.${now.year}.${now.week}.${grade}`;
function cacheGet(grade){try{const d=JSON.parse(localStorage.getItem(cacheKey(grade))||'null');return dataCurrent(d)?d:null}catch{return null}}
function cacheSet(grade,plan){try{localStorage.setItem(cacheKey(grade),JSON.stringify(plan))}catch{}}
function message(text,kind='info'){
 const box=$('preview-message');box.hidden=!text;box.textContent=text||'';box.classList.toggle('danger',kind==='warn');
}
function errorBox(text){const el=$('error-message');el.hidden=!text;el.textContent=text||''}
function setStatus(status){
 const good=status==='ok';const partial=status==='partial'||status==='unreadable';
 $('status-pill').textContent=good?'Oppdatert ukeplan':partial?'Delvis lest ukeplan':status==='loading'?'Henter planen…':status==='cached'?'Lagret ukeplan':status==='unpublished'?'Ikke publisert ennå':'Kan ikke hente ukeplan';
 $('status-dot').style.background=good?'#58ab83':status==='loading'?'#9db4b0':'#dfa466';
}

const weatherCacheKey='skolesekken.weather.v1';
function renderWeather(selected,dayName){
 const key=selected.toISOString().slice(0,10);
 const record=state.weather?.days?.[key]||null;
 $('weather-day').textContent=`${dayName} ${fmtDay(selected)}`;
 $('weather-icon').textContent=record?.icon || (state.weatherStatus==='loading'?'⌛':'🌥️');
 $('weather-temp').textContent=typeof record?.temperature==='number'?`${Math.round(record.temperature)}°`:'—';
 $('weather-description').textContent=record?.description || (state.weatherStatus==='demo'?'Eksempelvisning – ikke live vær':state.weatherStatus==='loading'?'Henter værmelding…':state.weatherStatus==='error'?'Været er utilgjengelig':'Ingen værdata for dagen');
 const tempRange=typeof record?.minTemp==='number'&&typeof record?.maxTemp==='number'
   ? `${Math.round(record.minTemp)}° til ${Math.round(record.maxTemp)}° · kl. 08–15`
   : 'Vær i skoletiden · kl. 08–15';
 $('weather-range').textContent=tempRange;
 $('weather-rain').textContent=typeof record?.rainMm==='number'
   ? `💧 ${record.rainApproximate?'Ca. ':''}${String(record.rainMm).replace('.',',')} mm nedbør`
   : '💧 Nedbør: —';
 $('weather-wind').textContent=typeof record?.windMs==='number'
   ? `🍃 ${String(record.windMs).replace('.',',')} m/s vind`
   : '🍃 Vind: —';
 $('weather-credit').textContent=state.weatherStatus==='demo'?'· Ingen live-data i forhåndsvisning':state.weatherStatus==='stale'?'· eldre varsel':'· Yr-prognose';
}
async function loadWeather(force=false){
 state.weatherStatus=state.weather?'stale':'loading';render();
 try {
  const url='/api/weather'+(force?`?fresh=1&t=${Date.now()}`:'');
  const response=await fetch(url,{cache:force?'no-store':'default'});
  const weather=await response.json();
  if(!response.ok || !weather.days || typeof weather.days!=='object')throw new Error(weather.warning||`HTTP ${response.status}`);
  state.weather=weather;
  state.weatherStatus=weather.demo?'demo':weather.stale?'stale':'ok';
  state.weatherUpdated=Date.now();
  try{localStorage.setItem(weatherCacheKey,JSON.stringify({savedAt:Date.now(),data:weather}))}catch{}
 } catch(error){
  let cached=null;
  try{cached=JSON.parse(localStorage.getItem(weatherCacheKey)||'null')}catch{}
  if(cached?.data?.days && Date.now()-cached.savedAt < 4*3600000){state.weather=cached.data;state.weatherStatus='stale'}
  else {state.weather=null;state.weatherStatus='error'}
 } finally{render()}
}
function renderAfterSchool(){
 const activity=afterSchoolForDay({grade:state.grade,year:now.year,week:now.week,dayIndex:state.day});
 const panel=$('after-school');panel.hidden=!activity;
 if(!activity)return;
 panel.classList.toggle('tennis',activity.type==='tennis');
 $('after-school-week').textContent=`UKE ${activity.week}`;
 $('after-school-icon').textContent=activity.emoji;
 $('after-school-title').textContent=activity.title;
 $('after-school-subtitle').textContent=`${activity.weekday} · Etter skolen · Klokkeslett ikke oppgitt`;
 $('after-school-ride-overline').textContent=activity.type==='dance'?'Oppmøte for kjøring':'Hvem kjører?';
 $('after-school-driver').textContent=activity.driverLabel;
 $('after-school-detail').textContent=activity.detail;
 $('after-school-ride').classList.toggle('unassigned',activity.unknownDriver);
}
function renderTheme(g){
 const panel=$('week-theme');
 const raw=(dataCurrent(g)&&typeof g.weekTheme==='string')?g.weekTheme:'';
 const presentation=themePresentation(raw);
 panel.hidden=!presentation;
 if(!presentation)return;
 panel.dataset.tone=presentation.tone;
 $('theme-emoji').textContent=presentation.emoji;
 $('theme-name').textContent=presentation.theme;
 const key=themeProgressKey(now.year,now.week,state.grade,presentation.theme);
 let progress={};try{progress=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
 const completed=state.themeDone[key]??!!progress.done;
 const expanded=state.themeOpen[`${state.grade}:${now.week}`]||completed;
 $('theme-quest').hidden=!expanded;
 $('theme-reveal').setAttribute('aria-expanded',String(expanded));
 $('theme-reveal').textContent=expanded?'Skjul minioppdrag ↑':'🎲 Se minioppdrag ↓';
 $('theme-mission').textContent=presentation.quest;
 $('theme-done').textContent=completed?'✓ Oppdrag fullført!':'✓ Jeg gjorde det!';
 $('theme-done').classList.toggle('completed',completed);
 $('theme-done').setAttribute('aria-pressed',String(completed));
 $('theme-reveal').onclick=()=>{state.themeOpen[`${state.grade}:${now.week}`]=!expanded;renderTheme(g)};
 $('theme-done').onclick=()=>{
   state.themeDone[key]=!completed;
   try{localStorage.setItem(key,JSON.stringify({done:!completed}))}catch{}
   state.themeOpen[`${state.grade}:${now.week}`]=true;
   renderTheme(g);
 };
}
function render(){
 const g=state.grades[state.grade];const status=state.statuses[state.grade]||'loading';
 $('week-badge').textContent=`UKE ${now.week}`;
 $('hero-week-number').textContent=String(now.week);
 setStatus(status);
 renderTheme(g);
 document.querySelectorAll('.gradebtn').forEach(b=>{const active=b.dataset.grade===state.grade;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
 const mon=mondayOfWeek(now.year,now.week);const fri=new Date(mon);fri.setUTCDate(mon.getUTCDate()+4);
 $('hero-week-range').textContent=`${fmtDay(mon)}–${fmtDay(fri)}`;
 $('week-dates').textContent=`${mon.toLocaleDateString('nb-NO',{timeZone:'UTC',weekday:'long'})} ${fmtDay(mon)} – ${fri.toLocaleDateString('nb-NO',{timeZone:'UTC',weekday:'long'})} ${fmtDay(fri)}`;
 $('fetched').textContent=`Fagerholt skole · ${now.year}`;
 $('weekend-note').hidden=now.dow<5;
 $('refresh').disabled=state.busy;
 const dayName=DAYS[state.day];const d=g?.days?.[dayName]||{events:[],bring:[]};
 $('daygrid').innerHTML=DAYS.map((name,i)=>{
  const d=g?.days?.[name]||{};const date=new Date(mon);date.setUTCDate(mon.getUTCDate()+i);
  const expired=isExpiredSchoolDay(i,now.dow);const active=state.day===i&&!expired;
  return `<button type="button" class="daycard${active?' active':''}${expired?' expired':''}" data-day="${i}" aria-pressed="${active}" aria-label="${name} ${fmtDay(date)}${expired?' – utgått':''}" ${expired?'disabled title="Dagen er utgått"':''}><span class="dname">${name}<span class="date">${fmtDay(date)}</span></span>${expired?'<span class="expired-badge">✓ Utgått</span>':''}<span class="di">${DAY_EMOJI[i]}</span><span class="ds">${esc(d.subtitle|| (status==='loading'?'Laster ukeplan…':'Se originalplan'))}</span><span class="endtime">${d.end?'Slutt '+esc(d.end):''}</span>${(()=>{const wd=state.weather?.days?.[date.toISOString().slice(0,10)];return wd&&wd.temperature!==null?`<span class="day-weather">${esc(wd.icon)} ${Math.round(wd.temperature)}°</span>`:''})()}${(()=>{const a=afterSchoolForDay({grade:state.grade,year:now.year,week:now.week,dayIndex:i});return a?`<span class="day-after-school">${esc(a.emoji)} ${esc(a.type==='dance'?'Hip-hop':'Tennis')}</span>`:''})()}</button>`;
 }).join('');
 $('daygrid').querySelectorAll('button:not(:disabled)').forEach(btn=>btn.onclick=()=>{
  const index=Number(btn.dataset.day);if(isExpiredSchoolDay(index,norwayCalendar().dow))return;
  state.day=index;render();
 });
 const selected=new Date(mon);selected.setUTCDate(mon.getUTCDate()+state.day);
 renderWeather(selected,dayName);
 renderAfterSchool();
 $('selected-date').textContent=`${now.dow>=5?'UTGÅTT · ':''}${dayName.toUpperCase()} ${fmtFull(selected).toUpperCase()} · ${state.grade}. KLASSE${state.grade==='3'?' · RØD GRUPPE':''}`;
 $('selected-day').textContent=now.dow>=5?'Siste skoledag denne uken':`Dette skjer på ${dayName.toLowerCase()}`;
 $('schoolhours').textContent=d.start&&d.end?`Skole ${d.start} – ${d.end}`:d.end?`Slutt ${d.end} · se originalen for starttid`:'Sjekk originalplanen for full timeplan';
 $('notice-banner').hidden=!d.alert||!g;$('alert-text').textContent=d.alert||'';
 const events=d.events||[];
 $('events').innerHTML=events.length?events.map(e=>`<article class="event"><div class="event-icon tone-${esc(e.tone||'aqua')}">${icon(e.icon||'book')}</div><div class="event-body"><div class="event-time">${esc(e.time||'Fra ukeplanen')}</div><h4 class="event-title">${esc(e.title||'Aktivitet')}</h4>${e.detail?`<p class="event-desc">${esc(e.detail)}</p>`:''}</div></article>`).join(''):`<p class="empty">${status==='loading'?'Henter ukeplanen fra skolen…':g?'Ingen konkrete aktiviteter er oppgitt for denne dagen. Se originalplanen for full oversikt.':'Ingen bekreftet ukeplan tilgjengelig. Bruk lenken til skolens trinnside nedenfor.'}</p>`;
 const items=[...(g?.everyday||[]),...(d.bring||[])].filter(item=>!['Penal','Skiftetøy'].includes(item.label));
 const unique=[...new Map(items.map(item=>[item.label,item])).values()];
 const packKey=`skolesekken.pack.v6.${now.year}.${now.week}.${state.grade}.${dayName}`;
 let packed={};try{packed=JSON.parse(localStorage.getItem(packKey)||'{}')}catch{}
 $('pack-items').innerHTML=unique.length?unique.map((v,i)=>`<label class="checkrow ${packed[v.label]?'done':''}"><input type="checkbox" data-label="${esc(v.label)}" ${packed[v.label]?'checked':''} aria-label="${esc(v.label)}"><span class="checktext">${esc(v.label)}<small>${esc(v.note||'')}</small></span></label>`).join(''):`<p class="empty">${g?'Ingen spesielle ting registrert for denne dagen. Husk de vanlige skolesakene.':'Pakkelisten vises når en ukeplan er hentet.'}</p>`;
 const progress=()=>{const checks=[...document.querySelectorAll('#pack-items input')];const yes=checks.filter(c=>c.checked).length;$('progress-label').textContent=`${yes} av ${checks.length} pakket`;$('progress-fill').style.width=checks.length?`${yes/checks.length*100}%`:'0%';$('ready').hidden=!checks.length||yes!==checks.length;};
 $('pack-items').querySelectorAll('input').forEach(el=>el.onchange=()=>{packed[el.dataset.label]=el.checked;try{localStorage.setItem(packKey,JSON.stringify(packed))}catch{}el.closest('.checkrow').classList.toggle('done',el.checked);progress()});progress();
 const homework=g?.homework||[];
 $('homework').innerHTML=homework.length?homework.map((h,i)=>`<article class="hw-item"><span class="hw-label tone-${esc(h.tone||'peach')}">${esc(h.subject)}</span><p class="hw-text">${esc(h.detail)}</p></article>`).join(''):'<p class="empty">Ingen lekser hentet fra ukeplanen.</p>';
 const notices=g?.notices||[];
 $('notices').innerHTML=notices.length?notices.map(n=>`<article class="note-item"><span class="note-icon tone-${esc(n.tone||'sky')}">${icon(n.icon||'book',17)}</span><div><p class="note-title">${esc(n.title||'Beskjed')}</p><p class="note-detail">${esc(n.detail||'')}</p></div></article>`).join(''):'<p class="empty">Ingen ukebeskjeder er registrert. Se skolens originalplan.</p>';
 $('pdf-link').href=(dataCurrent(g)&&g.pdf)?g.pdf:SECTIONS[state.grade];
 $('pdf-link').textContent=(dataCurrent(g)&&g.pdf)?'Se original ukeplan ↗':'Se ukeplaner hos skolen ↗';
 $('class-link').href=SECTIONS[state.grade];
 $('source-note').textContent=g?'Hentet fra Fagerholt skole. Automatisk PDF-lesing kan overse eller feiltolke detaljer – original PDF er fasiten.':'Appen søker etter ukeplanen for inneværende uke. Sjekk skolens side hvis den ikke er publisert.';
 if(status==='loading')message('Ser etter ukeplanen for inneværende uke hos Fagerholt skole …');
 else if(status==='ok')message('');
 else if(status==='partial'||status==='unreadable')message(g?.warning||'Planen ble hentet, men deler av PDF-en kunne ikke leses. Kontroller originalen.', 'warn');
 else if(status==='unpublished')message(`Skolen har ennå ikke publisert en ukeplan for uke ${now.week} på trinnsiden. Appen viser ikke forrige ukes plan som om den gjaldt nå.`, 'warn');
 else if(status==='cached')message('Kunne ikke hente en fersk plan akkurat nå. Viser en tidligere hentet kopi fra samme uke. Kontroller originalplanen.', 'warn');
 else message('Ukeplanen kunne ikke hentes akkurat nå. Prøv «Oppdater» eller åpne trinnets side.', 'warn');
}
async function loadGrade(grade,manual=false){
 if(state.busy)return;
 state.busy=true;state.statuses[grade]='loading';errorBox('');render();
 try{
   const suffix=manual?`&fresh=1&_=${Date.now()}`:'';
   const response=await fetch(`/api/plan?grade=${encodeURIComponent(grade)}${suffix}`,{cache:manual?'no-store':'default'});
   const data=await response.json();
   if(!response.ok||data.status==='error')throw new Error(data.warning||`HTTP ${response.status}`);
   if(data.week!==now.week||data.year!==now.year)throw new Error('Fikk en ukeplan med feil ukenummer');
   if(grade==='3'&&data.status!=='unpublished'&&data.group?.key!=='rød')throw new Error('Fikk en plan som ikke er filtrert for rød gruppe');
   if(data.status==='unpublished'){
     state.grades[grade]=null;state.statuses[grade]='unpublished';
   }else{
     state.grades[grade]=data;state.statuses[grade]=data.status||'partial';cacheSet(grade,data);
   }
 }catch(error){
   const cached=cacheGet(grade);
   if(cached){state.grades[grade]=cached;state.statuses[grade]='cached';}
   else{state.grades[grade]=null;state.statuses[grade]='error';errorBox('Klarte ikke å hente siste ukeplan: '+esc(error.message||'Ukjent feil'));}
 }finally{
   state.busy=false;render();
 }
}
const seed=JSON.parse($('seed').textContent);
if(now.year===seed.year&&now.week===seed.week){
  for(const g of ['3','7']){
    const data=seed.grades?.[g];if(data&&(g!=='3'||data.group?.key==='rød')){state.grades[g]={...data,year:now.year,week:now.week,status:'ok'};state.statuses[g]='cached'}
  }
}
const hello=['God mandag!','God tirsdag!','God onsdag!','God torsdag!','God fredag!','God helg!','God søndag!'];
$('hello').innerHTML=esc(hello[now.dow])+' <span aria-hidden="true">☀️</span>';
document.querySelectorAll('.gradebtn').forEach(btn=>btn.addEventListener('click',()=>{
 state.grade=btn.dataset.grade;try{history.replaceState(null,'',`${location.pathname}?klasse=${state.grade}`)}catch{}render();
 if(!state.statuses[state.grade]||state.statuses[state.grade]==='cached')loadGrade(state.grade);
}));
$('refresh').title='Hent siste ukeplan fra skolen';$('refresh').innerHTML=icon('refresh',16)+' Oppdater';
$('refresh').addEventListener('click',()=>{loadGrade(state.grade,true);loadWeather(true)});
render();
loadGrade(state.grade);
loadWeather();
// Refresh the whole page after one hour. Also react promptly at midnight in Norway.
// Browsers may throttle timers in background tabs: visibility/focus catches up on return.
let reloading=false;
function reloadWhenDue(){
 if(reloading)return;
 const current=norwayCalendar();
 if(hasCalendarDateChanged(now,current)||hourlyRefreshDue(openedAtMs,Date.now())){
  reloading=true;location.reload();
 }
}
setInterval(reloadWhenDue,REFRESH_INTERVAL_MS);
setInterval(reloadWhenDue,60*1000); // Detect the next day, even before the hourly refresh.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reloadWhenDue()});
window.addEventListener('focus',reloadWhenDue);
})();
