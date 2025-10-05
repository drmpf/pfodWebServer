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
    this.updateTimer = null;
    this.isUpdating = false; // Start with updates disabled until first load completes
    this.js_ver = JS_VERSION; // Client JavaScript version

    // Request queue system - isolated per viewer
    this.requestQueue = [];
    // Use simple boolean for queue processing state (single-threaded JavaScript environment)
    this._isProcessingQueue = false;
    console.log(`[SENTREQUEST] CLEARED: on creation`);
    this.sentRequest = null; // Currently in-flight request
    this.currentRetryCount = 0;
    this.MAX_RETRIES = 5;

    // Request tracking for touch vs insertDwg - isolated per viewer
    this.requestTracker = {
      touchRequests: new Set(), // Track touch-triggered requests
      insertDwgRequests: new Set() // Track insertDwg-triggered requests
    };

    // Unified shadow processing system for all request types (always active)
    this.shadowProcessing = {
      responses: new Map(), // drawingName -> response data
      requestType: null, // 'main', 'refresh', 'touch', 'insertDwg', etc.
      shadowDrawingManager: new DrawingManager() // shadow copy of drawing manager
    };

    // Transformation state for push/pop operations - used during JSON processing
    this.transformStack = []; // Stack to store transformation states

    // Map to store all active touchZones by command - now managed by DrawingManager
    // this.touchZonesByCmd = {}; // Format: {cmd: touchZone} - DEPRECATED

    // Window dimension tracking for change detection and saving
    this.lastLogicalWidth = null;
    this.lastLogicalHeight = null;
    this.lastWindowWidth = null;
    this.lastWindowHeight = null;

    // Load previous window dimensions from storage to pass to redraw
    const initialDimensions = this.loadPreviousDimensions();

    // Initialize our tracking with loaded dimensions
    if (initialDimensions) {
      this.lastLogicalWidth = initialDimensions.logicalWidth;
      this.lastLogicalHeight = initialDimensions.logicalHeight;
      this.lastWindowWidth = initialDimensions.windowWidth;
      this.lastWindowHeight = initialDimensions.windowHeight;
    }

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

    // Update collection for atomic refresh processing
    // updateCollection removed - using unified shadow processing system

    // Text input dialog state
    this.textInputDialog = null;

    // Transformation state for push/pop operations - used during JSON processing
    this.currentTransform = {
      x: 0,
      y: 0,
      scale: 1.0
    }; // Current transformation (initial state)

    // Create isolated MergeAndRedraw instance for this viewer
    // Create Redraw instance with canvas and context - uses its own local data
    this.redraw = new window.Redraw(this.canvas, this.ctx, initialDimensions);

    // Create DrawingDataProcessor instance for this viewer
    this.drawingDataProcessor = new window.DrawingDataProcessor(this);

    // Set up event listeners using pfodWebMouse.js
    this.setupEventListeners();
  }

  // Extract target IP address from URL parameters or global variable
  extractTargetIP() {
    console.log(`[TARGET_IP] Extracting target IP from URL or global variable`);
    console.log(`[TARGET_IP] window.PFOD_TARGET_IP: ${window.PFOD_TARGET_IP}`);
    console.log(`[TARGET_IP] window.location.search: ${window.location.search}`);

    // First check if global variable was set by index.html
    if (window.PFOD_TARGET_IP) {
      console.log(`[TARGET_IP] Using global variable: ${window.PFOD_TARGET_IP}`);
      return window.PFOD_TARGET_IP;
    }

    // Extract from URL parameters (e.g., ?targetIP=192.168.1.100)
    const urlParams = new URLSearchParams(window.location.search);
    const targetIP = urlParams.get('targetIP');
    console.log(`[TARGET_IP] URL parameter targetIP: ${targetIP}`);

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
          console.log(`[TARGET_IP] Valid IP found: ${targetIP}`);
          return targetIP;
        } else {
          console.log(`[TARGET_IP] Invalid IP ranges in: ${targetIP}`);
        }
      } else {
        console.log(`[TARGET_IP] Invalid IP format: ${targetIP}`);
      }
    }

    console.log(`[TARGET_IP] No valid target IP found, returning null`);
    return null;
  }

  // Build endpoint URL with target IP
  buildEndpoint(path) {
    console.log(`[ENDPOINT] buildEndpoint called with path: ${path}, targetIP: ${this.targetIP}`);
    if (this.targetIP) {
      const fullEndpoint = `http://${this.targetIP}${path}`;
      console.log(`[ENDPOINT] Built full endpoint: ${fullEndpoint}`);
      return fullEndpoint;
    }
    console.log(`[ENDPOINT] No targetIP, returning relative path: ${path}`);
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

  // Load previous dimensions from localStorage to pass to redraw
  loadPreviousDimensions() {
    try {
      const storageKey = this.getDimensionStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const dims = JSON.parse(saved);
        console.log(`[DIMENSIONS] Loaded previous dimensions from ${storageKey}: logical=${dims.logicalWidth}x${dims.logicalHeight}, window=${dims.windowWidth}x${dims.windowHeight}`);
        return dims;
      } else {
        console.log(`[DIMENSIONS] No previous dimensions found for ${storageKey}`);
        return null;
      }
    } catch (e) {
      console.log('[DIMENSIONS] Error loading dimensions:', e);
      return null;
    }
  }

  // Handle resize with dimension change detection and saving
  handleResize() {
    // Get current drawing data to determine logical dimensions
    const logicalDrawingData = this.redraw.redrawDrawingManager.getCurrentDrawingData();
    if (!logicalDrawingData) {
      console.warn('No drawing data available for resize handling');
      this.redraw.resizeCanvas(this.touchState);
      return;
    }

    // Get current dimensions
    const logicalWidth = Math.min(Math.max(logicalDrawingData.x, 1), 255);
    const logicalHeight = Math.min(Math.max(logicalDrawingData.y, 1), 255);
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Check if dimensions have changed
    const dimensionsChanged = (
      this.lastLogicalWidth !== logicalWidth ||
      this.lastLogicalHeight !== logicalHeight ||
      this.lastWindowWidth !== windowWidth ||
      this.lastWindowHeight !== windowHeight
    );

    // Update tracking and save if dimensions changed
    if (dimensionsChanged) {
      console.log(`[DIMENSIONS] Dimensions changed - saving: logical=${logicalWidth}x${logicalHeight}, window=${windowWidth}x${windowHeight}`);

      this.lastLogicalWidth = logicalWidth;
      this.lastLogicalHeight = logicalHeight;
      this.lastWindowWidth = windowWidth;
      this.lastWindowHeight = windowHeight;

      // Save to localStorage
      this.saveDimensions(logicalWidth, logicalHeight, windowWidth, windowHeight);
    }

    // Call redraw to handle the actual resizing and redraw elements
    this.redraw.resizeCanvas(this.touchState);
    this.redraw.performRedraw();
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
    const currentDrawingName = this.redraw.redrawDrawingManager.getCurrentDrawingName();
    if (!currentDrawingName) {
      console.error('No drawing name specified');
      return;
    }

    try {
      // Disable updates during loading
      this.isUpdating = false;
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
        endpoint += `?cmd=${encodeURIComponent('{' + savedVersion+ ':'+ currentDrawingName + '}')}`;
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
    const mainDrawingName = this.redraw.getCurrentDrawingName();
    console.log(`[SCHEDULE_NEXT_UPDATE] ${mainDrawingName}`);
    // Clear any existing timer first
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
      console.log('Cleared existing update timer');
    }

    // Get the current main drawing data from redraw system (where data is actually stored after processing)
    const currentDrawingData = this.redraw.redrawDrawingManager.drawingsData[mainDrawingName]?.data;

    // Only schedule an update if refresh is greater than 0, mouse is not down, queue is empty, and no request in flight
    // This ensures that a refresh value of 0 properly disables automatic updates
    // and prevents updates during mouse interactions or ongoing queue processing
    if (this.isUpdating && currentDrawingData && currentDrawingData.refresh > 0 && !this.touchState.isDown &&
        this.requestQueue.length === 0 && !this.sentRequest) {
      console.log(`[REFRESH] Scheduling next update in ${currentDrawingData.refresh}ms for drawing "${this.redraw.getCurrentDrawingName()}"`);
      this.updateTimer = setTimeout(() => this.fetchRefresh(), currentDrawingData.refresh);
      // Also schedule updates for inserted drawings
      if (this.redraw.redrawDrawingManager.drawings.length > 1) {
        console.log(`Will fetch updates for ${this.redraw.redrawDrawingManager.drawings.length - 1} inserted drawings during next update cycle`);
      }
    } else if (currentDrawingData && currentDrawingData.refresh === 0) {
      console.log(`[REFRESH] Automatic updates disabled (refresh=0) for drawing "${this.redraw.getCurrentDrawingName()}"`);
    } else if (!currentDrawingData) {
      console.log('[REFRESH] No drawing data available, cannot schedule updates');
    } else if (!this.isUpdating) {
      console.log('[REFRESH] Updates currently paused');
    } else if (this.touchState.isDown) {
      console.log('[REFRESH] Skipping update scheduling - mouse is down');
    } else if (this.requestQueue.length > 0) {
      console.log(`[REFRESH] Skipping update scheduling - queue not empty (${this.requestQueue.length} requests)`);
    } else if (this.sentRequest) {
      console.log(`[REFRESH] Skipping update scheduling - request in flight for "${this.sentRequest.drawingName}"`);
    }

  }

  // Fetch refreshes from the server
  async fetchRefresh() {
    console.log(`[REFRESH] Refresh timer fired - starting update cycle for drawing "${this.redraw.getCurrentDrawingName()}" at ${new Date().toISOString()}`);

    // Block update requests if user activity is present
    if (this.touchState.isDown) {
      console.log(`[REFRESH] Blocking update cycle - mouse is down`);
      this.scheduleNextUpdate(); // Reschedule for later
      return;
    }

    // Check if queue has user requests (non-refresh requestType)
    const hasUserRequests = this.requestQueue.some(req => req.requestType !== 'refresh');
    if (hasUserRequests) {
      console.log(`[REFRESH] Blocking refresh cycle - user requests in queue`);
      this.scheduleNextUpdate(); // Reschedule for later
      return;
    }

    // Check if user request is in flight (non-refresh requestType)
    if (this.sentRequest && this.sentRequest.requestType !== 'refresh') {
      console.log(`[REFRESH] Blocking refresh cycle - user request in flight (${this.sentRequest.requestType})`);
      this.scheduleNextUpdate(); // Reschedule for later
      return;
    }

    // Check if shadow processing is already active
    if (this.shadowProcessing.requestType) {
      console.log(`[REFRESH] Shadow processing already active (${this.shadowProcessing.requestType}), waiting for completion`);
      // Don't reschedule - let the current processing complete and schedule naturally
      return;
    }

    try {
      // Get main drawing name from redraw manager (same as scheduleNextUpdate)
      const mainDrawingName = this.redraw.redrawDrawingManager.getMainDrawingName();
      const currentDrawingData = this.redraw.redrawDrawingManager.drawingsData[mainDrawingName]?.data;

      if (!currentDrawingData || !mainDrawingName) {
        throw new Error('No active drawing');
      }

      // Set flag to indicate we're currently updating
      this.isUpdating = false;

      console.log(`[UPDATE] Starting update cycle at ${new Date().toISOString()}`);

      // TODO: Need to introduce concept of current drawing different from drawings[0]
      // For now, using drawings[0] as current drawing but this needs architectural change
      const currentDrawingName = this.redraw.redrawDrawingManager.drawings.length > 0 ? this.redraw.redrawDrawingManager.drawings[0] : '';
      console.log(`[UPDATE] Current drawing: "${currentDrawingName}", inserted drawings: ${this.redraw.redrawDrawingManager.drawings.length - 1}`);

      // Update collection removed - using unified shadow processing system

      // First, queue the current drawing update
      console.log(`[UPDATE] Queueing update for current drawing "${currentDrawingName}"`);
      await this.queueDrawingUpdate(currentDrawingName);

      // Inserted drawings will be queued automatically as they're discovered during response processing

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
    console.log(`[QUEUE] Current shadow processing type: ${this.shadowProcessing.requestType}`);
    console.log(`[QUEUE] Queue length before add: ${this.requestQueue.length}, sentRequest: ${this.sentRequest ? this.sentRequest.drawingName + '(' + this.sentRequest.requestType + ')' : 'null'}`);
    if (requestType == 'unknown') {
      console.error(`[QUEUE] Error: Unknown requestType`);
      return;
    }

    // If this is a non-refresh request, clean up any existing refresh requests
    if (requestType !== 'refresh') {
      // Remove all refresh requests from queue
      const refreshRequestsInQueue = this.requestQueue.filter(req => req.requestType === 'refresh');
      if (refreshRequestsInQueue.length > 0) {
        this.requestQueue = this.requestQueue.filter(req => req.requestType !== 'refresh');
        console.log(`[QUEUE] Removed ${refreshRequestsInQueue.length} refresh requests from queue due to user activity`);
      }

      // Mark sent refresh request for discard
      if (this.sentRequest && this.sentRequest.requestType === 'refresh') {
        this.sentRequest.discardResponse = true;
        console.log(`[QUEUE] Marked sent refresh request for "${this.sentRequest.drawingName}" to be discarded`);
      }
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
      drawingName = this.shadowProcessing.shadowDrawingManager.getCurrentDrawingName(); // assume we are updating main dwg from menu
    }
    console.log(`[processMenuResponse] Updated dwgName and currentDrawingName "${drawingName}"`);
    // Update page title with drawing name
   // this.updatePageTitle(drawingName);

    // Add the drawing as the first drawing in the array if not already present
    if (!this.shadowProcessing.shadowDrawingManager.drawings.includes(drawingName)) {
      this.shadowProcessing.shadowDrawingManager.drawings.unshift(drawingName);
    }

    // Check if server response includes version information
    const serverVersion = data.version;
    let storedVersion = null;

    // Get stored version for this drawing using DrawingManager
    if (this.shadowProcessing.shadowDrawingManager) {
      storedVersion = this.shadowProcessing.shadowDrawingManager.getStoredVersion(drawingName);
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

    // Queue the actual drawing request from main menu - add as first drawing and use 'main' requestType
    console.log(`[QUEUE] Main menu requesting drawing "${drawingName}" - adding to drawings[0] and using requestType: main`);
    // Add this drawing as the first drawing since it's from main menu
    if (!this.shadowProcessing.shadowDrawingManager.drawings.includes(drawingName)) {
      this.shadowProcessing.shadowDrawingManager.drawings.unshift(drawingName);
    }
    this.addToRequestQueue(drawingName, drawingEndpoint, request.options, null, 'main');
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

  redrawCanvas() {
              // Update the MergeAndRedraw module with the latest state
      console.warn(`[QUEUE] redrawCanvas isDown: ${this.touchState.isDown}`);
              if (!this.touchState.isDown) {
                if (this.touchState.wasDown) {
                  this.touchState.wasDown = this.touchState.isDown;
               }
          // Redraw no longer needs access to drawingManager or requestQueue
          // Data is managed locally in redraw
              }

          // Redraw the canvas with what we have
          // Note: TouchAction redraws are now handled directly by pfodWebMouse calling redraw.redrawForTouchAction()
          // This method only handles normal redraws
          this.handleResize();
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

        // Only redraw if shadow processing is not active - check inUse flag
        if (!this.shadowProcessing.shadowDrawingManager.inUse) {
            console.log(`[QUEUE] No shadow processing active - calling redrawCanvas for final display`);
            setTimeout(() => {
                this.redrawCanvas();
                this.scheduleNextUpdate();
            }, 10);
        } else {
            console.log(`[QUEUE] Shadow processing active - skipping premature redraw`);
            // Resume update scheduling after a brief delay to allow shadow processing to complete
            setTimeout(() => {
                this.scheduleNextUpdate();
            }, 10);
        }
      }
      return;
    }

    console.log(`[QUEUE] processRequestQueue current queue is:`, JSON.stringify(this.requestQueue, null, 2));

 //    this.setProcessingQueue(true); // have non-zero queue length
    // Remove the request from queue and move it to sentRequest
    const request = this.requestQueue.shift();
    console.warn(`[QUEUE] PROCESSING: "${request.drawingName}" (${request.requestType}) - moved from queue to sentRequest`);
    console.warn(`[QUEUE] after setting sentRequest the current queue is:`, JSON.stringify(this.requestQueue, null, 2));
    this.sentRequest = request;
    console.log(`[SENTREQUEST] ASSIGNED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
    console.warn(`[QUEUE] sentRequest is:`, JSON.stringify(this.sentRequest, null, 2));

    try {
      if (request.retryCount > 0) {
       console.warn(`[QUEUE] Processing request for "${request.drawingName}" (retry: ${request.retryCount}/${this.MAX_RETRIES})`);
      }

      // Initialize shadow processing for session-starting requests only
      // insertDwg and refresh-insertDwg requests are part of existing sessions
      if (['mainMenu', 'main', 'touch', 'refresh'].includes(request.requestType)) {
        try {
          this.initializeShadowProcessing(request);
        } catch (error) {
          console.error(`[SHADOW] Error initializing shadow processing:`, error);
          alert(`Shadow processing initialization error: ${error.message}`);
          return; // Stop processing this request
        }
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
      // Use buildEndpoint to ensure proper URL formatting
      let endpoint = this.buildEndpoint(request.endpoint);
      console.log(`[QUEUE] Original endpoint: ${request.endpoint}, final endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, request.options);

      console.warn(`[QUEUE] Received response for "${request.drawingName}": status ${response.status}, queue length: ${this.requestQueue.length}`);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} for drawing "${request.drawingName}"`);
      }

      // Get response text first to log the raw JSON
      const responseText = await response.text();
      console.log(`[QUEUE] Received raw JSON data for "${request.drawingName}":`);
      console.log(responseText);

      // Check if response should be discarded
      if (request.discardResponse) {
        console.log(`[QUEUE] Discarding response for "${request.drawingName}" - marked for discard due to user activity`);
        // Clear the sent request and continue processing
        console.log(`[SENTREQUEST] CLEARED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
        this.sentRequest = null;
        setTimeout(() => {
           this.processRequestQueue();
        }, 10);
        return;
      }

     // Don't clear sentRequest here - will be cleared after processing is complete

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
        // Clear sentRequest after mainMenu processing is complete
        console.log(`[QUEUE] COMPLETED: "${request.drawingName}" (${request.requestType}) - clearing sentRequest after mainMenu processing`);
        console.log(`[SENTREQUEST] CLEARED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
        this.sentRequest = null;
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
        // For touch requests (touchAction/touchActionInput), don't assign drawing name to update merged data only
        if (request.requestType === 'touch') {
          console.log(`[QUEUE] Touch request - updating merged data only, no individual drawing updates`);
          data.name = null; // No drawing name = update merged data only
        } else {
          data.name = request.drawingName;
        }
//         this.sentRequest = null;
//         this.requestQueue.shift();
         console.warn(`[QUEUE] after mouse up the current queue is:`, JSON.stringify(this.requestQueue, null, 2));


        // All responses are processed through unified shadow system (always active)
        try {
          console.log(`[SHADOW] Processing ${request.requestType} response for "${request.drawingName}"`);

          // Process the response immediately to discover insertDwg items and queue nested requests
          // For touch requests, don't assign drawing name to prevent individual drawing updates
          if (request.requestType === 'touch') {
            data.name = null; // No drawing name = update merged data only
          } else {
            data.name = request.drawingName;
          }
          this.processDrawingData(data, null, request.requestType);

          // Store the processed response
          this.shadowProcessing.responses.set(request.drawingName, { data, request });

          // Check if we need to apply collected responses
          this.checkAndApplyShadowUpdates();

          // Clear the sent request and continue processing
          console.log(`[QUEUE] COMPLETED: "${request.drawingName}" (${request.requestType}) - clearing sentRequest`);
          console.log(`[SENTREQUEST] CLEARED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
          this.sentRequest = null;
          console.log(`[QUEUE] After completion - queue length: ${this.requestQueue.length}, sentRequest: null`);

          // Check shadow processing again now that sentRequest is cleared
          this.checkAndApplyShadowUpdates();

          setTimeout(() => {
             this.processRequestQueue();
          }, 10);
          return;
        } catch (error) {
          console.error(`[SHADOW] Error in shadow processing:`, error);
          alert(`Shadow processing error: ${error.message}`);
          // Clean up shadow processing on error
          this.cleanupShadowProcessing();
          return; // Stop processing on error
        }
      }

      // Legacy queue completion logic removed - now handled by shadow processing atomic updates

    } catch (error) {
      let dwgName = " ";
      if  (request.drawingName !== undefined && request.drawingName !== null) {
        dwgName = request.drawingName;
      }
      console.error(`[QUEUE] Error processing request for "${dwgName}":`, error);

      // Additional diagnostics for debugging
      console.log(`[QUEUE] Debugging state for "${dwgName}":`);
      console.log(`- Main drawing name: ${this.shadowProcessing.shadowDrawingManager.getCurrentDrawingName()}`);
      console.log(`- Drawing in drawings array: ${this.shadowProcessing.shadowDrawingManager.drawings.includes(request.drawingName)}`);
      console.log(`- Drawing in drawingsData: ${this.shadowProcessing.shadowDrawingManager.drawingsData[request.drawingName] ? 'yes' : 'no'}`);
      console.log(`- unindexedItems collection exists: ${this.shadowProcessing.shadowDrawingManager.unindexedItems[request.drawingName] ? 'yes' : 'no'}`);
      console.log(`- indexedItems collection exists: ${this.shadowProcessing.shadowDrawingManager.indexedItems[request.drawingName] ? 'yes' : 'no'}`);
      console.log(`- touchZonesByCmd collection exists: ${this.shadowProcessing.shadowDrawingManager.touchZonesByCmd[request.drawingName] ? 'yes' : 'no'}`);

      // Try to fix any missing collections
      if (!this.shadowProcessing.shadowDrawingManager.unindexedItems[request.drawingName] || !this.shadowProcessing.shadowDrawingManager.indexedItems[request.drawingName]) {
        console.log(`[QUEUE] Attempting to fix missing collections for "${dwgName}"`);
        this.shadowProcessing.shadowDrawingManager.ensureItemCollections(request.drawingName);
      }

      // Increment retry count
      request.retryCount++;

      if (request.retryCount <= this.MAX_RETRIES) {
        console.log(`[QUEUE] Retrying request for "${request.drawingName}" (attempt ${request.retryCount} of ${this.MAX_RETRIES})`);
        // Put the request back at the front of the queue for retry
        this.requestQueue.unshift(request);
        console.log(`[SENTREQUEST] CLEARED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
        this.sentRequest = null;
        setTimeout(() => {
           this.processRequestQueue();
        }, 10);
        return;

      } else {
        console.error(`[QUEUE] Maximum retries (${this.MAX_RETRIES}) reached for "${request.drawingName}". Removing from queue.`);

        // Display error message only for the main drawing
        if (request.drawingName === this.shadowProcessing.shadowDrawingManager.getCurrentDrawingName()) {
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
        console.log(`[SENTREQUEST] CLEARED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
        this.sentRequest = null;
 //       setTimeout(() => {
 //          this.processRequestQueue();
 //       }, 10);
        
        // For inserted drawings, if we're at the end of the queue, proceed with redraw
        if (this.requestQueue.length === 0 && !this.sentRequest) {
          console.log(`[QUEUE] Queue empty after failed requests. Drawing with available data.`);
            this.setProcessingQueue(false);
          this.redrawCanvas();
          // Resume update scheduling after failed request cleanup
          this.scheduleNextUpdate();
          
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
        endpoint += `?cmd=${encodeURIComponent('{' + savedVersion+ ':'+ drawingName + '}')}`;
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
      this.addToRequestQueue(drawingName, endpoint, null, null, 'refresh');
      console.log(`[QUEUE_DWG] Added "${drawingName}" to request queue`);
    } catch (error) {
      console.error(`[QUEUE_DWG] Failed to queue drawing "${drawingName}":`, error);
    }
  }

  // Process all pending responses that were queued while mouse was down
  processPendingResponses() {
    if (this.pendingResponseQueue.length === 0) {
      console.log(`[QUEUE] No pending responses to process - ensuring refresh timer is restarted`);
      this.scheduleNextUpdate();
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

      // Check if we have touchAction backup data - if so, we need to restore before processing response
      if (window.pfodWebMouse.touchActionBackups) {
        console.log(`[QUEUE] TouchAction backup exists - processing response against backup data`);
        console.log(`[QUEUE] Response should restore original state before applying new data`);
        console.log(`[QUEUE] Backup indexed items keys: [${Object.keys(window.pfodWebMouse.touchActionBackups.allIndexedItemsByNumber).join(', ')}]`);
        // Log the visible state of items 7, 8, 9 in the backup
        [7, 8, 9].forEach(idx => {
          const backupItem = window.pfodWebMouse.touchActionBackups.allIndexedItemsByNumber[idx];
          console.log(`[QUEUE] Backup item ${idx}: ${backupItem ? `visible=${backupItem.visible}` : 'not found'}`);
        });
      } else {
        console.log(`[QUEUE] No touchAction backup - processing response normally`);
      }

      // Insert name property from request since responses no longer include it
      data.name = request.drawingName;

      // Process the response data using shadow drawing manager to preserve backup state
      this.processDrawingData(data, null, request.requestType);

      // Log the state after processing the response
      if (this.shadowProcessing.shadowDrawingManager) {
        console.log(`[QUEUE] After processing response, shadow manager indexed items: [${Object.keys(this.shadowProcessing.shadowDrawingManager.allIndexedItemsByNumber || {}).join(', ')}]`);
        [7, 8, 9].forEach(idx => {
          const shadowItem = this.shadowProcessing.shadowDrawingManager.allIndexedItemsByNumber[idx];
          console.log(`[QUEUE] After response, shadow item ${idx}: ${shadowItem ? `visible=${shadowItem.visible}` : 'not found'}`);
        });
      }
    }

    console.log(`[QUEUE] Finished processing all pending responses`);
    //this.sentRequest = null;

    // Apply shadow updates to redraw manager and redraw after processing all responses
    if (hadPendingResponses) {
      console.log(`[QUEUE] Finished processing pending responses - checking if shadow updates should be applied`);
      if (!this.touchState.isDown) {
        // Clear sentRequest if still set so queue can continue processing insertDwg requests
        if (this.sentRequest) {
          console.log(`[QUEUE] Clearing sentRequest "${this.sentRequest.drawingName}" to allow queue processing`);
          console.log(`[SENTREQUEST] CLEARED: "${this.sentRequest.drawingName}" (${this.sentRequest.requestType}) - after processing pending responses`);
          this.sentRequest = null;
        }

        // Check if we should apply shadow updates now or wait for more related requests
        console.log(`[QUEUE] Checking for more related requests before applying shadow updates`);
        this.checkAndApplyShadowUpdates();
      }
    }
    setTimeout(() => {
         this.processRequestQueue();
         // Ensure rescheduling after mouse up if queue is empty and no request in flight
         if (this.requestQueue.length === 0 && !this.sentRequest) {
           this.scheduleNextUpdate();
         }
    }, 10);
  }

  // Check if all responses are collected and apply them atomically
  checkAndApplyShadowUpdates() {
    console.log(`[SHADOW] === checkAndApplyShadowUpdates() called ===`);
    console.log(`[SHADOW] Current responses collected: ${this.shadowProcessing.responses.size}`);
    console.log(`[SHADOW] Response drawings: [${Array.from(this.shadowProcessing.responses.keys()).join(', ')}]`);

    // Skip if no active session
    if (!this.shadowProcessing.requestType) {
      console.log(`[SHADOW] No active session - skipping`);
      return;
    }

    // Check abandonment conditions based on request type
    if (this.shouldAbandonShadowProcessing()) {
      console.log(`[SHADOW] Abandoning ${this.shadowProcessing.requestType} processing - ${this.shadowProcessing.responses.size} responses discarded`);
      this.cleanupShadowProcessing();
      return;
    }

    // All responses have already been processed individually as they were received

    // Check if there are more related requests in queue - wait for them
    const hasMoreRelated = this.hasMoreRelatedRequests();
    const hasRelatedInFlight = this.hasRelatedRequestInFlight();

    console.log(`[SHADOW] Check results - hasMoreRelated: ${hasMoreRelated}, hasRelatedInFlight: ${hasRelatedInFlight}`);

    if (hasMoreRelated || hasRelatedInFlight) {
      console.log(`[SHADOW] Waiting for more ${this.shadowProcessing.requestType} responses - queue: ${hasMoreRelated}, in-flight: ${hasRelatedInFlight}`);
      return;
    }

    // All responses collected - apply them atomically
    console.log(`[SHADOW] All responses collected - applying shadow updates atomically`);
    this.applyShadowUpdates();
  }

  // Apply collected shadow updates atomically
  applyShadowUpdates() {
    console.log(`[SHADOW] Applying shadow updates atomically - copying processed data to redraw`);

    try {
      // Copy processed shadow data to isolated redraw drawing manager
      // processDrawingData has already been called and processed data in shadow copy
      if (this.shadowProcessing.shadowDrawingManager) {
        console.log(`[SHADOW] Updating redraw with processed shadow data`);

        // Check if any responses are touch requests - if so, skip merge
        const isTouchRequest = Array.from(this.shadowProcessing.responses.values())
          .some(response => response.request.requestType === 'touch');

        if (isTouchRequest) {
          console.log(`[SHADOW] Touch request detected - skipping merge operation, using shadow data as-is`);
        } else {
          // Create merged collections using DrawingMerger after all individual drawings are processed
          console.log(`[SHADOW] Normal request - performing merge operation`);
          const drawingMerger = new window.DrawingMerger(this.shadowProcessing.shadowDrawingManager);
          drawingMerger.mergeAllDrawings();
        }

        // Atomically update redraw drawing manager with processed shadow copy (triggers redraw)
        this.redraw.updateFromShadow(this.shadowProcessing.shadowDrawingManager);
      }

      // Clean up shadow processing session before resuming updates
      this.cleanupShadowProcessing();

      // Resume update scheduling now that shadow updates are applied
      this.scheduleNextUpdate();

    } catch (error) {
      console.error(`[SHADOW] Error applying shadow updates:`, error);
      alert(`Error applying shadow updates: ${error.message}`);
      // Clean up on error
      this.cleanupShadowProcessing();
    }
  }

  // Initialize shadow processing for a new session
  initializeShadowProcessing(request) {
    // Skip if already processing same request type
    if (this.shadowProcessing.requestType === request.requestType) {
      console.log(`[SHADOW] Shadow processing already active for ${request.requestType}`);
      return;
    }

    // Clean up any previous shadow processing
    if (this.shadowProcessing.requestType) {
      console.log(`[SHADOW] Cleaning up previous ${this.shadowProcessing.requestType} session before starting ${request.requestType}`);
      this.cleanupShadowProcessing();
    }

    // Initialize new shadow processing session
    this.shadowProcessing.requestType = request.requestType;
    this.shadowProcessing.responses.clear();

    // Create shadow copy of current drawing data
    this.createShadowCopy();

    console.log(`[SHADOW] Starting shadow processing session for ${request.requestType}`);
  }

  // Create shadow copy of current drawing data
  createShadowCopy() {
    try {
      // Create new shadow DrawingManager instance
      this.shadowProcessing.shadowDrawingManager = new window.DrawingManager();

      // Copy ALL redraw drawing manager data to shadow for processing
      this.redraw.copyToShadow(this.shadowProcessing.shadowDrawingManager);

    } catch (error) {
      console.error(`[SHADOW] Failed to create shadow copy:`, error);
      // Fall back to empty shadow manager
      this.shadowProcessing.shadowDrawingManager = new window.DrawingManager();
    }
  }

  // Clean up shadow processing session
  cleanupShadowProcessing() {
    // Reset shadow manager to new instance instead of null to avoid null access errors
    this.shadowProcessing.shadowDrawingManager = new window.DrawingManager();
    this.shadowProcessing.responses.clear();
    this.shadowProcessing.requestType = null; // This is the flag for active/inactive
    console.log(`[SHADOW] Shadow processing session cleaned up`);
  }

  // Check if shadow processing should be abandoned based on request type priorities
  shouldAbandonShadowProcessing() {
    const requestType = this.shadowProcessing.requestType;

    // Priority order: mainMenu > main > touch > refresh
    // Higher priority requests abandon lower priority ones

    // Refresh requests (lowest priority) - abandoned by mouse down or any higher priority request
    if (requestType === 'refresh') {
      return this.touchState.isDown || this.requestQueue.some(req => ['mainMenu', 'main', 'touch'].includes(req.requestType));
    }

    // Touch requests - abandoned by main or mainMenu requests
    if (requestType === 'touch') {
      return this.requestQueue.some(req => ['mainMenu', 'main'].includes(req.requestType));
    }

    // Main requests - abandoned only by mainMenu requests
    if (requestType === 'main') {
      return this.requestQueue.some(req => req.requestType === 'mainMenu');
    }

    // MainMenu requests (highest priority) - never abandoned
    if (requestType === 'mainMenu') {
      return false;
    }

    // Default - abandon unknown request types
    console.warn(`[SHADOW] Unknown request type for abandonment check: ${requestType}`);
    return true;
  }

  // Check if there are more requests related to current shadow processing
  hasMoreRelatedRequests() {
    const requestType = this.shadowProcessing.requestType;
    const relatedRequests = this.requestQueue.filter(req =>
      req.requestType === requestType ||
      req.requestType === 'insertDwg' ||
      (requestType === 'refresh' && req.requestType === 'refresh-insertDwg'));

    console.log(`[SHADOW_CHECK] hasMoreRelatedRequests() - shadow type: ${requestType}`);
    console.log(`[SHADOW_CHECK] Queue length: ${this.requestQueue.length}, related requests: ${relatedRequests.length}`);
    console.log(`[SHADOW_CHECK] All queue request types: [${this.requestQueue.map(req => req.drawingName + '(' + req.requestType + ')').join(', ')}]`);
    console.log(`[SHADOW_CHECK] Related request types: [${relatedRequests.map(req => req.drawingName + '(' + req.requestType + ')').join(', ')}]`);

    return relatedRequests.length > 0;
  }

  // Check if there's a related request in flight
  hasRelatedRequestInFlight() {
    const requestType = this.shadowProcessing.requestType;
    const hasRelated = this.sentRequest && (
      this.sentRequest.requestType === requestType ||
      this.sentRequest.requestType === 'insertDwg' ||
      (requestType === 'refresh' && this.sentRequest.requestType === 'refresh-insertDwg'));

    console.log(`[SHADOW_CHECK] hasRelatedRequestInFlight() - shadow type: ${requestType}`);
    console.log(`[SHADOW_CHECK] sentRequest: ${this.sentRequest ? this.sentRequest.drawingName + '(' + this.sentRequest.requestType + ')' : 'null'}`);
    console.log(`[SHADOW_CHECK] hasRelated: ${hasRelated}`);

    return hasRelated;
  }

  // Update collection shadow processors removed - using unified shadow processing system

  // Process drawing data (converted from global function)
  // touchZones are processed by adding current transform and then storing in touchZonesByCmd[dwgName]
  // in merge all touchZones are merged together into allTouchZonesByCmd
  // in redraw all the touchZones are drawn after unindexed and indexed items, if in debug mode
  processDrawingData(data, savedData, requestType = 'unknown') {
    // DrawingDataProcessor ALWAYS works on shadowDrawingManager only
    // Pass shadow drawing manager locally to avoid changing global references
    return this.drawingDataProcessor.processDrawingData(data, this.shadowProcessing.shadowDrawingManager, savedData, requestType);
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
    this.shadowProcessing.shadowDrawingManager.ensureItemCollections(drawingName);

    if (!drawingName) {
      console.error('[INSERT_DWG] InsertDwg item missing drawingName:', item);
      return {
        error: 'Missing drawing name',
        item: item
      };
    }

    // Check if we're trying to insert the current drawing (prevent infinite recursion)
    const mainDrawingName = this.shadowProcessing.shadowDrawingManager.drawings.length > 0 ? this.shadowProcessing.shadowDrawingManager.drawings[0] : '';
    if (drawingName === mainDrawingName) {
      console.warn(`[INSERT_DWG] Error: Cannot insert drawing "${drawingName}" into itself`);
      return {
        error: 'Self-insertion not allowed',
        drawingName: mainDrawingName
      };
    }

    // Check if this drawing is already in the drawings array
    if (this.shadowProcessing.shadowDrawingManager.drawings.includes(drawingName)) {
      console.log(`[INSERT_DWG] Drawing "${drawingName}" is already in drawings list.`);

      // Even if drawing is already in the drawings list, explicitly check if we need to request it
      if (!this.shadowProcessing.shadowDrawingManager.drawingsData[drawingName] || !this.shadowProcessing.shadowDrawingManager.drawingsData[drawingName].data) {
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
        dataAvailable: this.shadowProcessing.shadowDrawingManager.drawingsData[drawingName] && this.shadowProcessing.shadowDrawingManager.drawingsData[drawingName].data ? true : false,
        alreadyInList: true
      };
    }

    // Ensure collections exist for this drawing
    this.shadowProcessing.shadowDrawingManager.ensureItemCollections(drawingName);

    // Add this drawing to the DrawingManager
    this.shadowProcessing.shadowDrawingManager.addInsertedDrawing(
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

      // Determine the appropriate request type based on current shadow processing context
      let requestType = 'insertDwg';
      if (this.shadowProcessing.requestType === 'refresh') {
        requestType = 'refresh-insertDwg';
        console.warn(`[INSERT_DWG] Adding "${drawingName}" to request queue (refresh-triggered insert)`);
      } else {
        console.warn(`[INSERT_DWG] Adding "${drawingName}" to request queue (new insert)`);
      }

      this.addToRequestQueue(drawingName, endpoint, null, null, requestType);
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
      console.log(`[SENTREQUEST] CLEARED: "${request.drawingName}" (${request.requestType}) at ${new Date().toISOString()}`);
      this.sentRequest = null;
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`[REMOVE_DWG] Removed ${removedCount} request(s) for ${drawingName} (${initialQueueLength - this.requestQueue.length} from queue, ${this.sentRequest ? 0 : (removedCount - (initialQueueLength - this.requestQueue.length))} in-flight)`);
    }

    // First identify any child drawings that have this drawing as their parent
    const childDrawings = this.shadowProcessing.shadowDrawingManager.getChildDrawings(drawingName);

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
    this.shadowProcessing.shadowDrawingManager.removeInsertedDrawing(drawingName);

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
    './drawingMerger.js',
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
    drawingViewer.handleResize();
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
      if (!this.shadowProcessing.shadowDrawingManager.drawings.includes(currentDrawingName)) {
        this.shadowProcessing.shadowDrawingManager.drawings.unshift(currentDrawingName);
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

  // Make drawingViewer globally accessible for pfodWebMouse
  window.drawingViewer = drawingViewer;

  try {
    // Initialize the viewer - queue initial request to get drawing name from server
    drawingViewer.queueInitialRequest();

    // Redraw instance already created with canvas and context - no init needed
    // Data is managed locally in redraw

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