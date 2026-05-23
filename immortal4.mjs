import { initCombat, playerAct, endTurn, abilityUsable } from "./src/engine/combat.js";
import { enemyFromNPC } from "./src/data/bestiary.js";
import { deriveCombatStats } from "./src/engine/combat-stats.js";
import { getAbilityDef, BASIC_ATTACK } from "./src/data/abilities.js";
import { chooseAction } from "./src/engine/combat-ai.js";
import { recomputeVitalityMax } from "./src/engine/attributes.js";
import { makeInitialState } from "./src/data/initial-state.js";
const codex = makeInitialState().world.codex;
// Max-DR tank-sustain kit: aegis/godward/stoneskin/adamant DR + colossus/juggernaut/stalwart HP + sustain.
const kit = { characters:{wanderer:{id:"wanderer",worn:["w","a","h"]}}, items:{
  w:{id:"w",name:"Godsword",kind:"weapon",tier:"divine",passives:[{id:"worldbreaker",tier:"divine"},{id:"ascendant",tier:"divine"},{id:"bloodthirst",tier:"divine"},{id:"vampiric",tier:"divine"}]},
  a:{id:"a",name:"Godplate",kind:"armor",tier:"divine",armorClass:"heavy",passives:[{id:"godward",tier:"divine"},{id:"colossus",tier:"divine"},{id:"juggernaut",tier:"divine"},{id:"stoneskin",tier:"divine"}]},
  h:{id:"h",name:"Crown",kind:"clothing",tier:"divine",passives:[{id:"stalwart",tier:"divine"},{id:"adamant",tier:"divine"},{id:"renewing",tier:"divine"},{id:"phalanx",tier:"divine"}]},
}};
function gs(){ return recomputeVitalityMax({ name:"Godslayer", resolve:24, resolveMax:24, attributes:{body:30,reflex:30,vigor:30,mind:30,wit:30,presence:30}, abilities:["power-strike","execute","rend","renewal","second-wind","wrath","sanctuary","bulwark-stance"].map(id=>({id,tier:"divine"})), proficiencies:{} }); }
const ci=deriveCombatStats(gs(),kit);
console.log(`GODSLAYER: maxHP ${ci.maxHealth} · armor ${ci.armor} · DR ${(ci.dr*100).toFixed(0)}% · lifesteal ${ci.triggers?.lifesteal||0}% · weapon ${ci.weapon.min}-${ci.weapon.max}`);
function choose(cs){ const c=cs.player.abilities.map(a=>({id:a.id,tier:a.tier,def:getAbilityDef(a.id)})).filter(c=>c.def&&abilityUsable(cs,c.id)); const opp=cs.enemies.filter(e=>e.health>0&&!e.resolved); if(!opp.length)return null; const ch=chooseAction(cs.player,opp,c,{allies:[cs.player]}); if(!ch)return{abilityId:BASIC_ATTACK.id,targetIndex:0}; return {abilityId:ch.ability.id, targetIndex: ch.target?cs.enemies.indexOf(ch.target):0}; }
function run(b){ let cs=initCombat(gs(), kit, [enemyFromNPC(codex.characters[b],codex,{tierId:"divine"})]); let g=0,mh=1;
  while(!["victory","defeat","resolved","playerFled"].includes(cs.phase)&&g++<3000){ if(cs.phase!=="player")break; let a=true,s=0;
    while(a&&cs.phase==="player"&&s++<16){ const m=choose(cs); if(!m){a=false;break;} const bf=cs.player.actionsLeft||1; cs=playerAct(cs,m.abilityId,m.targetIndex); if(["victory","defeat","resolved","playerFled"].includes(cs.phase))break; mh=Math.min(mh,Math.max(0,cs.player.health)/cs.player.maxHealth); if((cs.player.actionsLeft||0)>=bf||(cs.player.actionsLeft||0)<=0)a=false; }
    if(["victory","defeat","resolved","playerFled"].includes(cs.phase))break; cs=endTurn(cs); mh=Math.min(mh,Math.max(0,cs.player.health)/cs.player.maxHealth); }
  return { win:cs.phase==="victory", dies:cs.phase==="defeat", turns:cs.turn, mh }; }
for(const b of ["great-wyrm","demon-king"]){ let N=120,w=0,d=0,t=0,mh=0; for(let i=0;i<N;i++){const r=run(b);if(r.win)w++;if(r.dies)d++;t+=r.turns;mh+=r.mh;}
  console.log(`SOLO ${b}: win ${Math.round(w/N*100)}% · DIES ${Math.round(d/N*100)}% · turns ${(t/N).toFixed(0)} · lowestHP ${Math.round(mh/N*100)}%`); }
