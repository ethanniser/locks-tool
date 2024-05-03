:: Save the current directory
set "original_dir=%cd%"

:: Change to the directory of the batch file
cd /d "%~dp0"

:: Perform your operations here
cd ..
:: %* passes all arguments to the next command
bun run index.ts %*

:: Return to the original directory
cd /d "%original_dir%"