const JSZip = require('jszip');
const path = require('path');
const fs = require('fs');

const plugin = path.join(__dirname, '../plugin.json');
const icon = path.join(__dirname, '../icon.png');
const readme = path.join(__dirname, '../readme.md');
const distFolder = path.join(__dirname, '../dist');
const main = path.join(distFolder, 'main.js');
const output = path.join(__dirname, '../plugin.zip');

const zip = new JSZip();

loadFiles('.', zip);
zip.file('plugin.json', fs.readFileSync(plugin));
zip.file('icon.png', fs.readFileSync(icon));
zip.file('readme.md', fs.readFileSync(readme));
zip
  .generateNodeStream({ type: 'nodebuffer', streamFiles: true })
  .pipe(fs.createWriteStream(output))
  .on('finish', () => console.log('✓ Plugin built!'));

function loadFiles(parent, zipFolderInstance) {
  fs.readdirSync(path.join(distFolder, parent)).forEach((file) => {
    const originalFilePath = path.join(distFolder, parent, file);
    const stat = fs.statSync(originalFilePath);

    if (stat.isDirectory()) {
      return loadFiles(path.join(parent, file), zipFolderInstance.folder(file));
    }

    if (!/LICENSE\.txt/.test(file)) {
      zipFolderInstance.file(file, fs.readFileSync(originalFilePath));
    }
  });
}
