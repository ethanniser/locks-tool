:: Save the current directory
set "original_dir=%cd%"

:: Change to the directory of the batch file
cd /d "%~dp0"

:: Perform your operations here
cd ..
git pull

bun i

:: Return to the original directory
cd /d "%original_dir%"