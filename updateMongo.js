const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Конфигурация подключения к MongoDB
const mongoUser = encodeURIComponent("shokotkop");
const mongoPassword = encodeURIComponent("9Q6ydWf7JMSumWgK");
const mongoDb = "carDatabase";
const mongoHost = "localhost";
const mongoPort = 27017;

const uri = `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDb}?authSource=admin`;

const folderPath = path.join(__dirname, 'data', 'olx-values');

async function uploadData() {
    const client = new MongoClient(uri);

    try {
        // Подключение к MongoDB
        await client.connect();
        console.log("Подключено к MongoDB");

        const db = client.db(mongoDb);

        // Получение списка файлов в папке
        const files = fs.readdirSync(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const collectionName = path.parse(file).name; // Название коллекции из имени файла

            // Чтение данных из файла
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // Сохранение данных в MongoDB
            const collection = db.collection(collectionName);
            await collection.deleteMany({}); // Очистка коллекции перед добавлением новых данных
            await collection.insertMany(Array.isArray(data) ? data : [data]);

            console.log(`Данные из ${file} успешно загружены в коллекцию ${collectionName}`);
        }

        console.log("Все данные загружены успешно.");
    } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
    } finally {
        await client.close();
    }
}

uploadData().catch(console.error);