/*   
   displayTextUtils.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// Utility functions for display text formatting
// Extracted from add-item.js and redraw.js to be reusable across server and client code

// JavaScript implementation of printFloatDecimals based on C++ version
// prints just number rounded to decPlaces, -ve decPlaces round to left of decimal point
function printFloatDecimals(f, decPlaces) {
    if (f === undefined || f === null) {
        return '';
    }
    
    let isNegative = false;
    if (f < 0) {
        f = -f;
        isNegative = true;
    }
    
    let result = '';
    
    if (decPlaces <= 0) {
        let iValue = Math.floor(f);
        if ((f - iValue) !== 0) {
            // round
            iValue = Math.floor(f + 0.5);
        }
        
        if (decPlaces === 0) {
            result = iValue.toString();
        } else {
            // decPlaces < 0
            // limit divider to be < number so always get something
            let divider = 1;
            for (let i = 0; i < (-decPlaces) && (divider < iValue); i++) {
                divider = divider * 10;
            }
            if (divider > iValue) {
                divider = Math.floor(divider / 10);
            }
            let idValue = Math.floor(iValue / divider) * divider;
            if ((idValue - iValue) !== 0) {
                // need to round
                iValue = iValue + Math.floor(divider / 2);
                iValue = Math.floor(iValue / divider);
                idValue = iValue * divider;
            }
            result = idValue.toString();
        }
    } else {
        // decPlaces > 0
        result = f.toFixed(decPlaces);
    }
    
    return isNegative ? '-' + result : result;
}

// Utility function to add formatted value to text (used by labels)
// Returns the text with formatted value and units appended if value exists
function addFormattedValueToText(text, item) {
    if (item.value !== undefined && item.value !== null && item.value !== '') {
        const decimals = (item.decimals !== undefined && item.decimals !== null) ? parseInt(item.decimals) : 2;
        const units = item.units || '';
        const formattedValue = printFloatDecimals(parseFloat(item.value), decimals);
        return text + formattedValue + units;
    }
    return text;
}

function generateItemDisplayText(item) {
    if (item.type === 'label') {
        // Label text generation: text + formatted value + units (if value exists)
        const text = item.text || '';
        return addFormattedValueToText(text, item);
    } else if (item.type === 'value') {
        // Value text generation: text + scaled/formatted intValue + units
        const textPrefix = item.text || '';
        const intValue = parseFloat(item.intValue || 0);
        const max = parseFloat(item.max || 1);
        const min = parseFloat(item.min || 0);
        const displayMax = parseFloat(item.displayMax || 1.0);
        const displayMin = parseFloat(item.displayMin || 0.0);
        const decimals = (item.decimals !== undefined && item.decimals !== null) ? parseInt(item.decimals) : 2;
        const units = item.units || '';
        
        // Scale the value (same logic as pfodWebMouse)
        let maxMin = max - min;
        if (maxMin === 0) maxMin = 1;  // Prevent division by zero
        const scaledValue = (intValue - min) * (displayMax - displayMin) / maxMin + displayMin;
        
        // Format and combine
        const formattedValue = printFloatDecimals(scaledValue, decimals);
        const displayText = textPrefix + formattedValue + units;
        
        return displayText;
    } else {
        // For other item types, just return the basic text
        return item.text || item.textFormat || '';
    }
}

// Font size calculation for touchActionInput dialogs
// fontSize 0 = 14px for dialog boxes, with baseFontSize = 14
function getActualFontSizeForDialog(relativeFontSize) {
    const baseFontSize = 14;
    const factor = 1.1225;
    
    // Ensure we have an integer
    const intFontSize = Math.round(relativeFontSize);
    
    if (intFontSize === 0) {
        return baseFontSize; // 14px
    } else if (intFontSize > 0) {
        return baseFontSize * Math.pow(factor, intFontSize);
    } else {
        return baseFontSize / Math.pow(factor, Math.abs(intFontSize));
    }
}

// Color conversion function for touchActionInput dialogs
// Converts color index to hex color value
function convertColorToHex(colorIndex) {
    // Check if colorUtils is available and has the conversion function
    if (typeof getColorValue === 'function') {
        return getColorValue(colorIndex);
    }
    
    // Fallback color mapping for basic colors
    const colorMap = {
        0: '#000000',   // Black
        1: '#800000',   // Maroon
        2: '#008000',   // Green
        3: '#808000',   // Olive
        4: '#000080',   // Navy
        5: '#800080',   // Purple
        6: '#008080',   // Teal
        7: '#C0C0C0',   // Silver
        8: '#808080',   // Gray
        9: '#FF0000',   // Red
        10: '#00FF00',  // Lime
        11: '#FFFF00',  // Yellow
        12: '#0000FF',  // Blue
        13: '#FF00FF',  // Fuchsia
        14: '#00FFFF',  // Aqua
        15: '#FFFFFF'   // White
    };
    
    return colorMap[colorIndex] || '#000000';
}

// Export for browser (client-side) - no longer needed server-side
if (typeof window !== 'undefined') {
    window.printFloatDecimals = printFloatDecimals;
    window.addFormattedValueToText = addFormattedValueToText;
    window.generateItemDisplayText = generateItemDisplayText;
    window.getActualFontSizeForDialog = getActualFontSizeForDialog;
    window.convertColorToHex = convertColorToHex;
}