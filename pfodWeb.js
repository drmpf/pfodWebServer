/*   
   pfodWeb.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// Canvas Drawing Application
// Dependencies are loaded as global variables via script tags
// MergeAndRedraw and DrawingManager are available on window object

// DEBUG flag
// any setting of DEBUG other then false or 'false' enables debug
var DEBUG = false;
if ((typeof DEBUG === 'undefined') || (DEBUG === false) || (DEBUG === 'false')) {
  if (typeof DEBUG === 'undefined') {
    console.log('[PFODWEB_DEBUG] DEBUG not defined.  Disabling logging');
  } else {  
    console.log('[PFODWEB_DEBUG] DEBUG defined as false.  Disabling logging. DEBUG = ',DEBUG);
  }
  // false suppress logging
    if(!window.console) window.console = {};
    var methods = ["log", "debug", "warn", "info"];
    for(var i=0;i<methods.length;i++){
        console[methods[i]] = function(){};
    }
} else {
   console.log('[PFODWEB_DEBUG] DEBUG defined and not false.  Logging Enabled.  DEBUG =',DEBUG);
}


// Dynamic script loader
function loadScript_noDebug(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load all dependencies in order
async function loadDependencies_noDebug() {
  const dependencies = [
    './version.js',
    './pfodWebDebug.js',
    './DrawingManager.js',
    './displayTextUtils.js',
    './redraw.js',
    './mergeAndRedraw.js',
    './webTranslator.js',
    './drawingDataProcessor.js',
    './pfodWebMouse.js'

  ];

  for (const dep of dependencies) {
    await loadScript_noDebug(dep);
  }
}

// Event Listeners
window.addEventListener('DOMContentLoaded', async () => {
  await loadDependencies_noDebug();
  await initializeApp();
});

