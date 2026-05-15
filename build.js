const { execSync } = require('child_process');

const fs = require('fs');

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public');
}

console.log('Building CSS...');
execSync('npx tailwindcss -i ./src/style.css -o ./public/style.css --minify', { stdio: 'inherit' });

console.log('Building JS...');
const apiKey = process.env.GEMINI_API_KEY || '';
execSync(`npx esbuild src/index.jsx --bundle --outfile=public/app.js --define:process.env.GEMINI_API_KEY="'${apiKey}'" --minify`, { stdio: 'inherit' });

console.log('Copying static assets...');
fs.copyFileSync('index.html', './public/index.html');

console.log('Build complete.');
