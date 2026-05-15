const { execSync } = require('child_process');

console.log('Building CSS...');
execSync('npx tailwindcss -i ./src/style.css -o ./style.css --minify', { stdio: 'inherit' });

console.log('Building JS...');
const apiKey = process.env.GEMINI_API_KEY || '';
// We inject the API key. We wrap it in quotes so esbuild replaces it as a string literal.
execSync(`npx esbuild src/index.jsx --bundle --outfile=app.js --define:process.env.GEMINI_API_KEY="'${apiKey}'" --minify`, { stdio: 'inherit' });

console.log('Build complete.');
