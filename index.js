const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const zipper = require('zip-local');
const fsExtra = require('fs-extra');
const axios = require('axios');
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const BMP_FOLDER = './bmp';
const JPG_FOLDER = './jpg';
const ZIP_FOLDER = './zip';

if (!fs.existsSync(BMP_FOLDER)) fs.mkdirSync(BMP_FOLDER);
if (!fs.existsSync(JPG_FOLDER)) fs.mkdirSync(JPG_FOLDER);
if (!fs.existsSync(ZIP_FOLDER)) fs.mkdirSync(ZIP_FOLDER);

const bmpDir = path.resolve(BMP_FOLDER);
const jpgDir = path.resolve(JPG_FOLDER);
const zipDir = path.resolve(ZIP_FOLDER);

let isProcessing = false;

function isEmpty(path) {
    return fs.readdirSync(path).length === 0;
}

const keyboard = {
    "reply_markup": { "keyboard": [["Download"]] }
};

const hiddenKeyboard = {
    "reply_markup": {"remove_keyboard": true }
};

bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, 'Hello. Send me BMP screenshots and I will send you a ZIP archive of JPG images');
});

bot.on('photo', msg => {
    bot.sendMessage(msg.chat.id, 'Please send an image as a document');
});

bot.on('document', async msg => {
    const doc = msg.document;
    const file = await bot.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
   
    if (doc.mime_type === 'image/bmp') {
        const fileName = path.parse(doc.file_name).name;
        const destPath = path.join(jpgDir, `${fileName}.jpg`);
        isProcessing = true;
        //bot.sendMessage(msg.chat.id, 'Starting convertation');
        Jimp.read(fileUrl).then(image => {
            image.quality(85).write(destPath);
            isProcessing = false;
            bot.sendMessage(msg.chat.id, 'Convertation finished, you can either send a new image for convertation, or download the current', keyboard);
        })
    } 
    else if (doc.mime_type === 'application/zip') {
        bot.sendMessage(msg.chat.id, 'Starting convertation', hiddenKeyboard);
        const archive = await axios.get(fileUrl, {
            headers: { Accept: 'application/zip' },
            responseType: 'arraybuffer',
        });
        const archivePath = path.resolve(zipDir, 'bmp.zip');
        fs.writeFile(archivePath, archive.data, e => {
            if (e) throw e;
            zipper.sync.unzip(archivePath).save(bmpDir);
            fsExtra.emptyDirSync(zipDir);

            //convert unpacked
            fs.readdir(bmpDir, (err, files) => {
                if (err) throw err;
                const jimpProcesses = [];
                files.forEach(file => {
                    let filePath = path.resolve(bmpDir, file);
                    let destPath = path.join(jpgDir, path.parse(file).name);
                    jimpProcesses.push(Jimp.read(filePath).then(image => image.quality(90).write(`${destPath}.jpg`)))
                });
                Promise.all(jimpProcesses).then(() => setTimeout(async () => {
                    const docPath = path.resolve(zipDir, 'jpg.zip'); //dublicated
                    zipper.sync.zip(jpgDir).save(docPath);
                    await bot.sendDocument(msg.from.id, docPath);
                    fsExtra.emptyDirSync(bmpDir)
                    fsExtra.emptyDirSync(jpgDir)
                }, 500))
            })
        });
    }
});

bot.onText(/Download/, async msg => {
    const docPath = path.resolve(zipDir, 'jpg.zip'); //dubpicated
    if (isEmpty(jpgDir) && !isProcessing) {
        bot.sendMessage(msg.chat.id, 'Nothing to download yet', hiddenKeyboard);
    }
    if (isProcessing) {
        bot.sendMessage(msg.chat.id, 'Please wait, convertation is in progress', hiddenKeyboard);
    }
    if (!isEmpty(jpgDir) && !isProcessing) {
       zipper.sync.zip(jpgDir).save(docPath);
       await bot.sendDocument(msg.from.id, docPath, hiddenKeyboard);
       fsExtra.emptyDirSync(bmpDir);
       fsExtra.emptyDirSync(zipDir);
       fsExtra.emptyDirSync(jpgDir);
    }
});
