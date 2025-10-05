/*
   drawingMerger.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// DrawingMerger class - Handles merging of drawing data from multiple sources
// Separated from redraw functionality for clean architecture
class DrawingMerger {
    constructor(drawingManager) {
        this.drawingManager = drawingManager;
    }

    // Main method to merge all drawing items into collections for rendering
    mergeAllDrawings() {
        // Get main drawing data
        const mainDrawingName = this.drawingManager.drawings.length > 0 ? this.drawingManager.drawings[0] : '';
        if (!mainDrawingName) return null;

        const currentDrawingData = this.drawingManager.drawingsData[mainDrawingName];
        if (!currentDrawingData) return null;

        console.log(`[DRAWING_MERGER] Starting merge for main drawing: ${mainDrawingName}`);

        // Initialize collections
        this.drawingManager.allUnindexedItems = [];
        this.drawingManager.allIndexedItemsByNumber = {};
        this.drawingManager.allTouchZonesByCmd = {};

        // Mark processed drawings to avoid infinite loops
        let processedDrawings = new Set();

        // Set up initial transform and clip region for main drawing
        const initialTransform = { x: 0, y: 0, scale: 1.0 };
        const mainClipRegion = null; // Main drawing has no clipping by default

        // Create main drawing insertDwg item for processing
        const mainDwg = {
            type: 'insertDwg',
            xOffset: 0,
            yOffset: 0,
            color: currentDrawingData.color,
            parentDrawingName: mainDrawingName,
            drawingName: mainDrawingName,
            transform: { x: 0, y: 0, scale: 1.0 }
        };

        // Merge all drawing items
        this.mergeDrawingItems(mainDwg, this.drawingManager.allUnindexedItems,
            this.drawingManager.allIndexedItemsByNumber, this.drawingManager.allTouchZonesByCmd,
            processedDrawings, mainClipRegion);

        console.log(`[DRAWING_MERGER] Merge complete: ${this.drawingManager.allUnindexedItems.length} unindexed items, ${Object.keys(this.drawingManager.allIndexedItemsByNumber).length} different indices, ${Object.keys(this.drawingManager.allTouchZonesByCmd).length} touchZones`);

        return currentDrawingData;
    }
    
    getDrawingResponseStatus(drawingName) {
        return this.drawingManager.drawingResponseStatus[drawingName] || false;
    }

        // Calculate clipping region for a drawing
    calculateItemClipRegion(transform, drawingWidth, drawingHeight, parentClipRegion) {
      /**
        const x = transform.x;
        const y = transform.y;
        const scale = transform.scale;
        const width = drawingWidth * scale;
        const height = drawingHeight * scale;

        let clipRegion = { x, y, width, height };

        // Apply parent clipping if it exists
        if (parentClipRegion) {
            clipRegion.x = Math.max(clipRegion.x, parentClipRegion.x);
            clipRegion.y = Math.max(clipRegion.y, parentClipRegion.y);
            clipRegion.width = Math.min(clipRegion.width, parentClipRegion.width);
            clipRegion.height = Math.min(clipRegion.height, parentClipRegion.height);
        }

        return clipRegion;
        **/
        return parentClipRegion; // do not limit insertDwgs
    }

    /**
    transform calculations
    each items has a base offset and a scale and a clip region
    when the item is drawn, first the item's offset x scale is added to the base to the the position
    then the size is scaled by scale and the item drawn
    insertDwg's offset are different they do not change the position of the the background rectangle
    rather they move the insertDwg's items up and to left by offset * scale (for +ve offsets)
    clip regions are only updated when insertDwg processed
    
    the insertDwg arg contains the current transformation offset and scale
    the insertDwg xOffset,yOffset move the dwg items up and left by offset * scale (for +ve offsets)
    scale insertDwg by ratio of cols i.e. a 20xh inserted in a 40xhh will be scaled down by 2 i.e. x 20/40
    **/
    // Merge drawing items from a specific drawing with transforms and clipping
    // dwgTransform is the parent transform and scaling for this deg
    mergeDrawingItems(insertDwg, allUnindexedItems, allIndexedItemsByNumber, allTouchZonesByCmd, processedDrawings, parentClipRegion = null) {
       // console.log(`[MERGE_DWG] Using parent transform: (${parentTransform.x}, ${parentTransform.y}, ${parentTransform.scale}) for drawing "${drawingName}"`);
        // parent transform is base offset + scale
        // all added item first have their offset scaled by scale and then base offset added
        
        let drawingName = insertDwg.drawingName;
        console.warn(`[MERGE_DWG] Merging Drawing "${drawingName}".`);
        console.log(`[MERGE_DWG] Beginning merge process for drawing "${drawingName}" ${JSON.stringify(insertDwg)}`);        
        // Get drawing data for dimensions and color
        const drawingData = this.drawingManager.drawingsData[drawingName];
        if (!drawingData || !drawingData.data) {
            console.log(`[DRAWING_MERGER] Drawing "${drawingName}" data not available.`);
            return;
        }
        let clipRegion = parentClipRegion;
        if (parentClipRegion) {
            console.log(`[DRAWING_MERGER] Using parent clip region: (${parentClipRegion.x}, ${parentClipRegion.y}, width:${parentClipRegion.width}, height:${parentClipRegion.height})`);
        } else {
            console.log(`[DRAWING_MERGER] No parent clip region provided, using drawing bounds for clipping`);
            clipRegion = {
            x: 0,
            y: 0,
            width: drawingData.data.x,
            height: drawingData.data.y
          };
        }
        parentClipRegion = clipRegion;
        // Get drawing dimensions and properties
        const drawingWidth = drawingData.data.x || 50;
        const drawingHeight = drawingData.data.y || 50;
        const backgroundColor = drawingData.data.color || 'white';
        
        console.log(`[DRAWING_MERGER] Drawing "${drawingName}" has dimensions ${drawingWidth}x${drawingHeight}, color: ${backgroundColor}`);
   
   
        
        // Calculate parent transform for this drawing
        const parentTransform = insertDwg.transform || { x: 0, y: 0, scale: 1.0 };

        // Get drawing items
        const drawingUnindexedItems = this.drawingManager.unindexedItems[drawingName] || [];
        const drawingIndexedItems = this.drawingManager.indexedItems[drawingName] || {};
        const touchZoneItems = this.drawingManager.touchZonesByCmd[drawingName] || {};
        const touchActionItems = this.drawingManager.touchActionsByCmd[drawingName] || {};

        console.log(`[DRAWING_MERGER] Processing ${drawingUnindexedItems.length} unindexed items, ${Object.keys(drawingIndexedItems).length} indexed items, ${Object.keys(touchZoneItems).length} touchZones from "${drawingName}"`);


        // Handle case where drawing has no items
        if (drawingUnindexedItems.length === 0 && Object.keys(drawingIndexedItems).length === 0) {
            console.log(`[DRAWING_MERGER] Drawing "${drawingName}" has no items, but will still be drawn as a rectangle with background color.`);
            if (Object.keys(touchZoneItems).length !== 0) {
                console.log(`[DRAWING_MERGER] Drawing "${drawingName}" has touchZones which will be drawn in debug mode.`);
            }    
        }
        
        
        let dwgTransform = {...insertDwg.transform}; // the current parent transform
        // adjust the scale by the ratio of the dwg.x to clip.width clip is the main dwg clip
        dwgTransform.scale = dwgTransform.scale * drawingWidth/parentClipRegion.width;
        
        console.log(`[SCALE_MERGE_DWG]  insertDwg transform: ${JSON.stringify(dwgTransform)}`);
        
        console.log(`[DRAWING_MERGER] For drawing: Raw dimensions: ${drawingWidth}x${drawingHeight}`);
        //console.log(`[MERGE_DWG] For drawing: Clip with scale: (${dwgTransform.x}, ${dwgTransform.y}, scale=${dwgTransform.scale})`);
        // Calculate the clip region for the nested drawing using our common function
        const dwgClipRegion = this.calculateItemClipRegion(dwgTransform, drawingWidth, drawingHeight, parentClipRegion);                   
        console.log(`[DRAWING_MERGER] Calculated nested drawing clip region: (${dwgClipRegion.x}, ${dwgClipRegion.y}, width:${dwgClipRegion.width}, height:${dwgClipRegion.height})`);
        
        // apply insertDwg offset move
        // update nestedTransform for  dwg offset to move dwg up and left need to include scale
         const dwg_xOffset = parseFloat(insertDwg.xOffset || 0);
         const dwg_yOffset = parseFloat(insertDwg.yOffset || 0);

        dwgTransform.x += (-dwg_xOffset) * dwgTransform.scale;
        dwgTransform.y += (-dwg_yOffset) * dwgTransform.scale;
        console.log(`[DRAWING_MERGER] Using item transform for nested drawing items: (${dwgTransform.x}, ${dwgTransform.y}, ${dwgTransform.scale})`);

        // Process touchZones
        for (const cmd in touchZoneItems) {
            const touchZone = touchZoneItems[cmd];
            const processedItem = {...touchZone};
            processedItem.clipRegion = dwgClipRegion;
            // build combined transform
           const itemTransform = {...processedItem.transform};
           itemTransform.x = itemTransform.x * dwgTransform.scale + dwgTransform.x;
           itemTransform.y = itemTransform.y * dwgTransform.scale + dwgTransform.y;
           itemTransform.scale = itemTransform.scale *  dwgTransform.scale;
           processedItem.transform = itemTransform;
           // Handle touchZone
           console.log(`[DRAWING_MERGER] Found touchzone item for drawing "${drawingName}" at offsets (${touchZone.xOffset || 0}, ${touchZone.yOffset || 0})`);
           const touchZoneCmd = touchZone.cmd || '';
           if (touchZoneCmd.trim().length == 0) {
             console.warn(`[DRAWING_MERGER] Error empty touchzone cmd in drawing "${drawingName}" ${JSON.stringify(processedItem)}`);
           } else {
             if (!allTouchZonesByCmd[touchZoneCmd]) {
             } else {
                const currentItem = allTouchZonesByCmd[touchZoneCmd];
                if (currentItem.parentDrawingName !== processedItem.parentDrawingName) {
                    console.warn(`[DRAWING_MERGER] Error: Updating existing touchZone with cmd ${touchZoneCmd} in "${processedItem.parentDrawingName}" with item from different drawing, "${currentItem.parentDrawingName}"`);
                }
                // save current transform
                processedItem.transform = {...currentItem.transform}; // keep new data but change transform and clipRegion
                processedItem.clipRegion = {...currentItem.clipRegion};
                console.log(`[DRAWING_MERGERG_UPDATE] Update existing touchZone with cmd ${touchZoneCmd} to ${JSON.stringify(processedItem)}`);
            }
            console.warn(`[DRAWING_MERGER] Added touchZone to allTouchZonesByCmd  ${JSON.stringify(processedItem)}`);
            allTouchZonesByCmd[touchZoneCmd] = processedItem;
           }
        }
        
        // Process touchActions - merge them into global collection
        for (const cmd in touchActionItems) {
            const touchActions = touchActionItems[cmd];
            if (touchActions && touchActions.length > 0) {
                console.log(`[DRAWING_MERGER] Found ${touchActions.length} touchActions for cmd="${cmd}" in drawing "${drawingName}"`);
                
                // Initialize global collection if needed
                if (!this.drawingManager.allTouchActionsByCmd) {
                    this.drawingManager.allTouchActionsByCmd = {};
                }
                
                // Add to global merged collection (overwrites any existing with same cmd)
                this.drawingManager.allTouchActionsByCmd[cmd] = [...touchActions];
                console.log(`[DRAWING_MERGER] Added ${touchActions.length} touchActions for cmd="${cmd}" to global merged collection`);
            }
        }

        // Process touchActionInputs - merge them into global collection
        const touchActionInputItems = this.drawingManager.touchActionInputsByCmd[drawingName] || {};
        for (const cmd in touchActionInputItems) {
            const touchActionInput = touchActionInputItems[cmd];
            if (touchActionInput) {
                console.log(`[DRAWING_MERGER] Found touchActionInput for cmd="${cmd}" in drawing "${drawingName}"`);
                
                // Initialize global collection if needed
                if (!this.drawingManager.allTouchActionInputsByCmd) {
                    this.drawingManager.allTouchActionInputsByCmd = {};
                }
                
                // Add to global merged collection (overwrites any existing with same cmd)
                this.drawingManager.allTouchActionInputsByCmd[cmd] = { ...touchActionInput };
                console.log(`[DRAWING_MERGER] Added touchActionInput for cmd="${cmd}" to global merged collection`);
            }
        }

        // Process unindexed items
        // Process unindexed items
        for (let i = 0; i < drawingUnindexedItems.length; i++) {
            const item = drawingUnindexedItems[i];
            // insertDwg does not process offset like rectangle
            item.clipRegion = dwgClipRegion;
            
            console.log(`[MERGE_DWG] Processing unindexed item ${i} of type '${item.type}' in drawing "${drawingName}"`);
            console.warn(`[MERGE_DWG] item: ${JSON.stringify(item)}`);
            //console.log(`[SCALE_MERGE_DWG]  parent transform: (${parentTransform.x}, ${parentTransform.y}, ${parentTransform.scale})`);
            
            if (item.type && item.type === 'insertDwg') {
                // Check if insertDwg should be visible
                if (item.visible === false) {
                    console.log(`[MERGE_DWG] Skipping hidden insertDwg for drawing "${item.drawingName}"`);
                    continue;
                }
                
                // Handle nested insertDwg
                const nestedDrawingName = item.drawingName;
                console.log(`[MERGE_DWG] Found nested insertDwg item for drawing "${nestedDrawingName}" at offsets (${item.xOffset || 0}, ${item.yOffset || 0})`);
                
                // Check if we have received a response for this drawing
                const hasResponse = this.getDrawingResponseStatus(nestedDrawingName);
                if (!hasResponse) {
                    console.warn(`[MERGE_DWG] No response received for drawing "${nestedDrawingName}" - skipping this insertDwg`);
                    continue;
                }
                
                // Create a processed item for the insertDwg itself and add it to the unindexed items
                const processedInsertDwgItem = {...item}; 
                processedInsertDwgItem.clipRegion = dwgClipRegion;

                // Store the parent transform directly with the item for reliable clipping                
              //  const itemTransform = {...parentTransform};
              //  processedInsertDwgItem.transform = itemTransform;
                
                // Add drawing bounds for clipping - use defaults if data not available
                const nestedDrawingData = this.drawingManager.drawingsData[nestedDrawingName];
                let drawingWidth = 50;  // Default width
                let drawingHeight = 50; // Default height
                
                if (nestedDrawingData && nestedDrawingData.data) {
                    drawingWidth = nestedDrawingData.data.x || drawingWidth;
                    drawingHeight = nestedDrawingData.data.y || drawingHeight;
                
                    processedInsertDwgItem.drawingBounds = {
                       width: drawingWidth,
                      height: drawingHeight
                    };
                } else {
                    console.warn(`[MERGE_DWG] insertDwg '${nestedDrawingName}' does not have sizes. Skipping`);
                    continue;
                }
                                
                // Add the nested insertDwg item to the list
               // allUnindexedItems.push(processedInsertDwgItem);
               // console.log(`[MERGE_DWG] Added nested insertDwg item for "${nestedDrawingName}" to unindexed items list`);
                
                // Process the nested drawing recursively if not already processed
                if (nestedDrawingName && !processedDrawings.has(nestedDrawingName)) {
                    processedDrawings.add(nestedDrawingName);                                                           
                    // Process the nested drawing with the intersection clip region
                    this.mergeDrawingItems(item, allUnindexedItems, allIndexedItemsByNumber, allTouchZonesByCmd, processedDrawings, dwgClipRegion);
                } else if (nestedDrawingName) {
                    console.log(`[MERGE_DWG] Drawing "${nestedDrawingName}" already processed, skipping content processing`);
                }
            } else {
                // Regular drawing item
                const processedItem = {...item};
                processedItem.clipRegion = dwgClipRegion;
                // build combined transform 
                // NOTE: default value only needed for test-modules.html, real display already has transform set
                const itemTransform = {...(processedItem.transform || { x: 0, y: 0, scale: 1 })};
                itemTransform.x = itemTransform.x * dwgTransform.scale + dwgTransform.x;
                itemTransform.y = itemTransform.y * dwgTransform.scale + dwgTransform.y;
                itemTransform.scale = itemTransform.scale *  dwgTransform.scale;
                processedItem.transform = itemTransform;
                console.warn(`[MERGE_DWG] Added unindexed Item  ${JSON.stringify(processedItem)}`);
                allUnindexedItems.push(processedItem);
            }
        }
        

        // Process indexed items
        for (const idx in drawingIndexedItems) {
            const item = drawingIndexedItems[idx];

            console.log(`[MERGE_DWG] Processing indexed item idx=${idx}, type='${item.type}' in drawing "${drawingName}"`);
            const processedItem = {...item};
            processedItem.clipRegion = dwgClipRegion;
            const itemTransform = {...processedItem.transform};
            itemTransform.x = itemTransform.x * dwgTransform.scale + dwgTransform.x;
            itemTransform.y = itemTransform.y * dwgTransform.scale + dwgTransform.y;
            itemTransform.scale = itemTransform.scale *  dwgTransform.scale;
            processedItem.transform = itemTransform;
            
           // Add to indexed items collection replacing existing 
           const numericIdx = parseInt(idx);
               // check for overwrite of another dwg
               // this check fails on update from touchAction in insertDwg so skip it
           if (!allIndexedItemsByNumber[numericIdx]) {
                //allIndexedItemsByNumber[numericIdx] = processedItem;
            } else {
               const currentItem = allIndexedItemsByNumber[numericIdx];
//               console.log(`[MERGE_DWG] Updating existing item with index ${numericIdx} in "${processedItem.drawingName}" with at ${JSON.stringify(processedItem)}`);
//               if (currentItem.parentDrawingName !== processedItem.parentDrawingName) {
//                 console.warn(`[MERGE_DWG] Error: Updating existing item with index ${numericIdx} in "${processedItem.parentDrawingName}" with item from different drawing, "${currentItem.parentDrawingName}"`);
//               }
               // save current transform
               processedItem.transform = {...currentItem.transform}; // keep new data but change transform and clipRegion
               processedItem.clipRegion = {...currentItem.clipRegion};
               processedItem.visible = {...currentItem.visible}; // keep current visible setting
               console.log(`[MERGE_DWG_UPDATE] Update existing item with index ${numericIdx} to ${JSON.stringify(processedItem)}`);
            }    
            console.warn(`[MERGE_DWG] Added indexed Item  ${JSON.stringify(processedItem)}`);
            allIndexedItemsByNumber[numericIdx] = processedItem;
        }
        
        console.log(`[MERGE_DWG] Completed merging items from "${drawingName}" at ${new Date().toISOString()}`);
        console.log(`[MERGE_DWG] Current status: ${allUnindexedItems.length} unindexed items, ${Object.keys(allIndexedItemsByNumber).length} different indices, ${Object.keys(allTouchZonesByCmd).length} touchZones `);
    }

}

// Export as global for browser compatibility
window.DrawingMerger = DrawingMerger;