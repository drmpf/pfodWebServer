/*   
   drawingDataProcessor.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// Drawing Data Processor Module
// Extracted from pfodWeb.js to improve code organization

// TouchZone filter constants
const TouchZoneFilters = {
    TOUCH: 0,           // Touches blocked if pfodApp busy waiting for response
    DOWN: 1,            // Queued if pfodApp busy waiting for response
    DRAG: 2,            // Queued if pfodApp busy waiting for response
    UP: 4,              // Queued if pfodApp busy waiting for response
    CLICK: 8,           // Queued if pfodApp busy waiting for response
    PRESS: 16,          // Long press - queued if pfodApp busy waiting for response
    ENTRY: 32,          // NEVER sent to pfodApp
    EXIT: 64,           // NEVER sent to pfodApp
    DOWN_DRAG_UP: 256,       // Msg not sent until finger removed (UP) but updates touchAction alias for DOWN_UP
    TOUCH_DISABLED: 512 // Capture touch to prevent scroll but do not send msg
};

// Decode method to convert filter numbers to array of filter names
TouchZoneFilters.decode = function(filterNumber) {
    // Handle TOUCH (value 0) first
    if (filterNumber === 0) {
        return ['TOUCH'];
    }
    
    // TOUCH_DISABLED has special handling - only return itself, no other values
    if (filterNumber === 512) {
        return ['TOUCH_DISABLED'];
    }
    
    const result = [];
    
    // Check each filter value (excluding TOUCH and TOUCH_DISABLED which are handled above)
    for (const [name, value] of Object.entries(TouchZoneFilters)) {
        if (name !== 'decode' && value !== 0 && value !== 512 && (filterNumber & value) === value) {
            result.push(name);
        }
    }
    
    return result;
};

// make all cmd: array
class DrawingDataProcessor {
    constructor(pfodWebInstance) {
        this.pfodWeb = pfodWebInstance;
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
      if ((cmd0 == '{') && (cmd1 == '}')){
        console.log(`[DRAWING_DATA] Received empty cmd response `);
        return true; // Successfully handled - no drawing data to process
      }
      return false;
    }
      
    // Main processing function for drawing data
    processDrawingData(data, savedData, requestType = 'unknown') {
        // Handle empty cmd responses (e.g., from touchZone requests)
        let cmd = data.cmd;
        if (cmd) {
          if (cmd.length < 2) {
            console.log(`[DRAWING_DATA] Received response with less than 2 elements of cmds (requestType: ${requestType})`);
            return; // Successfully handled - no drawing data to process
          }
          if (this.isEmptyCmd(cmd)) {
            console.log(`[DRAWING_DATA] Received empty cmd response - no action needed (requestType: ${requestType})`);
            // need to restore from touchaction
            return; // Successfully handled - no drawing data to process
          }            
          let msgType = cmd[0]; // take top on
          let result = null;
          if (msgType.startsWith("{+")) {
              result = window.translateDwgResponse(cmd);
              result.raw_items = cmd; // the rest of the commands are the raw_items for processing below
              result.name = data.name;
          } else if (msgType.startsWith("{,") || msgType.startsWith("{;")) {
              result = window.translateMenuResponse(cmd);
              this.currentIdentifier = result.identifier;
              let drawingName;
              if (result.drawingName.trim() !== '') {
               drawingName = result.drawingName; // update it
             } else {
               drawingName = this.pfodWeb.drawingManager.currentDrawingName; // assume we are updating main dwg from menu
             }
             console.log(`[processDrawingData] Updated dwgName and currentDrawingName "${drawingName}"`);

             this.pfodWeb.drawingManager.currentDrawingName = drawingName;
            // Update page title with drawing name
            // this.updatePageTitle(drawingName);
            // Add the drawing as the first drawing in the array if not already present
            if (!this.pfodWeb.drawingManager.drawings.includes(drawingName)) {
               this.pfodWeb.drawingManager.drawings.unshift(drawingName);
            }
            // request dwgName and return
         //   console.log(`[DRAWING_DATA] After tranlation::`, JSON.stringify(result, null, 2));
         //   this.pfodWebDebug.loadDrawing();
         //   return;
          }
          console.log(`[DRAWING_DATA] After tranlation::`, JSON.stringify(result, null, 2));
          
          data = result; // for next set of processing
        }
        // then continue to handle json version
         
        // need to handle {"cmd":["{+...", ... ]
        
        console.log(`Processing drawing data: ${data.pfodDrawing} command for ${data.name} (requestType: ${requestType})`);
        
        const drawingName = data.name;
        
        // Check if this is a touch-triggered request that should replace a drawing
        // Only touch-triggered requests can cause complete drawing replacement when data.pfodDrawing === 'start'
        if (requestType === 'touch' && data.pfodDrawing === 'start') {
            console.log(`[TOUCH_REPLACEMENT] Touch request returned start response for "${drawingName}"`);
            
            // Check if drawingName matches any current drawing (main or inserted)
            const drawingIndex = this.pfodWeb.drawingManager.drawings.indexOf(drawingName);
            
            if (drawingIndex >= 0) {
                // Drawing found in current drawings - completely replace that specific drawing
                console.log(`[TOUCH_REPLACEMENT] Found "${drawingName}" at index ${drawingIndex} - completely replacing it`);
                // The drawing data will be updated in the normal processing flow below
            } else {
                // Drawing not found - completely replace main drawing and clear all inserted drawings
                console.log(`[TOUCH_REPLACEMENT] "${drawingName}" not found in current drawings - completely starting fresh`);
                
                // Clear tracking for all current drawings
                this.pfodWeb.drawingManager.drawings.forEach(dwgName => {
                    this.pfodWeb.requestTracker.touchRequests.delete(dwgName);
                    this.pfodWeb.requestTracker.insertDwgRequests.delete(dwgName);
                    
                    // Clear localStorage for each drawing
                    localStorage.removeItem(`${dwgName}_version`);
                    localStorage.removeItem(`${dwgName}_data`);
                    console.log(`[TOUCH_REPLACEMENT] Cleared localStorage for "${dwgName}"`);
                });
                
                // Create a completely new DrawingManager instance to ensure clean state
                console.log(`[TOUCH_REPLACEMENT] Creating new DrawingManager instance`);
                this.pfodWeb.drawingManager = new window.DrawingManager();
                this.pfodWeb.drawingManager.initialize(drawingName);
                
                // Update page title with new main drawing name
                document.title = `pfodWeb ${drawingName}`;
                
                // Update MergeAndRedraw with the new clean DrawingManager
                this.pfodWeb.mergeAndRedraw.updateState(this.pfodWeb.drawingManager.getMergeAndRedrawState());
                
                console.log(`[TOUCH_REPLACEMENT] Started completely fresh with main drawing "${drawingName}"`);
            }
        }
        // Handle error responses first
        if (data.pfodDrawing === 'error') {
            console.log(`[ERROR] Drawing error received for "${drawingName}": ${data.error} - ${data.message}`);
            
            // If drawing not found, clear any saved version to prevent future requests with invalid version
            if (data.error === 'drawing_not_found') {
                console.log(`[ERROR] Clearing saved version for non-existent drawing "${drawingName}"`);
                localStorage.removeItem(`${drawingName}_version`);
                localStorage.removeItem(`${drawingName}_data`);
            }
            
            // Delegate to error handler
            this.pfodWeb.handleDrawingError(data);
            return;
        }
        
        // If this is a start command, initialize with new data
        if (data.pfodDrawing === 'start') {
        
            // Ensure x and y are within valid range (1-255)
            const x = Math.min(Math.max(data.x || 50, 1), 255);
            const y = Math.min(Math.max(data.y || 50, 1), 255);
        
            // Handle color validation - accept both numbers and string numbers
            let colorValue = data.color;
            if (typeof colorValue === 'string' && !isNaN(colorValue)) {
                console.log(`[COLOR_CONVERSION] Converting string color "${colorValue}" to number ${parseInt(colorValue)}`);
                colorValue = isNaN(parseInt(colorValue))? 0 : parseInt(colorValue);
            }
            const validColor = (typeof colorValue === 'number' && ((colorValue >= 0 && colorValue <= 255) || colorValue === -1)) ? colorValue : 0;
            console.log(`[COLOR_VALIDATION] Original color: ${data.color} (${typeof data.color}) -> Final color: ${validColor}`);

            const drawingData = {
                name: data.name,
                version: data.version,
                x: x,
                y: y,
                color: validColor, // Default to white (15) if invalid
                // Ensure refresh value is properly handled - 0 is a valid value
                refresh: data.refresh !== undefined ? data.refresh : 0
            };
            
            // Set the drawing data in the manager
            this.pfodWeb.drawingManager.setDrawingData(drawingName, drawingData);
            
            console.log(`[REFRESH] Initialized drawing: ${data.name}, size=${x}x${y}, refresh=${drawingData.refresh}ms, version=${data.version}`);
            
            // For 'start' commands, we need to check for previously inserted drawings to remove
            if (drawingName === (this.pfodWeb.drawingManager.drawings.length > 0 ? this.pfodWeb.drawingManager.drawings[0] : '') && this.pfodWeb.drawingManager.drawings.length > 1) {
                console.log(`Start command received for ${data.name}, checking for drawings to remove`);
                // Create a copy of the array since we'll be modifying it during removal
                // Skip first drawing (main drawing) and only include inserted drawings
                const previouslyInserted = [...this.pfodWeb.drawingManager.drawings.slice(1)];
                previouslyInserted.forEach(insertedDrawingName => {
                        // If the drawing was directly inserted by this drawing (parent relationship),
                        // remove it and all its children
                        if (this.pfodWeb.drawingManager.drawingsData[insertedDrawingName] && 
                            this.pfodWeb.drawingManager.drawingsData[insertedDrawingName].parentDrawing === drawingName) {
                        console.log(`Removing previously inserted drawing ${insertedDrawingName} as part of start command`);
                        this.pfodWeb.removeInsertedDrawing(insertedDrawingName);
                            }
                });
            }
            
            
            // Initialize or reset arrays for this drawing
            this.pfodWeb.drawingManager.clearItems(drawingName);
            
        // Save the version and data - handle empty/blank/undefined versions
            // If version is undefined, empty or all blanks, set to empty string
            console.log(`[VERSION_DEBUG] Processing start data for ${data.name}:`, data);
            console.log(`[VERSION_DEBUG] data.version = "${data.version}", type = ${typeof data.version}`);
            const normalizedVersion = (data.version && data.version.trim()) ? data.version : '';
            console.log(`Saving initial version "${normalizedVersion}" for drawing ${data.name}`);
            this.pfodWeb.drawingManager.saveToLocalStorage(drawingName);
            
            // Save merged data for the main drawing using new storage system
            const mainDrawingName = this.pfodWeb.drawingManager.getMainDrawingName();
            if (mainDrawingName) {
                this.pfodWeb.drawingManager.saveMergedDataToStorage(mainDrawingName);
            }
        }
       // If this is an update, apply changes to existing data
        else if (data.pfodDrawing === 'update') {
            let drawingData = this.pfodWeb.drawingManager.getDrawingData(drawingName);
            
            if (!drawingData) {
                // If we have saved data, try to use it
                if (savedData) {
                    console.log('No active drawing data, using saved data from localStorage');
                    drawingData = JSON.parse(savedData);
                
                    // Ensure saved data also respects the 1-255 limit
                    drawingData.x = Math.min(Math.max(drawingData.x, 1), 255);
                    drawingData.y = Math.min(Math.max(drawingData.y, 1), 255);
                    console.log(`Restored drawing from localStorage: ${drawingData.name}, size=${drawingData.x}x${drawingData.y}`);
                
                    // Set the loaded data in the manager
                    this.pfodWeb.drawingManager.setDrawingData(drawingName, drawingData);
                } else {                
                    console.error('Received update without initial data');
                    throw new Error('Received update without initial data');
                }
            }  
            // Store original dimensions and color before processing update
            const originalX = drawingData.x;
            const originalY = drawingData.y;
            const originalColor = drawingData.color;
            const originalVer = drawingData.version;
            
            // Create updated drawing data
            const updatedData = { ...drawingData };
            
            // Update refresh interval if provided
            if (data.refresh !== undefined) {
                console.log(`[REFRESH] Updating refresh rate for ${drawingName}: ${updatedData.refresh}ms -> ${data.refresh}ms`);
                updatedData.refresh = data.refresh;
            }
            
            // Preserve dimensions and color
            console.log(`Preserving dimensions (${originalX}x${originalY}) and color (${originalColor}) from previous data`);
            updatedData.x = originalX;
            updatedData.y = originalY;
            updatedData.color = originalColor;
            
            // Handle version updates - preserve existing version if not provided
            console.log(`[VERSION_DEBUG] Processing update data for ${data.name}:`, data);
            console.log(`[VERSION_DEBUG] data.version = "${data.version}", type = ${typeof data.version}`);
            if (data.version !== undefined && data.version !== null) {
                const normalizedVersion = data.version.trim() ? data.version : '';
                console.log(`Updating version from "${originalVer}" to "${normalizedVersion}"`);
                updatedData.version = normalizedVersion;
            } else {
                console.log(`Version not provided in update - keeping existing version "${originalVer}"`);
                updatedData.version = originalVer;
            }
            
            // Update the drawing data in the manager
            this.pfodWeb.drawingManager.setDrawingData(drawingName, updatedData);
           // Always save the updated drawing data
            this.pfodWeb.drawingManager.saveToLocalStorage(drawingName);
            
            // Save merged data for the main drawing using new storage system
            const mainDrawingName = this.pfodWeb.drawingManager.getMainDrawingName();
            if (mainDrawingName) {
                this.pfodWeb.drawingManager.saveMergedDataToStorage(mainDrawingName);
            }
        } 
        else { 
           this.pfodWeb.handleDrawingError({
                  error: 'response_invalid',
                  message: `Response to load drawing "${drawingName}" returned neither start or update, returned ${data.pfodDrawing}`,
                  pfodDrawing: 'error'
            });
           return;
       }
       // end if start else update
        
        // Reset the transformation state based on command type
        // Initialize local transform stack
        let transformStack = [];
        let currentTransform; //
        
        // Set the initial transform
        if (data.pfodDrawing === 'start') {
            // For 'start' commands, reset to initial state
            currentTransform = { x: 0, y: 0, scale: 1.0 };
            console.log(`[TRANSFORM] Using initial transform (0,0,1.0) for drawing start: ${drawingName}`);
        } else if (data.pfodDrawing === 'update' && this.pfodWeb.drawingManager.savedTransforms[drawingName]) {
            // For 'update' commands, use the saved transform if available
            currentTransform = {...this.pfodWeb.drawingManager.savedTransforms[drawingName]};
            console.log(`[TRANSFORM] Using saved transform for update: x=${currentTransform.x}, y=${currentTransform.y}, scale=${currentTransform.scale}`);
        } else {
            // Default fallback
            currentTransform = { x: 0, y: 0, scale: 1.0 };
            console.log(`[TRANSFORM] No saved transform found, using default (0,0,1.0)`);
        }
                
        // Process drawing items if they exist (either items or raw_items)
        let itemsToProcess = [];
        
        if (data.raw_items && Array.isArray(data.raw_items)) {
            console.log(`Processing ${data.raw_items.length} raw drawing items - translating to items format`);
            // Translate raw_items to items format using translator
            try {
                const translatedData = window.translateRawItemsToItemArray(data);
                itemsToProcess = translatedData.items;
                console.log(`Successfully translated ${data.raw_items.length} raw items to ${itemsToProcess.length} processed items`);
            } catch (error) {
                console.error('Failed to translate raw_items:', error.message);
                throw new Error(`Failed to translate raw_items: ${error.message}`);
            }
        } else if (data.items && Array.isArray(data.items)) {
            console.log(`Processing ${data.items.length} drawing items`);
            itemsToProcess = data.items;
        }
        
        if (itemsToProcess.length > 0) {
            
            // For update commands, if items array is empty, don't process anything (no changes)
            // but still need to redraw to show the restored state
            if (data.pfodDrawing === 'update' && itemsToProcess.length === 0) {
                console.log(`Update command has empty items array - no changes to apply, but triggering redraw`);
                // Still need to trigger redraw and continue with normal flow
            }
            
            itemsToProcess.forEach(item => {
            // Validate and normalize item color to integer (0-255)
            if (item.color !== undefined) {
                let colorValue = item.color;
                
// Handle string numbers (like "9", "82" from ESP32)
                if (typeof colorValue === 'string' && !isNaN(colorValue)) {
                  console.log(`[COLOR_CONVERSION] Converting string color "${colorValue}" to number ${parseInt(colorValue)}`);
                  colorValue = isNaN(parseInt(colorValue))? 0 : parseInt(colorValue);
                }                                   
               
                if (typeof colorValue === 'number' && ((colorValue >= 0 && colorValue <= 255) || colorValue === -1)) {
                    item.color = Math.floor(colorValue); // Ensure integer (-1 for Black/White mode, 0-255 for regular colors)
                } else {
                    item.color = 0; // Default to black for invalid colors
                }
            }
            
            // Add a processing flag to each item (assume valid by default)
            let skipProcessing = false;
                
            // Validate item
            if (!item.type) {
                console.error('Item missing type property:', item);
                skipProcessing = true;
            }
                
            // Debug log for each item
            console.log(`Processing item: type=${item.type}, properties:`, JSON.stringify(item));
            // Check if hide, unhide, or erase has valid idx or cmd
            if ((item.type === 'hide' || item.type === 'unhide' || item.type === 'erase')) {
                // For erase, allow either idx or cmd
                    if (!item.idx && !item.cmd) {
                        console.error(`Error: ${item.type} item has neither idx nor cmd, ignoring item:`, JSON.stringify(item));
                        skipProcessing = true;
                    } else if (item.idx && (item.idx < 1)) {
                        console.error(`Error: ${item.type} item has idx < 1, ignoring item:`, JSON.stringify(item));
                        skipProcessing = true;
                    }
            }
            
            // Handle push and pop first to maintain transformation state (all local)
                
            // Store a copy of the current transform with the item
            item.transform = {...currentTransform};
            // Set visible property to true by default
            if (item.visible === undefined) {
                item.visible = true;
            }

                
                if (item.type === 'pushZero') {
                // Save current transform to stack
                transformStack.push({...currentTransform});
                    
                 // Default missing properties
                 const x = item.x !== undefined ? parseFloat(item.x) : 0;
                 const y = item.y !== undefined ? parseFloat(item.y) : 0;
                 const scale = item.scale !== undefined ? parseFloat(item.scale) : 1.0;
                    
                 // Apply the push transform to current transform
                 currentTransform.x += x * currentTransform.scale;
                 currentTransform.y += y * currentTransform.scale;
                 currentTransform.scale *= scale;
                    
                 console.log(`[TRANSFORM] Push for ${drawingName}: New transform (${currentTransform.x}, ${currentTransform.y}, ${currentTransform.scale})`);
                    
                 // Skip adding push items to any collection
                 skipProcessing = true;
                 } else if (item.type === 'popZero') {
                 // Get previous transform from stack
                 if (transformStack.length > 0) {
                     const oldTransform = {...currentTransform};
                     currentTransform = transformStack.pop();
                     console.log(`[TRANSFORM] Pop for ${drawingName}: Restored from (${oldTransform.x}, ${oldTransform.y}, ${oldTransform.scale}) to (${currentTransform.x}, ${currentTransform.y}, ${currentTransform.scale})`);
                 } else {
                     // If stack is empty, reset to initial state
                     const oldTransform = {...currentTransform};
                     currentTransform = { x: 0, y: 0, scale: 1.0 };
                     console.warn(`[TRANSFORM] Pop for ${drawingName}: Stack empty, reset to default (0,0,1.0)`);
                 }
                    
                 // Skip adding pop items to any collection
                 skipProcessing = true;
             } // end push pop
                
             // Apply default values based on item type
             if (item.type === 'rectangle') {
                 // Default missing properties
                 item.xOffset = item.xOffset !== undefined ? item.xOffset : 0;
                 item.yOffset = item.yOffset !== undefined ? item.yOffset : 0;
                 item.xSize = item.xSize !== undefined ? item.xSize : 1;
                 item.ySize = item.ySize !== undefined ? item.ySize : 1;
                 item.filled = item.filled || 'false';
                 item.rounded = item.rounded || 'false';
                 console.log('Processed rectangle with defaults:', JSON.stringify(item));
                
            } else if (item.type === 'line') {
                // Default missing properties
                item.xOffset = item.xOffset !== undefined ? item.xOffset : 0;
                item.yOffset = item.yOffset !== undefined ? item.yOffset : 0;
                item.xSize = item.xSize !== undefined ? item.xSize : 1;
                item.ySize = item.ySize !== undefined ? item.ySize : 1;
                console.log('Processed line with defaults:', JSON.stringify(item));
                
            } else if (item.type === 'insertDwg' ) { //|| item.type.toLowerCase() === 'insertdwg') {
                // Always ensure insertDwg items have null index - they should NEVER be indexed
                if (item.idx && item.idx !== 'null') {
                    console.warn(`Warning: insertDwg item for "${item.drawingName}" has idx=${item.idx}, nulling it as insertDwg should never be indexed`);
                    item.idx = 'null';
                }                
                // Normalize the type to insertDwg for consistency
                item.type = 'insertDwg';
                
            } else if (item.type === 'touchZone') {
                // Default missing properties
                item.xOffset = item.xOffset ||  0;
                item.yOffset = item.yOffset ||  0;
                item.xSize = item.xSize || 1;
                item.ySize = item.ySize || 1;
                item.cmd = item.cmd || '';
                item.filter = parseInt(item.filter || TouchZoneFilters.TOUCH);
                item.centered = item.centered || 'false';
                // idx is handled in the touchZone processing logic below, not here
                if (item.cmd.trim().length == 0) {
                    console.warn('Error: touchZone has empty cmd, in drawing {$data.name} ignoring:', JSON.stringify(item));
                    skipProcessing = true; // Flag to skip adding this item to collections
                } else {
                   console.log('Processed touchZone with defaults:', JSON.stringify(item));
                }
                
            } else if (item.type === 'touchAction') {
                // Default missing properties
                item.cmd = item.cmd || '';
                item.action = item.action || [];
                
                if (item.cmd.trim().length == 0) {
                    console.warn(`Error: touchAction has empty cmd in drawing "${data.name}", ignoring:`, JSON.stringify(item));
                    skipProcessing = true;
                } else {
                    console.log('Processed touchAction with defaults:', JSON.stringify(item));
                }
                
            } else if (item.type === 'label') {
                // Default missing properties for label
                item.xOffset = item.xOffset || 0;
                item.yOffset = item.yOffset || 0;
                item.text = item.text || '';
                item.fontSize = item.fontSize || 0;
                item.bold = item.bold === 'true' || item.bold === true;
                item.italic = item.italic === 'true' || item.italic === true;
                item.underline = item.underline === 'true' || item.underline === true;
                item.align = item.align || 'left'; // default alignment when not specified
                // Handle new optional properties (value, units, decimals) - no defaults needed as they're optional
                if (item.value !== undefined && item.value !== null && item.value !== '') {
                    item.value = parseFloat(item.value);
                }
                if (item.decimals !== undefined && item.decimals !== null && item.decimals !== '') {
                    item.decimals = parseInt(item.decimals);
                }
                // item.units stays as-is (string) - no conversion needed
                console.log('Processed label with defaults:', JSON.stringify(item));
                
            } else if (item.type === 'value') {
                // Default missing properties for value
                item.xOffset = item.xOffset || 0;
                item.yOffset = item.yOffset || 0;
                item.text = item.text || '';
                item.fontSize = item.fontSize || 0;
                item.bold = item.bold === 'true' || item.bold === true;
                item.italic = item.italic === 'true' || item.italic === true;
                item.underline = item.underline === 'true' || item.underline === true;
                item.align = item.align || 'left'; // default alignment when not specified
                item.intValue = item.intValue || 0;
                item.max = item.max || 1;
                item.min = item.min || 0;
                item.displayMax = item.displayMax || 1.0;
                item.displayMin = item.displayMin || 0.0;
                item.decimals = (item.decimals !== undefined && item.decimals !== null && item.decimals !== '') ? parseInt(item.decimals) : 2;
                item.units = item.units || '';
                console.log('Processed value with defaults:', JSON.stringify(item));
                
            } else if (item.type === 'circle') {
                // Default missing properties for circle
                item.xOffset = item.xOffset || 0;
                item.yOffset = item.yOffset || 0;
                item.radius = item.radius || 1;
                item.filled = item.filled === 'true' || item.filled === true;
                console.log('Processed circle with defaults:', JSON.stringify(item));
                
            } else if (item.type === 'arc') {
                // Default missing properties for arc
                item.xOffset = item.xOffset || 0;
                item.yOffset = item.yOffset || 0;
                item.radius = item.radius || 1;
                item.filled = item.filled === 'true' || item.filled === true;
                item.start = item.start || 0;
                item.angle = item.angle || 90;
                
                // Normalize start and angle to be within -360 to +360 range
                item.start = item.start % 360;
                if (item.start > 360) item.start -= 360;
                if (item.start < -360) item.start += 360;
                
                item.angle = item.angle % 360;
                if (item.angle > 360) item.angle -= 360;
                if (item.angle < -360) item.angle += 360;
                
                console.log('Processed arc with defaults:', JSON.stringify(item));
                
            } else if (item.type === 'index') {
                // Check if idx is less than 1 (invalid)
                if (item.idx < 1) {
                    console.error('Error: Index item has idx < 1, ignoring item:', JSON.stringify(item));
                    skipProcessing = true; // Flag to skip adding this item to collections
                } else {
                    const idx = item.idx;
                    const indexedItems = this.pfodWeb.drawingManager.getIndexedItems(drawingName);
                    if (indexedItems[idx]) {
                      console.log(`Processing index item with idx=${item.idx} - already have item with that idx so skip processing this`);
                      skipProcessing = true; // Flag to skip adding this item to collections
                    } else {
                      // For valid index items, save transform data
                      console.log(`Processing index item with idx=${item.idx} - saving transform/clipping data for later use`);
                    }
                }
                // Handle index items with cmdName (touchZone items)  
                if (item.cmdName && item.cmdName.trim() !== '') {
                    const cmd = item.cmd || '';
                    if (cmd.trim().length > 0) {
                        // Check if there's already a touchZone with this cmd
                        const existingTouchZone = this.pfodWeb.drawingManager.touchZonesByCmd[drawingName] && 
                                                this.pfodWeb.drawingManager.touchZonesByCmd[drawingName][cmd];
                        if (existingTouchZone) {
                            console.log(`Processing index item with cmdName="${item.cmdName}" cmd="${cmd}" - already exists, skipping`);
                            skipProcessing = true;
                        } else {
                            console.log(`Processing index item with cmdName="${item.cmdName}" cmd="${cmd}" - will be added as touchZone placeholder`);
                        }
                    }
                }
            } // end not hide / unhide / erase
            
            // Process control items (hide, unhide, erase, push, pop) BEFORE checking skipProcessing
            // These should always be processed but never added to item collections
            if (item.type === 'hide' || item.type === 'unhide' || item.type === 'erase') {
                
                if (item.type === 'erase') {
                    // For erase items, handle both idx and cmd
                    if (item.idx) {
                        // Erase by index
                        const idx = item.idx;
                        const indexedItems = this.pfodWeb.drawingManager.getIndexedItems(drawingName);
                        
                        if (indexedItems[idx]) {
                            delete this.pfodWeb.drawingManager.indexedItems[drawingName][idx];
                            console.log(`Erased item with index ${idx}`);
                        } else {
                            console.warn(`Erase operation: No item found with idx=${idx} to erase`);
                        }
                    } else if (item.cmd) {
                        if (item.drawingName !== undefined) {
                         this.pfodWeb.drawingManager.eraseByCmd(drawingName, item.cmd, item.drawingName);
                         console.log(`Erased insertDwg and actions with cmd="${item.cmd}"`);
                       } else {
                        // Erase by cmd - removes touchZone and all associated actions
                        this.pfodWeb.drawingManager.eraseByCmd(drawingName, item.cmd);
                        console.log(`Erased touchZone and actions with cmd="${item.cmd}"`);
                       }
                    }
                    // Skip adding erase items to any collection
                    skipProcessing = true;
                } else {
                    // For hide/unhide, handle both idx and cmd
                    if (item.idx) {
                        // Hide/unhide by index - affects indexed items only (ignore touchZones)
                        const idx = item.idx;
                        const indexedItems = this.pfodWeb.drawingManager.getIndexedItems(drawingName);
                        const targetItem = indexedItems[idx];
                        
                        if (targetItem) {
                            // Set the visible property based on hide/unhide type
                            targetItem.visible = item.type === 'unhide';
                            console.log(`${item.type === 'unhide' ? 'Unhiding' : 'Hiding'} item with index ${idx}`);
                        } else {
                            console.warn(`${item.type} operation: No item found with idx=${idx} to ${item.type === 'unhide' ? 'unhide' : 'hide'}`);
                        }
                    } else if (item.cmd) {
                        // Hide/unhide by cmd - affects touchZones and insertDwg items only
                        if (item.type === 'hide') {
                            if (item.drawingName !== undefined) {
                            this.pfodWeb.drawingManager.hideByCmd(drawingName, item.cmd,item.drawingName);
                            console.log(`Hidden touchZone and insertDwg items with cmd="${item.cmd}"`);
                            } else {
                            this.pfodWeb.drawingManager.hideByCmd(drawingName, item.cmd);
                            console.log(`Hidden touchZone and insertDwg items with cmd="${item.cmd}"`);
                            }
                        } else if (item.type === 'unhide') {
                            if (item.drawingName !== undefined) {
                            this.pfodWeb.drawingManager.unhideByCmd(drawingName, item.cmd,item.drawingName);
                            console.log(`Unhidden touchZone and insertDwg items with cmd="${item.cmd}"`);
                            } else {
                            this.pfodWeb.drawingManager.unhideByCmd(drawingName, item.cmd);
                            console.log(`Unhidden touchZone and insertDwg items with cmd="${item.cmd}"`);
                            }
                        }
                    }
                    // Skip adding hide/unhide items to any collection
                    skipProcessing = true;
                }
            }
                
           // Only proceed with normal item processing if not already marked to skip
           if (!skipProcessing) {
              // Get drawing name from item or use current drawing name
              // SPECIAL CASE: For insertDwg items, we ALWAYS use the current drawing name, not the drawingName specified in the item
              // This is because the insertDwg item needs to be stored in the current drawing's unindexed items list
              // to be properly processed by the handleInsertDwg function
              const mainDrawingName = this.pfodWeb.drawingManager.drawings.length > 0 ? this.pfodWeb.drawingManager.drawings[0] : '';
              const itemDrawingName = data.name; // (item.type === 'insertDwg' || item.type.toLowerCase() === 'insertdwg') ? data.name : (item.drawingName || data.name);
              item.parentDrawingName = itemDrawingName;
              this.pfodWeb.drawingManager.ensureItemCollections(itemDrawingName);                       

              // Special handling for insertDwg items
              if (item.type === 'insertDwg') { // || (item.type && item.type.toLowerCase() === 'insertdwg')) {
                    // For insertDwg items, we MUST use the current drawing name
                    // NOT the drawingName specified in the item (which is the target drawing to insert)
                    const currentDrawing = data.name;
                    
                    // Ensure the collections exist for the current drawing
                    this.pfodWeb.drawingManager.ensureItemCollections(currentDrawing);
                    
                    // Normalize type to camelCase for consistency
                    item.type = 'insertDwg';                    
                                        
                    // Add to the current drawing's unindexed items
                    try {
                        this.pfodWeb.drawingManager.unindexedItems[currentDrawing].push(item);
                        console.log(`Added insertDwg item for "${item.drawingName}" with transform (${item.transform.x},${item.transform.y},${item.transform.scale}) to drawing=${currentDrawing}, visible=${item.visible}`);
                    } catch (error) {
                        console.error(`Error adding insertDwg item to unindexed items for ${currentDrawing}:`, error);
                        console.log('Item that caused error:', JSON.stringify(item));
                    }
              // Check if this is a touchZone or index item with cmdName
              } else if (item.type === 'touchZone' || (item.type === 'index' && item.cmdName && item.cmdName.trim() !== '')) {
                    // Only process filter for actual touchZone items, not index items
                    if (item.type === 'touchZone') {
                        // Check if there's an associated touchActionInput for this cmd
                        if (item.cmd && item.cmd.trim().length > 0) {
                            const existingTouchActionInput = this.pfodWeb.drawingManager.getTouchActionInput(itemDrawingName, item.cmd);
                            if (existingTouchActionInput) {
                                // If touchActionInput exists, filter can only be TOUCH or TOUCH_DISABLED
                                if (item.filter !== TouchZoneFilters.TOUCH && item.filter !== TouchZoneFilters.TOUCH_DISABLED) {
                                    console.log(`[TOUCH_ZONE] Constraining updated touchZone filter from ${item.filter} to TOUCH for cmd=${item.cmd} due to existing touchActionInput`);
                                    item.filter = TouchZoneFilters.TOUCH;
                                }
                            }
                        }
                    }
                    
                    // Add the touchZone using the manager
                    this.pfodWeb.drawingManager.addTouchZone(itemDrawingName, item);                    
                    console.log(`Added touchZone: cmd=${item.cmd}, filter=${item.filter}, idx=${item.idx || 0}, drawing=${itemDrawingName}`);
                   // this.drawingManager.unindexedItems[itemDrawingName].push(item);
                   // console.log(`Added unindexed item: type=${item.type}, drawing=${itemDrawingName}, visible=${item.visible !== false}`);
                    
              // Check if this is a touchAction
              } else if (item.type === 'touchAction') {
                    // Add the touchAction using the manager
                    const success = this.pfodWeb.drawingManager.addTouchAction(itemDrawingName, item);
                    if (success) {
                        console.log(`Added touchAction: cmd=${item.cmd}, actions=${(item.action || []).length}, drawing=${itemDrawingName}`);
                    }
                    // touchActions are not added to unindexed/indexed items - they're stored separately
                    
              // Check if this is a touchActionInput
              } else if (item.type === 'touchActionInput') {
                    // Add the touchActionInput using the manager
                    const success = this.pfodWeb.drawingManager.addTouchActionInput(itemDrawingName, item);
                    if (success) {
                        console.log(`Added touchActionInput: cmd=${item.cmd}, prompt="${item.prompt}", textIdx=${item.textIdx}, drawing=${itemDrawingName}`);
                    }
                    // touchActionInputs are not added to unindexed/indexed items - they're stored separately
                    
              // Normal processing for other items
              } else if (item.idx && item.idx !== 'null') {
                  // For non-touchZone items, handle as regular indexed items
                  const idx = item.idx;                        
                  // Get the current indexed items for this drawing
                  const currentIndexedItems = this.pfodWeb.drawingManager.getIndexedItems(itemDrawingName);
                  const isUpdate = currentIndexedItems[idx] !== undefined;                                                
                  // Add the item to the drawing's indexed items using the manager
                  if (isUpdate) {
                   item.transform = currentIndexedItems[idx].transform;// || { x: 0, y: 0, scale: 1 };
                   item.clipRegion = currentIndexedItems[idx].clipRegion;// || { x: 0, y: 0, width: 100, height: 20 };
                   // Preserve visibility state from existing item
                   item.visible = currentIndexedItems[idx].visible;
                  }

                  this.pfodWeb.drawingManager.indexedItems[itemDrawingName][idx] = item;
                        
                  console.log(`${isUpdate ? 'Updated' : 'Added'} indexed item: type=${item.type}, drawing=${itemDrawingName}, idx=${idx}, visible=${item.visible !== false}`);
              } else {
                  // Unindexed items
                  // For non-touchZone items, add to the drawing's unindexed items array
                  // Ensure the collections exist for the drawing before adding the item
                  // This is especially important for insertDwg items which refer to other drawings
                  try {
                      // Add to unindexed items using the manager
                      this.pfodWeb.drawingManager.unindexedItems[itemDrawingName].push(item);
                      console.log(`Added unindexed item: type=${item.type}, drawing=${itemDrawingName}, visible=${item.visible !== false}`);
                  } catch (error) {
                      console.error(`Error adding unindexed item to ${itemDrawingName}:`, error);
                      console.log('Item that caused error:', JSON.stringify(item));
                  }
                  console.log(`Added unindexed item: type=${item.type}, to drawing=${itemDrawingName}, visible=${item.visible}`);
               }
            } // if (!skipProcessing)
        });
        // Log summary of items
        const dwgUnindexedItems = this.pfodWeb.drawingManager.getUnindexedItems(data.name);
        const dwgIndexedItems = this.pfodWeb.drawingManager.getIndexedItems(data.name);
        const dwgTouchZones = this.pfodWeb.drawingManager.getTouchZonesByCmd(data.name);
        console.log(`Drawing ${data.name} now has ${dwgUnindexedItems.length} unindexed items, ${Object.keys(dwgIndexedItems).length} indexed items,  ${Object.keys(dwgTouchZones).length} touchZones`);
        if (dwgUnindexedItems.length > 0) {
            console.log('Unindexed item types:', dwgUnindexedItems.map(i => i.type).join(', '));
        }
        if (Object.keys(dwgIndexedItems).length > 0) {
            console.log('Indexed item types:', Object.values(dwgIndexedItems).map(i => i.type).join(', '));
        }
    } // if (data.items && Array.isArray(data.items))

    console.log(`Set response status to TRUE for "${drawingName}"`);
    this.pfodWeb.drawingManager.drawingResponseStatus[drawingName] = true;
        
    // Check for insertDwg items and add them to the request queue
    const dwgUnindexedItems = this.pfodWeb.drawingManager.getUnindexedItems(data.name);
    console.log(`Scanning for insertDwg items in ${dwgUnindexedItems.length} unindexed items of drawing ${data.name}`);    
    // Debug: full dump of unindexed items array for this drawing
    console.log(`[DEBUG] Raw unindexed items array for ${data.name}:`, JSON.stringify(dwgUnindexedItems));    
    // Find insertDwg items in unindexed items 
    const insertDwgItems = dwgUnindexedItems.filter(item => 
        item.type && (
            //item.type.toLowerCase() === 'insertdwg' || 
            item.type === 'insertDwg'
        ));

        // Debugging detailed info about each unindexed item
    console.log(`[DEBUG] Detailed unindexed items for drawing ${data.name}:`);
    dwgUnindexedItems.forEach((item, index) => {
        console.log(`- Item ${index}: type=${item.type}, drawingName=${item.drawingName || 'none'}, would match insertDwg filter: ${(item.type === 'insertDwg' || (item.type && item.type.toLowerCase() === 'insertdwg'))}`);
        // Print full item for better debugging
        console.log(`  Full item ${index}:`, JSON.stringify(item));
    });

    const dwgIndexedItems = this.pfodWeb.drawingManager.getIndexedItems(data.name);
    const indices = Object.keys(dwgIndexedItems);
    indices.forEach(idx => {
        const itemWithIndex = dwgIndexedItems[idx];
        const drawingSource = itemWithIndex.parentDrawingName || 'unknown';
        console.log(`[PROCESS_DATA] Drawing indexed item ${idx} of type ${itemWithIndex.type} from ${drawingSource}`);
        if (itemWithIndex.transform) {
            console.log(`[PROCESS_DATA] Indexed item transform: x=${itemWithIndex.transform.x}, y=${itemWithIndex.transform.y}, scale=${itemWithIndex.transform.scale}`);
        } else {
            console.log(`[PROCESS_DATA] Indexed item has no transform!`);
        }
    });
    
    let foundInsertDwgItems = false;
        
    if (insertDwgItems.length > 0) {
        foundInsertDwgItems = true;
        console.log(`Found ${insertDwgItems.length} insertDwg items to process in drawing ${data.name}`);
        insertDwgItems.forEach(item => {
            // Check for and null any idx on insertDwg items
            if (item.idx && item.idx !== 'null') {
                console.log(`Warning: insertDwg item for "${item.drawingName}" has idx=${item.idx}, nulling it as insertDwg should not have an idx.`);
                item.idx = 'null';
            }
            console.log(`Processing insertDwg item for drawing "${item.drawingName}" at offsets (${item.xOffset || 0}, ${item.yOffset || 0})`);
            this.pfodWeb.handleInsertDwg(item);
        });
    } else {
        console.log(`No insertDwg items found in unindexed items of drawing ${data.name}`);
    }
        
    // Save the current transform for this drawing at the end of processing
    // This will be used as the starting transform for updates
        this.pfodWeb.drawingManager.saveTransform(drawingName, currentTransform);
        console.log(`[TRANSFORM] Saved transform for drawing "${data.name}": x=${currentTransform.x}, y=${currentTransform.y}, scale=${currentTransform.scale}`);
        
    // Update the MergeAndRedraw module with the latest state
        this.pfodWeb.mergeAndRedraw.updateState(this.pfodWeb.drawingManager.getMergeAndRedrawState());
        
        // If we found insertDwg items, we'll let the queue process them and do the redraw
        // when all items are processed. Otherwise, redraw immediately.
        console.log(`[REDRAW_DECISION] foundInsertDwgItems=${foundInsertDwgItems}, requestQueue.length=${this.pfodWeb.requestQueue.length}, isProcessingQueue=${this.pfodWeb.isProcessingQueue()}, sentRequest=${this.pfodWeb.sentRequest?.drawingName || 'none'}, drawingName=${drawingName}`);
        // Defer redraw if there are pending requests in the queue OR if we're actively processing a request OR if there's a sent request
        // This ensures all drawings are processed before attempting a final redraw
        if (this.pfodWeb.requestQueue.length > 0 || this.pfodWeb.isProcessingQueue() || this.pfodWeb.sentRequest) {
            console.log(`[REDRAW_DECISION] Deferring redraw for ${drawingName} - queue length: ${this.pfodWeb.requestQueue.length}, processing: ${this.pfodWeb.isProcessingQueue()}, sentRequest: ${this.pfodWeb.sentRequest?.drawingName || 'none'}`);
            // We'll still update the state, but defer redraw to the queue completion
        } else {
            // Queue is empty, not processing, and no sent request - redraw now
            console.log(`[REDRAW_DECISION] Queue empty, not processing, no sent request after ${drawingName}, redrawing immediately`);
            this.pfodWeb.drawingManager.allDrawingsReceived = true; // this is not actually used!!
  //          this.pfodWeb.resizeCanvas();
        }
        
        // Enable updates and start update loop only after complete processing
        this.pfodWeb.isUpdating = true;
        this.pfodWeb.scheduleNextUpdate();
    }
}

// Export for use in other modules
// Make classes available globally for class definition access
// IMPORTANT: Only pfodWeb should create instances of these classes
// Other modules should use the instances provided by pfodWeb
window.DrawingDataProcessor = DrawingDataProcessor;
window.TouchZoneFilters = TouchZoneFilters;