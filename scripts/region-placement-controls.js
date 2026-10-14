const MODULE_ID="ugmuls-5-5e-automation";
const installed=new WeakSet();
let activePlacement=null;

export function placementOptions(options) {
    return {...options,
        onMove(context) {
            if (options.onMove?.(context) === false) return false;
            if (context.shape.type !== "cone" || !canvas.grid.isSquare) return;
            const point=canvas.grid.getSnappedPoint(context.position,{mode:CONST.GRID_SNAPPING_MODES.VERTEX});
            context.shape.move(point,{snap:false});
            return false;
        },
        onRotate(context) {
            // Permit rectangles even when D&D5e's grid-aligned square setting
            // would veto rotation. The override applies only during this preview.
            if (["cone","rectangle"].includes(context.shape.type)) return;
            return options.onRotate?.(context);
        }
    };
}
export function handlePlacementWheel(event) {
    const layer=activePlacement;
    if (!layer || game.settings.get(MODULE_ID,"regionPlacementControls") !== true || !layer._placementContext) return;
    const board=document.getElementById("board");
    if (!board || (event.target !== board && !board.contains(event.target))) return;
    event.preventDefault();event.stopImmediatePropagation();
    const delta=event.deltaY ?? event.delta;
    if (event.ctrlKey || event.metaKey) {canvas._onMouseWheel({delta});return;}
    // Native Region placement uses Shift for coarse rotation; invert that
    // modifier to provide our coarse default and Shift precision.
    layer._onMouseWheel({delta,shiftKey:!event.shiftKey,ctrlKey:false,altKey:event.altKey});
}
export function installPlacementControls(layer) {
    if (!layer || installed.has(layer)) return;
    installed.add(layer);
    const original=layer.placeRegions;
    layer.placeRegions=async function(data,options={}) {
        const casting=Array.from(data).some(region=>region["flags.core.MeasuredTemplate"] || region.flags?.core?.MeasuredTemplate);
        if (!casting || game.settings.get(MODULE_ID,"regionPlacementControls") !== true) return original.call(this,data,options);
        const previous=activePlacement;activePlacement=this;
        try {return await original.call(this,data,placementOptions(options));}
        finally {activePlacement=previous;}
    };
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"regionPlacementControls",{
    name:"Spell/Feature Region Placement Controls",
    hint:"Snap cone origins to square-grid intersections. During casting placement, scroll rotates (15 degrees), Shift-scroll rotates precisely (5 degrees), and Ctrl-scroll zooms. Allows square template rotation during placement.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("ready",()=>{
    installPlacementControls(canvas.regions);
    window.addEventListener("wheel",handlePlacementWheel,{capture:true,passive:false});
});
Hooks.on("canvasReady",()=>installPlacementControls(canvas.regions));

export function prepareSelfEmanation(activity,config) {
    if (game.settings.get(MODULE_ID,"autoAttachSelfEmanations") !== true ||
        !["spell","feat"].includes(activity.item?.type) || !config.shapes?.length ||
        !config.shapes.every(shape=>shape.type === "emanation")) return;
    const self=activity.target?.affects?.type === "self" || activity.range?.units === "self" ||
        activity.item?.system?.range?.units === "self";
    if (!self) return;
    const usage=activity.getUsageToken?.();
    const token=usage?.document ?? usage;
    // Never guess from a different controlled token or ambiguous actor copies.
    if (!token?.id || canvas.scene?.tokens.get(token.id)?.actor?.uuid !== activity.actor?.uuid) return;
    config.rsaSelfEmanationToken=token.id;
}

export function installSelfEmanationPlacement(Placement) {
    if (!Placement || Placement._rsaSelfEmanationInstalled) return;
    Placement._rsaSelfEmanationInstalled=true;
    const original=Placement.place;
    Placement.place=function(config) {
        const token=canvas.scene?.tokens.get(config.rsaSelfEmanationToken);
        if (!token || game.settings.get(MODULE_ID,"autoAttachSelfEmanations") !== true) return original.call(this,config);
        const scale=canvas.scene.grid.size/canvas.scene.grid.distance;
        return Promise.resolve(config.shapes.map(shape=>({
            type:"emanation",radius:shape.size*scale,token:token.id,
            base:{type:"token",x:token.x,y:token.y,width:token.width,height:token.height,shape:token.shape,rotation:0}
        })));
    };
}
Hooks.once("init",()=>game.settings.register(MODULE_ID,"autoAttachSelfEmanations",{
    name:"Automatically Attach Self Emanations",
    hint:"Place self-origin emanations on the casting token without manual placement. Uses native Region creation and attachment. Other template shapes keep manual placement.",
    scope:"world",config:true,type:Boolean,default:true
}));
Hooks.once("ready",()=>{
    installSelfEmanationPlacement(dnd5e.canvas.TemplatePlacement);
    Hooks.on("dnd5e.preCreateMeasuredTemplate",prepareSelfEmanation);
});
