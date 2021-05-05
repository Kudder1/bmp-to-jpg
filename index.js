const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const zipper = require('zip-local');
const fsExtra = require('fs-extra')

const JPG_FOLDER = './jpg';
const ZIP_FOLDER = './zip';

if (!fs.existsSync(JPG_FOLDER)) fs.mkdirSync(JPG_FOLDER)
if (!fs.existsSync(ZIP_FOLDER)) fs.mkdirSync(ZIP_FOLDER)

const bmpDir = path.resolve('./bmp');
const jpgDir = path.resolve(JPG_FOLDER);
const zipDir = path.resolve(ZIP_FOLDER);

fs.readdir(bmpDir, (err, files) => {
    if (err) throw err;
    const jimpProcesses = [];
    files.forEach(file => {
        let filePath = path.resolve(bmpDir, file);
        let destPath = path.join(jpgDir, path.parse(file).name);
        jimpProcesses.push(Jimp.read(filePath).then(image => image.quality(90).write(`${destPath}.jpg`)))
    });
    Promise.all(jimpProcesses).then(() => setTimeout(() => {
        zipper.sync.zip(jpgDir).save(path.resolve(zipDir, 'jpg.zip'));
        fsExtra.emptyDirSync(bmpDir)
        fsExtra.emptyDirSync(jpgDir)
    }, 500))
})
