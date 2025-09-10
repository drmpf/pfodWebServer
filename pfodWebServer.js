const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from current directory
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => {
    console.log(`pfodWebServer running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});