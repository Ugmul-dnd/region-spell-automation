const ID="ugmuls-5-5e-automation";
function automated(usage,message){const flags=message?.data?.flags?.[ID];return flags?.regionTriggered||flags?.riderTriggered||!!usage?.cause?.activity;}
export function needsSelectedTarget(activity){
 if(!activity||activity.target?.template?.type||activity.target?.affects?.type==="self")return false;
 if(activity.type==="attack")return true;
 const type=activity.target?.affects?.type;
 return ["spell","feat","weapon"].includes(activity.item?.type)&&!!type&&type!=="none"&&type!=="space";
}
export function targetUseWarning(activity,count,{scaled=true}={}){
 if(!needsSelectedTarget(activity))return;
 if(count<1)return "This requires a target before use";
 const raw=activity.target?.affects?.count;
 // Native preparation evaluates target formulas again after the chosen slot scales the item.
 const limit=Number(raw),single=limit===1||(activity.type==="attack"&&(raw==null||raw===""));
 if(scaled&&single&&count!==1)return "This requires a single target before use";
}
function targetCount(message){const targets=message?.data?.system?.targets??game.user.targets??[];return new Set(Array.from(targets,target=>target.token??target.document?.uuid??target.uuid??target)).size;}
function check(activity,usage,message,scaled){
 if(automated(usage,message))return;
 const warning=targetUseWarning(activity,targetCount(message),{scaled});
 if(warning){ui.notifications.warn(warning);return false;}
}
export function guardTargetStart(activity,usage,dialog,message){return check(activity,usage,message,false);}
export function guardScaledTargets(activity,usage,message){return check(activity,usage,message,true);}
export function guardAttackTargets(config,dialog,message){return check(config.subject,{},message,true);}
Hooks.once("ready",()=>{
 // Register before pending-card publication, and validate the native scaled activity before any consumption.
 Hooks.on("dnd5e.preUseActivity",guardTargetStart);
 Hooks.on("dnd5e.preActivityConsumption",guardScaledTargets);
 Hooks.on("dnd5e.preRollAttackV2",guardAttackTargets);
});
