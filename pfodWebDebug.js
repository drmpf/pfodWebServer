/*   
   pfodWebDebug.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// Canvas Drawing Application
// Dependencies are loaded as global variables via script tags
// MergeAndRedraw and DrawingManager are available on window object


// JavaScript version constant loaded globally from version.js
// JS_VERSION is available as a global variable

// DrawingViewer class to encapsulate all viewer functionality
class DrawingViewer {
  constructor() {
    console.log('[PFODWEB_DEBUG] DrawingViewer constructor called - NEW INSTANCE CREATED');
    console.log('[PFODWEB_DEBUG] URL:', window.location.href);
    console.log('[PFODWEB_DEBUG] Referrer:', document.referrer);

    // Extract target IP from URL or global variable
    this.targetIP = this.extractTargetIP();
    console.log('[PFODWEB_DEBUG] Target IP:', this.targetIP);

    // DOM Elements
    this.canvas = document.getElementById('drawing-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvasContainer = document.getElementById('canvas-container');

    // Application State - each viewer has its own isolated state
    this.drawingManager = new window.DrawingManager(); // Isolated manager for this viewer
    this.updateTimer = null;
    this.isUpdating = false; // Start with updates disabled until first load completes
    this.js_ver = JS_VERSION; // Client JavaScript version

    // Request queue system - isolated per viewer
    this.requestQueue = [];
    // Use simple boolean for queue processing state (single-threaded JavaScript environment)
    this._isProcessingQueue = false;
    this.sentRequest = null; // Currently in-flight request
    this.currentRetryCount = 0;
    this.MAX_RETRIES = 5;

    // Request tracking for touch vs insertDwg - isolated per viewer
    this.requestTracker = {
      touchRequests: new Set(), // Track touch-triggered requests
      insertDwgRequests: new Set() // Track insertDwg-triggered requests
    };

    // Transformation state for push/pop operations - used during JSON processing
    this.transformStack = []; // Stack to store transformation states

    // Map to store all active touchZones by command - now managed by DrawingManager
    // this.touchZonesByCmd = {}; // Format: {cmd: touchZone} - DEPRECATED

    // Canvas resize tracking to prevent unnecessary flashing
    this.lastLogicalWidth = null;
    this.lastLogicalHeight = null;
    this.lastWindowWidth = null;
    this.lastWindowHeight = null;

    // Restore previous window dimensions from storage to prevent unnecessary resize on reload
    this.restorePreviousDimensions();

    // Touch state for handling mouse/touch events - instance-specific
    this.touchState = {
      isDown: false,
      wasDown: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startTime: 0,
      longPressTimer: null,
      targetTouchZone: null,
      hasEnteredZones: new Set(),
      hasDragged: false,
      lastSentTouchType: null
    };

    // Current identifier for touchZone requests - defaults to 'pfodWeb'
    this.currentIdentifier = 'pfodWeb';

    // Queue for holding responses while mouse is down (to prevent flashing)
    this.pendingResponseQueue = [];

    // Text input dialog state
    this.textInputDialog = null;

    // Transformation state for push/pop operations - used during JSON processing
    this.currentTransform = {
      x: 0,
      y: 0,
      scale: 1.0
    }; // Current transformation (initial state)

    // Create isolated MergeAndRedraw instance for this viewer
    this.mergeAndRedraw = new window.MergeAndRedraw();

    // Create DrawingDataProcessor instance for this viewer
    this.drawingDataProcessor = new window.DrawingDataProcessor(this);

    // Set up event listeners using pfodWebMouse.js
    this.setupEventListeners();
  }

  // Extract target IP address from URL parameters or global variable
  extractTargetIP() {
    // First check if global variable was set by index.html
    if (window.PFOD_TARGET_IP) {
      return window.PFOD_TARGET_IP;
    }

    // Extract from URL parameters (e.g., ?targetIP=192.168.1.100)
    const urlParams = new URLSearchParams(window.location.search);
    const targetIP = urlParams.get('targetIP');
    
    if (targetIP) {
      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipRegex.test(targetIP)) {
        const parts = targetIP.split('.');
        // Validate IP address ranges
        const isValidIP = parts.every(part => {
          const num = parseInt(part, 10);
          return num >= 0 && num <= 255;
        });
        if (isValidIP) {
          return targetIP;
        }
      }
    }
    
    return null;
  }

  // Build endpoint URL with target IP
  buildEndpoint(path) {
    if (this.targetIP) {
      return `http://${this.targetIP}${path}`;
    }
    return path; // Fallback to relative URL
  }

  // Build fetch options with appropriate CORS settings
  buildFetchOptions(additionalHeaders = {}) {
    return {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...additionalHeaders
      },
      mode: this.targetIP ? 'cors' : 'same-origin',
      credentials: this.targetIP ? 'omit' : 'same-origin',
      cache: 'no-cache'
    };
  }

  // Get context-specific storage key based on referrer and current URL
  getDimensionStorageKey() {
    const isIframe = window.self !== window.top;
    const referrer = document.referrer;

    if (isIframe && referrer) {
      // Extract page name from referrer for iframe context
      const referrerPath = new URL(referrer).pathname;
      const pageName = referrerPath.split('/').pop().split('.')[0] || 'unknown';
      return `pfodWeb_dimensions_iframe_${pageName}`;
    } else {
      // Main window context
      return 'pfodWeb_dimensions_main';
    }
  }

  // Restore previous dimensions from localStorage to prevent unnecessary resize on reload
  restorePreviousDimensions() {
    try {
      const storageKey = this.getDimensionStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const dims = JSON.parse(saved);
        this.lastLogicalWidth = dims.logicalWidth;
        this.lastLogicalHeight = dims.logicalHeight;
        this.lastWindowWidth = dims.windowWidth;
        this.lastWindowHeight = dims.windowHeight;
        console.log(`[DIMENSIONS] Restored previous dimensions from ${storageKey}: logical=${this.lastLogicalWidth}x${this.lastLogicalHeight}, window=${this.lastWindowWidth}x${this.lastWindowHeight}`);
      } else {
        console.log(`[DIMENSIONS] No previous dimensions found for ${storageKey}`);
      }
    } catch (e) {
      console.log('[DIMENSIONS] Error restoring dimensions:', e);
    }
  }

  // Save current dimensions to localStorage for future reloads
  saveDimensions(logicalWidth, logicalHeight, windowWidth, windowHeight) {
    try {
      const dims = {
        logicalWidth: logicalWidth,
        logicalHeight: logicalHeight,
        windowWidth: windowWidth,
        windowHeight: windowHeight
      };
      const storageKey = this.getDimensionStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(dims));
      console.log(`[DIMENSIONS] Saved dimensions to ${storageKey}: logical=${logicalWidth}x${logicalHeight}, window=${windowWidth}x${windowHeight}`);
    } catch (e) {
      console.log('[DIMENSIONS] Error saving dimensions:', e);
    }
  }

  // Set up event listeners for the canvas - delegates to pfodWebMouse.js
  setupEventListeners() {
    // Mouse and touch event handling is now in pfodWebMouse.js
    if (typeof window.pfodWebMouse !== 'undefined') {
      window.pfodWebMouse.setupEventListeners(this);
    } else {
      console.error('pfodWebMouse.js not loaded - mouse events will not work');
    }
  }

  // Queue initial request using existing request queue system
  queueInitialRequest() {
    const startupCmd = '{.}';
    const endpoint = `/pfodWeb?cmd=${encodeURIComponent(startupCmd)}`;

    console.log('Sending {.} request without version to get drawing name from server via session context');
    console.log(`Queueing initial request: ${endpoint}`);

    // Add to request queue with mainMenu type - not a drawing request
    const requestType = 'mainMenu';
    this.addToRequestQueue(null, endpoint, null, null, requestType);
  }

  // Update page title to include main drawing name
//  updatePageTitle(drawingName) {
//    if (drawingName) {
//      document.title = `pfodWeb ${drawingName}`;
//    }
//  }

  // Load drawing data from the server
  async loadDrawing() {
    // Main drawing is always the first in the array
    const currentDrawingName = this.drawingManager.drawings.length > 0 ? this.drawingManager.drawings[0] : '';
    if (!currentDrawingName) {
      console.error('No drawing name specified');
      return;
    }

    try {
      // Disable updates during loading
      this.isUpdating = false;
      this.drawingManager.allDrawingsReceived = false; // this is not actually used!!
      // Clear any existing timer
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
        this.updateTimer = null;
      }

      // Check if we have a saved version
      const savedVersion = localStorage.getItem(`${currentDrawingName}_version`);
      const savedData = localStorage.getItem(`${currentDrawingName}_data`);

      let endpoint = `/pfodWeb`;
      // Add version query parameter only if we have both version and data
      if (savedVersion) { // && savedData) {
        // Use /pfodWeb endpoint with cmd parameter in {drawingName} format
        endpoint = `?cmd=${encodeURIComponent('{' + savedVersion+ ':'+ currentDrawingName + '}')}`;
        endpoint += `&version=${encodeURIComponent(savedVersion)}`; // add this as well for control server
        console.log(`Using saved version: ${savedVersion}`);
      } else {
        console.log('No valid saved version+data pair - requesting fresh data (dwg:start)');
        // Use /pfodWeb endpoint with cmd parameter in {drawingName} format
        endpoint += `?cmd=${encodeURIComponent('{' + currentDrawingName + '}')}`;
      }

      console.log(`Requesting drawing data: ${endpoint}`);

      // Add main drawing request to the queue
      this.addToRequestQueue(currentDrawingName, endpoint, null, null, 'main');
    } catch (error) {
      console.error('Failed to load drawing:', error);
      this.isUpdating = true; // Re-enable updates even if loading failed
    }
  }

  // Schedule the next update request
  scheduleNextUpdate() {
    const mainDrawingName = this.drawingManager.getMainDrawingName();
    console.log(`[SCHEDULE_NEXT_UPDATE] ${mainDrawingName}`);
    // Clear any existing timer first
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
      console.log('Cleared existing update timer');
    }

    // Get the current main drawing data
    const currentDrawingData = this.drawingManager.getCurrentDrawingData();

    // Only schedule an update if refresh is greater than 0
    // This ensures that a refresh value of 0 properly disables automatic updates
    if (this.isUpdating && currentDrawingData && currentDrawingData.refresh > 0) {
      console.log(`[REFRESH] Scheduling next update in ${currentDrawingData.refresh}ms for drawing "${this.drawingManager.drawings[0]}"`);
      this.updateTimer = setTimeout(() => this.fetchUpdate(), currentDrawingData.refresh);
      // Also schedule updates for inserted drawings
      if (this.drawingManager.drawings.length > 1) {
        console.log(`Will fetch updates for ${this.drawingManager.drawings.length - 1} inserted drawings during next update cycle`);
      }
    } else if (currentDrawingData && currentDrawingData.refresh === 0) {
      console.log(`[REFRESH] Automatic updates disabled (refresh=0) for drawing "${this.drawingManager.drawings[0]}"`);
    } else if (!currentDrawingData) {
      console.log('[REFRESH] No drawing data available, cannot schedule updates');
    } else if (!this.isUpdating) {
      console.log('[REFRESH] Updates currently paused');
    }

  }

  // Fetch updates from the server
  async fetchUpdate() {
    console.log(`[REFRESH] Refresh timer fired - starting update cycle for drawing "${this.drawingManager.drawings[0]}" at ${new Date().toISOString()}`);
    try {
      // Main drawing is always the first in the array
      const currentDrawingName = this.drawingManager.drawings.length > 0 ? this.drawingManager.drawings[0] : '';
      const currentDrawingData = this.drawingManager.getDrawingData(currentDrawingName);

      if (!currentDrawingData || !currentDrawingName) {
        throw new Error('No active drawing');
      }

      // Set flag to indicate we're currently updating
      this.isUpdating = false;
      this.drawingManager.allDrawingsReceived = false; // this is not actually used!!

      console.log(`[UPDATE] Starting update cycle at ${new Date().toISOString()}`);
      console.log(`[UPDATE] Main drawing: "${currentDrawingName}", inserted drawings: ${this.drawingManager.drawings.length - 1}`);

      // Clear the request queue
      this.requestQueue = [];

      // First, queue the main drawing update
      console.log(`[UPDATE] Queueing update for main drawing "${currentDrawingName}"`);
      await this.queueDrawingUpdate(currentDrawingName);

      // Then queue updates for all inserted drawings in the order they were inserted
      if (this.drawingManager.drawings.length > 1) {
        // Skip the first drawing (main drawing) and only include inserted drawings
        const insertedDrawings = this.drawingManager.drawings.slice(1);
        console.log(`[UPDATE] Queueing updates for ${insertedDrawings.length} inserted drawings:`, insertedDrawings);

        // Queue each inserted drawing update
        for (const insertedDrawingName of insertedDrawings) {
          console.log(`[UPDATE] Queueing update for inserted drawing "${insertedDrawingName}"`);
          await this.queueDrawingUpdate(insertedDrawingName);
        }
      }

      // Re-enable updates
      this.isUpdating = true;
      this.scheduleNextUpdate();
      console.log(`[UPDATE] Update cycle queued at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('[UPDATE] Failed to update drawing:', error);
      // Re-enable updates even if this one failed
      this.isUpdating = true;
      this.scheduleNextUpdate();
    }
  }

  // Add a request to the queue
  addToRequestQueue(drawingName, endpoint, options, touchZoneInfo, requestType = 'unknown') {
    console.warn(`[QUEUE] Adding request for "${drawingName}" to queue (type: ${requestType})`);
    console.log(`[QUEUE] Endpoint "${endpoint}"`);
    if (requestType == 'unknown') {
      console.error(`[QUEUE] Error: Unknown requestType`);
      return;
    }
    
    this.setProcessingQueue(true);

    // Track the request type
    if (requestType === 'touch') {
      this.requestTracker.touchRequests.add(drawingName);
      console.log(`[QUEUE] Tracking touch request for "${drawingName}"`);
    } else if (requestType === 'insertDwg') {
      this.requestTracker.insertDwgRequests.add(drawingName);
      console.log(`[QUEUE] Tracking insertDwg request for "${drawingName}"`);
    }

    // Check if this is a drag request and remove any existing drag requests from the same touchZone cmd
    if (touchZoneInfo && touchZoneInfo.filter === TouchZoneFilters.DRAG) {
      const cmd = touchZoneInfo.cmd;
      console.log(`[QUEUE] Removing existing DRAG requests for cmd="${cmd}" to minimize network traffic`);

      // Remove existing drag requests from the same cmd
      this.requestQueue = this.requestQueue.filter(request => {
        const isDragRequest = request.touchZoneInfo &&
          request.touchZoneInfo.filter === TouchZoneFilters.DRAG &&
          request.touchZoneInfo.cmd === cmd;
        if (isDragRequest) {
          console.log(`[QUEUE] Removed duplicate DRAG request for cmd="${cmd}"`);
        }
        return !isDragRequest;
      });
    }

    // Always use buildFetchOptions for consistent CORS handling
    const finalOptions = this.buildFetchOptions();
    console.log(`[QUEUE] Using buildFetchOptions for consistent CORS handling`);
    
    this.requestQueue.push({
      drawingName: drawingName,
      endpoint: endpoint,
      options: finalOptions,
      retryCount: 0,
      touchZoneInfo: touchZoneInfo,
      requestType: requestType
    });
    console.warn(`[QUEUE] addToRequestQueue current queue is:`, JSON.stringify(this.requestQueue, null, 2));
    // Process the queue if not already processing
    this.processRequestQueue();
  }

  // process response of type {,..|+A} and {; ,,|+A~dwgName}
  processMenuResponse(data, request) {
    let cmd;
    if (data.cmd) {
      cmd = data.cmd;
    } else {
      console.log('[QUEUE] No cmd field in server response ', JSON.stringify(data));
      return false;
    }
    let msgType = cmd[0];
    if (!(msgType.startsWith("{,") || msgType.startsWith("{;"))) {
      console.log('[QUEUE] Not a menu response ', JSON.stringify(data));
      return false;
    }

    let result = translateMenuResponse(cmd);
    if (result.pfodDrawing == 'error') {
      this.handleDrawingError(result);
      return false;
    }

    // result has form
    //    const result = {
    //  pfodDrawing: 'menu',
    //  drawingName: ${drawingName}', << may be empty
    //  identifier: ${identifier}
    //});
    this.currentIdentifier = result.identifier;
    let drawingName;
    if (result.drawingName.trim() !== '') {
      drawingName = result.drawingName; // update it
    } else {
      drawingName = this.drawingManager.currentDrawingName; // assume we are updating main dwg from menu
    }
    console.log(`[processMenuResponse] Updated dwgName and currentDrawingName "${drawingName}"`);
    this.drawingManager.currentDrawingName = drawingName;
    // Update page title with drawing name
   // this.updatePageTitle(drawingName);

    // Add the drawing as the first drawing in the array if not already present
    if (!this.drawingManager.drawings.includes(drawingName)) {
      this.drawingManager.drawings.unshift(drawingName);
    }

    // Check if server response includes version information
    const serverVersion = data.version;
    let storedVersion = null;

    // Get stored version for this drawing using DrawingManager
    if (this.drawingManager) {
      storedVersion = this.drawingManager.getStoredVersion(drawingName);
    }

    // Build the drawing request endpoint
    let drawingEndpoint = `/pfodWeb?cmd=${encodeURIComponent('{' + drawingName + '}')}`;

    // Include version in request only if we have stored version that matches server version
    if (storedVersion && serverVersion && storedVersion === serverVersion) {
      drawingEndpoint += `&version=${encodeURIComponent(storedVersion)}`;
      console.log(`[QUEUE] Version match: Including version ${storedVersion} in {${drawingName}} request`);
    } else {
      console.log(`[QUEUE] Version mismatch or no stored version: Sending {${drawingName}} without version (stored: ${storedVersion}, server: ${serverVersion})`);
    }

    // Queue the actual drawing request
    this.addToRequestQueue(drawingName, drawingEndpoint, request.options, null, 'insertDwg');
    console.log(`[QUEUE] Processed drawing menu item ${cmd}`);
    return true;
  }

  isEmptyCmd(cmd) {
    if (!cmd) {
      return false
    }
    if (cmd.length < 2) {
      return false;
    }
    let cmd0 = cmd[0].trim();
    let cmd1 = cmd[1].trim();
    if ((cmd0 == '{') && (cmd1 == '}')) {
      console.log(`[DRAWING_DATA] Received empty cmd response `);
      return true; // Successfully handled - no drawing data to process
    }
    return false;
  }

  // Atomic helper methods for queue processing state
  isProcessingQueue() {
    return this._isProcessingQueue;
  }

  setProcessingQueue(value) {
    const oldValue = this._isProcessingQueue;
    this._isProcessingQueue = value;
    console.log(`[QUEUE_STATE] setProcessingQueue(${value}) - oldValue: ${oldValue}, newValue: ${value}`);
    return value;
  }

  trySetProcessingQueue(expectedValue, newValue) {
    if (this._isProcessingQueue === expectedValue) {
      this._isProcessingQueue = newValue;
      console.log(`[QUEUE_STATE] trySetProcessingQueue(${expectedValue}, ${newValue}) - success: true`);
      return true;
    } else {
      console.log(`[QUEUE_STATE] trySetProcessingQueue(${expectedValue}, ${newValue}) - success: false, current: ${this._isProcessingQueue}`);
      return false;
    }
  }

  redrawCanvas(isTouchAction = false) {
              // Update the MergeAndRedraw module with the latest state
      console.warn(`[QUEUE] redrawCanvas isTouchAction: ${isTouchAction} isDown: ${this.touchState.isDown}`);
              if (!this.touchState.isDown) {
                if (this.touchState.wasDown) {
                  this.touchState.wasDown = this.touchState.isDown;
                   const drawingName = this.drawingManager.currentDrawingName;
                  if (drawingName) {
      console.warn(`[QUEUE] redrawCanvas restoreFromTouchAction: ${drawingName}`);
                    window.pfodWebMouse.restoreFromTouchAction(this, drawingName);
                  }
               }
          this.mergeAndRedraw.updateState({
            ...this.drawingManager.getMergeAndRedrawState(),
            requestQueue: this.requestQueue
          });
              }

          // Redraw the canvas with what we have
          if (isTouchAction) {
            // For touchAction, skip resize and call mergeAndRedraw directly
            this.mergeAndRedraw.redrawCanvas(true);
          } else {
            this.resizeCanvas();
          }
   }
    
   
  // Process the request queue
  async processRequestQueue() {
    // Safety check: ensure requestQueue is initialized
    if (!this.requestQueue) {
      console.error('[QUEUE] Error: requestQueue is undefined. Aborting queue processing.');
      return;
    }
    if (this.sentRequest) {
      console.log(`[QUEUE] processRequestQueue have sentRequest, queue length: ${this.requestQueue.length}`);
    } else {
      console.log(`[QUEUE] processRequestQueue no sentRequest, queue length: ${this.requestQueue.length}`);
    }       
    // Try to atomically set processing state from false to true
//    if (!this.trySetProcessingQueue(false, true)) {
//      console.log(`[QUEUE] Already processing queue - skipping`);
//      return;
//    }

    // Return early if there's already a request in flight or queue is empty
    if (this.sentRequest || this.requestQueue.length === 0) {
      if (this.sentRequest) {
        console.log(`[QUEUE] Request already in flight for "${this.sentRequest.drawingName}" - waiting`);
      }
      // Reset processing state before returning
      if (this.sentRequest) {
        this.setProcessingQueue(true);
      } else {
        console.log(`[QUEUE] NO sentRequest and queue empty`);
        this.setProcessingQueue(false);
        this.drawingManager.allDrawingsReceived = true; // this is not actually used!!
       console.warn(`[QUEUE] processRequestQueue calling redrawCanvas`);
        setTimeout(() => {
            this.redrawCanvas();
        }, 10);
      }
      return;
    }

    console.log(`[QUEUE] processRequestQueue current queue is:`, JSON.stringify(this.requestQueue, null, 2));

 //    this.setProcessingQueue(true); // have non-zero queue length
    // Remove the request from queue and move it to sentRequest
    const request = this.requestQueue.shift();
    console.warn(`[QUEUE] after setting sentRequest the current queue is:`, JSON.stringify(this.requestQueue, null, 2));
    this.sentRequest = request;
    console.warn(`[QUEUE] sentRequest is:`, JSON.stringify(this.sentRequest, null, 2));

    try {
      if (request.retryCount > 0) {
       console.warn(`[QUEUE] Processing request for "${request.drawingName}" (retry: ${request.retryCount}/${this.MAX_RETRIES})`);
      }

      // Track the touchZone filter and cmd for this request being sent
      if (request.touchZoneInfo) {
        if (!this.sentRequests) {
          this.sentRequests = [];
        }
        this.sentRequests.push({
          drawingName: request.drawingName,
          cmd: request.touchZoneInfo.cmd,
          filter: request.touchZoneInfo.filter,
          timestamp: Date.now()
        });
        console.log(`[QUEUE] Tracking sent request: cmd="${request.touchZoneInfo.cmd}", filter="${request.touchZoneInfo.filter}"`);
      }
      // Ensure endpoint has full URL with target IP if it's a relative path
      let endpoint = request.endpoint;
      console.log(`[QUEUE] Original endpoint: ${endpoint}, targetIP: ${this.targetIP}`);
      if (endpoint.startsWith('/') && this.targetIP) {
        endpoint = `http://${this.targetIP}${endpoint}`;
        console.log(`[QUEUE] Transformed endpoint to HTTP: ${endpoint}`);
      }
      
      const response = await fetch(endpoint, request.options);

      console.warn(`[QUEUE] Received response for "${request.drawingName}": status ${response.status}, queue length: ${this.requestQueue.length}`);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} for drawing "${request.drawingName}"`);
      }

      // Get response text first to log the raw JSON
      const responseText = await response.text();
      console.log(`[QUEUE] Received raw JSON data for "${request.drawingName}":`);
      console.log(responseText);
     // Clear the sent request and continue processing
      this.sentRequest = null;
      //this.requestQueue.shift(); // remove request regardless of what it was this response handles it
      
      let lastRequest = request.requestType;
      /***
      // Prefilter JSON to fix newlines in strings before parsing
      // prehaps add this back later to catch all control chars
      function prefilterJSON(jsonString) {
        let result = '';
        let inString = false;
        let escaping = false;
        
        for (let i = 0; i < jsonString.length; i++) {
          const char = jsonString[i];
          
          if (escaping) {
            result += char;
            escaping = false;
            continue;
          }
          
          if (char === '\\') {
            result += char;
            escaping = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            result += char;
            continue;
          }
          
          if (inString && char === '\n') {
            result += '\\n';  // Replace literal newline with escaped newline
          } else {
            result += char;
          }
        }
        
        return result;
      }
      
      // Parse the JSON for processing
      const cleanedResponseText = prefilterJSON(responseText);
      const data = JSON.parse(cleanedResponseText);
      console.log('[QUEUE] parsedText ', JSON.stringify(data,null,2));
      **/
      const data = JSON.parse(responseText);
      // Handle different response types for 
      let cmd;
      if (data.cmd) {
        cmd = data.cmd;
        let msgType = cmd[0];
        if ((msgType.startsWith("{,") || msgType.startsWith("{;"))) {
          console.log('[QUEUE] Got a menu response ', JSON.stringify(data,null,2));
          lastRequest = 'mainMenu'  // kluge to handle mainmenu update response to a button press Only from pfodDevice with cmds
        }
      } else {
        console.log('[QUEUE] No cmd field in server response ', JSON.stringify(data));
      }


      if (lastRequest === 'mainMenu') {
        var result = this.processMenuResponse(data, request);
        if (!result) {
          console.error(`[QUEUE] Invalid mainMenu response format. Got: ${cmd}`);
        }

        // Continue processing immediately - no timeout needed
    console.warn(`[QUEUE] after process mainMenu the current queue is:`, JSON.stringify(this.requestQueue, null, 2));
        this.processRequestQueue();
        return;
        // else continue to process touch
      }

      // Check if server returned empty cmd response for a drawing request
      if (this.isEmptyCmd(data.cmd) && (lastRequest === 'insertDwg')) {
        console.warn(`[QUEUE] WARNING: Requested drawing "${request.drawingName}" but server returned empty cmd "{}". Drawing not found on server.`);
      }


      // Check if this response should be discarded due to newer drag requests in queue
      if (request.touchZoneInfo && request.touchZoneInfo.filter === TouchZoneFilters.DRAG) {
        const cmd = request.touchZoneInfo.cmd;
        const hasNewerDragRequest = this.requestQueue.some(queuedRequest =>
          queuedRequest.touchZoneInfo &&
          queuedRequest.touchZoneInfo.filter === TouchZoneFilters.DRAG &&
          queuedRequest.touchZoneInfo.cmd === cmd
        );

        if (hasNewerDragRequest) {
          console.log(`[QUEUE] Discarding response for DRAG cmd="${cmd}" - newer request exists in queue`);
          // Remove the processed request from the queue first
//          this.sentRequest = null;
//          this.requestQueue.shift();
          console.warn(`[QUEUE] after newerDragRequest the current queue is:`, JSON.stringify(this.requestQueue, null, 2));

      //    this.processRequestQueue();
          // Continue processing next request
          setTimeout(() => {
            if (this.sentRequest || this.requestQueue.length !== 0) {
              this.processRequestQueue();
            }
          }, 10);
          return;
        } 
      }

      // Handle the response data
      if (this.touchState.isDown) {
        // Mouse is down - queue the response to prevent flashing
        console.log(`[QUEUE] Mouse is down (touchState.isDown=${this.touchState.isDown}) - queuing response for "${request.drawingName}" to prevent flashing`);
        // Remove the processed request from the queue first
//         this.sentRequest = null;
//         this.requestQueue.shift();
         console.warn(`[QUEUE] after isDown sentRequest the current queue is:`, JSON.stringify(this.requestQueue, null, 2));


        // For DRAG responses, keep only the latest one
        if (request.touchZoneInfo && request.touchZoneInfo.filter === TouchZoneFilters.DRAG) {
          const cmd = request.touchZoneInfo.cmd;
          // Remove any existing DRAG response for the same cmd
          this.pendingResponseQueue = this.pendingResponseQueue.filter(pendingResponse =>
            !(pendingResponse.request.touchZoneInfo &&
              pendingResponse.request.touchZoneInfo.filter === TouchZoneFilters.DRAG &&
              pendingResponse.request.touchZoneInfo.cmd === cmd)
          );
          console.log(`[QUEUE] Keeping only latest DRAG response for cmd="${cmd}"`);
        }

        // Add this response to the pending queue
        this.pendingResponseQueue.push({
          request: request,
          data: data
        });
        console.log(`[QUEUE] Added to pending queue. Total pending responses: ${this.pendingResponseQueue.length}`);
      } else {
        // Mouse is up - process immediately
        // No need to restore - we'll do a full merge with the new response data

        console.log(`[QUEUE] Processing data for drawing "${request.drawingName}" (type: ${request.requestType})`);
        // check for {|+ menu return to load/reload dwg
        var result = this.processMenuResponse(data, request);
        if (result) {
          return; // have processed this
        } // else continue
        // Insert name property from request since responses no longer include it
        data.name = request.drawingName;
//         this.sentRequest = null;
//         this.requestQueue.shift();
         console.warn(`[QUEUE] after mouse up the current queue is:`, JSON.stringify(this.requestQueue, null, 2));


        this.processDrawingData(data, null, request.requestType);
        // Clear the sent request since it's been processed
        this.sentRequest = null;
        setTimeout(() => {
           this.processRequestQueue();
        }, 10);
        return;
      }

      // Check if all drawings have been received
      // We do this after processing nested insertDwg items which might have been added to queue
      if (this.requestQueue.length === 0 && !this.sentRequest) {
        console.log(`[QUEUE] All drawings processed and queue is empty. Redrawing canvas with all drawing data.`);
        this.drawingManager.allDrawingsReceived = true; // this is not actually used!!
        console.log(`[QUEUE} Mouse isDown: ${this.touchState.isDown}`);

        this.redrawCanvas(this.touchState.isDown);
        /**
        // Update the MergeAndRedraw module with the latest state
        this.mergeAndRedraw.updateState({
          ...this.drawingManager.getMergeAndRedrawState(),
          requestQueue: this.requestQueue,
          sentRequest: this.sentRequest
        });

        // Call resizeCanvas first to ensure proper scaling before redraw
        this.resizeCanvas();
        // Redraw the canvas using the MergeAndRedraw module
        // This is required as a backup in case resizeCanvas didn't trigger a redraw
        // this.mergeAndRedraw.redrawCanvas();
        **/
      } else {
        console.log(`[QUEUE] Queue not empty after processing - ${this.requestQueue.length} requests remaining. Deferring redraw.`);
        // The queue processing will continue automatically
      }

    } catch (error) {
      let dwgName = " ";
      if  (request.drawingName !== undefined && request.drawingName !== null) {
        dwgName = request.drawingName;
      }
      console.error(`[QUEUE] Error processing request for "${dwgName}":`, error);

      // Additional diagnostics for debugging
      console.log(`[QUEUE] Debugging state for "${dwgName}":`);
      console.log(`- Main drawing name: ${this.drawingManager.drawings.length > 0 ? this.drawingManager.drawings[0] : ''}`);
      console.log(`- Drawing in drawings array: ${this.drawingManager.drawings.includes(request.drawingName)}`);
      console.log(`- Drawing in drawingsData: ${this.drawingManager.drawingsData[request.drawingName] ? 'yes' : 'no'}`);
      console.log(`- unindexedItems collection exists: ${this.drawingManager.unindexedItems[request.drawingName] ? 'yes' : 'no'}`);
      console.log(`- indexedItems collection exists: ${this.drawingManager.indexedItems[request.drawingName] ? 'yes' : 'no'}`);
      console.log(`- touchZonesByCmd collection exists: ${this.drawingManager.touchZonesByCmd[request.drawingName] ? 'yes' : 'no'}`);

      // Try to fix any missing collections
      if (!this.drawingManager.unindexedItems[request.drawingName] || !this.drawingManager.indexedItems[request.drawingName]) {
        console.log(`[QUEUE] Attempting to fix missing collections for "${dwgName}"`);
        this.drawingManager.ensureItemCollections(request.drawingName);
      }

      // Increment retry count
      request.retryCount++;

      if (request.retryCount <= this.MAX_RETRIES) {
        console.log(`[QUEUE] Retrying request for "${request.drawingName}" (attempt ${request.retryCount} of ${this.MAX_RETRIES})`);
        // Put the request back at the front of the queue for retry
        this.requestQueue.unshift(request);
        this.sentRequest = null;
        setTimeout(() => {
           this.processRequestQueue();
        }, 10);
        return;

      } else {
        console.error(`[QUEUE] Maximum retries (${this.MAX_RETRIES}) reached for "${request.drawingName}". Removing from queue.`);

        // Display error message only for the main drawing
        if (request.drawingName === this.drawingManager.drawings[0]) {
          this.handleDrawingError({
            error: 'request_failed',
            message: `Failed to load drawing "${request.drawingName}" after ${this.MAX_RETRIES} attempts`,
            pfodDrawing: 'error'
          });
        } else {
          // For inserted drawings, just log the error but continue processing
          console.warn(`[QUEUE] ERROR: Failed to load inserted drawing "${request.drawingName}" after ${this.MAX_RETRIES} attempts - continuing without it`);
        }

        // Clear the failed request (it's already been removed from sentRequest)
        this.sentRequest = null;
 //       setTimeout(() => {
 //          this.processRequestQueue();
 //       }, 10);
        
        // For inserted drawings, if we're at the end of the queue, proceed with redraw
        if (this.requestQueue.length === 0 && !this.sentRequest) {
          console.log(`[QUEUE] Queue empty after failed requests. Drawing with available data.`);
          this.drawingManager.allDrawingsReceived = true; // this is not actually used!!
          this.setProcessingQueue(false);
          this.redrawCanvas();
/**          
          // Update the MergeAndRedraw module with the latest state
          this.mergeAndRedraw.updateState({
            ...this.drawingManager.getMergeAndRedrawState(),
            requestQueue: this.requestQueue
          });

          // Redraw the canvas with what we have
          this.resizeCanvas();
          //this.mergeAndRedraw.redrawCanvas();
**/          
        }
      }
    } finally {
      // If there are more requests in the queue, continue processing
  //    if (this.requestQueue.length > 0 && !this.sentRequest) {
        // Add a small delay between requests
        console.warn(`[QUEUE] Finally post processRequestQueue.`);
        setTimeout(() => {
            if (this.sentRequest || this.requestQueue.length !== 0) {
              this.processRequestQueue();
            }
        }, 10);
  //    }
    }
  }

  restoreFromTouchAction(drawingName) {

    console.log(`[TOUCH_ACTION] Restoring original items for ${drawingName} after HTTP response`);

    const backup = this.touchActionBackups;
        for (const idx in backup.indexed) {
            const item = backup.indexed[idx];
            console.warn(`[TOUCH_ACTION] restore indexed Item  ${JSON.stringify(item)}`);
        }
    
    // Restore the backed up items, transform state, and clip area
    this.drawingManager.unindexedItems[drawingName] = backup.unindexed;
    this.drawingManager.indexedItems[drawingName] = backup.indexed;
    this.drawingManager.allTouchZonesByCmd = backup.allTouchZonesByCmd;
    // Restore transform state
    if (backup.transform) {
      this.drawingManager.saveTransform(drawingName, backup.transform);
    }

    // Note: We don't restore clip area because clip boundaries should be preserved 
    // as part of the drawing's permanent state during normal processing.
    // Only the transform state changes for the next update.


    console.log(`[TOUCH_ACTION] Restored ${backup.unindexed.length} unindexed items, ${Object.keys(backup.indexed).length} indexed items, transform (${backup.transform?.x}, ${backup.transform?.y}, ${backup.transform?.scale}), and clip area`);
  }

  // Queue an update for any drawing (main or inserted)
  async queueDrawingUpdate(drawingName) {
    try {
      console.log(`[QUEUE_DWG] Preparing fetch for drawing "${drawingName}" at ${new Date().toISOString()}`);

      const savedVersion = localStorage.getItem(`${drawingName}_version`);
      const savedData = localStorage.getItem(`${drawingName}_data`);
      let endpoint = `/pfodWeb`;
      // Add version query parameter only if we have both version and data
      if (savedVersion) { // && savedData) {
        // Use /pfodWeb endpoint with cmd parameter in {drawingName} format
        endpoint = `?cmd=${encodeURIComponent('{' + savedVersion+ ':'+ drawingName + '}')}`;
        endpoint += `&version=${encodeURIComponent(savedVersion)}`; // for control 
        console.log(`Using saved version: ${savedVersion}`);
      } else {
        console.log('No valid saved version+data pair - requesting fresh data (dwg:start)');
        // Use /pfodWeb endpoint with cmd parameter in {drawingName} format
        endpoint += `?cmd=${encodeURIComponent('{' + drawingName + '}')}`;
      }

      /**
      // Use /pfodWeb endpoint with cmd parameter in {drawingName} format
      let endpoint = `/pfodWeb?cmd=${encodeURIComponent('{' + drawingName + '}')}`;

      // Add version query parameter if available and valid AND there's corresponding data
      if (savedVersion !== null && savedData) {
        endpoint += `&version=${encodeURIComponent(savedVersion)}`;
        console.log(`[QUEUE_DWG] Using saved version "${savedVersion}" for "${drawingName}"`);
      } else {
        if (savedVersion !== null && !savedData) {
          console.log(`[QUEUE_DWG] Found valid version "${savedVersion}" without data for "${drawingName}" - keeping version but requesting full drawing data`);
          // Don't remove the version - it's valid (including empty string), just request fresh data
        } else {
          console.log(`[QUEUE_DWG] No saved version for "${drawingName}", requesting full drawing data`);
        }
      }
      **/
      // Keep URL as /pfodWeb (or original URL) - don't change to direct drawing URLs

      // Add to the request queue
      this.addToRequestQueue(drawingName, endpoint, null, null, 'update');
      console.log(`[QUEUE_DWG] Added "${drawingName}" to request queue`);
    } catch (error) {
      console.error(`[QUEUE_DWG] Failed to queue drawing "${drawingName}":`, error);
    }
  }

  // Process all pending responses that were queued while mouse was down
  processPendingResponses() {
    if (this.pendingResponseQueue.length === 0) {
      return;
    }

    console.log(`[QUEUE] Processing ${this.pendingResponseQueue.length} pending responses after mouse release`);
    const hadPendingResponses = this.pendingResponseQueue.length > 0;

    // Process responses in order of receipt
    while (this.pendingResponseQueue.length > 0) {
      const pendingResponse = this.pendingResponseQueue.shift();
      const request = pendingResponse.request;
      const data = pendingResponse.data;

      console.log(`[QUEUE] Processing queued response for "${request.drawingName}"`);

      // No need to restore - we'll do a full merge with the new response data

      // Insert name property from request since responses no longer include it
      data.name = request.drawingName;

      // Process the response data
      this.processDrawingData(data, null, request.requestType);
    }

    console.log(`[QUEUE] Finished processing all pending responses`);
    //this.sentRequest = null;

    // Redraw again after processing all responses to show the latest drawing data
    if (hadPendingResponses) {
      console.log(`[QUEUE] Redrawing canvas after processing pending responses with updated drawing data`);
      if (!this.touchState.isDown) {
      // Update the MergeAndRedraw module with the latest state
        this.mergeAndRedraw.updateState({
          ...this.drawingManager.getMergeAndRedrawState(),
          requestQueue: this.requestQueue
        });

        // Redraw with the updated data
        this.resizeCanvas(); // resize updates state
      }
    }
    setTimeout(() => {
     // if (this.sentRequest || this.requestQueue.length !== 0) {
         this.processRequestQueue();
     // }
    }, 10);
  }

  // Process drawing data (converted from global function)
  // touchZones are processed by adding current transform and then storing in touchZonesByCmd[dwgName]
  // in merge all touchZones are merged together into allTouchZonesByCmd
  // in redraw all the touchZones are drawn after unindexed and indexed items, if in debug mode
  processDrawingData(data, savedData, requestType = 'unknown') {
    // Delegate to the extracted DrawingDataProcessor
    return this.drawingDataProcessor.processDrawingData(data, savedData, requestType);
  }


  // Handle insertDwg items by adding them to the request queue
  handleInsertDwg(item) {
    const drawingName = item.drawingName;
    const xOffset = parseFloat(item.xOffset || 0);
    const yOffset = parseFloat(item.yOffset || 0);

    console.log(`[INSERT_DWG] Handling insertDwg for drawing "${drawingName}" with offset (${xOffset}, ${yOffset})`);

    // Verify this is a valid insertDwg item
    if (!item.type || (item.type !== 'insertDwg' && item.type.toLowerCase() !== 'insertdwg')) {
      console.error(`[INSERT_DWG] Invalid item type: ${item.type}. Expected 'insertDwg'`);
      console.log(`[INSERT_DWG] Full item:`, JSON.stringify(item));
    }

    // Ensure the target drawing has its item collections properly initialized
    this.drawingManager.ensureItemCollections(drawingName);

    if (!drawingName) {
      console.error('[INSERT_DWG] InsertDwg item missing drawingName:', item);
      return {
        error: 'Missing drawing name',
        item: item
      };
    }

    // Check if we're trying to insert the current drawing (prevent infinite recursion)
    const mainDrawingName = this.drawingManager.drawings.length > 0 ? this.drawingManager.drawings[0] : '';
    if (drawingName === mainDrawingName) {
      console.warn(`[INSERT_DWG] Error: Cannot insert drawing "${drawingName}" into itself`);
      return {
        error: 'Self-insertion not allowed',
        drawingName: mainDrawingName
      };
    }

    // Check if this drawing is already in the drawings array
    if (this.drawingManager.drawings.includes(drawingName)) {
      console.log(`[INSERT_DWG] Drawing "${drawingName}" is already in drawings list.`);

      // Even if drawing is already in the drawings list, explicitly check if we need to request it
      if (!this.drawingManager.drawingsData[drawingName] || !this.drawingManager.drawingsData[drawingName].data) {
        console.log(`[INSERT_DWG] Drawing "${drawingName}" in list but data missing - will request it`);
        // Add to the request queue if not already in queue
        if (!this.requestQueue.some(req => req.drawingName === drawingName)) {
          const endpoint = `/pfodWeb?cmd=${encodeURIComponent('{' + drawingName + '}')}`;

          console.warn(`[INSERT_DWG] Adding "${drawingName}" to request queue (already in drawings)`);
          this.addToRequestQueue(drawingName, endpoint, null, null, 'insertDwg');
        } else {
          console.log(`[INSERT_DWG] "${drawingName}" already in request queue`);
        }
      }

      return {
        drawingName: drawingName,
        dataAvailable: this.drawingManager.drawingsData[drawingName] && this.drawingManager.drawingsData[drawingName].data ? true : false,
        alreadyInList: true
      };
    }

    // Ensure collections exist for this drawing
    this.drawingManager.ensureItemCollections(drawingName);

    // Add this drawing to the DrawingManager
    this.drawingManager.addInsertedDrawing(
      drawingName,
      xOffset,
      yOffset,
      item.transform || {
        x: 0,
        y: 0,
        scale: 1.0
      },
      mainDrawingName // Parent drawing name
    );

    console.log(`[INSERT_DWG] Created entry for drawing "${drawingName}" in drawingsData`);
    console.log(`[INSERT_DWG] Request timestamp: ${new Date().toISOString()}`);

    // Add to the request queue
    if (!this.requestQueue.some(req => req.drawingName === drawingName)) {
      const endpoint = `/pfodWeb?cmd=${encodeURIComponent('{' + drawingName + '}')}`;
      console.warn(`[INSERT_DWG] Adding "${drawingName}" to request queue (new insert)`);
      this.addToRequestQueue(drawingName, endpoint, null, null, 'insertDwg');
    } else {
      console.log(`[INSERT_DWG] "${drawingName}" already in request queue`);
    }

    // Return immediately so that the placeholder can be drawn
    return {
      drawingName: drawingName,
      dataAvailable: false,
      newlyAdded: true
    };
  }

  // Resize canvas to fit the container
  resizeCanvas(isTouchAction = false) {
    console.log(`[RESIZE_DEBUG] resizeCanvas() called for drawing: "${this.drawingManager.getMainDrawingName()}"`);
    console.log(`[RESIZE_DEBUG] URL: ${window.location.href}`);

    console.log(`[REDRAW_CANVAS] "${this.drawingManager.getMainDrawingName()}" `);
    const logicalDrawingData = this.drawingManager.getCurrentDrawingData();

    if (!logicalDrawingData) {
      console.warn('No drawing data available for resizing');
      return;
    }

    // Check if mouse is down - skip resize operations during drag
    const isMouseDown = this.touchState && this.touchState.isDown;

    if (isTouchAction || isMouseDown){
      this.mergeAndRedraw.redrawCanvas(true);
       return;
    }

    // Get the logical canvas dimensions (1-255 range)
    const logicalWidth = Math.min(Math.max(logicalDrawingData.x, 1), 255);
    const logicalHeight = Math.min(Math.max(logicalDrawingData.y, 1), 255);

    // Get window dimensions to check if they've changed too
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    console.log(`[RESIZE_DEBUG] Current dimensions: logical=${logicalWidth}x${logicalHeight}, window=${windowWidth}x${windowHeight}`);
    console.log(`[RESIZE_DEBUG] Previous dimensions: logical=${this.lastLogicalWidth}x${this.lastLogicalHeight}, window=${this.lastWindowWidth}x${this.lastWindowHeight}`);
    console.log(`[RESIZE_DEBUG] Drawing data x=${logicalDrawingData.x}, y=${logicalDrawingData.y}`);
    console.log(`[RESIZE_DEBUG] Is first resize? lastLogicalWidth=${this.lastLogicalWidth}, lastLogicalHeight=${this.lastLogicalHeight}`);

    // Calculate what the canvas size should be based on logical dimensions
    const aspectRatio = logicalWidth / logicalHeight;
    let displayHeight = windowHeight;
    let displayWidth = displayHeight * aspectRatio;

    // If width exceeds screen, scale down to fit width
    if (displayWidth > windowWidth) {
      displayWidth = windowWidth;
      displayHeight = displayWidth / aspectRatio;
    }

    // Account for the nested borders (white 2px + black 2px on each side) and some margin
    // Total border: 8px (4px + 4px), plus 12px margin = 20px total
    displayWidth -= 26;
    displayHeight -= 26;

    // Calculate expected canvas size
    const expectedCanvasWidth = Math.floor(displayWidth);
    const expectedCanvasHeight = Math.floor(displayHeight);

    
    // Check if both logical dimensions AND window dimensions have changed AND canvas is correctly sized
    if ((this.lastLogicalWidth === logicalWidth &&
      this.lastLogicalHeight === logicalHeight &&
      this.lastWindowWidth === windowWidth &&
      this.lastWindowHeight === windowHeight &&
      this.canvas.width === expectedCanvasWidth &&
      this.canvas.height === expectedCanvasHeight) || isMouseDown) {
      
      if (isMouseDown) {
        console.log(`[RESIZE] Skipping resize - mouse is down during drag operation`);
      } else {
        console.log(`[RESIZE] Skipping resize - dimensions unchanged: logical=${logicalWidth}x${logicalHeight}, window=${windowWidth}x${windowHeight}, canvas=${this.canvas.width}x${this.canvas.height}`);
      }
      console.log(`[RESIZE_DEBUG] SKIP - Just updating state and redrawing without resize`);
      // Still update state and redraw, just don't resize canvas
      // But we still need to ensure scale factors are calculated for clip regions
      this.canvas.scaleX = this.canvas.width / logicalWidth;
      this.canvas.scaleY = this.canvas.height / logicalHeight;
      console.log(`[RESIZE_DEBUG] Scale factors maintained: X=${this.canvas.scaleX}, Y=${this.canvas.scaleY}`);
      if (!isMouseDown) {
        this.mergeAndRedraw.updateState({
        ...this.drawingManager.getMergeAndRedrawState(),
        requestQueue: this.requestQueue
        });
        this.mergeAndRedraw.redrawCanvas();
      }
      return;
    }

    // Store current dimensions for future comparison (both logical and window)
    this.lastLogicalWidth = logicalWidth;
    this.lastLogicalHeight = logicalHeight;
    this.lastWindowWidth = windowWidth;
    this.lastWindowHeight = windowHeight;

    // Save dimensions to localStorage for future reloads
    this.saveDimensions(logicalWidth, logicalHeight, windowWidth, windowHeight);

    console.log(`[RESIZE] Dimensions or canvas size changed - proceeding with resize: logical=${logicalWidth}x${logicalHeight}, window=${windowWidth}x${windowHeight}`);
    console.log(`[RESIZE_DEBUG] Current canvas size: ${this.canvas.width}x${this.canvas.height}, expected: ${expectedCanvasWidth}x${expectedCanvasHeight}`);
    console.log(`[RESIZE_DEBUG] PROCEEDING - Will trigger full canvas resize and redraw`);

    console.log(`Logical canvas dimensions: ${logicalWidth}x${logicalHeight}, aspect ratio: ${aspectRatio}`);
    console.log(`Window dimensions: ${windowWidth}x${windowHeight}`);

    // Use the already calculated canvas size
    const canvasWidth = expectedCanvasWidth;
    const canvasHeight = expectedCanvasHeight;

    // Set canvas size
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.canvas.scaleX = canvasWidth / logicalWidth;
    this.canvas.scaleY = canvasHeight / logicalHeight;

    console.log(`Canvas physical size: ${this.canvas.width}x${this.canvas.height}`);
    console.log(`Scale factors: X=${this.canvas.scaleX}, Y=${this.canvas.scaleY}`);

    // Update the MergeAndRedraw module with the latest state
    this.mergeAndRedraw.updateState({
      ...this.drawingManager.getMergeAndRedrawState(),
      requestQueue: this.requestQueue
    });

    // Redraw content using the MergeAndRedraw module
    console.log(`[RESIZE] redrawCanvas after resize`);
    this.mergeAndRedraw.redrawCanvas();
  }


  // Remove an inserted drawing and its touchZones, plus any child drawings
  removeInsertedDrawing(drawingName) {
    if (!drawingName) {
      console.error('No drawing name provided to removeInsertedDrawing');
      return;
    }

    console.log(`[REMOVE_DWG] Removing inserted drawing: ${drawingName}`);

    // Remove any pending requests for this drawing from the queue
    const initialQueueLength = this.requestQueue.length;
    this.requestQueue = this.requestQueue.filter(request => request.drawingName !== drawingName);
    let removedCount = initialQueueLength - this.requestQueue.length;

    // Also check and clear if the currently sent request is for this drawing
    if (this.sentRequest && this.sentRequest.drawingName === drawingName) {
      console.log(`[REMOVE_DWG] Clearing in-flight request for ${drawingName}`);
      this.sentRequest = null;
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`[REMOVE_DWG] Removed ${removedCount} request(s) for ${drawingName} (${initialQueueLength - this.requestQueue.length} from queue, ${this.sentRequest ? 0 : (removedCount - (initialQueueLength - this.requestQueue.length))} in-flight)`);
    }

    // First identify any child drawings that have this drawing as their parent
    const childDrawings = this.drawingManager.getChildDrawings(drawingName);

    // Recursively remove all child drawings first
    childDrawings.forEach(childName => {
      console.log(`[REMOVE_DWG] Removing child drawing ${childName} of ${drawingName}`);
      this.removeInsertedDrawing(childName);
    });

    // Remove associated touchZones (if touchZonesByCmd is available)
    if (typeof this.touchZonesByCmd !== 'undefined') {
      this.removeTouchZonesByDrawing(drawingName);
    }

    // Remove the drawing using the manager
    this.drawingManager.removeInsertedDrawing(drawingName);

    console.log(`[REMOVE_DWG] Completed removal of inserted drawing: ${drawingName}`);
  }

  // Remove touchZones associated with a specific drawing
  removeTouchZonesByDrawing(drawingName) {
    if (!drawingName) {
      console.error('No drawing name provided to removeTouchZonesByDrawing');
      return;
    }

    console.log(`Removing touchZones for drawing: ${drawingName}`);

    // Create a new array of keys to remove
    const keysToRemove = [];

    // Find all touchZones belonging to this drawing
    for (const cmd in this.touchZonesByCmd) {
      const touchZone = this.touchZonesByCmd[cmd];
      if (touchZone.parentDrawingName === drawingName) {
        keysToRemove.push(cmd);
        console.log(`Marked touchZone for removal: cmd=${cmd}, drawing=${drawingName}`);
      }
    }

    // Remove identified touchZones
    keysToRemove.forEach(cmd => {
      delete this.touchZonesByCmd[cmd];
      console.log(`Removed touchZone: cmd=${cmd}`);
    });

    console.log(`Removed ${keysToRemove.length} touchZones for drawing: ${drawingName}`);
  }

  // Handle drawing error (not found, etc) - instance method for multi-viewer support
  handleDrawingError(errorData) {
    console.error(`Drawing error: ${errorData.error} - ${errorData.message}`);

    // Completely remove any canvas container that might interfere
    if (this.canvasContainer) {
      this.canvasContainer.style.display = 'none';
    }

    // Create a brand new error message div directly in the body
    // First, remove any existing error message
    const existingError = document.getElementById('error-message');
    if (existingError) {
      document.body.removeChild(existingError);
    }

    // Create the new error element
    const errorMessageElement = document.createElement('div');
    errorMessageElement.id = 'error-message';

    // Apply inline styles directly
    errorMessageElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: white;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            color: #333;
            text-align: center;
        `;

    // Set the HTML content
    errorMessageElement.innerHTML = `
            <div style="
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                max-width: 80%;
                margin: 0 auto;
                text-align: center;
            ">
                <h2 style="
                    color: #d32f2f;
                    margin-bottom: 20px;
                    font-size: 28px;
                    font-weight: bold;
                ">Drawing Error</h2>
                <p style="
                    font-size: 20px;
                    margin-bottom: 20px;
                    color: #333;
                ">${errorData.message}</p>
                <p style="
                    font-size: 18px;
                    margin-bottom: 30px;
                    color: #666;
                ">Please check the drawing name and try again.</p>
            </div>
        `;

    // Add to the document body
    document.body.appendChild(errorMessageElement);

    // For debugging
    console.log('Error message created and added to body');

    // Remove any canvas, just to be sure
    if (this.canvas) {
      this.canvas.style.display = 'none';
    }

    // Disable updates
    this.isUpdating = false;
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // Log to console
    console.warn("ERROR DISPLAYED TO USER:", errorData.message);

    // Try to adjust the page title to indicate the error
    document.title = "Error: Drawing Not Found";
  }


}


// TouchZone special values - these remain global as they're constants
const TouchZoneSpecialValues = {
  TOUCHED_COL: 65534, // Only used in touchZone actions to specify touched col value
  TOUCHED_ROW: 65532, // Only used in touchZone actions to specify touched row value
};

// Dynamic script loader
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load all dependencies in order
async function loadDependencies() {
  const dependencies = [
    './version.js',
    './DrawingManager.js',
    './displayTextUtils.js',
    './redraw.js',
    './mergeAndRedraw.js',
    './webTranslator.js',
    './drawingDataProcessor.js',
    './pfodWebMouse.js'
  ];

  for (const dep of dependencies) {
    await loadScript(dep);
  }
}

// Global viewer instance
let drawingViewer = null;

// Event Listeners
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[PFODWEB_DEBUG] DOMContentLoaded event fired');
  
  console.log('[PFODWEB_DEBUG] URL when DOMContentLoaded:', window.location.href);
  console.log('[PFODWEB_DEBUG] Referrer when DOMContentLoaded:', document.referrer);
  await loadDependencies();
  await initializeApp();
});
window.addEventListener('resize', () => {
  if (drawingViewer) {
    drawingViewer.resizeCanvas();
  }
});


// Touch and mouse event handlers - now handled in DrawingViewer.setupEventListeners()

// Touch state is now handled as instance properties in DrawingViewer class
// See this.touchState in DrawingViewer constructor

// Handle browser refresh button
window.addEventListener('beforeunload', function(event) {
  // Store the current URL pattern
  localStorage.setItem('lastUrlPattern', window.location.pathname);
});

// Handle returning from browser refresh
window.addEventListener('DOMContentLoaded', function() {
  const lastUrlPattern = localStorage.getItem('lastUrlPattern');
  if (lastUrlPattern && lastUrlPattern.includes('/update')) {
    // If we were on an update URL, make sure we load the drawing correctly
    const pathSegments = lastUrlPattern.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length > 0) {
      const currentDrawingName = pathSegments[0];
      // Make sure the drawing is the first in the array
      if (!this.drawingManager.drawings.includes(currentDrawingName)) {
        this.drawingManager.drawings.unshift(currentDrawingName);
      }
    }
  }
});

// Initialize the application
async function initializeApp() {
  console.log('[PFODWEB_DEBUG] initializeApp() called');
  console.log('[PFODWEB_DEBUG] Current URL:', window.location.href);
  console.log('[PFODWEB_DEBUG] Referrer:', document.referrer);
  console.log('[PFODWEB_DEBUG] Document ready state:', document.readyState);
  console.log('Initializing canvas drawing viewer');

  // Check if drawingViewer already exists
  if (drawingViewer) {
    console.log('[PFODWEB_DEBUG] DrawingViewer already exists - skipping creation but doing initial request');
    drawingViewer.queueInitialRequest(); // request refresh with{.}
    return;
  }

  // Create the DrawingViewer instance
  drawingViewer = new DrawingViewer();

  try {
    // Initialize the viewer - queue initial request to get drawing name from server
    drawingViewer.queueInitialRequest();

    // Initialize the MergeAndRedraw module with the DrawingManager state
    drawingViewer.mergeAndRedraw.init({
      canvas: drawingViewer.canvas,
      ctx: drawingViewer.ctx,
      ...drawingViewer.drawingManager.getMergeAndRedrawState(),
      requestQueue: drawingViewer.requestQueue,
      sentRequest: drawingViewer.sentRequest,
      drawingViewer: drawingViewer // Pass reference to access atomic methods
    });

    // The drawing name will be extracted and drawing loaded via the request queue
  } catch (error) {
    console.error('Failed to initialize application:', error);
    // Show error to user
    document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: Arial;">
            <h2>Error Loading Drawing</h2>
            <p>Failed to get drawing name from server: ${error.message}</p>
        </div>`;
  }
}


// Global touch event handling functions moved to pfodWebMouse.js

// Make DrawingViewer and JS_VERSION available globally for browser use
window.DrawingViewer = DrawingViewer;
window.JS_VERSION = JS_VERSION;