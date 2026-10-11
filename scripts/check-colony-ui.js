// Direct UI adapter acceptance, with the actual Notables engine and a minimal DOM.
// Run: node scripts/check-colony-ui.js
// This does not launch a browser or verify visual layout/theme contrast.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, "..");
const notables = require(path.join(root, 'engine/notables.js'));
const config = require(path.join(root, 'engine/config.js'));
class El {
  constructor(tag='div') { this.tag = tag; this.children=[]; this.events={}; this.hidden=false; this.textContent=''; this.className=''; this.style={setProperty(){}}; this.classList={add:(c)=>this.className+=' '+c, remove:()=>{}, toggle:()=>{}}; }
  append(...els) { els.forEach(e=>{e.parent=this;this.children.push(e)}); }
  replaceChildren(...els) { this.children=[]; this.textContent=''; this.append(...els); }
  setAttribute(k,v) { this[k]=v; }
  addEventListener(k,f) { this.events[k]=f; }
  querySelector(q) { for (const c of this.children) { if(q[0]==='.' ? c.className.split(' ').includes(q.slice(1)) : c.tag===q) return c; const found=c.querySelector(q); if(found)return found; } return null; }
  remove() { this.parent.children=this.parent.children.filter(c=>c!==this); }
}
const fixture=(id)=>({id,name:id,status:'PENDING',powerType:'PRODUCTION_INCREASE',powerMagnitude:0.15,habitatsServed:[]});
const state=notables.createState({pending:Array.from({length:7},(_,i)=>fixture('candidate-'+(i+1)))});
const ctx={document:{createElement:t=>new El(t),getElementById:()=>null},window:{IdleSnakeNotables:notables,IdleSnakeConfig:config},habitatConfig:config.habitatConfig,gameView:{notablesState:state,habitats:{counts:Array(8).fill(0)}},latestSnapshot:{notableCapacity:1},engineQueries:{capabilities:()=>({canRecruit:false})},notableDisplayName:n=>n.name,notablePowerText:n=>n.powerType,notableSourceText:()=> 'Test',notableContributionText:n=>'Generated '+n.totalProductionAdded,formatDuration:v=>String(v),isMenuPanelVisible:e=>!e.hidden,setText:(e,t)=>e.textContent=t,setHidden:(e,h)=>e.hidden=h,confirm:()=>true,setTimeout:f=>{ctx.hold=f; return 1},clearTimeout:()=>{}};
for(const n of ['notablesPanelEl','notablesRosterEl','eldersRosterEl','pendingNotableEl','candidateDecisionEl','recruitNotableButtonEl','notablesButtonEl','notablesButtonLabelEl','notablesPendingIndicatorEl','notablesSummaryEl']) ctx[n]=new El();
const actions=[];
ctx.commitNotableAction=a=>{actions.push(a); let result;
 if(a.type==='resolvePendingNotable')result=notables.resolvePending(state,a.decision,a.replaceNotableId,100,ctx.gameView.habitats.counts,a.candidateId);
 if(a.type==='unassignNotable')result=notables.unassign(state,a.notableId);
 if(['dismissNotable','retireNotable'].includes(a.type))result=notables.removeRetained(state,a.notableId,100);
 ctx.renderNotables(); return result;
};
vm.createContext(ctx);
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('const numberFormatCache'), source.indexOf('// Write to a text node')), ctx);
vm.runInContext(source.slice(source.indexOf('function formatDuration('), source.indexOf('function togglePause()')), ctx);
vm.runInContext(source.slice(source.indexOf('function notablePowerText('), source.indexOf('function commitNotableAction(')), ctx);
vm.runInContext(source.slice(source.indexOf('const NOTABLE_HOLD_CONFIRM_MS'),source.indexOf('function showNotablesMenu()')),ctx);
ctx.renderNotables();
const buttons=()=>ctx.pendingNotableEl.children[1].children.filter(e=>e.tag==='button');
assert.equal(ctx.pendingNotableEl.children.length,2); assert.equal(ctx.pendingNotableEl.children[0].children[0].textContent,'candidate-1');
assert.equal(ctx.notablesPendingIndicatorEl.textContent,'7 Pending');
buttons()[0].events.click(); assert.equal(state.retained[0].id,'candidate-1');assert.equal(state.pending.length,6);assert.equal(buttons()[0].disabled,true);
const original=JSON.stringify(state.pending);assert.equal(notables.resolvePending(state,'ACCEPT',null,100,[],state.pending[0].id).reason,'notableCapacityFull');assert.equal(JSON.stringify(state.pending),original);
buttons()[1].events.click();assert.equal(state.pending[0].id,'candidate-3');assert.equal(state.pending.length,5);
const beforeDismiss=JSON.stringify(state.pending);ctx.notablesRosterEl.children[0].querySelector('.notable-remove').events.pointerdown({type:'pointerdown',preventDefault(){}});ctx.hold();assert.equal(state.retained.length,0);assert.equal(JSON.stringify(state.pending),beforeDismiss);assert.equal(buttons()[0].disabled,false);
buttons()[0].events.click();assert.equal(state.retained[0].id,'candidate-3');
ctx.gameView.habitats.counts[0]=1;notables.assign(state,'candidate-3',0,config.habitatConfig.habitats,ctx.gameView.habitats.counts);ctx.renderNotables();
let rosterCard=ctx.notablesRosterEl.children[0];const service=rosterCard.querySelector('.notable-service');const remove=rosterCard.querySelector('.notable-remove');state.retained[0].totalServiceTime=60000;state.retained[0].hasServed=true;state.retained[0].totalProductionAdded=2;ctx.syncNotableService();assert.equal(ctx.notablesRosterEl.children[0],rosterCard);assert.equal(rosterCard.querySelector('.notable-service'),service);assert.match(service.textContent,/01:00 served/);assert.equal(remove.textContent,'Hold to Retire');
rosterCard.querySelector('.notable-actions').children[0].events.click();assert.equal(state.retained[0].assignedHabitatId,null);assert.equal(state.pending.length,4);
const replace=ctx.pendingNotableEl.children[1].children.find(e=>e.tag==='select');replace.value='candidate-3';replace.events.change();assert.equal(state.elders[0].id,'candidate-3');assert.equal(state.retained[0].id,'candidate-4');assert.equal(state.pending.length,3);
while(state.pending.length)buttons()[1].events.click();assert.equal(ctx.candidateDecisionEl.hidden,true);assert.equal(ctx.pendingNotableEl.children.length,0);assert.equal(ctx.notablesPendingIndicatorEl.hidden,true);assert.equal(ctx.notablesSummaryEl.textContent,'(1/1)');
console.log('PASS: actual Notables renderer + engine: 7→6→5→4→3→0 pending, one visible card, Keep capacity, Reject, Dismiss preserves queue, Unassign, served replacement archival, badge/count, hidden zero state, and service refresh keeps controls intact.');

// Run the actual habitat renderer against its engine read model, including tiny
// nonzero production rates, different output types, and current Lake reduction.
const queries = require(path.join(root, 'engine/queries.js'));
const sessionApi = require(path.join(root, 'engine/session.js'));
const initial = sessionApi.createGameSession({ now: 0 }).snapshot();
ctx.latestSnapshot = { ...initial, best: 1000, habitats: { ...initial.habitats, counts: [1, 2, 3, 4, 0, 0, 0, 0] } };
ctx.engineQueries = queries;
ctx.gameView.provisionsTotal = 0;
ctx.gameView.branchesTotal = 0;
ctx.padScore = String;
for (const name of ['colonyCountEl', 'colonyPlacedCountEl', 'colonyProvisionTotalEl', 'colonyBranchTotalEl', 'colonySeedIncomeRateEl', 'colonyProvisionIncomeRateEl', 'colonyBranchIncomeRateEl']) ctx[name] = new El();
ctx.habitatCardRefs = config.habitatConfig.habitats.map(() => Object.fromEntries(['card', 'outputTypes', 'notable', 'assignedCount', 'naturalCount', 'maxCount', 'capacityTooltip', 'overCapacityRow', 'idleSnakes', 'bonus', 'button', 'upgradeButton'].map(key => [key, new El()])));
vm.runInContext(source.slice(source.indexOf('function renderHabitats()'), source.indexOf('function placeSnakeInHabitat(')), ctx);
ctx.renderHabitats();
const panel = queries.habitatPanel(ctx.latestSnapshot);
assert.equal(ctx.habitatCardRefs[0].outputTypes.textContent, `Effect: +${ctx.formatDecimal(panel.habitats[0].seedRate)} Seed/Sec`);
assert.equal(ctx.habitatCardRefs[1].outputTypes.textContent, `Effect: -${ctx.formatDecimal(panel.habitats[1].eggHatchReduction)} Hatch Sec/Egg`);
assert.match(ctx.habitatCardRefs[2].outputTypes.textContent, /Branch\/Sec/);
assert.match(ctx.habitatCardRefs[3].outputTypes.textContent, new RegExp(`Effect: \\+${ctx.formatDecimal(panel.habitats[3].provisionRate)} Provision/Sec`));
assert.equal(ctx.habitatCardRefs[0].overCapacityRow.hidden, true);
ctx.latestSnapshot.habitats.counts[1] = 0;
ctx.renderHabitats();
assert.equal(ctx.habitatCardRefs[1].outputTypes.textContent, 'Effect: -0 Hatch Sec/Egg');
console.log('PASS: actual habitat renderer + queries: current Seed/Branch/Provision rates, nonzero precision, Lake active reduction and zero effect, no empty consumption row.');
