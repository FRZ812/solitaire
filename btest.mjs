import { initCombat, playerAct, endTurn, abilityUsable } from "./src/engine/combat.js";
import { enemyFromNPC } from "./src/data/bestiary.js";
import { getAbilityDef, BASIC_ATTACK } from "./src/data/abilities.js";
import { chooseAction } from "./src/engine/combat-ai.js";
import { recomputeVitalityMax } from "./src/engine/attributes.js";
import { makeInitialState } from "./src/data/initial-state.js";
const codex = makeInitialState().world.codex;
function kit(extraW){ return { characters:{wanderer:{id:"wanderer",worn:["w","a","h"]}}, items:{
  w:{id:"w",name:"Sword",kind:"weapon",tier:"divine",passives:[{id:"worldbreaker",tier:"divine"},{id:"savage",tier:"divine"},{id:"sunder",tier:"divine"},...extraW]},
  a:{id:"a",name:"Plate",kind:"armor",tier:"divine",armorClass:"heavy",passives:[{id:"godward",tier:"divine"},{id:"colossus",tier:"divine"},{id:"juggernaut",tier:"divine"},{id:"stoneskin",tier:"divine"}]},
  h:{id:"h",name:"Crown",kind:"clothing",tier:"divine",passives:[{id:"stalwart",tier:"divine"},{id:"benediction",tier:"divine"},{id:"renewing",tier:"divine"},{id:"vampiric",tier:"divine"}]},
}};}
function pc(abils){ return recomputeVitalityMax({ name:"P", resolve:24,resolveMax:24, attributes:{body:30,reflex:30,vigor:30,mind:30,wit:30,presence:30}, abilities:abils.map(id=>({id,tier:"divine"})), proficiencies:{} }); }
function choose(cs){ const c=cs.player.abilities.map(a=>({id:a.id,tier:a.tier,def:getAbilityDef(a.id)})).filter(c=>c.def&&abilityUsable(cs,c.id)); const opp=cs.enemies.filter(e=>e.health>0&&!e.resolved); if(!opp.length)return null; const ch=chooseAction(cs.player,opp,c,{allies:[cs.player]}); if(!ch)return{abilityId:BASIC_ATTACK.id,targetIndex:0}; return {abilityId:ch.ability.id, targetIndex: ch.target?cs.enemies.indexOf(ch.target):0}; }
function run(boss,codx,abils){ let cs=initCombat(pc(abils),codx,[enemyFromNPC(codex.characters[boss],codex,{tierId:"divine"})]); let g=0;
  while(!["victory","defeat","resolved","playerFled"].includes(cs.phase)&&g++<2500){ if(cs.phase!=="player")break; let a=true,s=0;
    while(a&&cs.phase==="player"&&s++<16){ const m=choose(cs); if(!m){a=false;break;} const bf=cs.player.actionsLeft||1; cs=playerAct(cs,m.abilityId,m.targetIndex); if(["victory","defeat","resolved","playerFled"].includes(cs.phase))break; if((cs.player.actionsLeft||0)>=bf||(cs.player.actionsLeft||0)<=0)a=false; } if(["victory","defeat","resolved","playerFled"].includes(cs.phase))break; cs=endTurn(cs); }
  return { win:cs.phase==="victory", turns:cs.turn }; }
function suite(label,boss,codx,abils){ let N=120,w=0,t=0; for(let i=0;i<N;i++){const r=run(boss,codx,abils);if(r.win)w++;t+=r.turns;} console.log(`${label}: win ${Math.round(w/N*100)}% · turns ${(t/N).toFixed(0)}`); }
const base=["power-strike","execute","rend","renewal","second-wind","wrath"];
console.log("--- Vyrnholt: does %HP bleed (hemorrhage) chip it? ---");
suite("  no hemorrhage  ", "great-wyrm", kit([{id:"keen-edge",tier:"divine"}]), base);
suite("  +hemorrhage    ", "great-wyrm", kit([{id:"hemorrhage",tier:"divine"}]), base);
console.log("--- Demon King: does BKB (unbreakable-will) beat the curse-alpha? ---");
suite("  no BKB         ", "demon-king", kit([{id:"keen-edge",tier:"divine"}]), base);
suite("  +BKB           ", "demon-king", kit([{id:"keen-edge",tier:"divine"}]), [...base,"unbreakable-will"]);
