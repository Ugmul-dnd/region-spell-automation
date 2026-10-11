import assert from "node:assert/strict";
globalThis.Hooks={once(){}};
globalThis.foundry={utils:{deepClone:structuredClone},dice:{terms:{}}};
let evaluations=0;
class OperatorTerm {constructor(data){Object.assign(this,data);this._evaluated=true;}toJSON(){return {kind:"operator",operator:this.operator};}}
class NumericTerm {constructor(data){Object.assign(this,data);this._evaluated=false;} evaluate(){this._evaluated=true;return this;}get total(){return this.number;}toJSON(){return {kind:"numeric",number:this.number,evaluated:this._evaluated};}}
class Die {
    constructor({number,faces,results=[],options={},modifiers=[]}){Object.assign(this,{number,faces,results,options,modifiers});}
    async evaluate(){evaluations++;this.results=Array.from({length:this.number},()=>({result:6,active:true}));}
    get total(){return this.results.filter(r=>r.active!==false).reduce((sum,r)=>sum+r.result,0);}
    toJSON(){return {kind:"die",number:this.number,faces:this.faces,results:this.results,options:this.options,modifiers:this.modifiers};}
}
Object.assign(foundry.dice.terms,{OperatorTerm,NumericTerm,Die});
class DamageRoll {
    constructor(terms,options={}){this.terms=terms;this.options=options;this._evaluated=true;this._total=this._evaluateTotal();}
    _evaluateTotal(){return this.terms.reduce((sum,term)=>sum+(term.total??0),0);}
    resetFormula(){}
    toJSON(){return {terms:this.terms.map(term=>term.toJSON()),options:this.options};}
    static fromData(data){return new this(data.terms.map(term=>term.kind==="die"?new Die(term):term.kind==="numeric"?new NumericTerm(term):new OperatorTerm(term)),data.options);}
}
globalThis.CONFIG={Dice:{DamageRoll}};
const source=Buffer.from(process.env.RSA_DAMAGE_MODE_SOURCE,"base64").toString().replace('"./shared-activity-card.js"',JSON.stringify(`data:text/javascript;base64,${process.env.RSA_SHARED_SOURCE}`));
const {changeDamageCritical,canAdjustDamage,isAttackDamage}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const normal=new DamageRoll([new Die({number:1,faces:8,results:[{result:4,active:true}]}),new OperatorTerm({operator:"+"}),new NumericTerm({number:3})],{isCritical:false});
const critical=await changeDamageCritical(normal,true);assert.equal(critical._total,13);assert.equal(evaluations,1);assert.equal(normal._total,7);
const restored=await changeDamageCritical(critical,false);assert.equal(restored._total,7);
const recritical=await changeDamageCritical(restored,true);assert.equal(recritical._total,13);assert.equal(evaluations,1,"Switching modes reuses cached critical dice");
const originalCrit=new DamageRoll([new Die({number:2,faces:6,results:[{result:2,active:true},{result:5,active:true}]}),new NumericTerm({number:4})],{isCritical:true});
const lowered=await changeDamageCritical(originalCrit,false);assert.equal(lowered._total,6);
assert.equal((await changeDamageCritical(lowered,true))._total,11);
assert.equal(canAdjustDamage({type:"damage",author:{id:"p"},getAssociatedActivity:()=>({type:"attack"})},{id:"p"}),true);
assert.equal(canAdjustDamage({type:"damage",author:{id:"p"},getAssociatedActivity:()=>({type:"attack"})},{id:"other"}),false);
assert.equal(canAdjustDamage({type:"attack"},{isGM:true}),false);
await assert.rejects(changeDamageCritical(new DamageRoll(normal.terms,{critical:{bonusDamage:"1d6"}}),true));
console.log("Damage mode checks passed: both initial modes, bonus preservation, cached critical dice, original-roll isolation, permissions and unsupported formula rejection.");

const powerfulNormal=new DamageRoll([new Die({number:2,faces:8,results:[{result:3,active:true},{result:5,active:true}]}),new OperatorTerm({operator:"+"}),new NumericTerm({number:4})],{isCritical:false,critical:{powerfulCritical:true}});
const beforePower=evaluations;
const powerfulCrit=await changeDamageCritical(powerfulNormal,true);
assert.equal(powerfulCrit._total,28,"2d8 rolled 8 + maximized 16 + modifier 4");
assert.equal(evaluations,beforePower,"Powerful critical adds maximum without new dice");
assert.equal((await changeDamageCritical(powerfulCrit,false))._total,12);
const originalPower=new DamageRoll([new Die({number:2,faces:8,results:[{result:3,active:true},{result:5,active:true}]}),new OperatorTerm({operator:"+"}),new NumericTerm({number:16}),new OperatorTerm({operator:"+"}),new NumericTerm({number:4})],{isCritical:true,critical:{powerfulCritical:true}});
const powerNormal=await changeDamageCritical(originalPower,false);assert.equal(powerNormal._total,12);
assert.equal((await changeDamageCritical(powerNormal,true))._total,28);
console.log("Powerful-critical checks passed: rolled dice plus maximized bonus, both initial modes, modifier preservation and no rerolling.");
for (const result of [critical,restored,recritical,powerfulCrit,powerNormal]) {
    assert.doesNotThrow(()=>JSON.stringify(result.toJSON()),"Mode caches remain JSON-serializable after restoration");
}
const newBonus=powerfulCrit.terms.find(term=>term instanceof NumericTerm&&term.number===16);
assert.equal(newBonus._evaluated,true,"Maximized bonus is evaluated before native damage aggregation");
let repeated=powerfulCrit;
for(let i=0;i<8;i++){repeated=await changeDamageCritical(repeated,i%2===1);assert.doesNotThrow(()=>JSON.stringify(repeated.toJSON()));}
console.log("Damage serialization checks passed: native options aliasing, repeated toggles and evaluated maximized bonus.");
for(const type of ["save","damage","utility"]){
    const card={type:"damage",getAssociatedActivity:()=>({type}),author:{id:"p"}};
    assert.equal(isAttackDamage(card),false);
    assert.equal(canAdjustDamage(card,{isGM:true}),false,"GM cannot toggle critical damage on non-attack activity");
}
assert.equal(isAttackDamage({type:"damage"}),false,"Unknown damage sources do not expose critical controls");
assert.equal(isAttackDamage({type:"damage",getAssociatedActivity:()=>({type:"attack"})}),true);
console.log("Damage critical scope checks passed: attack activities only; saves, automatic damage and unknown sources excluded.");