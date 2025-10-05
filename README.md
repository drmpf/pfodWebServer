# pfodWebServer
These are the javascript/html files needed to provide pfodWeb in a web browser. 

There are two versions of these files.  

This is the locally hosted version, ~4Mb, is designed to run on your computer and to server the javascript/html files from there with only the small pfod messages going to and from your microprocessor.
In this case no file system or storage is needed on your microprocessor. 
This locally hosted version need nodejs to be installed, but all the other necessary npm packages are included in the 4Mb code package. 
No additional downloads are required. Once you have install nodejs, you can run pfodWeb on a completely isolated network with no internet access.  

Removing the node-modules sub-directory gives the minimal version, ~500Kb, that is designed to be loaded into your microprocessor's file system and served from there.
In that case no third party packages or code are used and you can run on a completely isolated network with no internet access.


# How-To
See [pfodWeb Installation and Tutorials](https://www.forward.com.au/pfod/pfodWeb/index.html)  

# Security and Privacy
pfodWeb when served from your microprocessor, does not use any third party code and does not require any internet access so you can run on a completely isolated network.  
When pfodWebServer is installed on your computer, it requires nodejs and other npm packages to be installed. 
The zip file of this release contains all the additional package so no additional downloads are required.  

Of the compromised npm packages, only the debug package is used here and the version supplied here is V4.4.1 which is prior to the version compromised.
See [How Safe is pfodWeb, pfodWebServer and pfodWebDesigner](https://www.forward.com.au/pfod/pfodWeb/index.html#safe)  

If you want to do a clean download of the npm packages, **not recommended**, then delete the package-lock.json file and the node_modules sub-directory and run one of the pfodWebServer_install... batch files

# Software License
(c)2014-2025 Forward Computing and Control Pty. Ltd.  
NSW Australia, www.forward.com.au  
This code is not warranted to be fit for any purpose. You may only use it at your own risk.  
This code may be freely used for both private and commercial use  
Provide this copyright is maintained.  

# Revisions
Version 1.1.5 used gzip files to reduce microprocessor file storage requirements  
Version 1.1.3 drawing updates as response received and included dependent node packages and removed package install script from batch files  
Version 1.1.2 fixed hiding of touchActionInput labels  
Version 1.1.1 fixed loss of idx on edit  
Version 1.1.0 fix hide/unhide and other general improvements  
Version 1.0.2 fix for drag touchActions  
Version 1.0.1 fix for debug display and mainmenu updates  
Version 1.0.0 initial release  

