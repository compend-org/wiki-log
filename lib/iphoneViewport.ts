// ABOUTME: Stops iPhones zooming the page when a form field takes focus.
// ABOUTME: Other devices keep the default viewport, because this setting would block their pinch zoom.

// iPhones zoom in on fields with text under 16px, and ours are 15px. iOS ignores
// maximum-scale for pinch zoom but honours it for that automatic zoom. Android
// browsers honour it for both, so it must only ever reach iPhones.
//
// The browser uses the last viewport tag, so this adds its own instead of editing
// Next's: React wouldn't recognise an edited tag when it hydrates. Next also adds
// its tag again on client-side navigation, so this moves its own back to the end.
export const iphoneViewportScript = `(function(){if(navigator.userAgent.indexOf("iPhone")<0)return;var m=document.createElement("meta");m.name="viewport";m.content="width=device-width, initial-scale=1, maximum-scale=1";function k(){var a=document.head.querySelectorAll('meta[name="viewport"]');if(a[a.length-1]!==m)document.head.appendChild(m);}k();new MutationObserver(k).observe(document.head,{childList:true});})();`;
