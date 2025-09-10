/*   
   DrawingManager.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// DrawingManager.js - Centralized manager for all drawing data
// Replaces the global drawingData variable with a class that manages data for each drawing

class DrawingManager {
    constructor() {
        // Store for drawing items
        this.touchZonesByCmd = {}; // Format: {drawingName: {cmd: item}}
        this.touchActionsByCmd = {}; // Format: {drawingName: {cmd: actionArray}}
        this.touchActionInputsByCmd = {}; // Format: {drawingName: {cmd: {prompt, textIdx}}}
        this.allTouchZonesByCmd = {}; // // Format: {cmd: item}
        this.unindexedItems = {}; // Format: {drawingName: [items]}
        this.indexedItems = {}; // Format: {drawingName: {idx: item}}
        
        // Track all drawings including main and inserted ones
        this.drawings = []; // Array of drawing names in order, with main drawing first
        this.drawingsData = {}; // Format: {drawingName: {xOffset, yOffset, transform, data, parentDrawing}}
        
        // Flag to track if all drawings have been received
        this.allDrawingsReceived = false; // this is not actually used!!
        
        // Only store the last transform for drawing updates
        this.savedTransforms = {}; // Format: {drawingName: {x, y, scale}}
        
        // Track response status for each drawing
        this.drawingResponseStatus = {}; // Format: {drawingName: boolean} - true if response received, false if pending
        
        // Try to restore merged data from localStorage on construction
        this.loadMergedDataFromStorage();
    }
    
    // Initialize the manager with a drawing name
    initialize(drawingName) {
        // Add the main drawing as the first entry in the drawings array
        if (!this.drawings.includes(drawingName)) {
            this.drawings.unshift(drawingName);
        }
        
        if (!this.touchZonesByCmd[drawingName]) {
            this.touchZonesByCmd[drawingName] = {};
        }
        if (!this.touchActionsByCmd[drawingName]) {
            this.touchActionsByCmd[drawingName] = {};
        }
        if (!this.touchActionInputsByCmd[drawingName]) {
            this.touchActionInputsByCmd[drawingName] = {};
        }    
        if (!this.allTouchZonesByCmd) {
            this.allTouchZonesByCmd = {};
        }    
        // Initialize collections for the drawing if they don't exist
        if (!this.unindexedItems[drawingName]) {
            this.unindexedItems[drawingName] = [];
        }
        if (!this.indexedItems[drawingName]) {
            this.indexedItems[drawingName] = {};
        }
        
        console.log(`DrawingManager initialized with drawing: ${drawingName}`);
        return this;
    }
    
    // Get the saved transform for a drawing
    // This is only used for restoring the last saved transform for updates
    getSavedTransform(drawingName = null) {
        const name = drawingName || (this.getMainDrawingName());
        // Return default transform if not found
        return this.savedTransforms[name] || { x: 0, y: 0, scale: 1.0 };
    }
    
    // Save the current transform for a drawing
    // This is used only to store the final transform for the next update
    saveTransform(drawingName, transform) {
        this.savedTransforms[drawingName] = { ...transform };
        return this;
    }
    
    // Get the drawing data for a specific drawing or the current one
    getDrawingData(drawingName = null) {
        const name = drawingName || (this.getMainDrawingName());
        return this.drawingsData[name]?.data;
    }
    
    // Get the current main drawing data
    getCurrentDrawingData() {
        // Main drawing is always the first in the drawings array
        const mainDrawing = this.getMainDrawingName();
        return this.drawingsData[mainDrawing]?.data;
    }
    
    // Set drawing data for a drawing
    setDrawingData(drawingName, data) {
        // Ensure drawingsData entry exists
        if (!this.drawingsData[drawingName]) {
            this.drawingsData[drawingName] = {
                xOffset: 0,
                yOffset: 0,
                transform: { x: 0, y: 0, scale: 1.0 },
                data: null,
                parentDrawing: null
            };
            
            // If this is a new drawing, add it to the drawings array
            if (!this.drawings.includes(drawingName)) {
                this.drawings.push(drawingName);
            }
        }
        
        // Update the data
        this.drawingsData[drawingName].data = data;
        this.drawingsData[drawingName].name = drawingName;
        this.drawingResponseStatus[drawingName] = true;
        
        // Ensure there are item collections for this drawing
        this.ensureItemCollections(drawingName);
        
        console.log(`DrawingManager: Set data for drawing ${drawingName}`);
        return this;
    }
    
    // Update drawing data (partial update)
    updateDrawingData(drawingName, updates) {
        if (!this.drawingsData[drawingName]) {
            this.drawingsData[drawingName] = {
                xOffset: 0,
                yOffset: 0,
                transform: { x: 0, y: 0, scale: 1.0 },
                data: {},
                parentDrawing: null
            };
            
            // If this is a new drawing, add it to the drawings array
            if (!this.drawings.includes(drawingName)) {
                this.drawings.push(drawingName);
            }
        }
        
        const currentData = this.drawingsData[drawingName].data || {};
        this.drawingsData[drawingName].data = { ...currentData, ...updates };
        this.drawingResponseStatus[drawingName] = true;
        
        console.log(`DrawingManager: Updated data for drawing ${drawingName}`);
        return this;
    }
    
    // Add an item to a drawing
    addItem(drawingName, item) {
        // Ensure the item collections exist
        this.ensureItemCollections(drawingName);
        
        // Apply current transform to the item
        if (!item.transform) {
            item.transform = {...this.getTransform(drawingName)};
        }
        
        // Handle indexed vs. unindexed items
        if (item.idx && item.idx !== 'null') {
            const idx = item.idx;
            this.indexedItems[drawingName][idx] = item;
            return this;
        }
        
        // For non-indexed items
        this.unindexedItems[drawingName].push(item);
        return this;
    }
    
    // Process a touchZone item
    addTouchZone(drawingName, touchZone) {
        // Ensure the item has a drawing name
        touchZone.drawingName = drawingName;
        const cmd = touchZone.cmd || '';
        if (cmd.trim().length == 0) {
            console.warn(`Error empty touchzone cmd in drawing "${drawingName}" ${JSON.stringify(touchZone)}`);
            return this;
        }
 
        // Check if there's already an existing item (could be index item) with this cmd
        const existingItem = this.touchZonesByCmd[drawingName] && this.touchZonesByCmd[drawingName][cmd];
        
        if (existingItem) {
            // Preserve transform and visibility state from existing item (likely an index item)
            touchZone.transform = existingItem.transform;
            touchZone.visible = existingItem.visible !== undefined ? existingItem.visible : touchZone.visible;
            console.log(`[DRAWING_MANAGER] Preserving state from existing item for cmd="${cmd}": visible=${touchZone.visible}, transform=(${touchZone.transform.x},${touchZone.transform.y},${touchZone.transform.scale})`);
        } else {
            // Apply current transform if not already set
            if (!touchZone.transform) {
                touchZone.transform = {...this.getTransform(drawingName)};
            }
        }
        
        // Add to the touchZones map - cmd is unique reference
        this.touchZonesByCmd[drawingName][touchZone.cmd] = touchZone;
        
        return this;
    }

    // Process a touchAction item
    addTouchAction(drawingName, touchAction) {
        console.log(`[DRAWING_MANAGER] Adding touchAction: cmd=${touchAction.cmd || ''}, drawingName=${drawingName}`);
        const cmd = touchAction.cmd || '';
        
        if (cmd.trim().length === 0) {
            console.warn(`[DRAWING_MANAGER] TouchAction has empty cmd, ignoring:`, JSON.stringify(touchAction));
            return false;
        }
        
        // Check if there's a touchZone with the same cmd in this drawing
        if (!this.touchZonesByCmd[drawingName] || !this.touchZonesByCmd[drawingName][cmd]) {
            console.warn(`[DRAWING_MANAGER] TouchAction cmd=${cmd} has no corresponding touchZone. TouchActions must be positioned AFTER their corresponding touchZone in the items list. Please move this touchAction to come after the touchZone with cmd="${cmd}".`);
            return false;
        }
        
        // Ensure the collections exist
        this.ensureItemCollections(drawingName);
        
        // Initialize actions array if it doesn't exist for this cmd
        if (!this.touchActionsByCmd[drawingName][cmd]) {
            this.touchActionsByCmd[drawingName][cmd] = [];
        }
        
        // Append the action items to existing actions array instead of replacing
        if (touchAction.action && Array.isArray(touchAction.action)) {
            this.touchActionsByCmd[drawingName][cmd].push(...touchAction.action);
        }
        
        console.log(`[DRAWING_MANAGER] TouchAction added successfully: cmd=${cmd}, actions=${(touchAction.action || []).length}, drawingName=${drawingName}`);
        return true;
    }

    // Get touchActions for a specific cmd
    getTouchAction(drawingName, cmd) {
        if (!this.touchActionsByCmd[drawingName]) return [];
        return this.touchActionsByCmd[drawingName][cmd] || [];
    }

    // Add touchActionInput for a specific cmd
    addTouchActionInput(drawingName, touchActionInput) {
        console.log(`[DRAWING_MANAGER] Adding touchActionInput: cmd=${touchActionInput.cmd || ''}, drawingName=${drawingName}`);
        const cmd = touchActionInput.cmd || '';
        
        if (cmd.trim().length === 0) {
            console.warn(`[DRAWING_MANAGER] TouchActionInput has empty cmd, ignoring:`, JSON.stringify(touchActionInput));
            return false;
        }
        
        // Check if there's a touchZone with the same cmd in this drawing
        if (!this.touchZonesByCmd[drawingName] || !this.touchZonesByCmd[drawingName][cmd]) {
            console.warn(`[DRAWING_MANAGER] TouchActionInput cmd=${cmd} has no corresponding touchZone, ignoring:`, JSON.stringify(touchActionInput));
            return false;
        }
        
        // Ensure the collections exist
        this.ensureItemCollections(drawingName);
        
        // Store the touchActionInput - overwrites any existing touchActionInput with same cmd
        this.touchActionInputsByCmd[drawingName][cmd] = {
            prompt: touchActionInput.prompt || '',
            textIdx: touchActionInput.textIdx,
            fontSize: touchActionInput.fontSize !== undefined ? touchActionInput.fontSize : 0,
            color: touchActionInput.color !== undefined ? touchActionInput.color : 0,
            backgroundColor: touchActionInput.backgroundColor !== undefined ? touchActionInput.backgroundColor : 0
        };
        
        // Force touchZone filter to TOUCH when touchActionInput is present, but only if not TOUCH_DISABLED
        const touchZone = this.touchZonesByCmd[drawingName][cmd];
        if (touchZone && touchZone.filter !== TouchZoneFilters.TOUCH && touchZone.filter !== TouchZoneFilters.TOUCH_DISABLED) {
            console.log(`[DRAWING_MANAGER] Forcing touchZone filter from ${touchZone.filter} to TOUCH for cmd=${cmd} due to touchActionInput`);
            touchZone.filter = TouchZoneFilters.TOUCH;
        }
        
        console.log(`[DRAWING_MANAGER] TouchActionInput added successfully: cmd=${cmd}, prompt="${touchActionInput.prompt}", textIdx=${touchActionInput.textIdx}, drawingName=${drawingName}`);
        return true;
    }

    // Get touchActionInput for a specific cmd
    getTouchActionInput(drawingName, cmd) {
        if (!this.touchActionInputsByCmd[drawingName]) return null;
        return this.touchActionInputsByCmd[drawingName][cmd] || null;
    }
    
    // Get all unindexed items for a drawing
    getTouchZonesByCmd(drawingName = null) {
        const name = drawingName || (this.getMainDrawingName());
        return this.touchZonesByCmd[name] || [];
    }
    
    // Clear items for a drawing
    clearItems(drawingName) {
        this.unindexedItems[drawingName] = [];
        this.indexedItems[drawingName] = {};
        this.touchZonesByCmd[drawingName] = {};
        this.touchActionsByCmd[drawingName] = {};
        this.touchActionInputsByCmd[drawingName] = {};
        return this;
    }
    
    // Get all unindexed items for a drawing
    getUnindexedItems(drawingName = null) {
        const name = drawingName || (this.getMainDrawingName());
        return this.unindexedItems[name] || [];
    }
    
    // Get all indexed items for a drawing
    getIndexedItems(drawingName = null) {
        const name = drawingName || (this.getMainDrawingName());
        return this.indexedItems[name] || {};
    }
    
    // Add an inserted drawing
    addInsertedDrawing(drawingName, xOffset, yOffset, transform, parentDrawing) {
        // Add to tracking array if not already present
        if (!this.drawings.includes(drawingName)) {
            this.drawings.push(drawingName);
        }
        
        // Initialize data structure for the inserted drawing
        this.drawingsData[drawingName] = {
            xOffset: xOffset,
            yOffset: yOffset,
            transform: transform || { x: 0, y: 0, scale: 1.0 },
            data: null,
            parentDrawing: parentDrawing
        };
        
        // Initialize saved transform
        this.savedTransforms[drawingName] = { x: 0, y: 0, scale: 1.0 };
        
        // Set response status to false (pending) when request is queued
        this.drawingResponseStatus[drawingName] = false;
        
        // Ensure the item collections exist for this drawing
        this.ensureItemCollections(drawingName);
        
        return this;
    }
 /**   
    // Set data for an inserted drawing
    setInsertedDrawingData(drawingName, data) {
        if (this.drawingsData[drawingName]) {
            this.drawingsData[drawingName].data = data;
            
            // Set response status to true when response is received
            this.drawingResponseStatus[drawingName] = true;
            console.log(`[DRAWING_MANAGER] Set response status to TRUE for "${drawingName}"`);
        } else {
            console.warn(`[DRAWING_MANAGER] Cannot set data for "${drawingName}" - not found in drawingsData`);
        }
        return this;
    }
 **/   
    // Remove an inserted drawing
    removeInsertedDrawing(drawingName) {
         console.log(`[DRAWING_MANAGER] Remove inserted drawing: "${drawingName}" `);
        // Cannot remove the main drawing (first in the array)
        if (this.getMainDrawingName() === drawingName) {
            console.warn(`[DRAWING_MANAGER] Cannot remove main drawing "${drawingName}"`);
            return this;
        }
        
        // Remove from drawings array
        const index = this.drawings.indexOf(drawingName);
        if (index !== -1) {
            this.drawings.splice(index, 1);
        }
        
        // Remove the drawing data
        delete this.drawingsData[drawingName];
        
        // Remove the drawing's item collections
        delete this.unindexedItems[drawingName];
        delete this.indexedItems[drawingName];
        
        // Remove saved transform
        delete this.savedTransforms[drawingName];
        
        // Remove response status
        delete this.drawingResponseStatus[drawingName];
        
        return this;
    }
    
    // Remove touchZone and associated touchActions by cmd, and also erase insertDwg items
    eraseByCmd(drawingName, cmd, dwgName = null) {
        console.log(`[DRAWING_MANAGER] Erasing touchZone and associated actions for cmd="${cmd}" in drawing="${drawingName}"`);
        if (!dwgName) {
        // Remove touchZone
        if (this.touchZonesByCmd[drawingName] && this.touchZonesByCmd[drawingName][cmd]) {
            delete this.touchZonesByCmd[drawingName][cmd];
            console.log(`[DRAWING_MANAGER] Removed touchZone for cmd="${cmd}"`);
        }
        
        // Remove associated touchActions
        if (this.touchActionsByCmd[drawingName] && this.touchActionsByCmd[drawingName][cmd]) {
            delete this.touchActionsByCmd[drawingName][cmd];
            console.log(`[DRAWING_MANAGER] Removed touchActions for cmd="${cmd}"`);
        }
        
        // Remove associated touchActionInputs
        if (this.touchActionInputsByCmd[drawingName] && this.touchActionInputsByCmd[drawingName][cmd]) {
            delete this.touchActionInputsByCmd[drawingName][cmd];
            console.log(`[DRAWING_MANAGER] Removed touchActionInput for cmd="${cmd}"`);
        }
        } else {
          // Also erase any insertDwg items with drawingName matching the cmd
          this.eraseInsertDwgByCmd(drawingName, cmd);
        }
        
        return this;
    }
    
    // Remove insertDwg items and recursively cleanup associated data
    eraseInsertDwgByCmd(parentDrawingName, targetDrawingName) {
        console.log(`[DRAWING_MANAGER] Erasing insertDwg for drawing="${targetDrawingName}" from parent="${parentDrawingName}"`);
        
        // Remove insertDwg items from unindexed items where drawingName matches cmd
        if (this.unindexedItems[parentDrawingName]) {
            const originalLength = this.unindexedItems[parentDrawingName].length;
            this.unindexedItems[parentDrawingName] = this.unindexedItems[parentDrawingName].filter(item => {
                if (item.type === 'insertDwg' && item.drawingName === targetDrawingName) {
                    console.log(`[DRAWING_MANAGER] Removing insertDwg item for "${targetDrawingName}" from unindexed items`);
                    return false; // Remove this item
                }
                return true; // Keep this item
            });
            const newLength = this.unindexedItems[parentDrawingName].length;
            if (originalLength !== newLength) {
                console.log(`[DRAWING_MANAGER] Removed ${originalLength - newLength} insertDwg items from unindexed items`);
            }
        }
        
        // Recursively remove all drawings that were inserted by the target drawing
        if (this.unindexedItems[targetDrawingName]) {
            const insertDwgItems = this.unindexedItems[targetDrawingName].filter(item => 
                item.type === 'insertDwg'
            );
            
            insertDwgItems.forEach(item => {
                console.log(`[DRAWING_MANAGER] Recursively removing nested insertDwg: "${item.drawingName}"`);
                this.eraseInsertDwgByCmd(targetDrawingName, item.drawingName);
            });
        }
        
        // Remove the inserted drawing from our tracking and cleanup all associated data
        if (this.drawings.includes(targetDrawingName)) {
            this.removeInsertedDrawing(targetDrawingName);
            console.log(`[DRAWING_MANAGER] Removed inserted drawing "${targetDrawingName}" from drawings array and cleaned up data`);
        }
        
        // Clear localStorage for the erased drawing
        try {
            localStorage.removeItem(`${targetDrawingName}_version`);
            localStorage.removeItem(`${targetDrawingName}_data`);
            console.log(`[DRAWING_MANAGER] Cleared localStorage for "${targetDrawingName}"`);
        } catch (error) {
            console.error(`[DRAWING_MANAGER] Error clearing localStorage for "${targetDrawingName}":`, error);
        }
        
        return this;
    }
    
    // Hide touchZone and insertDwg items by cmd
    hideByCmd(drawingName, cmd, dwgName = null) {
        console.log(`[DRAWING_MANAGER] Hiding items with cmd="${cmd}" in drawing="${drawingName}"`);
        if (!dwgName) {
        // Hide touchZone
        if (this.touchZonesByCmd[drawingName] && this.touchZonesByCmd[drawingName][cmd]) {
            this.touchZonesByCmd[drawingName][cmd].visible = false;
            console.log(`[DRAWING_MANAGER] Hidden touchZone for cmd="${cmd}"`);
        }
        } else {
        // Hide insertDwg items with cmd matching the hide command
        if (this.unindexedItems[drawingName]) {
            console.log(`[DRAWING_MANAGER] Checking ${this.unindexedItems[drawingName].length} unindexed items for insertDwg to hide with cmd="${cmd}"`);
            this.unindexedItems[drawingName].forEach((item, index) => {
                if (item.type === 'insertDwg') {
                    console.log(`[DRAWING_MANAGER] Found insertDwg item ${index}: cmd="${item.cmd}", target cmd="${cmd}", match=${item.cmd === cmd}`);
                    if (item.cmd === cmd) {
                        item.visible = false;
                        console.log(`[DRAWING_MANAGER] Hidden insertDwg item with cmd="${cmd}"`);
                    }
                }
            });
        }
        }
        
        return this;
    }
    
    // Unhide touchZone and insertDwg items by cmd
    unhideByCmd(drawingName, cmd, dwgName = null) {
        console.log(`[DRAWING_MANAGER] Unhiding items with cmd="${cmd}" in drawing="${drawingName}"`);
        if (!dwgName) {
        // Unhide touchZone
        if (this.touchZonesByCmd[drawingName] && this.touchZonesByCmd[drawingName][cmd]) {
            this.touchZonesByCmd[drawingName][cmd].visible = true;
            console.log(`[DRAWING_MANAGER] Unhidden touchZone for cmd="${cmd}"`);
        }
        } else {
        // Unhide insertDwg items with cmd matching the unhide command
        if (this.unindexedItems[drawingName]) {
            this.unindexedItems[drawingName].forEach(item => {
                if (item.type === 'insertDwg' && item.cmd === cmd) {
                    item.visible = true;
                    console.log(`[DRAWING_MANAGER] Unhidden insertDwg item with cmd="${cmd}"`);
                }
            });
        }
        }
        return this;
    }
    
    // Get all child drawings for a parent drawing
    getChildDrawings(parentDrawingName) {
        const childDrawings = [];
        
        for (const childName in this.drawingsData) {
            if (this.drawingsData[childName].parentDrawing === parentDrawingName) {
                childDrawings.push(childName);
            }
        }
        
        return childDrawings;
    }
    
    // Save the current transform for a drawing
    saveTransform(drawingName, transform) {
        this.savedTransforms[drawingName] = { ...transform };
        return this;
    }
    
    // Get the saved transform for a drawing
    getTransform(drawingName) {
        return this.savedTransforms[drawingName] || { x: 0, y: 0, scale: 1.0 };
    }
    
    // Get all data needed for the mergeAndRedraw module
    getMergeAndRedrawState() {
        // Get the main drawing name (first in the array)
        const mainDrawingName = this.getMainDrawingName();
        
        return {
            unindexedItems: this.unindexedItems,
            indexedItems: this.indexedItems,
            touchZonesByCmd: this.touchZonesByCmd,
            touchActionsByCmd: this.touchActionsByCmd,
            touchActionInputsByCmd: this.touchActionInputsByCmd,
            allTouchZonesByCmd: this.allTouchZonesByCmd,
            currentDrawingName: mainDrawingName,
            drawings: this.drawings,
            drawingsData: this.drawingsData,
            allDrawingsReceived: this.allDrawingsReceived, // this is not actually used!!
            drawingResponseStatus: this.drawingResponseStatus
        };
    }
    
    // Return initial transform state based on command type
    // This doesn't store any state, just returns the appropriate initial transform
    getInitialTransform(drawingName, command) {
        const name = drawingName || (this.getMainDrawingName());
        
        if (command === 'start') {
            // For 'start' commands, always use initial state
            console.log(`[TRANSFORM] Using initial transform (0,0,1.0) for drawing start: ${name}`);
            return { x: 0, y: 0, scale: 1.0 };
        } else if (command === 'update' && this.savedTransforms[name]) {
            // For 'update' commands, use the saved transform if available
            const savedTransform = {...this.savedTransforms[name]};
            console.log(`[TRANSFORM] Using saved transform for update: x=${savedTransform.x}, y=${savedTransform.y}, scale=${savedTransform.scale}`);
            return savedTransform;
        } else {
            // Default fallback
            console.log(`[TRANSFORM] No saved transform found, using default (0,0,1.0)`);
            return { x: 0, y: 0, scale: 1.0 };
        }
    }
    
    // Load drawing data from localStorage (if available)
    loadFromLocalStorage(drawingName) {
        try {
            const savedVersion = localStorage.getItem(`${drawingName}_version`);
            const savedData = localStorage.getItem(`${drawingName}_data`);
            
            if (savedData) {
                const drawingData = JSON.parse(savedData);
                
                // Ensure the drawing is in the drawings array
                if (!this.drawings.includes(drawingName)) {
                        this.drawings.push(drawingName);
                }
                
                // Create or update drawingsData entry
                if (!this.drawingsData[drawingName]) {
                    this.drawingsData[drawingName] = {
                        xOffset: 0,
                        yOffset: 0,
                        transform: { x: 0, y: 0, scale: 1.0 },
                        data: null,
                        parentDrawing: null
                    };
                }
                
                // Update the data
                this.drawingsData[drawingName].data = drawingData;
                this.drawingResponseStatus[drawingName] = true;
                
                console.log(`DrawingManager: Loaded drawing ${drawingName} from localStorage (version: ${savedVersion})`);
                return drawingData;
            }
        } catch (error) {
            console.error(`Error loading drawing ${drawingName} from localStorage:`, error);
        }
        
        return null;
    }
    
    // Save drawing data to localStorage
    saveToLocalStorage(drawingName) {
        const drawingData = this.drawingsData[drawingName]?.data;
        
        if (!drawingData) {
            console.warn(`Cannot save drawing ${drawingName} to localStorage: No data available.`);
            return this;
        }
        
        try {
            // Save the version separately
            console.log(`[DRAWINGMANAGER_DEBUG] About to save version for ${drawingName}: drawingData.version = "${drawingData.version}"`);
            if (drawingData.version) {
                localStorage.setItem(`${drawingName}_version`, drawingData.version);
                console.log(`[DRAWINGMANAGER_DEBUG] Saved version "${drawingData.version}" to localStorage`);
            } else {
                console.log(`[DRAWINGMANAGER_DEBUG] NOT saving version - drawingData.version is falsy: "${drawingData.version}"`);
            }
            
            // Save the drawing data
            localStorage.setItem(`${drawingName}_data`, JSON.stringify(drawingData));
            console.log(`DrawingManager: Saved drawing ${drawingName} to localStorage (version: ${drawingData.version})`);
        } catch (error) {
            console.error(`Error saving drawing ${drawingName} to localStorage:`, error);
        }
        
        return this;
    }
    
    // Helper method to ensure item collections exist for a drawing
    ensureItemCollections(drawingName) {
        if (!this.unindexedItems[drawingName]) {
            this.unindexedItems[drawingName] = [];
        }
        if (!this.indexedItems[drawingName]) {
            this.indexedItems[drawingName] = {};
        }
        if (!this.touchZonesByCmd[drawingName]) {
            this.touchZonesByCmd[drawingName] = {};
        }
        if (!this.touchActionsByCmd[drawingName]) {
            this.touchActionsByCmd[drawingName] = {};
        }
        if (!this.touchActionInputsByCmd[drawingName]) {
            this.touchActionInputsByCmd[drawingName] = {};
        }
    }
    
    getMainDrawingName() {
         const mainDrawingName = this.drawings.length > 0 ? this.drawings[0] : '';
         return mainDrawingName;
    }

    // Create a structured response for sharing state with other modules
    getState() {
        // Main drawing is always the first in the array
        const mainDrawingName = this.getMainDrawingName();
        
        return {
            currentDrawingName: mainDrawingName,
            drawings: this.drawings,
            drawingsData: this.drawingsData,
            unindexedItems: this.unindexedItems,
            indexedItems: this.indexedItems,
            allDrawingsReceived: this.allDrawingsReceived,
            savedTransforms: this.savedTransforms,
            drawingResponseStatus: this.drawingResponseStatus
        };
    }
    
    // Get the response status for a drawing
    getDrawingResponseStatus(drawingName) {
        // Add debug logging to help troubleshoot
        console.log(`[DRAWING_MANAGER] Checking response status for "${drawingName}": ${this.drawingResponseStatus[drawingName]}`);
        
        // If it's undefined, treat as false - if it's truthy, treat as true
        return !!this.drawingResponseStatus[drawingName];
    }
    
    // Load merged data from localStorage based on main drawing organization
    loadMergedDataFromStorage() {
        console.log('[DRAWING_MANAGER] Loading merged data from localStorage...');
        
        try {
            // Look for any main drawing storage keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('pfodWeb_mainDwg_')) {
                    const mainDrawingName = key.replace('pfodWeb_mainDwg_', '');
                    console.log(`[DRAWING_MANAGER] Found stored data for main drawing: ${mainDrawingName}`);
                }
            }
        } catch (error) {
            console.error('[DRAWING_MANAGER] Error loading merged data from localStorage:', error);
        }
    }
    
    // Save merged data to localStorage organized by main drawing
    saveMergedDataToStorage(mainDrawingName) {
        if (!mainDrawingName) {
            console.warn('[DRAWING_MANAGER] Cannot save merged data: No main drawing name provided');
            return;
        }
        
        try {
            const storageKey = `pfodWeb_mainDwg_${mainDrawingName}`;
            
            // Get all inserted drawings for this main drawing
            const insertedDrawings = [];
            for (const drawingName in this.drawingsData) {
                if (this.drawingsData[drawingName].parentDrawing === mainDrawingName) {
                    insertedDrawings.push(drawingName);
                }
            }
            
            // Create storage structure for this main drawing
            const mainDrawingStorage = {
                mainDrawingName: mainDrawingName,
                insertedDrawings: insertedDrawings,
                mergedData: {
                    touchZonesByCmd: this.touchZonesByCmd[mainDrawingName] || {},
                    touchActionsByCmd: this.touchActionsByCmd[mainDrawingName] || {},
                    touchActionInputsByCmd: this.touchActionInputsByCmd[mainDrawingName] || {},
                    unindexedItems: this.unindexedItems[mainDrawingName] || [],
                    indexedItems: this.indexedItems[mainDrawingName] || {},
                    allTouchZonesByCmd: this.allTouchZonesByCmd || {}
                },
                individualDrawings: {}
            };
            
            // Store individual drawing data for main drawing and its inserted drawings
            if (this.drawingsData[mainDrawingName]?.data) {
                mainDrawingStorage.individualDrawings[mainDrawingName] = {
                    rawData: this.drawingsData[mainDrawingName].data,
                    version: this.drawingsData[mainDrawingName].data.version
                };
            }
            
            // Store data for inserted drawings
            insertedDrawings.forEach(drawingName => {
                if (this.drawingsData[drawingName]?.data) {
                    mainDrawingStorage.individualDrawings[drawingName] = {
                        rawData: this.drawingsData[drawingName].data,
                        version: this.drawingsData[drawingName].data.version
                    };
                }
            });
            
            // Save to localStorage
            localStorage.setItem(storageKey, JSON.stringify(mainDrawingStorage));
            console.log(`[DRAWING_MANAGER] Saved merged data for main drawing "${mainDrawingName}" to localStorage`);
            
        } catch (error) {
            console.error(`[DRAWING_MANAGER] Error saving merged data for "${mainDrawingName}":`, error);
        }
    }
    
    // Load merged data for a specific main drawing from localStorage
    loadMergedDataForMainDrawing(mainDrawingName) {
        if (!mainDrawingName) {
            return null;
        }
        
        try {
            const storageKey = `pfodWeb_mainDwg_${mainDrawingName}`;
            const savedData = localStorage.getItem(storageKey);
            
            if (savedData) {
                const mainDrawingStorage = JSON.parse(savedData);
                
                // Restore the main drawing in the drawings array
                if (!this.drawings.includes(mainDrawingName)) {
                    this.drawings.unshift(mainDrawingName);
                }
                
                // Restore merged data for the main drawing
                this.touchZonesByCmd[mainDrawingName] = mainDrawingStorage.mergedData.touchZonesByCmd || {};
                this.touchActionsByCmd[mainDrawingName] = mainDrawingStorage.mergedData.touchActionsByCmd || {};
                this.touchActionInputsByCmd[mainDrawingName] = mainDrawingStorage.mergedData.touchActionInputsByCmd || {};
                this.unindexedItems[mainDrawingName] = mainDrawingStorage.mergedData.unindexedItems || [];
                this.indexedItems[mainDrawingName] = mainDrawingStorage.mergedData.indexedItems || {};
                this.allTouchZonesByCmd = mainDrawingStorage.mergedData.allTouchZonesByCmd || {};
                
                // Restore individual drawing data
                for (const drawingName in mainDrawingStorage.individualDrawings) {
                    const drawingInfo = mainDrawingStorage.individualDrawings[drawingName];
                    
                    // Add to drawings array if not present
                    if (!this.drawings.includes(drawingName)) {
                        this.drawings.push(drawingName);
                    }
                    
                    // Create drawingsData entry
                    if (!this.drawingsData[drawingName]) {
                        this.drawingsData[drawingName] = {
                            xOffset: 0,
                            yOffset: 0,
                            transform: { x: 0, y: 0, scale: 1.0 },
                            data: null,
                            parentDrawing: drawingName === mainDrawingName ? null : mainDrawingName
                        };
                    }
                    
                    // Restore the drawing data
                    this.drawingsData[drawingName].data = drawingInfo.rawData;
                    this.drawingResponseStatus[drawingName] = true;
                    
                    // Ensure item collections exist
                    this.ensureItemCollections(drawingName);
                }
                
                console.log(`[DRAWING_MANAGER] Loaded merged data for main drawing "${mainDrawingName}" from localStorage`);
                return mainDrawingStorage;
            }
        } catch (error) {
            console.error(`[DRAWING_MANAGER] Error loading merged data for "${mainDrawingName}":`, error);
        }
        
        return null;
    }
    
    // Get the version number for a specific drawing from localStorage
    getStoredVersion(drawingName) {
        if (!drawingName) return null;
        
        // First check if we have it in memory
        if (this.drawingsData[drawingName]?.data?.version) {
            return this.drawingsData[drawingName].data.version;
        }
        
        // Try to find it in localStorage by checking all main drawing storage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('pfodWeb_mainDwg_')) {
                    const savedData = localStorage.getItem(key);
                    if (savedData) {
                        const mainDrawingStorage = JSON.parse(savedData);
                        if (mainDrawingStorage.individualDrawings[drawingName]) {
                            return mainDrawingStorage.individualDrawings[drawingName].version;
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[DRAWING_MANAGER] Error getting stored version for "${drawingName}":`, error);
        }
        
        return null;
    }
}

// Make DrawingManager available globally for class definition access
// IMPORTANT: Only pfodWeb should create instances of DrawingManager
// Other modules should use the instance provided by pfodWeb
window.DrawingManager = DrawingManager;