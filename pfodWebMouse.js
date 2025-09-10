/*   
   pfodWebMouse.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// Make pfodWebMouse available globally for browser use
window.pfodWebMouse = {
  setupEventListeners: function(drawingViewer) {
    const canvas = drawingViewer.canvas;
    
    // Initialize touchActionBackups on global object only if it doesn't exist to preserve existing backups
    if (window.pfodWebMouse.touchActionBackups === undefined) {
      window.pfodWebMouse.touchActionBackups = null;
    }

    canvas.addEventListener('mousedown', (e) => this.handleMouseDown.call(drawingViewer, e));
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove.call(drawingViewer, e));
    canvas.addEventListener('mouseup', (e) => this.handleMouseUp.call(drawingViewer, e));
    canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave.call(drawingViewer, e));
    canvas.addEventListener('click', (e) => this.handleClick.call(drawingViewer, e));
    canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault(); // Prevent context menu
    });
    
    // Prevent browser drag behavior on canvas
    canvas.addEventListener('dragstart', function(e) {
      e.preventDefault(); // Prevent canvas from being dragged
    });
    
    // Disable canvas selection and drag
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.msTouchAction = 'none';
    canvas.style.touchAction = 'none';
    canvas.draggable = false;

    // Touch events for mobile support
    canvas.addEventListener('touchstart', (e) => this.handleMouseDown.call(drawingViewer, e.touches[0]));
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.handleMouseMove.call(drawingViewer, e.touches[0]);
    });
    canvas.addEventListener('touchend', (e) => this.handleMouseUp.call(drawingViewer, e.changedTouches[0]));
  },

  // Mouse and touch event handlers
  handleMouseDown: function(e) {
    console.warn(`[MOUSE_DOWN] called handleMouseDown`);
    const currentDrawingData = this.drawingManager.getCurrentDrawingData();
    if (!currentDrawingData) return;

    const drawingName = this.drawingManager.getMainDrawingName();

    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.canvas.scaleX;
    const y = (e.clientY - rect.top) / this.canvas.scaleY;

    let minTouch_mm = 9;
    let minPercent = 2 / 100;
    let colPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4); // half 9mm to add to both sides
    let rowPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4);
    if ((rect.width * minPercent) > colPixelsHalf9mm) {
      colPixelsHalf9mm = rect.width * minPercent;
    }
    if ((rect.height * minPercent) > rowPixelsHalf9mm) {
      rowPixelsHalf9mm = rect.height * minPercent;
    }
    console.log(`DOWN in touchZone: enlarge by ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);
    colPixelsHalf9mm = colPixelsHalf9mm / this.canvas.scaleX;
    rowPixelsHalf9mm = rowPixelsHalf9mm / this.canvas.scaleX;
    console.log(`DOWN in touchZone: canvas ${rect.width} x ${rect.height}`);
    console.log(`DOWN in touchZone: enlarge by dwg coords ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);

    // Update touch state
    console.log(`[MOUSE_DOWN] Setting touchState.isDown = true`);
    this.touchState.wasDown = this.touchState.isDown;
    this.touchState.isDown = true;
    this.touchState.startX = x;
    this.touchState.startY = y;
    this.touchState.lastX = x;
    this.touchState.lastY = y;
    this.touchState.startTime = Date.now();
    this.touchState.hasDragged = false;
    this.touchState.hasEnteredZones.clear();

    
      // Make backup copy of ONLY merged/display data that will be modified by touchActions
      const transformBackup = JSON.parse(JSON.stringify(this.mergeAndRedraw.getGlobalTransform()));
      
      // Backup merged collections that will be restored
      const allTouchZonesBackup = JSON.parse(JSON.stringify(this.mergeAndRedraw.getAllTouchZonesByCmd()));
      const allUnindexedItemsBackup = JSON.parse(JSON.stringify(this.mergeAndRedraw.getAllUnindexedItems()));
      const allIndexedItemsByNumberBackup = JSON.parse(JSON.stringify(this.mergeAndRedraw.getAllIndexedItemsByNumber()));
      const touchActionsBackup = JSON.parse(JSON.stringify(this.mergeAndRedraw.getAllTouchActionsByCmd()));
      const touchActionInputsBackup = JSON.parse(JSON.stringify(this.mergeAndRedraw.getAllTouchActionInputsByCmd()));

      // Get current clip area from drawing data
      const drawingData = this.drawingManager.getDrawingData(drawingName);
      const clipAreaBackup = drawingData ? {
        x: drawingData.x || 0,
        y: drawingData.y || 0,
        width: drawingData.data ? drawingData.data.x : 0,
        height: drawingData.data ? drawingData.data.y : 0
      } : null;

      console.warn(`[TOUCH_ACTION] Creating INITIAL backup: ${Object.keys(allTouchZonesBackup).length} merged touchZones, ${allUnindexedItemsBackup.length} merged unindexed items, ${Object.keys(allIndexedItemsByNumberBackup).length} merged indexed items, ${Object.keys(touchActionsBackup).length} touchActions, ${Object.keys(touchActionInputsBackup).length} touchActionInputs, transform (${transformBackup.x}, ${transformBackup.y}, ${transformBackup.scale}), and clip area`);
    // copy current dwg state
      // Store the complete backup for restoration when mouse is released
      console.log(`[TOUCH_ACTION] DEBUG - Creating backup on object:`, this);
      console.log(`[TOUCH_ACTION] DEBUG - Object constructor:`, this.constructor?.name);
      // Store backup on the global pfodWebMouse object so it's accessible from restoration calls
      window.pfodWebMouse.touchActionBackups = {
        transform: transformBackup,
        clipArea: clipAreaBackup,
        allTouchZonesByCmd: allTouchZonesBackup,
        allUnindexedItems: allUnindexedItemsBackup,
        allIndexedItemsByNumber: allIndexedItemsByNumberBackup,
        touchActions: touchActionsBackup,
        touchActionInputs: touchActionInputsBackup
      };


    // Find the touchZone at this position
    const foundTouchZone = window.pfodWebMouse.findTouchZoneAt.call(this, x, y, colPixelsHalf9mm, rowPixelsHalf9mm);
    this.touchState.targetTouchZone = foundTouchZone;

    // Handle basic TOUCH filter (default if no filter specified)
    if (foundTouchZone && (foundTouchZone.filter === TouchZoneFilters.TOUCH || foundTouchZone.filter === 0)) {
      console.log(`TOUCH in touchZone: cmd=${foundTouchZone.cmd}`);
      window.pfodWebMouse.handleTouchZoneActivation.call(this, foundTouchZone, TouchZoneFilters.TOUCH, x, y);
    } 

    // If we found a touchZone with a DOWN filter, handle it
    if (foundTouchZone && (foundTouchZone.filter & TouchZoneFilters.DOWN)) {
      console.log(`Mouse DOWN in touchZone: cmd=${foundTouchZone.cmd}, filter=${foundTouchZone.filter}`);
      window.pfodWebMouse.handleTouchZoneActivation.call(this, foundTouchZone, TouchZoneFilters.DOWN, x, y);
    }
    // If we found a touchZone with a DOWN_UP / DOWN_DRAG_UP filter, handle it show touchActions but no msg yet
    if (foundTouchZone && (foundTouchZone.filter & TouchZoneFilters.DOWN_DRAG_UP)) {
      console.log(`Mouse DOWN in touchZone: cmd=${foundTouchZone.cmd}, filter=${foundTouchZone.filter}`);
      window.pfodWebMouse.handleTouchZoneActivation.call(this, foundTouchZone, TouchZoneFilters.DOWN, x, y, false);
    }

    // If we found a touchZone with a CLICK filter, handle it
//    if (foundTouchZone && (foundTouchZone.filter & TouchZoneFilters.CLICK)) {
//      console.log(`Mouse DOWN in touchZone: cmd=${foundTouchZone.cmd}, filter=${foundTouchZone.filter}`);
//      window.pfodWebMouse.handleTouchZoneActivation.call(this, foundTouchZone, TouchZoneFilters.DOWN, x, y, false); // show touchActions but no msg
//    }
    
    // If the touchZone supports PRESS (long press), set up a timer
    if (foundTouchZone && (foundTouchZone.filter & TouchZoneFilters.PRESS)) {
      if (this.touchState.longPressTimer) {
        clearTimeout(this.touchState.longPressTimer);
      }

      // Set a timer for long press (700ms is standard)
      this.touchState.longPressTimer = setTimeout(() => {
        if (this.touchState.isDown && this.touchState.targetTouchZone === foundTouchZone) {
          console.log(`Long PRESS in touchZone: cmd=${foundTouchZone.cmd}`);
          window.pfodWebMouse.handleTouchZoneActivation.call(this, foundTouchZone, TouchZoneFilters.PRESS, this.touchState.lastX, this.touchState.lastY);
        }
      }, 700);
    }
  },

  handleMouseMove: function(e) {
    if (!this.touchState.isDown) return;

    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.canvas.scaleX;
    const y = (e.clientY - rect.top) / this.canvas.scaleY;

    let minTouch_mm = 9;
    let minPercent = 2 / 100;
    let colPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4); // half 9mm to add to both sides
    let rowPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4);
    if ((rect.width * minPercent) > colPixelsHalf9mm) {
      colPixelsHalf9mm = rect.width * minPercent;
    }
    if ((rect.height * minPercent) > rowPixelsHalf9mm) {
      rowPixelsHalf9mm = rect.height * minPercent;
    }
    console.log(`DRAG in touchZone enlarge by ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);
    colPixelsHalf9mm = colPixelsHalf9mm / this.canvas.scaleX;
    rowPixelsHalf9mm = rowPixelsHalf9mm / this.canvas.scaleX;
    console.log(`DRAG in touchZone canvas ${rect.width} x ${rect.height}`);
    console.log(`DRAG in touchZone enlarge by dwg coords ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);

    // Update current position
    this.touchState.lastX = x;
    this.touchState.lastY = y;

    // Calculate distance moved from start point
    const dx = x - this.touchState.startX;
    const dy = y - this.touchState.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only consider as drag if moved more than a small threshold
    if (distance > 0) {
      this.touchState.hasDragged = true;

      // Find touchZone at current position
      const currentTouchZone = window.pfodWebMouse.findTouchZoneAt.call(this, x, y, colPixelsHalf9mm, rowPixelsHalf9mm);

      // Handle ENTRY/EXIT events
      if (currentTouchZone !== this.touchState.targetTouchZone) {
        // Handle EXIT from previous touchZone
        if (this.touchState.targetTouchZone && (this.touchState.targetTouchZone.filter & TouchZoneFilters.EXIT)) {
          console.log(`EXIT from touchZone: cmd=${this.touchState.targetTouchZone.cmd}`);
          window.pfodWebMouse.handleTouchZoneActivation.call(this, this.touchState.targetTouchZone, TouchZoneFilters.EXIT, x, y, false);
        }

        // Handle ENTRY to new touchZone
        if (currentTouchZone && (currentTouchZone.filter & TouchZoneFilters.ENTRY)) {
          // Only trigger ENTRY once per touch sequence for this zone
          if (!this.touchState.hasEnteredZones.has(currentTouchZone)) {
            console.log(`ENTRY to touchZone: cmd=${currentTouchZone.cmd}`);
            window.pfodWebMouse.handleTouchZoneActivation.call(this, currentTouchZone, TouchZoneFilters.ENTRY, x, y, false);
            this.touchState.hasEnteredZones.add(currentTouchZone);
          }
        }

        this.touchState.targetTouchZone = currentTouchZone;
      }

      // Handle DRAG events for current touchZone
      if (currentTouchZone && (currentTouchZone.filter & TouchZoneFilters.DRAG)) {
        console.warn(`[MOUSE_DRAG] in touchZone: cmd=${currentTouchZone.cmd}`);
        window.pfodWebMouse.handleTouchZoneActivation.call(this, currentTouchZone, TouchZoneFilters.DRAG, x, y);
      }
      // Handle DRAG events for current touchZone
      if (currentTouchZone && (currentTouchZone.filter & TouchZoneFilters.DOWN_DRAG_UP)) {
        console.log(`[MOUSE_DRAG] in touchZone: cmd=${currentTouchZone.cmd}`);
        window.pfodWebMouse.handleTouchZoneActivation.call(this, currentTouchZone, TouchZoneFilters.DRAG, x, y,false); // show but not send
      }

      // Check if we've left the original touchzone that started the drag
      if (this.touchState.targetTouchZone && !currentTouchZone) {
        console.warn('[MOUSE_DRAG] Left original touchzone area - restoring touchActions and processing pending responses');

        // Restore from any active touchActions FIRST to get back to basic state
        const drawingName = this.drawingManager.currentDrawingName;
        if (drawingName) {
          window.pfodWebMouse.restoreFromTouchAction(this, drawingName);
          // Immediately redraw to show the restored state
          this.mergeAndRedraw.redrawCanvas();
        }

        // THEN process any pending responses
        if (this.pendingResponseQueue.length > 0) {
          this.processPendingResponses();
        }

        // Reset mouse state since we've left the drag area
        this.touchState.wasDown = this.touchState.isDown;
        this.touchState.isDown = false;
        this.touchState.targetTouchZone = null;
        this.touchState.hasEnteredZones.clear();
      }
    }
  },

  handleMouseUp: function(e) {
    if (!this.touchState.isDown) return;

    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.canvas.scaleX;
    const y = (e.clientY - rect.top) / this.canvas.scaleY;

    // Cancel long press timer if active
    if (this.touchState.longPressTimer) {
      clearTimeout(this.touchState.longPressTimer);
      this.touchState.longPressTimer = null;
    }

    // Handle UP and DOWN_DRAG_UP events for current touchZone
    if (this.touchState.targetTouchZone) {
      // Handle UP filter - Works
      if (this.touchState.targetTouchZone.filter & TouchZoneFilters.UP) {
        console.log(`Mouse UP in touchZone: cmd=${this.touchState.targetTouchZone.cmd}`);
        window.pfodWebMouse.handleTouchZoneActivation.call(this, this.touchState.targetTouchZone, TouchZoneFilters.UP, x, y);
      }

      // Handle DOWN_DRAG_UP filter - only sends on finger up - Works
      if (this.touchState.targetTouchZone.filter & TouchZoneFilters.DOWN_DRAG_UP) {
        console.log(`DOWN_UP in touchZone: cmd=${this.touchState.targetTouchZone.cmd}`);
        window.pfodWebMouse.handleTouchZoneActivation.call(this, this.touchState.targetTouchZone, TouchZoneFilters.DOWN_DRAG_UP, x, y);
      }
    }

    // Reset touch state FIRST to allow final redraw
    console.log(`[MOUSE_UP] Setting touchState.isDown = false`);
    this.touchState.wasDown = this.touchState.isDown;
    this.touchState.isDown = false;

    // Restore from any active touchActions to get back to basic state
    const drawingName = this.drawingManager.currentDrawingName;
    if (this.touchState.targetTouchZone && (this.touchState.targetTouchZone.filter & TouchZoneFilters.CLICK)) {
        // SKIP RESTORE
    } else {
      if (drawingName) {
        window.pfodWebMouse.restoreFromTouchAction(this, drawingName);
        // Immediately redraw to show the restored state - now that mouse is up
        this.mergeAndRedraw.redrawCanvas();
      }
    }

    // THEN process any pending responses that were queued while mouse was down
    this.processPendingResponses();
    this.touchState.targetTouchZone = null;
    this.touchState.hasEnteredZones.clear();
  },

  handleMouseLeave: function(e) {
    console.log('[MOUSE_LEAVE] Mouse left canvas area');
    if (this.touchState.isDown) {
      console.log('[MOUSE_LEAVE] Mouse was down - restoring touchActions and processing pending responses');

      // Restore from any active touchActions FIRST to get back to basic state
      const drawingName = this.drawingManager.currentDrawingName;
      if (drawingName) {
        window.pfodWebMouse.restoreFromTouchAction(this, drawingName);
        // Immediately redraw to show the restored state
        this.mergeAndRedraw.redrawCanvas();
      }

      // THEN process any pending responses
      if (this.pendingResponseQueue.length > 0) {
        this.processPendingResponses();
      }

      // Reset touch state
      this.touchState.wasDown = this.touchState.isDown;
      this.touchState.isDown = false;
      this.touchState.targetTouchZone = null;
      this.touchState.hasEnteredZones.clear();
    }
  },

  handleClick: function(e) {
    // Check if mouse was held down for longer than PRESS timeout (700ms)
    // If so, ignore this click as it was a long press
    const currentTime = Date.now();
    const pressDuration = currentTime - this.touchState.startTime;
    if (pressDuration >= 700) {
      console.log(`Ignoring click - mouse was held down for ${pressDuration}ms (long press)`);
      this.touchState.hasDragged = false;
      return;
    }

    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect(); // canvas rect in pixels 
    const x = (e.clientX - rect.left) / this.canvas.scaleX;
    const y = (e.clientY - rect.top) / this.canvas.scaleY;

    let minTouch_mm = 9;
    let minPercent = 2 / 100;
    let colPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4); // half 9mm to add to both sides
    let rowPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4);
    if ((rect.width * minPercent) > colPixelsHalf9mm) {
      colPixelsHalf9mm = rect.width * minPercent;
    }
    if ((rect.height * minPercent) > rowPixelsHalf9mm) {
      rowPixelsHalf9mm = rect.height * minPercent;
    }
    console.log(`CLICK in touchZone: enlarge by ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);
    colPixelsHalf9mm = colPixelsHalf9mm / this.canvas.scaleX;
    rowPixelsHalf9mm = rowPixelsHalf9mm / this.canvas.scaleX;
    console.log(`CLICK in touchZone: canvas ${rect.width} x ${rect.height}`);
    console.log(`CLICK in touchZone: enlarge by dwg coords ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);

    // Find touchZone at click position
    const touchZone = window.pfodWebMouse.findTouchZoneAt.call(this, x, y, colPixelsHalf9mm, rowPixelsHalf9mm);

    // Handle basic CLICK event without drag
    if (!this.touchState.hasDragged) {
      if (touchZone) {
        // Handle CLICK filter
        if (touchZone && (touchZone.filter & TouchZoneFilters.CLICK)) {
          console.log(`CLICK in touchZone: cmd=${touchZone.cmd}`);
          window.pfodWebMouse.handleTouchZoneActivation.call(this, touchZone, TouchZoneFilters.CLICK, x, y, false);
          if (this.touchState.clickTimer) {
           clearTimeout(this.touchState.clickTimer);
          }

          // Set a timer for display of click touchActions (100ms is standard)
          this.touchState.clickTimer = setTimeout(() => {
            window.pfodWebMouse.handleTouchZoneActivation.call(this, touchZone, TouchZoneFilters.CLICK, this.touchState.lastX, this.touchState.lastY);
          }, 100);
          return;
        } 
      } else {
        // Special case: no touchZones defined or clicked outside all touchZones
        // Only send update request if no touchZones are defined
        const hasTouchZones = Object.keys(this.mergeAndRedraw.getAllTouchZonesByCmd()).length > 0;

        if (!hasTouchZones) {
          // No touchZones defined, so queue a general update request
          console.log("No touchZones defined - requesting general update on click");

          // Queue a general update request
          this.queueDrawingUpdate(this.drawingManager.currentDrawingName);

          // If there are any inserted drawings, queue updates for them too
          if (this.drawingManager.drawings.length > 1) {
            // Skip the first drawing (main drawing) and only include inserted drawings
            const insertedDrawings = this.drawingManager.drawings.slice(1);
            for (const insertedDrawingName of insertedDrawings) {
              this.queueDrawingUpdate(insertedDrawingName);
            }
          }
        } else {
          console.log("Touch outside defined touchZones - ignoring");
        }
      }
    }

    // Safety net: Restore touchActions and process any pending responses if mouse state got out of sync
    const drawingName = this.drawingManager.currentDrawingName;
    if (drawingName) {
      window.pfodWebMouse.restoreFromTouchAction(this, drawingName);
      // Immediately redraw to show the restored state
      this.mergeAndRedraw.redrawCanvas();
    }

    if (this.pendingResponseQueue.length > 0) {
      console.log(`[QUEUE] Safety net: Processing ${this.pendingResponseQueue.length} pending responses in handleClick`);
      this.processPendingResponses();
    }

    // Reset drag state
    this.touchState.hasDragged = false;
  },

  // Find touchZone containing specified coordinates (instance method)
  // touchZone object
  //    touchZoneObject = {
  //        type: "touchZone",
  //        xSize: xSize,
  //        ySize: ySize,
  //        cmd: cmd,
  //        idx: idx
  //        xOffset: xOffset,
  //        yOffset: yOffset,
  //        filter: filter,
  //        centered: "true"
  //    }
  
  // row col extra in dwg coords
  findTouchZoneAt: function(x, y, colExtra, rowExtra) { 
    console.warn(`[FIND_TOUCH_ZONE] findTouchZoneAt called with x:${x} y:${y} colExtra:${colExtra} rowExtra:${rowExtra}`);

    // Collect all visible touchZones
    let visibleTouchZones = [];

    //always use touchActionBackups
    
    // Create array from touchZonesByCmd values
    // Debug check for undefined issues during drag
    if (!this.mergeAndRedraw) {
        console.error(`[FIND_TOUCH_ZONE] this.mergeAndRedraw is undefined`);
        return null;
    }
    
    const allTouchZones = window.pfodWebMouse.touchActionBackups?.allTouchZonesByCmd;
    console.log(`[FIND_TOUCH_ZONE] DEBUG allTouchZonesByCmd returned ${Object.keys(allTouchZones || {}).length} touchZones:`, Object.keys(allTouchZones || {}));
    if (allTouchZones === undefined) {
        console.error(`[FIND_TOUCH_ZONE] allTouchZonesByCmd returned undefined during ${this.touchState?.isDown ? 'DRAG' : 'NORMAL'} operation`);
        return null;
    }
    for (const cmd in allTouchZones) {
      const zone = allTouchZones[cmd];

      // Only include visible and non-disabled zones
      if (zone.visible !== false && zone.filter !== TouchZoneFilters.TOUCH_DISABLED) {
        visibleTouchZones.push(zone);
      }
    }
    console.warn(`[FIND_TOUCH_ZONE] number of visible touchZones ${visibleTouchZones.length}`);

    // Sort by idx (high idx first) last one wins if it over lays earlier one
    //visibleTouchZones.sort((a, b) => (b.idx || 0) - (a.idx || 0));

    // returns -ve if outside rect else min (x-x_middle,y-y_middle)
    // Check if point is inside any touchZone
    let currentZone = null;
    let currentBounds = null;
    let current_colMin = 0;
    let current_rowMin = 0;
    for (const zone of visibleTouchZones) {
      // Calculate touchZone bounds in dwg coords
      let bounds = window.pfodWebMouse.calculateTouchZoneBounds.call(this, zone);
      // apply min extra
      bounds.left -= colExtra;
      bounds.right += colExtra;
      bounds.top -= rowExtra;
      bounds.bottom += rowExtra;
      bounds.width = bounds.right - bounds.left;
      bounds.height = bounds.bottom - bounds.top;
      console.warn(`[FIND_TOUCH_ZONE] TouchZone: cmd=${zone.cmd}, left:${bounds.left} right:${bounds.right} top:${bounds.top} bottom:${bounds.bottom}`);
      // Check if point is inside bounds
      let insideZone = (x >= bounds.left && x <= bounds.left + bounds.width &&
        y >= bounds.top && y <= bounds.top + bounds.height);
      if (!insideZone) {
        continue;
      }
      colMin = Math.min(x - bounds.left, bounds.right - x); // closest col to edge
      rowMin = Math.min(y - bounds.top, bounds.bottom - y); // closest row to edge
      if (currentZone == null) {
        // make sure these are set for rect compare on next call
        currentZone = zone;
        current_colMin = colMin;
        current_rowMin = rowMin;
        currentBounds = bounds;
         console.warn(`[FIND_TOUCH_ZONE] TouchZone: cmd=${currentZone.cmd}, colMin:${colMin} rowMin:${rowMin})`);
        continue;
      } else { // have current
        let currentIdx = currentZone.idx;
        let thisIdx = zone.idx;
        if (currentIdx != thisIdx) {
          if (currentIdx > thisIdx) {
            // currentZone; // wins
            continue;
          } else if (thisIdx > currentIdx) {
            currentZone = zone;
            current_colMin = colMin;
            current_rowMin = rowMin;
            currentBounds = bounds;
            continue;
          }
        } else { // same idx so compare overlaps  
           console.warn(`[FIND_TOUCH_ZONE] TouchZone: cmd=${zone.cmd}, colMin:${colMin} rowMin:${rowMin})`);

          // else // continue to check overlaps
          // Returns true if `a` contains `b`
          // if current contains this return current
          // i.e. larger rect sits over smaller one but only if it completely covers it.
          // used for dragging
          // normally touchZones do not have/need indices
          // this approach allows you to put a whole dwg touchZone over other dwgs and
          // then click and drag them (identified by their position on the dwg)
          // without triggering the underlying dwgs own touchZones.
          //
          // touchZones ordered in the order they (first) arrived
          // if a late touchZone exactly overlays an earlier on the later (higher) touchZone is the active one!!
          // NOTE: rectf can have -ve values It is not limited to screen
          const contains = (a, b) => a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom;
          if (contains(zone, currentZone)) { // later zone contains earlier
            currentZone = zone;
            current_colMin = colMin;
            current_rowMin = rowMin;
            currentBounds = bounds;
            continue;
          } else if (contains(currentZone, zone)) {
            // no change
            continue;
          } else {
            // check overlap for best fit
            // else compare based on min overlap dimension
            // x_overlap = Math.max(0, Math.min(x12,x22) - Math.max(x11,x21));
            // y_overlap = Math.max(0, Math.min(y12,y22) - Math.max(y11,y21));
            // x11 = left y11 = top x12 = right, y12 = bottom
            // MUST overlap since point in both so can skip Math.max(0...
            let colOverlap = Math.min(bounds.right, currentBounds.right) - Math.max(bounds.left, currentBounds.left);
            let rowOverlap = Math.min(bounds.bottom, currentBounds.bottom) - Math.max(bounds.top, currentBounds.top);
            // console.warn(`[FIND_TOUCH_ZONE] colOverlap:${colOverlap} rowOverlap:${rowOverlap})`);

            let compareCol = true;
            // need this for long rectangles
            if (colOverlap == rowOverlap) {
              // check both dimensions point in col dimension
              let col_min = Math.min(current_colMin, colMin);
              let row_min = Math.min(current_rowMin, rowMin);
              // console.warn(`[FIND_TOUCH_ZONE] col_min:${col_min} row_min:${row_min})`);
              if (col_min < row_min) {
                // since overlap equal then this also implies col_max > row_max
                // closest to col boundry
                // compareCol == true;
              } else {
                compareCol = false;
              }
            } else if (colOverlap < rowOverlap) {
              // compareCol == true;
            } else {
              compareCol = false;
            }
            if (compareCol) {
              // check point in col dimension
              if (current_colMin <= colMin) {
                // nearer edge of current so choose this
                // if equal later ones take precedence
                currentZone = zone;
                current_colMin = colMin;
                current_rowMin = rowMin;
                currentBounds = bounds;
              } else {
                // return current;
              }
            } else {
              // check point in row dimension
              if (current_rowMin <= rowMin) {
                // nearer edge of current so choose this
                currentZone = zone;
                current_colMin = colMin;
                current_rowMin = rowMin;
                currentBounds = bounds;
              } else {
                // return current;
              }
            }
          }
        }
      }
    }
    if (currentZone) {
      console.warn(`[FIND_TOUCH_ZONE] returning TouchZone: cmd=${currentZone.cmd}`);
    } else {
      console.warn(`[FIND_TOUCH_ZONE] returning TouchZone: null`);
    }
    return currentZone; // the one found
  },

  // Calculate the bounds of a touchZone in canvas coordinates (instance method)
  // left, right, top, bottom
  calculateTouchZoneBounds: function(zone) {
    // Get the transform
    const transform = zone.transform || {
      x: 0,
      y: 0,
      scale: 1.0
    };

    // Get properties with defaults
    const xOffset = parseFloat(zone.xOffset || 0);
    const yOffset = parseFloat(zone.yOffset || 0);
    const xSize = parseFloat(zone.xSize || 1); // min size is 1
    const ySize = parseFloat(zone.ySize || 1);
    const centered = zone.centered === 'true' || zone.centered === true;

    // Apply transform scale
    const scaledXOffset = xOffset * transform.scale;
    const scaledYOffset = yOffset * transform.scale;
    const scaledXSize = xSize * transform.scale;
    const scaledYSize = ySize * transform.scale;

    // Calculate bounds based on centered property
    let x, y, width, height;

    if (centered) {
      // For centered zones, center point is at the offset
      x = transform.x + scaledXOffset - Math.abs(scaledXSize) / 2;
      y = transform.y + scaledYOffset - Math.abs(scaledYSize) / 2;
      width = Math.abs(scaledXSize);
      height = Math.abs(scaledYSize);
    } else {
      // For non-centered zones, handle negative sizes
      if (scaledXSize >= 0) {
        x = transform.x + scaledXOffset;
        width = scaledXSize;
      } else {
        x = transform.x + scaledXOffset + scaledXSize; // Move start point left
        width = Math.abs(scaledXSize);
      }

      if (scaledYSize >= 0) {
        y = transform.y + scaledYOffset;
        height = scaledYSize;
      } else {
        y = transform.y + scaledYOffset + scaledYSize; // Move start point up
        height = Math.abs(scaledYSize);
      }
    }

    //        return { x, y, width, height };
    let left = x;
    let right = x + width;
    let top = y;
    let bottom = y + height;
    return {
      left,
      right,
      top,
      bottom,
      width,
      height
    };
  },

  // Handle touchZone activation by queueing a request (instance method)
  handleTouchZoneActivation: function(touchZone, touchType, x, y, sendMsg = true) {
    if (!touchZone.cmd) return;

    // Skip disabled touchZones
    if (touchZone.filter & TouchZoneFilters.TOUCH_DISABLED) return;

    // Calculate touchZone bounds in canvas coordinates left, rigth, top, bottom, width, height
    const bounds = window.pfodWebMouse.calculateTouchZoneBounds.call(this, touchZone);
    // apply min extra
    //    bounds.left -= colHalf9mm;
    //    bounds.right += colHalf9mm;
    //    bounds.top -= rowHalf9mm;
    //    bounds.bottom += rowHalf9mm;
    //    bounds.width = bounds.right - bounds.left;
    //    bounds.height = bounds.bottom - bounds.top;

    // Get the original touchZone dimensions (unscaled)
    const xSize = parseFloat(touchZone.xSize || 1);
    const ySize = parseFloat(touchZone.ySize || 1);

    // Convert global coordinates to touchZone-relative coordinates
    // First, get the position within the rendered (scaled) touchZone
    const relativeX = x - bounds.left;
    const relativeY = y - bounds.top;

    // Scale back to the original touchZone coordinate system
    // This ensures coordinates range from 0,0 to width,height regardless of scaling
    const scaledCol = (relativeX / bounds.width) * Math.abs(xSize);
    const scaledRow = (relativeY / bounds.height) * Math.abs(ySize);

    // Round to nearest integer
    let col = Math.round(scaledCol);
    let row = Math.round(scaledRow);
    // limit to zone size
    if (col < 0) {
      col = 0;
    }
    if (row < 0) {
      row = 0;
    }
    if (col > xSize) {
      col = xSize;
    }
    if (row > ySize) {
      row = ySize;
    }

    console.log(`[TOUCH_ZONE} TouchZone activated: cmd=${touchZone.cmd}, touchType=${touchType}`);
    console.log(`Global coords: (${x}, ${y}), TouchZone bounds: (${bounds.left}, ${bounds.top}, ${bounds.width}, ${bounds.height})`);
    console.log(`Original size: ${xSize}x${ySize}, Displayed size: ${bounds.width}x${bounds.height}`);
    console.log(`Relative coords: (${relativeX}, ${relativeY}), Scaled: (${scaledCol}, ${scaledRow})`);
    console.log(`[TOUCH_ZONE]  Rounded to nearest int: col=${col}, row=${row} (range 0,0 to ${xSize},${ySize})`);

    // Get the drawing name
    const drawingName = this.drawingManager.currentDrawingName; //touchZone.drawingName || 

    // Check for touchActionInput first - it runs before other touchActions
    const allTouchActionInputsByCmd = this.mergeAndRedraw.getAllTouchActionInputsByCmd();
    const touchActionInput = allTouchActionInputsByCmd[touchZone.cmd];
    if (touchActionInput) {
      console.log(`[TOUCH_ACTION_INPUT] Found touchActionInput for cmd=${touchZone.cmd}`);
      window.pfodWebMouse.executeTouchActionInput.call(this, drawingName, touchZone.cmd, touchActionInput, col, row, touchType);
      return; // touchActionInput handles its own execution flow
    }

    // Execute touchAction if it exists for this cmd clears before starting
    window.pfodWebMouse.executeTouchAction.call(this, drawingName, touchZone.cmd, col, row, touchType);
    if (sendMsg) {
      // Build the endpoint for the touchZone event using /pfodWeb
      // For touchZone actions, include col, row, touchType inside the command
      // Use dynamic identifier from calling context (this.currentIdentifier)
      const identifier = this.currentIdentifier || 'pfodWeb';
      const touchZoneCmd = `{${identifier}~${touchZone.cmd}\`${col}\`${row}\`${touchType}}`;
      let endpoint = `/pfodWeb?cmd=${encodeURIComponent(touchZoneCmd)}`;

      // Add editedText if it exists (for text input touchZones)
      //        if (this.textInputValue) {
      // For touchActionInput, append ~editedText inside the braces
      //            const touchZoneCmdWithText = `{pfodWeb~${touchZone.cmd}\`${col}\`${row}\`${touchType}~${this.textInputValue}}`;
      //            endpoint = `/pfodWeb?cmd=${encodeURIComponent(touchZoneCmdWithText)}`;
      //           this.textInputValue = null; // Clear after use
      //       }

      console.log(`[TOUCH_ACTION_QUEUE] endpoint before version: ${endpoint}`);

      // Add version query parameter if available
      const savedVersion = localStorage.getItem(`${drawingName}_version`);
      console.log(`[TOUCH_ACTION_QUEUE] drawingName: ${drawingName}, savedVersion: "${savedVersion}"`);
      console.log(`[TOUCH_ACTION_QUEUE] localStorage key: "${drawingName}_version"`);
      console.log(`[TOUCH_ACTION_QUEUE] All localStorage keys:`, Object.keys(localStorage));
      if (savedVersion !== null) {
        endpoint += `&version=${encodeURIComponent(savedVersion)}`;
        console.log(`[TOUCH_ACTION_QUEUE] endpoint after adding version: ${endpoint}`);
      } else {
        console.log(`[TOUCH_ACTION_QUEUE] No version added - savedVersion: "${savedVersion}" (null)`);
      }

      // Set up request options - will be corrected by addToRequestQueue for cross-origin
      const options = {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        mode: 'same-origin',
        credentials: 'same-origin',
        cache: 'no-cache'
      };

      // Add to the request queue with touchZone info for drag optimization
      this.addToRequestQueue(drawingName, endpoint, options, {
        cmd: touchZone.cmd,
        filter: touchType
      }, 'touch');
    }
  },

  // Execute touchAction when touchZone is activated
  executeTouchAction: function(drawingName, cmd, col, row, touchType) {
    console.log(`[TOUCH_ACTION] executeTouchAction Checking for touchAction: drawing=${drawingName}, cmd=${cmd} touchType=${touchType}`);

    // REQUIREMENT: Always start from basic (untouched) drawing
    // Only make backup once - don't restore during drag operations

    // Get the touchAction for this cmd from merged data
    const allTouchActionsByCmd = this.mergeAndRedraw.getAllTouchActionsByCmd();
    const touchActions = allTouchActionsByCmd[cmd];

    if (!touchActions || touchActions.length === 0) {
      console.log(`[TOUCH_ACTION] No touchAction found for cmd=${cmd}, drawing=${drawingName}`);
      return;
    }

    console.log(`[TOUCH_ACTION] Found touchAction with ${touchActions.length} actions for cmd=${cmd}, touchType=${touchType}`);

    

    // Get the backup before creating the pseudo response
    const backup = window.pfodWebMouse.touchActionBackups;
    
    // Create a pseudo update response with the touchAction items
    const pseudoUpdateResponse = {
      pfodDrawing: 'update',
      name: drawingName,
      items: touchActions.map(actionItem => {
        const item = JSON.parse(JSON.stringify(actionItem));
        
        if (item.idx !== undefined) {
          const backupIndexedItem = backup.allIndexedItemsByNumber[item.idx];
          if (!backupIndexedItem) {
            console.error(`[TOUCH_ACTION] Processing touchAction but no dwg item for this index`, JSON.stringify(item,null,2));
            return null; // Return null for invalid items, they'll be filtered out
          }
          console.warn(`[TOUCH_ACTION] Processing touchAction to update `, JSON.stringify(backupIndexedItem,null,2));
          
          // Apply special touchZone values if they exist (support both string and numeric formats)
          if (item.xOffset === 'COL' || item.xOffset === TouchZoneSpecialValues.TOUCHED_COL) {
            item.xOffset = col;
            console.log(`[TOUCH_ACTION] Replaced xOffset COL with ${col}`);
          } else if (item.xOffset === 'ROW' || item.xOffset === TouchZoneSpecialValues.TOUCHED_ROW) {
            item.xOffset = row;
            console.log(`[TOUCH_ACTION] Replaced xOffset ROW with ${row}`);
          }
          if (item.yOffset === 'ROW' || item.yOffset === TouchZoneSpecialValues.TOUCHED_ROW) {
            item.yOffset = row;
            console.log(`[TOUCH_ACTION] Replaced yOffset ROW with ${row}`);
          } else if (item.yOffset === 'COL' || item.yOffset === TouchZoneSpecialValues.TOUCHED_COL) {
            item.yOffset = col;
            console.log(`[TOUCH_ACTION] Replaced yOffset COL with ${col}`);
          }

                    // Apply special touchZone values if they exist (support both string and numeric formats)
          if (item.xSize === 'COL' || item.xSize === TouchZoneSpecialValues.TOUCHED_COL) {
            item.xSize = col;
            console.log(`[TOUCH_ACTION] Replaced xSize COL with ${col}`);
          } else if (item.xSize === 'ROW' || item.xSize === TouchZoneSpecialValues.TOUCHED_ROW) {
            item.xSize = row;
            console.log(`[TOUCH_ACTION] Replaced xSize ROW with ${row}`);
          }
          if (item.ySize === 'ROW' || item.ySize === TouchZoneSpecialValues.TOUCHED_ROW) {
            item.ySize = row;
            console.log(`[TOUCH_ACTION] Replaced ySize ROW with ${row}`);
          } else if (item.ySize === 'COL' || item.ySize === TouchZoneSpecialValues.TOUCHED_COL) {
            item.ySize = col;
            console.log(`[TOUCH_ACTION] Replaced ySize COL with ${col}`);
          }

          // Apply special touchZone values for intValue if item is a value type
          if (item.type === 'value' && item.intValue !== undefined) {
            if (item.intValue === 'COL' || item.intValue === TouchZoneSpecialValues.TOUCHED_COL) {
              item.intValue = col;
              console.log(`[TOUCH_ACTION] Replaced intValue COL with ${col}`);
            } else if (item.intValue === 'ROW' || item.intValue === TouchZoneSpecialValues.TOUCHED_ROW) {
              item.intValue = row;
              console.log(`[TOUCH_ACTION] Replaced intValue ROW with ${row}`);
            }
          }

          // Add transform and clipRegion from backup
          item.transform = backupIndexedItem.transform;// || { x: 0, y: 0, scale: 1 };
          item.clipRegion = backupIndexedItem.clipRegion;// || { x: 0, y: 0, width: 100, height: 20 };
          
          console.log(`[TOUCH_ACTION] Processing touchAction as pseudo update `, JSON.stringify(item,null,2));
          return item;
          
        } else {
          console.error(`[TOUCH_ACTION] Processing touchAction but it has no index`, JSON.stringify(item,null,2));
          return null; // Return null for items without index
        }
      }).filter(item => item !== null)
    };

    console.log(`[TOUCH_ACTION] Processing touchAction as pseudo update with ${pseudoUpdateResponse.items.length} items`);

    // Create a working copy of the backup to apply touchAction changes
    const workingCopy = {
      allUnindexedItems: JSON.parse(JSON.stringify(backup.allUnindexedItems)),
      allIndexedItemsByNumber: JSON.parse(JSON.stringify(backup.allIndexedItemsByNumber)),
      allTouchZonesByCmd: JSON.parse(JSON.stringify(backup.allTouchZonesByCmd))
    };
    console.log(`[TOUCH_ACTION_DEBUG] Created working copy - unindexed: ${workingCopy.allUnindexedItems.length}, indexed keys: [${Object.keys(workingCopy.allIndexedItemsByNumber).join(', ')}], touchZones: [${Object.keys(workingCopy.allTouchZonesByCmd).join(', ')}]`);


    // Apply touchAction changes to the working copy using the processed items from pseudoUpdateResponse
    pseudoUpdateResponse.items.forEach(processedItem => {
      console.log(`[TOUCH_ACTION] Applying processed item to working copy:`, JSON.stringify(processedItem, null, 2));
      
      // Handle hide/unhide items specially - they modify target item visibility instead of replacing the item
      if (processedItem.idx !== undefined) {
        if (processedItem.type === 'hide' || processedItem.type === 'unhide') {
          const targetItem = workingCopy.allIndexedItemsByNumber[processedItem.idx];
          if (targetItem) {
            const newVisible = (processedItem.type === 'unhide');
            console.log(`[TOUCH_ACTION] ${processedItem.type === 'unhide' ? 'Unhiding' : 'Hiding'} item ${processedItem.idx}: setting visible from ${targetItem.visible} to ${newVisible}`);
            targetItem.visible = newVisible;
          } else {
            console.warn(`[TOUCH_ACTION] ${processedItem.type} operation: No item found with idx=${processedItem.idx} to ${processedItem.type === 'unhide' ? 'unhide' : 'hide'}`);
          }
        } else {
          // Normal item replacement for non-hide/unhide items
          workingCopy.allIndexedItemsByNumber[processedItem.idx] = processedItem;
          console.log(`[TOUCH_ACTION] Updated working copy indexed item ${processedItem.idx} with processed touchAction item`);
          console.log(`[TOUCH_ACTION_DEBUG] Working copy item ${processedItem.idx} after update:`, JSON.stringify(workingCopy.allIndexedItemsByNumber[processedItem.idx], null, 2));
        }
      }
    });

    // Apply working copy to merged drawingManagerState for redraw (no per-drawing assignments)
    this.mergeAndRedraw.drawingManagerState.allTouchZonesByCmd = workingCopy.allTouchZonesByCmd;
    this.mergeAndRedraw.drawingManagerState.allUnindexedItems = workingCopy.allUnindexedItems;
    this.mergeAndRedraw.drawingManagerState.allIndexedItemsByNumber = workingCopy.allIndexedItemsByNumber;

    // Trigger a redraw to show the touchAction effects - no merge needed since we updated the state directly
    console.log(`[TOUCH_ACTION] Triggering redraw to display touchAction effects using working copy`);
    this.mergeAndRedraw.redrawCanvas(workingCopy.allUnindexedItems,workingCopy.allIndexedItemsByNumber,workingCopy.allTouchZonesByCmd,true); // force redraw
  },

  // Execute touchActionInput - opens text dialog and handles response
  executeTouchActionInput: function(drawingName, cmd, touchActionInput, col, row, touchType) {
    console.log(`[TOUCH_ACTION_INPUT] Executing touchActionInput: cmd=${cmd}, prompt="${touchActionInput.prompt}", textIdx=${touchActionInput.textIdx}`);

    // Get initial text from textIdx if specified
    let initialText = '';
    if (touchActionInput.textIdx !== undefined && touchActionInput.textIdx !== null) {
      const indexedItems = this.drawingManager.getIndexedItems(drawingName);
      const item = indexedItems[touchActionInput.textIdx];
      if (item && (item.type === 'label' || item.type === 'value')) {
        if (item.type === 'label') {
          // Generate label text using same utility as drawLabel and displayTextUtils
          initialText = addFormattedValueToText(item.text || '', item);
        } else if (item.type === 'value') {
          // For value items, get the displayed text (prefix + scaled value + units)
          const prefix = item.text || '';
          const intValue = parseFloat(item.intValue || 0);
          const min = parseFloat(item.min || 0);
          const max = parseFloat(item.max || 1);
          const displayMin = parseFloat(item.displayMin || 0.0);
          const displayMax = parseFloat(item.displayMax || 1.0);
          const decimals = parseInt(item.decimals || 2);
          const units = item.units || '';

          // Calculate scaled value using same logic as drawValue
          let maxMin = max - min;
          if (maxMin === 0) maxMin = 1;
          const scaledValue = (intValue - min) * (displayMax - displayMin) / maxMin + displayMin;

          initialText = prefix + printFloatDecimals(scaledValue, decimals) + units;
        }
        console.log(`[TOUCH_ACTION_INPUT] Retrieved initial text from textIdx ${touchActionInput.textIdx} (${item.type}): "${initialText}"`);
      } else {
        console.log(`[TOUCH_ACTION_INPUT] textIdx ${touchActionInput.textIdx} not found or not label/value, using blank text`);
      }
    }

    // Create and show text input dialog with formatting options
    const formatOptions = {
      fontSize: touchActionInput.fontSize,
      color: touchActionInput.color,
      backgroundColor: touchActionInput.backgroundColor
    };
    console.log(`[TOUCH_ACTION_INPUT] Format options:`, formatOptions);
    window.pfodWebMouse.showTextInputDialog.call(this, touchActionInput.prompt, initialText, formatOptions, (result, text) => {
      console.log(`[TOUCH_ACTION_INPUT] Dialog result: ${result}, text: "${text}"`);

      if (result === 'ok') {
        // Build endpoint with the edited text included in the command
        // For touchActionInput, include col, row, touchType, and editedText inside the command
        // Use dynamic identifier from calling context (this.currentIdentifier)
        const identifier = this.currentIdentifier || 'pfodWeb';
        const touchZoneCmd = `{${identifier}~${cmd}\`${col}\`${row}\`${touchType}~${text}}`;
        let endpoint = `/pfodWeb?cmd=${encodeURIComponent(touchZoneCmd)}`;

        console.log(`[TOUCH_ACTION_INPUT] endpoint before version: ${endpoint}`);

        // Add version query parameter if available
        const savedVersion = localStorage.getItem(`${drawingName}_version`);
        console.log(`[TOUCH_ACTION_INPUT] drawingName: ${drawingName}, savedVersion: ${savedVersion}`);
        if (savedVersion !== null) {
          endpoint += `&version=${encodeURIComponent(savedVersion)}`;
          console.log(`[TOUCH_ACTION_INPUT] endpoint after adding version: ${endpoint}`);
        } else {
          console.log(`[TOUCH_ACTION_INPUT] No version added - savedVersion: ${savedVersion} (null)`);
        }

        console.log(`[TOUCH_ACTION_INPUT] Sending request with edited text: ${endpoint}`);

        // Queue the request with proper headers
        const options = {
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          mode: 'same-origin',
          credentials: 'same-origin',
          cache: 'no-cache'
        };
        this.addToRequestQueue(drawingName, endpoint, options, {
          cmd: cmd,
          filter: touchType
        }, 'touch');

        // After the text input is confirmed, run any other touchActions for this cmd
        // clears before starting to show actions
        window.pfodWebMouse.executeTouchAction.call(this, drawingName, cmd, col, row, touchType);
      } else {
        console.log(`[TOUCH_ACTION_INPUT] User cancelled text input, no request sent`);
      }
    });
  },

  // Show text input dialog within canvas bounds
  showTextInputDialog: function(prompt, initialText, formatOptions, callback) {
    // Handle the case where formatOptions is actually the callback (backward compatibility)
    if (typeof formatOptions === 'function') {
      callback = formatOptions;
      formatOptions = {};
    }
    console.log(`[DIALOG] showTextInputDialog called with prompt="${prompt}", formatOptions:`, formatOptions);
    // Remove any existing dialog
    window.pfodWebMouse.hideTextInputDialog.call(this);

    // Get canvas bounds for positioning
    const canvasRect = this.canvas.getBoundingClientRect();
    const drawingData = this.drawingManager.getDrawingData(this.drawingManager.getMainDrawingName());

    // Calculate dialog position within canvas bounds - reduced width by half
    const dialogWidth = Math.min(250, canvasRect.width * 0.4);
    const dialogHeight = 'auto'; // Let content determine height
    const dialogX = canvasRect.left + (canvasRect.width - Math.min(250, canvasRect.width * 0.4)) / 2;
    const dialogY = canvasRect.top + (canvasRect.height * 0.3); // Position higher for better visibility

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.style.position = 'fixed';
    dialog.style.left = dialogX + 'px';
    dialog.style.top = dialogY + 'px';
    dialog.style.width = dialogWidth + 'px';
    dialog.style.minWidth = '150px';
    dialog.style.maxWidth = '250px';
    dialog.style.height = 'auto';
    dialog.style.minHeight = '150px';
    dialog.style.backgroundColor = '#f0f0f0';
    dialog.style.border = '2px solid #666';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '15px';
    dialog.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    dialog.style.zIndex = '1000';
    dialog.style.fontFamily = 'Arial, sans-serif';
    dialog.style.fontSize = '14px';

    // Create title with formatting - match the non-modal preview styling
    const title = document.createElement('div');
    title.textContent = prompt;
    title.style.padding = '10px';
    title.style.marginBottom = '10px';
    title.style.borderRadius = '4px';
    title.style.wordWrap = 'break-word';

    // Apply formatting options if provided
    console.log(`[DIALOG] Applying formatting options:`, formatOptions);
    if (formatOptions.fontSize !== undefined) {
      const actualFontSize = getActualFontSizeForDialog(formatOptions.fontSize);
      console.log(`[DIALOG] Setting fontSize to ${actualFontSize}px (from relative ${formatOptions.fontSize})`);
      title.style.fontSize = actualFontSize + 'px';
    }
    if (formatOptions.color !== undefined) {
      try {
        const colorHex = convertColorToHex(formatOptions.color);
        console.log(`[DIALOG] Setting color to ${colorHex} (from ${formatOptions.color})`);
        title.style.color = colorHex;
      } catch (error) {
        console.error(`[DIALOG] Error getting color hex for ${formatOptions.color}:`, error);
        title.style.color = '#000';
      }
    } else {
      title.style.color = '#000';
    }
    if (formatOptions.backgroundColor !== undefined) {
      try {
        const bgColorHex = convertColorToHex(formatOptions.backgroundColor);
        console.log(`[DIALOG] Setting backgroundColor to ${bgColorHex} (from ${formatOptions.backgroundColor})`);
        title.style.backgroundColor = bgColorHex;
      } catch (error) {
        console.error(`[DIALOG] Error getting backgroundColor hex for ${formatOptions.backgroundColor}:`, error);
      }
    } else {
      // Default background color if none specified
      title.style.backgroundColor = '#ffffff';
    }

    dialog.appendChild(title);

    // Create text input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialText;
    input.maxLength = 255;
    input.style.width = '100%';
    input.style.padding = '6px';
    input.style.fontSize = '14px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';
    input.style.marginBottom = '10px';
    input.style.boxSizing = 'border-box';
    dialog.appendChild(input);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'space-between';

    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.border = '1px solid #666';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.backgroundColor = 'white';
    cancelButton.style.color = '#000';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontSize = '10px';

    // Create OK button with tick and blue background
    const okButton = document.createElement('button');
    okButton.textContent = '✓ OK';
    okButton.style.padding = '8px 16px';
    okButton.style.border = '1px solid #0066cc';
    okButton.style.borderRadius = '4px';
    okButton.style.backgroundColor = '#0066cc';
    okButton.style.color = 'white';
    okButton.style.cursor = 'pointer';
    okButton.style.fontSize = '10px';

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(okButton);
    dialog.appendChild(buttonContainer);

    // Event handlers
    const handleOk = () => {
      const text = input.value;
      window.pfodWebMouse.hideTextInputDialog.call(this);
      callback('ok', text);
    };

    const handleCancel = () => {
      window.pfodWebMouse.hideTextInputDialog.call(this);
      callback('cancel', '');
    };

    okButton.addEventListener('click', handleOk);
    cancelButton.addEventListener('click', handleCancel);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleOk();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    });

    // Add to page and focus
    document.body.appendChild(dialog);
    input.focus();
    input.select();

    // Store reference
    this.textInputDialog = dialog;
  },

  // Hide text input dialog
  hideTextInputDialog: function() {
    if (this.textInputDialog) {
      document.body.removeChild(this.textInputDialog);
      this.textInputDialog = null;
    }
  },

  // Restore original drawing state after touchAction (called when HTTP response received)
  restoreFromTouchAction: function(drawingViewer, drawingName) {

    console.log(`[TOUCH_ACTION] Restoring complete original state for ${drawingName} after HTTP response`);
    console.log(`[TOUCH_ACTION] DEBUG - Restoring on object:`, this);
    console.log(`[TOUCH_ACTION] DEBUG - Object constructor:`, this.constructor?.name);
    console.log(`[TOUCH_ACTION] DEBUG - touchActionBackups exists:`, !!window.pfodWebMouse.touchActionBackups);

    const backup = window.pfodWebMouse.touchActionBackups;
    
    if (!backup) {
      console.warn(`[TOUCH_ACTION] No backup found for restoration, skipping restore operation`);
      return;
    }

    // Restore ONLY merged/display data - per-drawing data should only be changed by server updates
    
    // Restore merged touchZones
    if (backup.allTouchZonesByCmd) {
      drawingViewer.mergeAndRedraw.drawingManagerState.allTouchZonesByCmd = backup.allTouchZonesByCmd;
    }
    
    // Restore merged items
    if (backup.allUnindexedItems) {
      drawingViewer.mergeAndRedraw.drawingManagerState.allUnindexedItems = backup.allUnindexedItems;
    }
    if (backup.allIndexedItemsByNumber) {
      drawingViewer.mergeAndRedraw.drawingManagerState.allIndexedItemsByNumber = backup.allIndexedItemsByNumber;
    }
    
    // Restore merged touchActions and touchActionInputs
    if (backup.touchActions) {
      drawingViewer.mergeAndRedraw.drawingManagerState.allTouchActionsByCmd = backup.touchActions;
    }
    if (backup.touchActionInputs) {
      drawingViewer.mergeAndRedraw.drawingManagerState.allTouchActionInputsByCmd = backup.touchActionInputs;
    }

    // Restore global display transform (affects entire merged canvas positioning/scaling)
    if (backup.transform) {
      drawingViewer.mergeAndRedraw.setGlobalTransform(backup.transform);
    }

    // Note: We don't restore clip area because clip boundaries should be preserved 
    // as part of the drawing's permanent state during normal processing.
    // Only the transform state changes for the next update.

    console.log(`[TOUCH_ACTION] Restored merged display state: ${Object.keys(backup.allTouchZonesByCmd || {}).length} merged touchZones, ${(backup.allUnindexedItems || []).length} merged unindexed items, ${Object.keys(backup.allIndexedItemsByNumber || {}).length} merged indexed items, ${Object.keys(backup.touchActions || {}).length} touchActions, ${Object.keys(backup.touchActionInputs || {}).length} touchActionInputs, transform (${backup.transform?.x}, ${backup.transform?.y}, ${backup.transform?.scale})`);

  },

};