const MODULE_ID="region-spell-automation";
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
