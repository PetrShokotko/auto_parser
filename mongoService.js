
// // mongoService.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

// Формируем строку подключения с использованием переменных окружения
const uri = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Функция для подключения к базе данных
async function connectToDatabase() {
    try {
        await client.connect();
        const database = client.db(process.env.MONGO_DB);
        const carsCollection = database.collection('cars');
        const sellersCollection = database.collection('sellersNumbers');
        return { carsCollection, sellersCollection };
    } catch (err) {
        console.error('Ошибка подключения к базе данных:', err);
        throw err;
    }
}

// Функция для добавления или обновления данных автомобиля
async function addOrUpdateCar(carData) {
    const { carsCollection } = await connectToDatabase();

    if (!carData.vin || carData.vin === "не указан") {
        console.log(`Автомобиль с VIN 'не указан' пропущен.`);
        return;
    }

    const existingCar = await carsCollection.findOne({ vin: carData.vin });

    if (existingCar) {
        const ad = existingCar.ads.find(ad => ad.id === carData.ads[0].id);
        if (ad) {
            const currentDate = new Date().toLocaleString();
            if (ad.price !== carData.ads[0].price) {
                ad.priceHistory = ad.priceHistory || [];
                ad.priceHistory.push({
                    oldValue: ad.price,
                    newValue: carData.ads[0].price,
                    dateChanges: currentDate
                });
                ad.price = carData.ads[0].price;
            }
        } else {
            existingCar.ads.push(carData.ads[0]);
        }
        await carsCollection.updateOne({ vin: carData.vin }, { $set: existingCar });
    } else {
        await carsCollection.insertOne(carData);
    }
}

// Функция для добавления или обновления данных продавца
async function addOrUpdateSellerNumbers(sellerData) {
    const { sellersCollection } = await connectToDatabase();

    const existingSeller = await sellersCollection.findOne({ phone: sellerData.phone });

    if (existingSeller) {
        existingSeller.phone2 = sellerData.phone2 || existingSeller.phone2;
        existingSeller.phone3 = sellerData.phone3 || existingSeller.phone3;

        sellerData.carAd.forEach(newAd => {
            const existingAd = existingSeller.carAd.find(ad => ad.id === newAd.id || ad.url === newAd.url);
            if (existingAd) {
                Object.assign(existingAd, newAd);
            } else {
                existingSeller.carAd.push(newAd);
            }
        });
        await sellersCollection.updateOne({ phone: sellerData.phone }, { $set: existingSeller });
    } else {
        await sellersCollection.insertOne(sellerData);
    }
}

// Экспорт функций
module.exports = {
    addOrUpdateCar,
    addOrUpdateSellerNumbers
};