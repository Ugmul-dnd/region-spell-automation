const ID="region-spell-automation";
const authority=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
export function managedRegionEffect(model) {
    const behavior=model.behavior;
    if(behavior?.getFlag?.(ID,"managedRegionEffect"))return true;
    const item=fromUuidSync(model.region?.flags?.dnd5e?.item??"",{strict:false});
    const config=item?game.settings.get(ID,"spellTable")?.[item.name]:null;
    return !!item&&(config?.regionEffects??[]).some(effect=>behavior?.name===`${item.name} - Effect - ${effect.name}`);
}
export function installRegionEffectAuthority(Type=CONFIG.RegionBehavior?.dataModels?.["dnd5e.applyActiveEffect"]) {
    if(!Type||Type.rsaRegionAuthority)return;
    Type.rsaRegionAuthority=true;
    for(const [eventName,handler] of Object.entries(Type.events)) {
        Type.events[eventName]=async function(event) {
            if(!managedRegionEffect(this))return handler.call(this,event);
            if(!authority())return;
            // Native private handlers require event.user.isSelf. The GM executes
            // the original native operation without changing its effect data.
            return handler.call(this,{...event,user:game.user});
        };
    }
    const update=Type.prototype._onUpdate;
    Type.prototype._onUpdate=function(...args) {
        if(managedRegionEffect(this)&&!authority())return;
        return update.apply(this,args);
    };
}
Hooks.once("ready",()=>installRegionEffectAuthority());
