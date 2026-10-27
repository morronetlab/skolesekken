import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('unødvendige informasjonsmeldinger fjernes uten ekstra tomt panel',()=>{
 for(const text of ['kun gruppens egne tider','3. klasse er tilpasset rød gruppe.','Oppdateres automatisk fra Fagerholt skoles publiserte ukeplan.']){
  assert.equal(html.includes(text)||js.includes(text),false,text);
 }
 assert.doesNotMatch(html,/id="group-message"/);
 assert.doesNotMatch(js,/\$\('group-message'\)/);
 assert.match(js,/else if\(status==='ok'\)message\(''\)/);
 assert.match(html,/.preview-toast\[hidden\]\{display:none!important\}/);
});

test('gruppefiltrering og viktige driftsvarsler er fortsatt på plass',()=>{
 assert.match(js,/data.group\?\.key!=='rød'/);
 assert.match(js,/else if\(status==='unpublished'\)message/);
 assert.match(js,/else if\(status==='partial'\|\|status==='unreadable'\)message/);
 assert.match(js,/else if\(status==='cached'\)message/);
 assert.match(html,/id="pdf-link"/);
});
