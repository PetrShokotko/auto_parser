const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@datascraperauto.78jwr.mongodb.net/?retryWrites=true&w=majority`;

let client;

async function connectToMongo() {
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
    }
    return client;
}

async function saveSellerData(sellerData) {
    try {
        const client = await connectToMongo();
        const db = client.db('car_Sellers_Numbers');
        const collection = db.collection('sellersnumbers');

        const existingSeller = await collection.findOne({ phone: sellerData.phone });

        if (existingSeller) {
            sellerData.carAd.forEach(newAd => {
                let existingAd = existingSeller.carAd.find(ad => ad.vin === newAd.vin || ad.id === newAd.id || ad.url === newAd.url);

                if (existingAd) {
                    Object.assign(existingAd, newAd);
                } else {
                    existingSeller.carAd.push(newAd);
                }
            });

            await collection.updateOne({ phone: sellerData.phone }, { $set: existingSeller });
        } else {
            await collection.insertOne(sellerData);
        }

    } catch (error) {
        console.error('Ошибка при сохранении данных продавца:', error);
    }
}

async function saveCarData(carData) {
    try {
        const client = await connectToMongo();
        const db = client.db('car_VIN_Base'); // База данных для автомобилей
        const collection = db.collection('cars'); // Коллекция для машин

        // Проверяем наличие VIN, если его нет - пропускаем
        if (!carData.vin || carData.vin === "не указан") {
            console.log('Пропуск автомобиля без VIN');
            return;
        }

        // Ищем автомобиль с таким VIN в базе данных
        const existingCar = await collection.findOne({ vin: carData.vin });

        if (existingCar) {
            // Проверка, есть ли объявление с таким же ID или URL
            const existingAd = existingCar.ads.find(ad => ad.id === carData.ads[0].id || ad.link === carData.ads[0].link);

            if (existingAd) {
                // Если объявление существует, проверяем, изменилась ли цена
                if (existingAd.price !== carData.ads[0].price) {
                    existingAd.priceHistory = existingAd.priceHistory || [];
                    existingAd.priceHistory.push({
                        oldValue: existingAd.price,
                        newValue: carData.ads[0].price,
                        dateChanges: carData.ads[0].date,
                    });
                    existingAd.price = carData.ads[0].price; // Обновляем текущую цену
                }
            } else {
                // Если объявление с таким ID или URL еще не добавлено, добавляем его в массив `ads`
                existingCar.ads.push(carData.ads[0]);
            }

            // Обновляем информацию о машине с новым объявлением или измененной ценой
            await collection.updateOne({ vin: carData.vin }, { $set: existingCar });
        } else {
            // Если VIN не найден в базе, добавляем новый автомобиль и его объявление
            await collection.insertOne(carData);
        }

    } catch (error) {
        console.error('Ошибка при сохранении данных автомобиля:', error);
    }
}

module.exports = { saveSellerData, saveCarData };
// const { MongoClient } = require('mongodb');
// require('dotenv').config();  // Для использования переменных окружения

// const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@datascraperauto.78jwr.mongodb.net/?retryWrites=true&w=majority`;

// let client;

// async function connectToMongo() {
//     if (!client) {
//         client = new MongoClient(uri); // Убираем параметры useNewUrlParser и useUnifiedTopology
//         await client.connect();
//     }
//     return client;
// }

// async function saveSellerData(sellerData) {
//     try {
//         const client = await connectToMongo();
//         const db = client.db('car_Sellers_Numbers');  // База данных
//         const collection = db.collection('sellersnumbers');  // Коллекция для номеров продавцов

//         // Сначала проверяем наличие продавца по номеру телефона
//         const existingSeller = await collection.findOne({ phone: sellerData.phone });

//         if (existingSeller) {
//             // Продавец существует, проверяем его объявления
//             sellerData.carAd.forEach(newAd => {
//                 let existingAd = null;

//                 // Проверяем наличие объявления по VIN, если он указан
//                 if (newAd.vin && newAd.vin !== "не указан") {
//                     existingAd = existingSeller.carAd.find(ad => ad.vin === newAd.vin);
//                 }

//                 // Если VIN не указан, проверяем по URL или ID
//                 if (!existingAd && (!newAd.vin || newAd.vin === "не указан")) {
//                     existingAd = existingSeller.carAd.find(ad => ad.id === newAd.id || ad.url === newAd.url);
//                 }

//                 if (existingAd) {
//                     // Объявление уже существует, обновляем его данные
//                     Object.assign(existingAd, newAd);
//                 } else {
//                     // Если объявления нет, добавляем новое в массив carAd
//                     existingSeller.carAd.push(newAd);
//                 }
//             });

//             // Обновляем данные продавца в базе
//             await collection.updateOne(
//                 { phone: sellerData.phone },
//                 { $set: existingSeller }
//             );

//             console.log('Данные продавца обновлены');
//         } else {
//             // Если продавец не найден, добавляем новый объект в базу данных
//             await collection.insertOne(sellerData);

//             console.log('Продавец и его объявления добавлены');
//         }

//     } catch (error) {
//         console.error('Ошибка при сохранении данных продавца:', error);
//     }
// }

// module.exports = { saveSellerData };