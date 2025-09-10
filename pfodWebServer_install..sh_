#!/bin/bash
echo "Starting pfodWebServer..."
echo
echo "This will install dependencies if needed and start the server"
echo "Press Ctrl+C to stop the server when finished"
echo
#   pfodWebServer.sh
# * (c)2025 Forward Computing and Control Pty. Ltd.
# * NSW Australia, www.forward.com.au
# * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
# * This generated code may be freely used for both private and commercial use
# * provided this copyright is maintained.

cd data

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in your PATH"
    echo "Please install Node.js from https://nodejs.org/"
    echo
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error installing dependencies"
        exit 1
    fi
    echo "Dependencies installed successfully"
    echo
fi

# Ensure express is installed
echo "Checking for express..."
npm install express
if [ $? -ne 0 ]; then
    echo "Warning: Could not install express"
fi

# Start the server
echo "Starting pfodWebServer..."
echo "The server will run on port 8080 by default"
echo
echo "Once the server has started, open your browser to:"
echo "  http://localhost:8080"
echo
echo "Usage Instructions:"
echo "1. Enter a target IP address (e.g., 192.168.1.100)"
echo "2. Click 'Launch pfodWeb' for standard interface"
echo "3. Click 'Launch pfodWebDebug' for debug interface with console logging"
echo
echo "The pfodWeb interface will send menu requests to your specified IP"
echo "while serving all web files from this server."
echo

node pfodWebServer.js