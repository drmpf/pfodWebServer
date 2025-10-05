// Shared constants to avoid circular dependencies
  var JS_VERSION = "V1.1.5 -- 19th September 2025";
// V1.1.5 added init() of drawings
// V1.1.4 added pfodMainDrawing.h generated file
// V1.1.3 dwg updates as response received

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.JS_VERSION = JS_VERSION;
}

// Export for Node.js use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JS_VERSION };
}