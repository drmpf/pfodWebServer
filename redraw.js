/*   
   redraw.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// Redraw module - handles all canvas drawing operations
// Supports multiple independent viewer instances

// Convert relative fontSize to actual pixel size
// fontSize 0 = 2.9, +1 = 2.9*1.1225, -1 = 2.9/1.1225, etc.
// +6 doubles size, -6 halves size
// relativeFontSize must be an integer
function getActualFontSize(relativeFontSize) {
    const baseFontSize = 2.9;
    const factor = 1.1225;
    
    // Ensure we have an integer
    const intFontSize = Math.round(relativeFontSize);
    
    if (intFontSize === 0) {
        return baseFontSize;
    } else if (intFontSize > 0) {
        return baseFontSize * Math.pow(factor, intFontSize);
    } else {
        return baseFontSize / Math.pow(factor, Math.abs(intFontSize));
    }
}

// Import formatting utilities
// Note: printFloatDecimals and addFormattedValueToText are now in displayTextUtils.js

// Get appropriate black or white color based on background contrast
function getBlackWhite(color) {
    // Convert color to RGB values
    function getRGB(color) {
        // Handle hex colors
        if (typeof color === 'string' && color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return [r, g, b];
        }
        
        // Handle color numbers - convert to hex first, then to RGB using xtermColorToHex
        const hexColor = xtermColorToHex(color);
        const hex = hexColor.slice(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return [r, g, b];
    }
    
    const [r, g, b] = getRGB(color);
    
    // Use the same algorithm as Java code: y = (299 * R + 587 * G + 114 * B) / 1000
    const y = (299 * r + 587 * g + 114 * b) / 1000;
    
    // If y >= 128, background is light, use black text. Otherwise use white text.
    return y >= 128 ? 0 : 15; // BLACK (0) : WHITE (15)
}

// Convert xterm 256 color index to RGB hex color
function xtermColorToHex(colorIndex) {
    // Handle non-numeric input or out of range - use black
    if (typeof colorIndex !== 'number' || colorIndex > 255 || colorIndex < 0) {
        return '#000000';
    }
    
    // Clamp input to valid range
    colorIndex = Math.max(0, Math.min(255, Math.floor(colorIndex)));
    
    let r, g, b;
    
    if (colorIndex < 16) {
        // Standard colors (0-15)
        const standardColors = [
            [0, 0, 0],       // 0: Black
            [128, 0, 0],     // 1: Maroon
            [0, 128, 0],     // 2: Green
            [128, 128, 0],   // 3: Olive
            [0, 0, 128],     // 4: Navy
            [128, 0, 128],   // 5: Purple
            [0, 128, 128],   // 6: Teal
            [192, 192, 192], // 7: Silver
            [128, 128, 128], // 8: Grey
            [255, 0, 0],     // 9: Red
            [0, 255, 0],     // 10: Lime
            [255, 255, 0],   // 11: Yellow
            [0, 0, 255],     // 12: Blue
            [255, 0, 255],   // 13: Fuchsia
            [0, 255, 255],   // 14: Aqua
            [255, 255, 255]  // 15: White
        ];
        [r, g, b] = standardColors[colorIndex];
        
    } else if (colorIndex >= 16 && colorIndex <= 231) {
        // 216 color cube (16-231)
        const cubeIndex = colorIndex - 16;
        const cubeValues = [0, 95, 135, 175, 215, 255];
        
        const rIndex = Math.floor(cubeIndex / 36);
        const gIndex = Math.floor((cubeIndex % 36) / 6);
        const bIndex = cubeIndex % 6;
        
        r = cubeValues[rIndex];
        g = cubeValues[gIndex];
        b = cubeValues[bIndex];
        
    } else {
        // Grayscale ramp (232-255)
        const grayIndex = colorIndex - 232;
        const grayValue = 8 + grayIndex * 10;
        r = g = b = grayValue;
    }
    
    const toHex = (value) => {
        const hex = value.toString(16).toUpperCase();
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

// Convert color value to hex - only supports integers (0-255)
function convertColorToHex(color, backgroundColorNumber = null) {
    // Handle Black/White mode (color -1)
    if (color === -1 && backgroundColorNumber !== null) {
        const blackWhiteColor = getBlackWhite(backgroundColorNumber);
        return xtermColorToHex(blackWhiteColor);
    }
    
    // Support both integer colors and string numbers
    if (typeof color === 'number') {
        return xtermColorToHex(color);
    }
    if (typeof color === 'string' && !isNaN(color)) {
        hexColor = isNaN(parseInt(color))? 0 : parseInt(color);
        return xtermColorToHex(hexColor);
    }
    // Any non-integer color defaults to black
    return '#000000';
}

class Redraw {
    constructor() {
        // Instance variables for multi-viewer isolation
        this.canvas = null;
        this.ctx = null;
        this.drawingManagerState = null;
        
        // Drawing state
        this.currentBackgroundColor = 0; // Store current drawing background color for Black/White mode
        
        // Canvas caching for optimization
        this.cachedCanvasWidth = 0;
        this.cachedCanvasHeight = 0;
        this.hasCompletedFirstDraw = false;
    }

    // Initialize with canvas and drawing manager state
    init(config) {
        if (config.canvas) this.canvas = config.canvas;
        if (config.ctx) this.ctx = config.ctx;
        if (config.drawingManagerState) this.drawingManagerState = config.drawingManagerState;
        
        console.log(`[REDRAW] Module initialized with canvas ${this.canvas.width}x${this.canvas.height}`);
    }

    // Update drawing manager state
    updateState(config) {
        if (config.drawings) this.drawingManagerState.drawings = config.drawings;
        if (config.drawingsData) this.drawingManagerState.drawingsData = config.drawingsData;
        if (config.allDrawingsReceived !== undefined) this.drawingManagerState.allDrawingsReceived = config.allDrawingsReceived; // this is not actually used!!
        if (config.drawingResponseStatus) this.drawingManagerState.drawingResponseStatus = config.drawingResponseStatus;
    }

    // Helper methods to access drawing manager state



        // This would need to be implemented based on how transforms are stored

    getCurrentDrawingName() {
        return this.drawingManagerState.drawings.length > 0 ? this.drawingManagerState.drawings[0] : '';
    }

    // Public interface for drawing operations
    redrawCanvas(currentDrawingData, allUnindexedItems, allIndexedItemsByNumber, allTouchZonesByCmd) {
        return this.redrawCanvasImpl(currentDrawingData, allUnindexedItems, allIndexedItemsByNumber, allTouchZonesByCmd);
    }


    // Get current state for debugging
    getState() {
        return {
            canvasSize: { width: this.canvas?.width, height: this.canvas?.height },
            hasCompletedFirstDraw: this.hasCompletedFirstDraw,
            currentDrawingName: this.getCurrentDrawingName()
        };
    }

    // Main canvas redraw implementation
    redrawCanvasImpl(currentDrawingData, allUnindexedItems, allIndexedItemsByNumber, allTouchZonesByCmd) {
        if (!currentDrawingData) return;
        
        console.log(`[REDRAW] Starting redraw for canvas: ${currentDrawingData.name}, size=${this.canvas.width}x${this.canvas.height} at ${new Date().toISOString()}`);
        console.log(`[REDRAW_DEBUG] Redraw inputs - unindexed: ${allUnindexedItems.length}, indexed keys: [${Object.keys(allIndexedItemsByNumber).join(', ')}], touchZones: [${Object.keys(allTouchZonesByCmd).join(', ')}]`);
        
        // Check if canvas size has changed or this is the first draw
        const sizeChanged = !this.hasCompletedFirstDraw || this.cachedCanvasWidth !== this.canvas.width || this.cachedCanvasHeight !== this.canvas.height;
        
        console.log(`[REDRAW] Proceeding with redraw, using passed drawing data and merged items`);
        
        // Clear canvas - use cached dimensions after first draw if size hasn't changed
        const rawBackgroundColor = currentDrawingData.data ? currentDrawingData.data.color || 0 : 0; // Default to black (0)
        this.currentBackgroundColor = rawBackgroundColor; // Store for Black/White color mode
        const backgroundColor = convertColorToHex(rawBackgroundColor);
        console.log(`[REDRAW] Setting canvas background color to: ${backgroundColor} (from raw: ${rawBackgroundColor})`);
        this.ctx.fillStyle = backgroundColor;
        this.ctx.strokeStyle = backgroundColor;
        this.ctx.lineWidth = 2; 
        if (this.hasCompletedFirstDraw && !sizeChanged) {
            // Use cached dimensions if they exist and size hasn't changed
            //this.drawRoundedRectangle(0, 0, this.cachedCanvasWidth, this.cachedCanvasHeight, 10, true);
            console.log(`[REDRAW] Using cached dimensions: ${this.cachedCanvasWidth}x${this.cachedCanvasHeight}`);
        } else {
            // Use current canvas dimensions and update cache
            this.cachedCanvasWidth = this.canvas.width;
            this.cachedCanvasHeight = this.canvas.height;
            this.hasCompletedFirstDraw = true;
            //this.drawRoundedRectangle(0, 0, this.cachedCanvasWidth, this.cachedCanvasHeight, 10, true);
            console.log(`[REDRAW] Canvas size changed or first draw - updated cached dimensions to ${this.cachedCanvasWidth}x${this.cachedCanvasHeight}`);
        }
        this.ctx.fillRect(0, 0, this.cachedCanvasWidth, this.cachedCanvasHeight);
//        this.ctx.strokeStyle = "#FFFFFF";
//        this.drawRoundedRectangle(0, 0, this.cachedCanvasWidth, this.cachedCanvasHeight, 20, false);
//        this.ctx.strokeStyle = "#000000";
//        this.drawRoundedRectangle(2, 2, this.cachedCanvasWidth-4, this.cachedCanvasHeight-4, 20, false);
        
        this.ctx.strokeStyle = backgroundColor;

        console.log(`[REDRAW] Drawing ${allUnindexedItems.length} merged unindexed items`);
        
        // Debug: log each unindexed item
        for (let i = 0; i < allUnindexedItems.length; i++) {
            const item = allUnindexedItems[i];
            console.log(`[REDRAW] DEBUG: Unindexed item ${i}: type=${item.type}, drawingName=${item.drawingName || 'none'}, transform=(${item.transform?.x},${item.transform?.y}), scale=${item.transform?.scale}`);
        }
        
        // Handle case where no items to draw
        if (allUnindexedItems.length === 0) {
            console.log(`[REDRAW] No unindexed items to draw.`);
        }
        
        // Draw all merged unindexed items in order
        allUnindexedItems.forEach((item, index) => {
            const drawingSource = item.parentDrawingName || 'unknown';
            console.log(`[REDRAW] Drawing unindexed item ${index} of type ${item.type} from ${drawingSource} with color ${item.color}`);
            if (item.transform) {
                console.log(`[REDRAW] Item transform: x=${item.transform.x}, y=${item.transform.y}, scale=${item.transform.scale}`);
            } else {
                console.log(`[REDRAW] Item has no transform!`);
            }
            this.drawItem(item);
        });

        // Draw all indexed items in order of their indices
        const sortedIndices = Object.keys(allIndexedItemsByNumber)
            .map(idx => parseInt(idx))
            .filter(idx => !isNaN(idx))
            .sort((a, b) => a - b);

        console.log(`[REDRAW] Drawing items with ${sortedIndices.length} different indices`);
        sortedIndices.forEach(idx => {
            const itemWithIndex = allIndexedItemsByNumber[idx];
            const drawingSource = itemWithIndex.parentDrawingName || 'unknown';
            console.log(`[REDRAW] Drawing indexed item ${idx} of type ${itemWithIndex.type} from ${drawingSource}`);
            console.log(`[REDRAW_INDEXED_DEBUG] Item ${idx} full data:`, JSON.stringify(itemWithIndex, null, 2));
            if (itemWithIndex.transform) {
                console.log(`[REDRAW] Indexed item transform: x=${itemWithIndex.transform.x}, y=${itemWithIndex.transform.y}, scale=${itemWithIndex.transform.scale}`);
            } else {
                console.log(`[REDRAW] Indexed item has no transform!`);
            }
            this.drawItem(itemWithIndex);
        });

        Object.keys(allTouchZonesByCmd).forEach(cmd => {
            const touchZone = allTouchZonesByCmd[cmd];
            const drawingSource = touchZone.parentDrawingName || 'unknown';
            console.log(`[REDRAW] Drawing touchZone item ${cmd} from ${drawingSource}`);
            if (touchZone.transform) {
                console.log(`[REDRAW] TouchZone transform: x=${touchZone.transform.x}, y=${touchZone.transform.y}, scale=${touchZone.transform.scale}`);
            } else {
                console.log(`[REDRAW] TouchZone item has no transform!`);
            }
            this.drawItem(touchZone);
        });

        
        console.log(`[REDRAW] Canvas redraw completed at ${new Date().toISOString()}`);
        console.log(`[REDRAW] Final item counts: ${allUnindexedItems.length} unindexed, ${sortedIndices.length} different indices`);
    }


    // Draw a single item implementation
    drawItem(itemToDraw) {
        if (!itemToDraw || !itemToDraw.type) {
            console.error('Invalid item with missing or undefined type:', itemToDraw);
            return;
        }
        const item = {...itemToDraw};
        // protect transform
        const itemTransform = {...itemToDraw.transform};
        item.transform = itemTransform;
        const itemClipRegion = {...itemToDraw.clipRegion};
        item.clipRegion = itemClipRegion;

        try {
            console.log(`[DRAWING] Drawing item of type: ${item.type}`, JSON.stringify(item));
            
            // Check if item is visible
            if (item.visible === false) {
                console.log(`Skipping draw for invisible item of type: ${item.type}, idx: ${item.idx || 'none'}, cmd: ${item.cmd || 'none'}`);
                return;
            }
            
            // Skip items that should have been processed in pfodWeb.js
            if (item.type === 'hide' || item.type === 'unhide' || item.type == 'push' || item.type == 'pop' || item.type == 'erase') {
                console.warn(`WARNING: ${item.type} item should be processed in pfodWeb.js and not passed to drawing layer!`);
                return;
            }
            
            // Save canvas state (including clipping)
            this.ctx.save();
            
            // Apply clipping if clipRegion is provided and has valid properties
            if (item.clipRegion && typeof item.clipRegion.x === 'number' && typeof item.clipRegion.width === 'number') {
                // Use pre-calculated clip region
                console.log(`Using pre-calculated clip region: (${item.clipRegion.x}, ${item.clipRegion.y}, ${item.clipRegion.width}, ${item.clipRegion.height})`);
                
                // Convert logical coordinates to canvas pixel coordinates
                const scaledX = item.clipRegion.x * this.canvas.scaleX;
                const scaledY = item.clipRegion.y * this.canvas.scaleY;
                const scaledWidth = item.clipRegion.width * this.canvas.scaleX;
                const scaledHeight = item.clipRegion.height * this.canvas.scaleY;
                
                // Apply clipping rectangle
                this.ctx.beginPath();
                this.ctx.rect(Math.round(scaledX), Math.round(scaledY), Math.round(scaledWidth), Math.round(scaledHeight));
                this.ctx.clip();
                
                // Optionally draw the clip region for debugging
               // this.ctx.strokeStyle = 'rgba(0,255,0,0.3)'; // Use green for clip regions
               // this.ctx.strokeRect(Math.round(scaledX), Math.round(scaledY), Math.round(scaledWidth), Math.round(scaledHeight));
                
                console.log(`Applied pre-calculated clip region: (${scaledX}, ${scaledY}, ${scaledWidth}, ${scaledHeight})`);
            }
            
            // Set default color for drawing
            if (item.color === undefined) {
              item.color = -1;
            }
            const hexColor = convertColorToHex(item.color, this.currentBackgroundColor);
            this.ctx.fillStyle = hexColor;
            this.ctx.strokeStyle = hexColor;
            // Dispatch to specific drawing functions based on type
            switch (item.type.toLowerCase()) {
                case 'line':
                    this.drawLine(item);
                    break;
                case 'rectangle':
                    console.log('Drawing rectangle item with:', 
                        `xOffset: ${item.xOffset} yOffset: ${item.yOffset}`,
                        `xSize: ${item.xSize} ySize: ${item.ySize}`,
                        `centered: ${item.centered}`,
                        `style: ${item.style}`,
                        `corners: ${item.corners}`
                    );
                    this.drawRectangle(item);
                    break;
                case 'label':
                    console.log('Drawing label item with:',
                        `text: "${item.text}"`,
                        `xOffset: ${item.xOffset} yOffset: ${item.yOffset}`,
                        `xSize: ${item.xSize} ySize: ${item.ySize}`,
                        `fontSize: ${item.fontSize}`,
                        `align: ${item.align}`,
                        `bold: ${item.bold} italic: ${item.italic} underline: ${item.underline}`
                    );
                    this.drawLabel(item);
                    break;
                case 'value':
                    console.log('Drawing value item with:',
                        `text: "${item.text}"`,
                        `intValue: ${item.intValue}`,
                        `min: ${item.min} max: ${item.max}`,
                        `displayMin: ${item.displayMin} displayMax: ${item.displayMax}`,
                        `decimals: ${item.decimals} units: "${item.units}"`,
                        `xOffset: ${item.xOffset} yOffset: ${item.yOffset}`,
                        `fontSize: ${item.fontSize} align: ${item.align}`
                    );
                    this.drawValue(item);
                    break;
                case 'circle':
                    console.log('Drawing circle item with:',
                        `xOffset: ${item.xOffset} yOffset: ${item.yOffset}`,
                        `radius: ${item.radius}`,
                        `filled: ${item.filled}`
                    );
                    this.drawCircle(item);
                    break;
                case 'arc':
                    console.log('Drawing arc item with:',
                        `xOffset: ${item.xOffset} yOffset: ${item.yOffset}`,
                        `radius: ${item.radius}`,
                        `start: ${item.start}° angle: ${item.angle}°`,
                        `filled: ${item.filled}`
                    );
                    this.drawArc(item);
                    break;
                case 'touchzone':
                    console.log('Drawing touchZone item with:',
                        `cmd: ${item.cmd}`,
                        `xOffset: ${item.xOffset} yOffset: ${item.yOffset}`,
                        `xSize: ${item.xSize} ySize: ${item.ySize}`,
                        `centered: ${item.centered}`,
                        `filter: ${item.filter}`,
                        `idx: ${item.idx}`
                    );
                    this.drawTouchZone(item);
                    break;
                case 'insertdwg':
                    // Draw the inserted drawing directly as a rectangle with background color
                    console.log(`Drawing insertdwg item: ${item.drawingName}`);
                    this.drawInsertDwg(item);
                    break;
                case 'index':
                    // Index type is a placeholder that doesn't draw anything
                    console.log(`Skipping draw for index item with idx=${item.idx} - this is a placeholder that maintains transform/clipping data only`);
                    break;
                default:
                    console.error(`ERROR: Unknown item type: ${item.type} - not supported by drawing layer!`);
            }
        } catch (error) {
            console.error(`Error drawing item of type ${item.type}:`, error);
        }
        
        // Restore canvas state (also removes clipping)
        this.ctx.restore();
    }

    //========== drawInsertDwg ==========
    // Draw an insertDwg item as a background rectangle
    drawInsertDwg(item) {
        console.error('drawInsertDwg called. Should not be drawing insertDwg:', JSON.stringify(item,null,2));
/**        
        if (!item || !item.drawingName) {
            console.error('Invalid insertDwg item or missing drawingName:', item);
            return;
        }
            
        // Get the transform for positioning
        const transform = item.transform || { x: 0, y: 0, scale: 1.0 };
        
        // Get drawing dimensions and color from DrawingManager
        let drawingWidth = 50;  // Default width
        let drawingHeight = 50; // Default height
        let backgroundColor = 7; // Default light gray (silver) for missing drawings
        
        const drawingData = this.drawingManagerState.drawingsData[item.drawingName];
        if (drawingData && drawingData.data) {
            // Use actual drawing data
            drawingWidth = drawingData.data.x || drawingWidth;
            drawingHeight = drawingData.data.y || drawingHeight;
            backgroundColor = drawingData.data.color || backgroundColor;
            
            console.log(`[DRAWING] insertDwg Using actual drawing data: ${drawingWidth}x${drawingHeight}, color: ${backgroundColor}`);
        } else {
            console.log(`[DRAWING] insertDwg '${item.drawingName}' not loaded - skipping drawing`);
            return; // Skip drawing insertDwg if not loaded
        }
**/
        /**
        // Use the drawing bounds if available
        if (item.drawingBounds) {
            drawingWidth = item.drawingBounds.width;
            drawingHeight = item.drawingBounds.height;
            
            // CRITICAL FIX: Apply the transform scale to the drawing bounds
            if (transform && transform.scale) {
                console.log(`Applying scale ${transform.scale} to drawing bounds`);
                drawingWidth *= transform.scale;
                drawingHeight *= transform.scale;
            }
            
            console.log(`[DRAWING] Using drawing bounds from item: ${drawingWidth}x${drawingHeight}`);
        }
        **/
        /**
        console.log(`[DRAWING] Using transform for insertDwg '${item.drawingName}': (${transform.x}, ${transform.y}, ${transform.scale})`);
        
        // Create a rectangle to represent the inserted drawing's background
        const rectItem = {
            xSize: drawingWidth,
            ySize: drawingHeight,
            xOffset: 0,
            yOffset: 0,
            color: backgroundColor,
            filled: 'true',
            centered: 'false',
            transform: transform,
            drawingBounds: item.drawingBounds,
        };
        
        // Store original colors
        const originalFill = this.ctx.fillStyle;
        const originalStroke = this.ctx.strokeStyle;
        
        // Set color for the inserted drawing background
        const hexBackgroundColor = convertColorToHex(backgroundColor);
        this.ctx.fillStyle = hexBackgroundColor;
        this.ctx.strokeStyle = hexBackgroundColor;
        
        // Draw the rectangle
        console.log(`[DRAWING] Drawing insertDwg background rectangle: ${drawingWidth}x${drawingHeight} at (${transform.x}, ${transform.y}), scale: ${transform.scale}`);
            
        this.drawRectangle(rectItem);
        
        // Restore original colors
        this.ctx.fillStyle = originalFill;
        this.ctx.strokeStyle = originalStroke;
        **/
    }

    // Draw a label
    drawLabel(item) {
        console.log('[DRAWING_LABEL] Drawing label - Raw item:', JSON.stringify(item));

        // Check if label should be visible
        if (item.visible === false) {
            console.log('[DRAWING_LABEL] label not visible, skipping drawing');
            return;
        }

        const transform = item.transform || { x: 0, y: 0, scale: 1.0 };
        const xOffset = parseFloat(item.xOffset || 0);
        const yOffset = parseFloat(item.yOffset || 0);
        // Generate label text: if label has a value, combine text+FloatDecimals(value,decimals)+units
        const text = addFormattedValueToText(item.text || '', item);
        const relativeFontSize = parseInt(item.fontSize || 0);
        const fontSize = getActualFontSize(relativeFontSize);
        const bold = item.bold === 'true' || item.bold === true;
        const italic = item.italic === 'true' || item.italic === true;
        const underline = item.underline === 'true' || item.underline === true;
        const align = item.align || 'left';

        // Calculate actual position with transform
        const actualX = (xOffset * transform.scale) + transform.x;
        const actualY = (yOffset * transform.scale) + transform.y;
        const actualFontSize = fontSize * transform.scale;

        // Convert to canvas coordinates
        const canvasX = actualX * this.canvas.scaleX;
        const canvasY = actualY * this.canvas.scaleY;
        const canvasFontSize = actualFontSize * this.canvas.scaleX;

        console.log(`[DRAWING_LABEL] Drawing label at canvas coordinates (${canvasX}, ${canvasY}), fontSize: ${canvasFontSize}`);

        // Set font style
        let fontStyle = '';
        if (italic) fontStyle += 'italic ';
        if (bold) fontStyle += 'bold ';
        fontStyle += `${canvasFontSize}px Arial`;

        this.ctx.font = fontStyle;
        this.ctx.textBaseline = 'middle';

        // Set text alignment and calculate text position
        let textX = canvasX;
        
        if (align === 'right') {
            // For right alignment, the xOffset represents where the right edge should be
            this.ctx.textAlign = 'right';
            textX = canvasX; // xOffset position is where right edge will be
        } else if (align === 'center') {
            // For center alignment, the xOffset represents the center point
            this.ctx.textAlign = 'center';
            textX = canvasX; // xOffset position is where center will be
        } else {
            // For left alignment (default), the xOffset represents where the left edge should be
            this.ctx.textAlign = 'left';
            textX = canvasX; // xOffset position is where left edge will be
        }

        // Split text by newlines and draw each line separately
        const lines = text.split('\n');
        const lineHeight = canvasFontSize * 1.0; // 1.0x font size for line spacing
        
        // Calculate starting Y position for multi-line text (center the block vertically)
        const totalHeight = (lines.length - 1) * lineHeight;
        let startY = canvasY - (totalHeight / 2);
        
        lines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight);
            
            // Draw the line at the calculated position
            this.ctx.fillText(line, textX, lineY);

            // Draw underline for this line if specified
            if (underline) {
                const textMetrics = this.ctx.measureText(line);
                const underlineY = lineY + canvasFontSize / 2;
                let underlineX = textX;
                let underlineWidth = textMetrics.width;

                if (align === 'center') {
                    underlineX = textX - textMetrics.width / 2;
                } else if (align === 'right') {
                    underlineX = textX - textMetrics.width;
                }

                this.ctx.beginPath();
                this.ctx.moveTo(underlineX, underlineY);
                this.ctx.lineTo(underlineX + underlineWidth, underlineY);
                this.ctx.stroke();
            }
        });

        console.log(`[DRAWING_LABEL] Label drawn: "${text}" at (${canvasX}, ${canvasY})`);
    }

    // Draw a value
    drawValue(item) {
        console.log('[DRAWING_VALUE] Drawing value - Raw item:', JSON.stringify(item));

        // Check if value should be visible
        if (item.visible === false) {
            console.log('[DRAWING_VALUE] value not visible, skipping drawing');
            return;
        }

        const transform = item.transform || { x: 0, y: 0, scale: 1.0 };
        const xOffset = parseFloat(item.xOffset || 0);
        const yOffset = parseFloat(item.yOffset || 0);
        const textPrefix = item.text || '';
        const relativeFontSize = parseInt(item.fontSize || 0);
        const fontSize = getActualFontSize(relativeFontSize);
        const bold = item.bold === 'true' || item.bold === true;
        const italic = item.italic === 'true' || item.italic === true;
        const underline = item.underline === 'true' || item.underline === true;
        const align = item.align || 'left';
        const intValue = parseFloat(item.intValue || 0);
        const max = parseFloat(item.max || 1);
        const min = parseFloat(item.min || 0);
        const displayMax = parseFloat(item.displayMax || 1.0);
        const displayMin = parseFloat(item.displayMin || 0.0);
        const decimals = (item.decimals !== undefined && item.decimals !== null) ? parseInt(item.decimals) : 2;
        const units = item.units || '';

        // Calculate scaled value using the mapping function
        let maxMin = max - min;
        if (maxMin === 0) {
            maxMin = 1;
        }
        const scaledValue = (intValue - min) * (displayMax - displayMin) / maxMin + displayMin;

        // Format the scaled value to specified decimals (supports negative decimals)
        const formattedValue = printFloatDecimals(scaledValue, decimals);

        // Create the final display text
        const displayText = textPrefix + formattedValue + units;

        console.log(`[DRAWING_VALUE] Calculated scaled value: ${intValue} -> ${scaledValue} (${formattedValue}) -> "${displayText}"`);

        // Calculate actual position with transform
        const actualX = (xOffset * transform.scale) + transform.x;
        const actualY = (yOffset * transform.scale) + transform.y;
        const actualFontSize = fontSize * transform.scale;

        // Convert to canvas coordinates
        const canvasX = actualX * this.canvas.scaleX;
        const canvasY = actualY * this.canvas.scaleY;
        const canvasFontSize = actualFontSize * this.canvas.scaleX;

        console.log(`[DRAWING_VALUE] Drawing value at canvas coordinates (${canvasX}, ${canvasY}), fontSize: ${canvasFontSize}`);

        // Set font style
        let fontStyle = '';
        if (italic) fontStyle += 'italic ';
        if (bold) fontStyle += 'bold ';
        fontStyle += `${canvasFontSize}px Arial`;

        this.ctx.font = fontStyle;
        this.ctx.textBaseline = 'middle';

        // Set text alignment and calculate text position
        let textX = canvasX;
        
        if (align === 'right') {
            // For right alignment, the xOffset represents where the right edge should be
            this.ctx.textAlign = 'right';
            textX = canvasX; // xOffset position is where right edge will be
        } else if (align === 'center') {
            // For center alignment, the xOffset represents the center point
            this.ctx.textAlign = 'center';
            textX = canvasX; // xOffset position is where center will be
        } else {
            // For left alignment (default), the xOffset represents where the left edge should be
            this.ctx.textAlign = 'left';
            textX = canvasX; // xOffset position is where left edge will be
        }

        // Split text by newlines and draw each line separately
        const lines = displayText.split('\n');
        const lineHeight = canvasFontSize * 1.0; // 1.0x font size for line spacing
        
        // Calculate starting Y position for multi-line text (center the block vertically)
        const totalHeight = (lines.length - 1) * lineHeight;
        let startY = canvasY - (totalHeight / 2);
        
        lines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight);
            
            // Draw the line at the calculated position
            this.ctx.fillText(line, textX, lineY);

            // Draw underline for this line if specified
            if (underline) {
                const textMetrics = this.ctx.measureText(line);
                const underlineY = lineY + canvasFontSize / 2;
                let underlineX = textX;
                let underlineWidth = textMetrics.width;

                if (align === 'center') {
                    underlineX = textX - textMetrics.width / 2;
                } else if (align === 'right') {
                    underlineX = textX - textMetrics.width;
                }

                this.ctx.beginPath();
                this.ctx.moveTo(underlineX, underlineY);
                this.ctx.lineTo(underlineX + underlineWidth, underlineY);
                this.ctx.stroke();
            }
        });

        console.log(`[DRAWING_VALUE] Value drawn: "${displayText}" at (${canvasX}, ${canvasY})`);
    }

    // Draw a line
    drawLine(item) {
        console.log('[DRAWING_LINE] Drawing line - Raw item:', JSON.stringify(item));

        // Check if touchZone should be visible
        if (item.visible === false) {
            console.log('[DRAWING_LINE] line not visible, skipping drawing');
            return;
        }
        // default for test-modules.html use only
        const transform = item.transform ? {...item.transform} : { x: 0, y: 0, scale: 1.0 };
        const x = parseFloat(item.xSize || 0);         // Vector X component
        const y = parseFloat(item.ySize || 0);         // Vector Y component
        const xOffset = parseFloat(item.xOffset || 0); // Starting X position
        const yOffset = parseFloat(item.yOffset || 0); // Starting Y position
        
        console.log(`[DRAWING_LINE] drawLine: original coords - offset(${xOffset},${yOffset}), vector(${x},${y})`);
        console.log(`[DRAWING_LINE] drawLine: using transform - x=${transform.x}, y=${transform.y}, scale=${transform.scale}`);
        
        // Use offsets and dimensions as-is since scaling is handled in merge step
        const transformedXOffset = xOffset*transform.scale;
        const transformedYOffset = yOffset*transform.scale;
        const transformedX = x*transform.scale;
        const transformedY = y*transform.scale;
        
        console.log(`[DRAWING_LINE] drawLine: after transform scale - offset(${transformedXOffset},${transformedYOffset}), vector(${transformedX},${transformedY})`);
                                  
        // Apply the translation component of the transform
        const translatedStartX = transform.x + transformedXOffset;
        const translatedStartY = transform.y + transformedYOffset;
        const translatedEndX = translatedStartX + transformedX;
        const translatedEndY = translatedStartY + transformedY;
        
        console.log(`drawLine: after transform translation - start(${translatedStartX},${translatedStartY}), end(${translatedEndX},${translatedEndY})`);
        
        // Apply canvas scaling to get actual pixel coordinates
        const scaledStartX = translatedStartX * this.canvas.scaleX;
        const scaledStartY = translatedStartY * this.canvas.scaleY;
        const scaledEndX = translatedEndX * this.canvas.scaleX;
        const scaledEndY = translatedEndY * this.canvas.scaleY;
        console.log(`[DRAWING_LINE] drawLine: after canvas scaling - start(${scaledStartX},${scaledStartY}), end(${scaledEndX},${scaledEndY})`);
         
        // Draw the line
        this.ctx.beginPath();
      //  this.ctx.lineWidth = 2;
        
        this.ctx.moveTo(Math.round(scaledStartX), Math.round(scaledStartY));
        this.ctx.lineTo(Math.round(scaledEndX), Math.round(scaledEndY));
        
        this.ctx.stroke();
        
        console.log(`[DRAWING_LINE] Drawing line from (${translatedStartX},${translatedStartY}) to (${translatedEndX},${translatedEndY})`);
    }
    
    // draw rounded rectangel
    drawRoundedRectangle(roundedX, roundedY, roundedWidth, roundedHeight, radius, filled = false) {
      // uses preset 
      //this.ctx.fillStyle = color;
      //this.ctx.strokeStyle = color;

                 // Create rounded rectangle path
                this.ctx.beginPath();
                
                // Top edge and top-right corner
                this.ctx.moveTo(roundedX + radius, roundedY);
                this.ctx.lineTo(roundedX + roundedWidth - radius, roundedY);
                this.ctx.arc(roundedX + roundedWidth - radius, roundedY + radius, radius, Math.PI * 1.5, 0, false);
                
                // Right edge and bottom-right corner
                this.ctx.lineTo(roundedX + roundedWidth, roundedY + roundedHeight - radius);
                this.ctx.arc(roundedX + roundedWidth - radius, roundedY + roundedHeight - radius, radius, 0, Math.PI * 0.5, false);
                
                // Bottom edge and bottom-left corner
                this.ctx.lineTo(roundedX + radius, roundedY + roundedHeight);
                this.ctx.arc(roundedX + radius, roundedY + roundedHeight - radius, radius, Math.PI * 0.5, Math.PI, false);
                
                // Left edge and top-left corner
                this.ctx.lineTo(roundedX, roundedY + radius);
                this.ctx.arc(roundedX + radius, roundedY + radius, radius, Math.PI, Math.PI * 1.5, false);
                
                this.ctx.closePath();
                
                if (filled) {
                    console.log(`[DRAWING_ROUNDED_RECTANGLE] Filling rounded rectangle at (${roundedX},${roundedY}) with size ${roundedWidth}x${roundedHeight}`);
                    this.ctx.fill();
                } else {
                    console.log(`[DRAWING_ROUNDED_RECTANGLE] Stroking rounded rectangle at (${roundedX},${roundedY}) with size ${roundedWidth}x${roundedHeight}`);
                    this.ctx.stroke();
                }
     }
     
    // Draw a rectangle
    drawRectangle(item) {
        console.log('[DRAWING_RECTANGLE] Drawing rectangle - Raw item:', JSON.stringify(item));
        
        try {
            
            // Get the transform from the item (or use default if not present)
            // default for test-modules.html use only
            const transform = item.transform ? {...item.transform} : { x: 0, y: 0, scale: 1.0 };
            console.log(`[DRAWING_RECTANGLE] drawRectangle: using transform - x=${transform.x}, y=${transform.y}, scale=${transform.scale}`);
            // Check if rectanglee should be visible
            if (item.visible === false) {
                console.log('[DRAWING_RECTANGLE] rectangle not visible, skipping drawing');
                return;
            }
            
            // Default offsets to 0 if not specified
            const xOffset = parseFloat(item.xOffset || 0);
            const yOffset = parseFloat(item.yOffset || 0);
            
            // Default sizes to 1 if not specified
            let xSize = parseFloat(item.xSize);
            let ySize = parseFloat(item.ySize);
            
            // Get the centered flag
            const centered = item.centered === 'true' || item.centered === true;
            
            console.log(`[DRAWING_RECTANGLE] Rectangle original properties: xOffset=${xOffset}, yOffset=${yOffset}, xSize=${xSize}, ySize=${ySize}, centered=${centered}`);
            
            const transformedXOffset = xOffset*transform.scale;
            const transformedYOffset = yOffset*transform.scale;
            const transformedXSize = xSize*transform.scale;
            const transformedYSize = ySize*transform.scale;
            
            console.log(`[DRAWING_RECTANGLE] Rectangle dimensions  xOffset=${transformedXOffset}, yOffset=${transformedYOffset}, xSize=${transformedXSize}, ySize=${transformedYSize}`);
            
            // Calculate the starting point (top-left) and dimensions based on rectangle properties
            let startX, startY, width, height;
            
            // If centered is true, negative values result in the same drawing as positive values
            if (centered) {
                // For centered rectangles, the center point is at the transformed offset
                startX = transformedXOffset - Math.abs(transformedXSize) / 2;
                startY = transformedYOffset - Math.abs(transformedYSize) / 2;
                width = Math.abs(transformedXSize);
                height = Math.abs(transformedYSize);
                console.log(`[DRAWING_RECTANGLE] Centered rectangle: Position set to (${startX},${startY}), size set to ${width}x${height}`);
            } else {
                // For non-centered rectangles, handle negative sizes
                if (transformedXSize >= 0) {
                    startX = transformedXOffset;
                    width = transformedXSize;
                } else {
                    // Negative width - draw rectangle left from offset
                    startX = transformedXOffset + transformedXSize; // Move start point left
                    width = Math.abs(transformedXSize);
                    console.log(`[DRAWING_RECTANGLE] Negative width: Position adjusted to x=${startX}, width=${width}`);
                }
                
                if (transformedYSize >= 0) {
                    startY = transformedYOffset;
                    height = transformedYSize;
                } else {
                    // Negative height - draw rectangle up from offset
                    startY = transformedYOffset + transformedYSize; // Move start point up
                    height = Math.abs(transformedYSize);
                    console.log(`[DRAWING_RECTANGLE] Negative height: Position adjusted to y=${startY}, height=${height}`);
                }
            }
            
            // Apply the translation component of the transform
            const translatedX = transform.x + startX;
            const translatedY = transform.y + startY;
            
            console.log(`[DRAWING_RECTANGLE] Rectangle after transform translation: x=${translatedX}, y=${translatedY}, width=${width}, height=${height}`);
            
            // Use the actual rectangle coordinates for drawing
            let visibleRect = {
                x: translatedX,
                y: translatedY,
                width: width,
                height: height
            };
            
            console.log(`[DRAWING_RECTANGLE] Rectangle drawing coordinates: (${visibleRect.x}, ${visibleRect.y}, ${visibleRect.width}, ${visibleRect.height})`);
            
            // Apply canvas scaling to the visible rectangle to get actual pixel coordinates
            const scaledX = visibleRect.x * this.canvas.scaleX;
            const scaledY = visibleRect.y * this.canvas.scaleY;
            const scaledWidth = visibleRect.width * this.canvas.scaleX;
            const scaledHeight = visibleRect.height * this.canvas.scaleY;
            
            console.log(`[DRAWING_RECTANGLE] Rectangle after canvas scaling: x=${scaledX}, y=${scaledY}, width=${scaledWidth}, height=${scaledHeight}`);
            
            // Round to whole pixels for sharp edges
            const roundedX = Math.round(scaledX);
            const roundedY = Math.round(scaledY);
            
            // Ensure width and height are at least 1 pixel
            const minPixelSize = 2; // Minimum size to ensure visibility
            const roundedWidth = Math.max(Math.round(scaledWidth), minPixelSize);
            const roundedHeight = Math.max(Math.round(scaledHeight), minPixelSize);
            
            console.log(`[DRAWING_RECTANGLE] Rectangle after rounding: x=${roundedX}, y=${roundedY}, width=${roundedWidth}, height=${roundedHeight}`);
            
            // Determine drawing style
            const filled = item.filled === 'true' || item.filled === true;
            console.log(`Rectangle filled: ${filled}`);
            
            // Handle rounded corners if specified
            const rounded = item.rounded === 'true' || item.rounded === true;
            console.log(`[DRAWING_RECTANGLE] Rectangle rounded: ${rounded}`);
            
            // Draw the rectangle
            if (rounded) {
                // Draw rounded rectangle
                const radius = Math.min(roundedWidth, roundedHeight) * 0.2;
                console.log(`[DRAWING_RECTANGLE] Using corner radius: ${radius}px`);
                this.drawRoundedRectangle(roundedX, roundedY, roundedWidth, roundedHeight,radius, filled);
                
            } else {
                // Draw regular rectangle
                if (filled) {
                    console.log(`[DRAWING_RECTANGLE] Filling rectangle at (${roundedX},${roundedY}) with size ${roundedWidth}x${roundedHeight}`);
                    this.ctx.fillRect(roundedX, roundedY, roundedWidth, roundedHeight);
                } else {
                    console.log(`[DRAWING_RECTANGLE] Stroking rectangle at (${roundedX},${roundedY}) with size ${roundedWidth}x${roundedHeight}`);
                    this.ctx.strokeRect(roundedX, roundedY, roundedWidth, roundedHeight);
                }
            }
            
            console.log('[DRAWING_RECTANGLE] Rectangle drawing completed');
        } catch (error) {
            console.error('[DRAWING_RECTANGLE] Error in drawRectangle:', error);
        }
    }

    // Draw a touch zone (for debugging/visualization)
    drawTouchZone(item) {
      if (typeof DEBUG === 'undefined') {
        // assume debugging
      } else {
        if ((DEBUG === false) || (DEBUG === 'false')) {
          return;
        } // continue if not false
      }
      console.log('[DRAWING_TOUCHZONE] Drawing touchZone - Raw item:', JSON.stringify(item));
        
      const rect = this.canvas.getBoundingClientRect();
      let minTouch_mm = 9;
      let minPercent = 2/100;
      let colPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4); // half 9mm to add to both sides
      let rowPixelsHalf9mm = (96 * minTouch_mm) / (2 * 25.4);
      if ((rect.width * minPercent) > colPixelsHalf9mm) {
        colPixelsHalf9mm = rect.width * minPercent;
      }
      if ((rect.height * minPercent) > rowPixelsHalf9mm) {
        rowPixelsHalf9mm = rect.height * minPercent;
      }
      console.log(`[REDRAW_TOUCHZONE]: enlarge by ${colPixelsHalf9mm} x ${rowPixelsHalf9mm}`);
      console.log(`[REDRAW_TOUCHZONE] touchZone: canvas ${rect.width} x ${rect.height}`);
        
        try {
            
            // Get the transform from the item (or use default if not present)
            // default for test-modules.html use only
            const transform = item.transform ? {...item.transform} : { x: 0, y: 0, scale: 1.0 };
            console.log(`[DRAWING_TOUCHZONE] drawTouchZone: using transform - x=${transform.x}, y=${transform.y}, scale=${transform.scale}`);
            // Check if touchZone should be visible
            if (item.visible === false) {
                console.log('[DRAWING_TOUCHZONE] TouchZone not visible, skipping drawing');
                return;
            }
            
            // Default offsets to 0 if not specified
            const xOffset = parseFloat(item.xOffset || 0);
            const yOffset = parseFloat(item.yOffset || 0);
            
            // Default sizes to 1 if not specified
            let xSize = parseFloat(item.xSize || 1);
            let ySize = parseFloat(item.ySize || 1);
            
            // Get the centered flag
            const centered = item.centered === 'true' || item.centered === true;
            
            console.log(`[DRAWING_TOUCHZONE] TouchZone original properties: xOffset=${xOffset}, yOffset=${yOffset}, xSize=${xSize}, ySize=${ySize}, centered=${centered}`);
                       
            const transformedXOffset = xOffset*transform.scale;
            const transformedYOffset = yOffset*transform.scale;
            const transformedXSize = xSize*transform.scale;
            const transformedYSize = ySize*transform.scale;
            
            console.log(`[DRAWING_TOUCHZONE] TouchZone after transform scale: xOffset=${transformedXOffset}, yOffset=${transformedYOffset}, xSize=${transformedXSize}, ySize=${transformedYSize}`);
            
            // Calculate the starting point (top-left) and dimensions based on touchZone properties
            let startX, startY, width, height;
            
            // If centered is true, negative values result in the same drawing as positive values
            if (centered) {
                // For centered touchZones, the center point is at the transformed offset
                startX = transformedXOffset - Math.abs(transformedXSize) / 2;
                startY = transformedYOffset - Math.abs(transformedYSize) / 2;
                width = Math.abs(transformedXSize);
                height = Math.abs(transformedYSize);
                console.log(`[DRAWING_TOUCHZONE] Centered touchZone: Position set to (${startX},${startY}), size set to ${width}x${height}`);
            } else {
                // For non-centered touchZones, handle negative sizes
                if (transformedXSize >= 0) {
                    startX = transformedXOffset;
                    width = transformedXSize;
                } else {
                    // Negative width - draw touchZone left from offset
                    startX = transformedXOffset + transformedXSize; // Move start point left
                    width = Math.abs(transformedXSize);
                    console.log(`[DRAWING_TOUCHZONE] Negative width: Position adjusted to x=${startX}, width=${width}`);
                }
                
                if (transformedYSize >= 0) {
                    startY = transformedYOffset;
                    height = transformedYSize;
                } else {
                    // Negative height - draw touchZone up from offset
                    startY = transformedYOffset + transformedYSize; // Move start point up
                    height = Math.abs(transformedYSize);
                    console.log(`[DRAWING_TOUCHZONE] Negative height: Position adjusted to y=${startY}, height=${height}`);
                }
            }
            
            // Apply the translation component of the transform
            const translatedX = transform.x + startX;
            const translatedY = transform.y + startY;
            
            console.log(`[DRAWING_TOUCHZONE] TouchZone after transform translation: x=${translatedX}, y=${translatedY}, width=${width}, height=${height}`);
            
            // Apply canvas scaling to get actual pixel coordinates
            let scaledX = translatedX * this.canvas.scaleX;
            let scaledY = translatedY * this.canvas.scaleY;
            let scaledWidth = width * this.canvas.scaleX;
            let scaledHeight = height * this.canvas.scaleY;
            // add extra  colPixelsHalf9mm,  rowPixelsHalf9mm
            let extra_scaledX = scaledX -colPixelsHalf9mm;
            let extra_scaledY = scaledY - rowPixelsHalf9mm;
            let extra_scaledWidth = scaledWidth + 2 * colPixelsHalf9mm;
            let extra_scaledHeight = scaledHeight + 2 * rowPixelsHalf9mm;
            console.log(`[DRAWING_TOUCHZONE] TouchZone after canvas scaling: x=${scaledX}, y=${scaledY}, width=${scaledWidth}, height=${scaledHeight}`);
            
            // Round to whole pixels for sharp edges
            const roundedX = Math.round(scaledX);
            const roundedY = Math.round(scaledY);
            const minPixelSize = 2; // Minimum size to ensure visibility
            const roundedWidth = Math.max(Math.round(scaledWidth), minPixelSize);
            const roundedHeight = Math.max(Math.round(scaledHeight), minPixelSize);
            
            // Round to whole pixels for sharp edges
            const extra_roundedX = Math.round(extra_scaledX);
            const extra_roundedY = Math.round(extra_scaledY);
            const extra_roundedWidth = Math.max(Math.round(extra_scaledWidth), minPixelSize);
            const extra_roundedHeight = Math.max(Math.round(extra_scaledHeight), minPixelSize);
            
            console.log(`[DRAWING_TOUCHZONE] TouchZone after rounding: x=${roundedX}, y=${roundedY}, width=${roundedWidth}, height=${roundedHeight}`);
            
            // Store original styles
            const originalStroke = this.ctx.strokeStyle;
            const originalFill = this.ctx.fillStyle;
            const originalFont = this.ctx.font;
            const originalTextAlign = this.ctx.textAlign;
            const originalTextBaseline = this.ctx.textBaseline;
            const originalLineWidth = this.ctx.lineWidth;
            const originalLineDash = this.ctx.setLineDash;
            
            // Set touchZone-specific style
            this.ctx.strokeStyle = 'rgba(0, 128, 255, 0.7)';
          //  this.ctx.lineWidth = 2;
            
            // Draw touchZone as dashed rectangle
            this.ctx.beginPath();
            this.ctx.setLineDash([5, 3]); // 5px dash, 3px gap
            this.ctx.strokeRect(roundedX, roundedY, roundedWidth, roundedHeight);
            this.ctx.beginPath();
            const doubleLinePixels = -2; // draw line inside
            this.ctx.strokeRect(roundedX-doubleLinePixels, roundedY-doubleLinePixels, roundedWidth+2*doubleLinePixels, roundedHeight+2*doubleLinePixels);
          //  this.ctx.strokeRect(extra_roundedX, extra_roundedY, extra_roundedWidth, extra_roundedHeight);
            
            this.ctx.setLineDash([]); // Reset to solid line
//            this.ctx.beginPath();
//            this.ctx.strokeRect(roundedX, roundedY, roundedWidth, roundedHeight);
            
//            console.log(`[DRAWING_TOUCHZONE] TouchZone item `, JSON.stringify(item,null,2));
//            console.log(`[DRAWING_TOUCHZONE] TouchZone item.cmdName ${item.cmdName}`);
//            console.log(`[DRAWING_TOUCHZONE] TouchZone item.cmd ${item.cmd}`);

            // Draw command text if present
                this.ctx.fillStyle = 'rgba(0, 128, 255, 0.7)';
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'top'; //'middle';
            if (item.cmdName !== undefined) {
                this.ctx.fillText(item.cmdName, roundedX + roundedWidth / 2, roundedY + 5);
            } else {
                this.ctx.fillText(item.cmd, roundedX + roundedWidth / 2, roundedY + 5);
            }  
                // Draw filter text if present
                if (item.filter !== undefined) {
                    const filterText = `f:${item.filter}`;
                    this.ctx.font = '16px Arial';
                    this.ctx.textAlign = 'left';
                    this.ctx.textBaseline = 'top';
                    this.ctx.fillText(filterText, roundedX + 5, roundedY + 5);
                }
                
                // Draw idx text if present
                let idxText;
                if ((item.idx !== undefined) && (item.idx > 0)) {
                    if (item.idxName !== undefined) {
                      idxText = `i:${item.idxName}`;
                    } else {
                     idxText = `i:${item.idx}`;
                    }                  
                    this.ctx.font = '10px Arial';
                    this.ctx.textAlign = 'right';
                    this.ctx.textBaseline = 'top';
                    this.ctx.fillText(idxText, roundedX + roundedWidth - 5, roundedY + 5);
                }
           
            
            // Restore original styles
            this.ctx.strokeStyle = originalStroke;
            this.ctx.fillStyle = originalFill;
            this.ctx.font = originalFont;
            this.ctx.textAlign = originalTextAlign;
            this.ctx.textBaseline = originalTextBaseline;
            this.ctx.lineWidth = originalLineWidth;
            this.ctx.setLineDash = originalLineDash;


            
            console.log('[DRAWING_TOUCHZONE] TouchZone drawing completed');
        } catch (error) {
            console.error('[DRAWING_TOUCHZONE] Error in drawTouchZone:', error);
        }
    }

    // Draw a circle
    drawCircle(item) {
        console.log('[DRAWING_CIRCLE] Drawing circle - Raw item:', JSON.stringify(item));

        // Check if circle should be visible
        if (item.visible === false) {
            console.log('[DRAWING_CIRCLE] Circle not visible, skipping drawing');
            return;
        }

        try {
            const transform = item.transform || { x: 0, y: 0, scale: 1.0 };
            const xOffset = parseFloat(item.xOffset || 0);
            const yOffset = parseFloat(item.yOffset || 0);
            const radius = parseFloat(item.radius || 1);
            const filled = item.filled === 'true' || item.filled === true;

            console.log(`[DRAWING_CIRCLE] Circle properties: xOffset=${xOffset}, yOffset=${yOffset}, radius=${radius}, filled=${filled}`);

            // Apply transform to position and radius
            const transformedX = (xOffset * transform.scale) + transform.x;
            const transformedY = (yOffset * transform.scale) + transform.y;
            const transformedRadius = radius * transform.scale;

            console.log(`[DRAWING_CIRCLE] Circle after transform: center=(${transformedX}, ${transformedY}), radius=${transformedRadius}`);

            // Apply canvas scaling
            const canvasX = transformedX * this.canvas.scaleX;
            const canvasY = transformedY * this.canvas.scaleY;
            const canvasRadius = transformedRadius * this.canvas.scaleX;

            console.log(`[DRAWING_CIRCLE] Circle after canvas scaling: center=(${canvasX}, ${canvasY}), radius=${canvasRadius}`);

            // Draw the circle
            this.ctx.beginPath();
            this.ctx.arc(canvasX, canvasY, canvasRadius, 0, 2 * Math.PI);

            if (filled) {
                console.log(`[DRAWING_CIRCLE] Filling circle at (${canvasX}, ${canvasY}) with radius ${canvasRadius}`);
                this.ctx.fill();
            } else {
                console.log(`[DRAWING_CIRCLE] Stroking circle at (${canvasX}, ${canvasY}) with radius ${canvasRadius}`);
                this.ctx.stroke();
            }

            console.log('[DRAWING_CIRCLE] Circle drawing completed');
        } catch (error) {
            console.error('[DRAWING_CIRCLE] Error in drawCircle:', error);
        }
    }

    // Draw an arc
    drawArc(item) {
        console.log('[DRAWING_ARC] Drawing arc - Raw item:', JSON.stringify(item));

        // Check if arc should be visible
        if (item.visible === false) {
            console.log('[DRAWING_ARC] Arc not visible, skipping drawing');
            return;
        }

        try {
            const transform = item.transform || { x: 0, y: 0, scale: 1.0 };
            const xOffset = parseFloat(item.xOffset || 0);
            const yOffset = parseFloat(item.yOffset || 0);
            const radius = parseFloat(item.radius || 1);
            const filled = item.filled === 'true' || item.filled === true;
            const startDegrees = -parseFloat(item.start || 0); // angles go anti-clockwise
            const angleDegrees = parseFloat(item.angle || 90);

            console.log(`[DRAWING_ARC] Arc properties: xOffset=${xOffset}, yOffset=${yOffset}, radius=${radius}, filled=${filled}, start=${startDegrees}°, angle=${angleDegrees}°`);

            // Convert degrees to radians
            // Note: Canvas uses radians where 0 is 3 o'clock, positive is clockwise
            // The specification says +ve is anti-clockwise, -ve is clockwise
            // So we need to negate the angles to match the specification
            const startRadians = (startDegrees * Math.PI) / 180;
            const endRadians = startRadians - ((angleDegrees * Math.PI) / 180);
            const anticlockwise = angleDegrees < 0; // +ve angle = anti-clockwise in specification

            console.log(`[DRAWING_ARC] Arc angles: start=${startRadians}rad, end=${endRadians}rad, anticlockwise=${anticlockwise}`);

            // Apply transform to position and radius
            const transformedX = (xOffset * transform.scale) + transform.x;
            const transformedY = (yOffset * transform.scale) + transform.y;
            const transformedRadius = radius * transform.scale;

            console.log(`[DRAWING_ARC] Arc after transform: center=(${transformedX}, ${transformedY}), radius=${transformedRadius}`);

            // Apply canvas scaling
            const canvasX = transformedX * this.canvas.scaleX;
            const canvasY = transformedY * this.canvas.scaleY;
            const canvasRadius = transformedRadius * this.canvas.scaleX;

            console.log(`[DRAWING_ARC] Arc after canvas scaling: center=(${canvasX}, ${canvasY}), radius=${canvasRadius}`);

            // Draw the arc
            this.ctx.beginPath();
                // For filled arcs, draw from center to create a pie slice
            this.ctx.moveTo(canvasX, canvasY);
            this.ctx.arc(canvasX, canvasY, canvasRadius, startRadians, endRadians, !anticlockwise);
            this.ctx.closePath();
            if (filled) {
                console.log(`[DRAWING_ARC] Filling arc pie slice at (${canvasX}, ${canvasY}) with radius ${canvasRadius}`);
                this.ctx.fill();
            }
            this.ctx.stroke();
            console.log('[DRAWING_ARC] Arc drawing completed');
        } catch (error) {
            console.error('[DRAWING_ARC] Error in drawArc:', error);
        }
    }
}

// Export as global for browser compatibility
window.Redraw = Redraw;