require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const zipper = require('zip-local');
const fsExtra = require('fs-extra');
const axios = require('axios');

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const bot = new TelegramBot(TOKEN, { webHook: {PORT, HOST} });

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
    "reply_markup": { "keyboard": [["Получить"]] }
};

const hiddenKeyboard = {
    "reply_markup": {"remove_keyboard": true }
};

function cleanFolders() {
    fsExtra.emptyDirSync(bmpDir);
    fsExtra.emptyDirSync(jpgDir);
    fsExtra.emptyDirSync(zipDir);
}

bot.onText(/^(?!.*(Получить))/, msg => { 
    bot.sendMessage(msg.chat.id, 'Пришли мне BMP скриншоты, и я конвентирую их в JPG! Можешь также прислать скриншоты в ZIP архиве');
});

bot.on('photo', msg => {
    bot.sendMessage(msg.chat.id, 'Пожалуйста загрузи изображение без сжатия');
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
            bot.sendMessage(msg.chat.id, `Скриншот ${fileName} успешно конвентирован и добавлен в архив. Отправляй ещё, или получи уже готовое`, keyboard);
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
        bot.sendMessage(msg.chat.id, 'К сожалению я работаю только с ZIP архивами', hiddenKeyboard);
    }
});

bot.onText(/Получить/, async msg => {
    zipper.sync.zip(jpgDir).save(docFullPath);
    await bot.sendDocument(msg.from.id, docFullPath, hiddenKeyboard);
    cleanFolders();
});
