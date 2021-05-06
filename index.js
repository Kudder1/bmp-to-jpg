require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const zipper = require('zip-local');
const fsExtra = require('fs-extra');
const axios = require('axios');

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
const docFullPath = path.resolve(zipDir, 'jpg.zip');

const keyboard = {
    "reply_markup": { "keyboard": [["Download"]] }
};

const hiddenKeyboard = {
    "reply_markup": {"remove_keyboard": true }
};

function cleanFolders() {
    fsExtra.emptyDirSync(bmpDir);
    fsExtra.emptyDirSync(jpgDir);
    fsExtra.emptyDirSync(zipDir);
}

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
        Jimp.read(fileUrl).then(image => {
            image.quality(85).write(destPath);
            bot.sendMessage(msg.chat.id, 'Convertation finished, you can either send a new image, or download the current', keyboard);
        })
    } 
    else if (doc.mime_type === 'application/zip') {
        const archive = await axios.get(fileUrl, {
            headers: { Accept: 'application/zip' },
            responseType: 'arraybuffer',
        });
        const archivePath = path.resolve(zipDir, 'bmp.zip');
        fs.writeFile(archivePath, archive.data, e => {
            if (e) throw e;
            zipper.sync.unzip(archivePath).save(bmpDir);
          
            fs.readdir(bmpDir, (err, files) => {
                if (err) throw err;
                const jimpProcesses = [];
                files.forEach(file => {
                    let filePath = path.resolve(bmpDir, file);
                    let destPath = path.join(jpgDir, path.parse(file).name);
                    jimpProcesses.push(Jimp.read(filePath).then(image => image.quality(90).write(`${destPath}.jpg`)))
                });
                Promise.all(jimpProcesses).then(() => setTimeout(async () => {
                    zipper.sync.zip(jpgDir).save(docFullPath);
                    await bot.sendDocument(msg.from.id, docFullPath);
                    cleanFolders()
                }, 500))
            })
        });
    }
    else if (doc.mime_type.includes('7z') || doc.mime_type.includes('rar')) {
        bot.sendMessage(msg.chat.id, 'Sorry, only ZIP archives allowed', hiddenKeyboard);
    }
});

bot.onText(/Download/, async msg => {
    zipper.sync.zip(jpgDir).save(docFullPath);
    await bot.sendDocument(msg.from.id, docFullPath, hiddenKeyboard);
    cleanFolders();
});
