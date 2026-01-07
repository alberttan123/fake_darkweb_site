# THE ORACLE
Source code for a fake darkweb website called 'The Oracle', they supposedly sell stolen/exfiltrated data.
Drawn out the expected design on paper and written the initial HTML structure; then, passed both into ChatGPT to implement functionality. 
Images and Icons generated using ChatGPT.  

# FUNCTIONALITY
The webpage is able to:
1. Filter products
2. Search products
3. Pop-up modal onclick of product tile
4. Sort product tiles  

# HOW TO USE
1. Clone the repo
2. Run the python script

# PYINSTALLER BUILD SCRIPT FOR WINDOWS
```
python -m PyInstaller --onefile --icon=logoSquare.ico ^
--add-data="main.html;." ^
--add-data="script.js;." ^
--add-data="styles.css;." ^
--add-data="products.json;." ^
--add-data="logoRectangle.png;." ^
--add-data="logoSquare.ico;." ^
server.py
```
The above makes an exe that when clicked:
1. Runs the server
2. Opens the webpage
