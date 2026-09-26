/**
 * Light / dark theme.
 *
 * The theme is `data-theme` on <html>, set by THEME_SCRIPT before the first
 * paint so a dark reader never sees a flash of the light page. A choice made
 * with the header toggle is kept in localStorage and wins; without one the OS
 * setting decides, and is followed live if it changes.
 */

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pakremits-theme'

export const THEME_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)');
function apply(t){d.dataset.theme=t}
var s=localStorage.getItem(k);
apply(s==='light'||s==='dark'?s:(m.matches?'dark':'light'));
m.addEventListener('change',function(e){if(!localStorage.getItem(k))apply(e.matches?'dark':'light')});
}catch(e){}})()`
