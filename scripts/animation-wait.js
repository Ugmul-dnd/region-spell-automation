// Animations are presentation, never a dependency on another user keeping a window active.
export async function waitForVisibleAnimation(animation,{document:doc=globalThis.document,window:win=globalThis.window}={}){
 const pending=Promise.resolve(animation);
 const inactive=()=>doc?.hidden===true||doc?.hasFocus?.()===false;
 if(inactive()){pending.catch(error=>console.warn("Background dice animation failed",error));return;}
 let release;const background=new Promise(resolve=>release=resolve);
 const visibility=()=>{if(inactive())release();};
 const blur=()=>release();
 doc?.addEventListener?.("visibilitychange",visibility);win?.addEventListener?.("blur",blur);
 try{visibility();await Promise.race([pending,background]);}
 finally{doc?.removeEventListener?.("visibilitychange",visibility);win?.removeEventListener?.("blur",blur);}
}
Hooks.once("ready",()=>{globalThis.Ugmuls55eAutomationWaitForAnimation=waitForVisibleAnimation;});
