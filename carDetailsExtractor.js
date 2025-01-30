const fs = require('fs');
const puppeteer = require('puppeteer');
const { extractPhoneNumbers } = require('./phoneExtractor'); // Импорт функции извлечения телефонов
const { checkPhoneNumber } = require('./check.js'); // Импорт функции проверки телефонов
const { sendTelegramNotification } = require('./telegram'); // Импорт функции отправки уведомления в Telegram
const { saveCarData, saveSellerData } = require('./mongoConnector'); // Импорт функций для работы с MongoDB
const { sendSMSorIMessage } = require('./sendMessage'); // Импорт функции для отправки сообщений
const { proposePrice } = require('./proposePrice');


// Вспомогательная функция ожидания
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для загрузки и сохранения JSON-файлов
function loadJsonFile(filePath) {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        return JSON.parse(data);
    } else {
        return [];
    }
}

function saveJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Функция загрузки JSON файла с номерами продавцов
function loadSellerNumbers(filePath) {
    return loadJsonFile(filePath);
}

function saveSellerNumbers(filePath, data) {
    saveJsonFile(filePath, data);
}

// Функции для работы с VIN и объявлениями
function findCarByVin(cars, vin) {
    return cars.find(car => car.vin === vin);
}

function findAdById(ads, adId) {
    return ads.find(ad => ad.id === adId);
}

// Получение текущей форматированной даты
function getCurrentFormattedDate() {
    return new Date().toLocaleString('ru-UA', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    });
}

// Функция для добавления или обновления данных автомобиля
function addOrUpdateCar(carData) {
    const filePath = 'carsbase.json';
    const carsBase = loadJsonFile(filePath);

    if (!carData.vin || carData.vin === "не указан") {
        console.log(`Автомобиль с VIN 'не указан' пропущен.`);
        return;
    }

    let car = findCarByVin(carsBase, carData.vin);

    if (car) {
        let ad = findAdById(car.ads, carData.ads[0].id);
        if (ad) {
            const currentDate = getCurrentFormattedDate();
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
            car.ads.push(carData.ads[0]);
        }
    } else {
        carsBase.push(carData);
    }

    saveJsonFile(filePath, carsBase);
}

// Функция для добавления или обновления информации о продавцах
function addOrUpdateSellerNumbers(sellerData) {
    const filePath = 'sellersnumbers.json';
    const sellersBase = loadSellerNumbers(filePath);

    let seller = sellersBase.find(s => s.phone === sellerData.phone);
    if (seller) {
        seller.phone2 = sellerData.phone2 || seller.phone2;
        seller.phone3 = sellerData.phone3 || seller.phone3;

        sellerData.carAd.forEach(newAd => {
            let existingAd = seller.carAd.find(ad => ad.id === newAd.id || ad.url === newAd.url);
            if (existingAd) {
                Object.assign(existingAd, newAd);
            } else {
                seller.carAd.push(newAd);
            }
        });
    } else {
        sellersBase.push(sellerData);
    }

    saveSellerNumbers(filePath, sellersBase);
}

// Основная функция для извлечения данных о машине
async function extractCarDetails(url, regionsId) {
    const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const adMatch = url.match(/auto_[\w-]+_(\d+)\.html/);
    const adId = adMatch ? adMatch[1] : 'не указан';
    const currentDate = getCurrentFormattedDate();

    const { phone1, phone2, phone3 } = await extractPhoneNumbers(page);

    const [carMakeModelYear, carInfo, vinElement, sellerInfo, transmission, driveType, bodyType] = await Promise.all([
        getCarMakeModelYear(page),
        getCarInfo(page),
        getVIN(page),
        getSellerInfo(page),
        getTransmission(page),
        getDriveType(page),
        getBodyType(page)
    ]);

    const wasDamaged = await getDamageDetails(page);
    const { make, model, year } = carMakeModelYear;
    const { engineVol, fuelType } = carInfo;
    const { sellerName, location } = sellerInfo;

    // Проверка телефона и поиск дополнительных объявлений
    const additionalData = await checkPhoneNumber(phone1); // ВАЖНО!
    const filteredData = additionalData.filter(data => data.id !== adId); // Исключаем текущее объявление

    const licensePlate = (await getTextContent(page, '.state-num.ua') || '').match(/[A-Z]{2}\s?\d{4}\s?[A-Z]{2}/)?.[0].replace(/\s+/g, '') || 'не указан';
    const mileage = await getTextContent(page, '.price.mb-15.mhide .base-information.bold span:nth-child(1)') || 'не указано';
    const priceUSD = (await getTextContent(page, '.price.mb-15.mhide .price_value strong') || 'не указана').replace(/\s+/g, '').replace(/[^0-9]/g, '') + ' $';

    try {
        console.log('Закрытие браузера после извлечения данных...');
        await browser.close(); // Закрываем браузер сразу после извлечения данных
    } catch (error) {
        console.error('Ошибка при закрытии браузера:', error);
    }

    // Собираем данные об автомобиле
    const newCarData = {
        vin: vinElement,
        brand: make,
        model: model,
        year: Number(year),
        engineVol: engineVol,
        fuelType: fuelType,
        transmission: transmission,
        driveType: driveType,
        bodyType: bodyType,
        wasDamaged: wasDamaged,
        ads: [{
            id: adId,
            licensePlate,
            link: url,
            millage: `${mileage} тис. км`,
            price: priceUSD,
            date: currentDate,
            phone: phone1,
            phone2: phone2,
            phone3: phone3,
            name: sellerName,
            location: location
        }]
    };

    // Сохраняем данные об автомобиле в MongoDB
    await saveCarData(newCarData);
    addOrUpdateCar(newCarData);

    // Собираем данные о продавце, включая другие объявления
    const sellerNumber = {
        phone: phone1,
        phone2: phone2,
        phone3: phone3,
        name: sellerName,
        location: location,
        carAd: [
            {
                vin: vinElement,
                licensePlate,
                id: adId,
                url: url,
                platform: "autoria",
                date: currentDate,
                mark: make,
                model: model,
                year: Number(year),
                price: priceUSD
            },
            ...filteredData
        ]
    };

    // Сохраняем данные о продавце в MongoDB
    await saveSellerData(sellerNumber);
    addOrUpdateSellerNumbers(sellerNumber);

    // Проверяем количество объявлений и отправляем уведомления
    const carAdCount = sellerNumber.carAd.length;
    if (carAdCount < 5) {
        const carDetails = {
            vin: vinElement || 'не указан',
            licensePlate: licensePlate || 'не указан',
            brand: make || 'не указано',
            model: model || 'не указано',
            year: Number(year) || 'не указан',
            engineVol: engineVol || 'не указан',
            fuelType: fuelType || 'не указано',
            transmission: transmission || 'не указано',
            driveType: driveType || 'не указано',
            bodyType: bodyType || 'не указано',
            price: priceUSD || 'не указана',
            mileage: mileage || 'не указан'
        };
    
        console.log('Передача данных в proposePrice:', carDetails);
        const priceDetails = await proposePrice(carDetails);
const averagePrice = priceDetails.averagePrice;
const proposePriceValue = priceDetails.proposePrice;
    
        const message = `Новый автомобильный пост:
Ссылка: ${url}
Количество объявлений: ${carAdCount}
Номер телефона: ${sellerNumber.phone}
Средняя цена: ${averagePrice}$
Предлагаемая цена: ${proposePriceValue}`;

        await sendTelegramNotification(message);

        sendSMSorIMessage(phone1, make, model, proposePriceValue);
    }

    console.log('Информация о машине:', JSON.stringify(newCarData, null, 2));
    console.log('Информация о продавце:', JSON.stringify(sellerNumber, null, 2));
    

}

const { getTextContent } = require('./utils/getTextContentExtractor.js');
const { getCarMakeModelYear } = require('./utils/getCarMakeModelYear.js');
const { getCarInfo } = require('./utils/getCarInfo.js');
const { getVIN } = require('./utils/getVIN.js');
const { getSellerInfo } = require('./utils/getSellerInfo.js');
const { getTransmission } = require('./utils/getTransmission.js');
const { getDriveType } = require('./utils/getDriveType.js');
const { getBodyType } = require('./utils/getBodyType.js');
const { getDamageDetails } = require('./utils/getDamageDetails.js');

module.exports = { extractCarDetails };


// ____________________________ Рабочий код с  GeneratePirce____________________
// const fs = require('fs');
// const puppeteer = require('puppeteer');
// const { extractPhoneNumbers } = require('./phoneExtractor'); // Импорт функции извлечения телефонов
// const { checkPhoneNumber } = require('./check.js'); // Импорт функции проверки телефонов
// const { sendTelegramNotification } = require('./telegram'); // Импорт функции отправки уведомления в Telegram
// const { saveCarData, saveSellerData } = require('./mongoConnector'); // Импорт функций для работы с MongoDB
// const { sendSMSorIMessage } = require('./sendMessage'); // Импорт функции для отправки сообщений
// const { generatePriceQuote } = require('./generatePriceQuote'); // Импорт функции генерации ценового предложения

// // Вспомогательная функция ожидания
// async function wait(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Функция для загрузки и сохранения JSON-файлов
// function loadJsonFile(filePath) {
//     if (fs.existsSync(filePath)) {
//         const data = fs.readFileSync(filePath);
//         return JSON.parse(data);
//     } else {
//         return [];
//     }
// }

// function saveJsonFile(filePath, data) {
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
// }

// // Функция загрузки JSON файла с номерами продавцов
// function loadSellerNumbers(filePath) {
//     return loadJsonFile(filePath);
// }

// function saveSellerNumbers(filePath, data) {
//     saveJsonFile(filePath, data);
// }

// // Функции для работы с VIN и объявлениями
// function findCarByVin(cars, vin) {
//     return cars.find(car => car.vin === vin);
// }

// function findAdById(ads, adId) {
//     return ads.find(ad => ad.id === adId);
// }

// // Получение текущей форматированной даты
// function getCurrentFormattedDate() {
//     return new Date().toLocaleString('ru-UA', {
//         timeZone: 'Europe/Kiev',
//         year: 'numeric',
//         month: 'numeric',
//         day: 'numeric',
//         hour: 'numeric',
//         minute: 'numeric'
//     });
// }

// // Функция для добавления или обновления данных автомобиля
// function addOrUpdateCar(carData) {
//     const filePath = 'carsbase.json';
//     const carsBase = loadJsonFile(filePath);

//     if (!carData.vin || carData.vin === "не указан") {
//         console.log(`Автомобиль с VIN 'не указан' пропущен.`);
//         return;
//     }

//     let car = findCarByVin(carsBase, carData.vin);

//     if (car) {
//         let ad = findAdById(car.ads, carData.ads[0].id);
//         if (ad) {
//             const currentDate = getCurrentFormattedDate();
//             if (ad.price !== carData.ads[0].price) {
//                 ad.priceHistory = ad.priceHistory || [];
//                 ad.priceHistory.push({
//                     oldValue: ad.price,
//                     newValue: carData.ads[0].price,
//                     dateChanges: currentDate
//                 });
//                 ad.price = carData.ads[0].price;
//             }
//         } else {
//             car.ads.push(carData.ads[0]);
//         }
//     } else {
//         carsBase.push(carData);
//     }

//     saveJsonFile(filePath, carsBase);
// }

// // Функция для добавления или обновления информации о продавцах
// function addOrUpdateSellerNumbers(sellerData) {
//     const filePath = 'sellersnumbers.json';
//     const sellersBase = loadSellerNumbers(filePath);

//     let seller = sellersBase.find(s => s.phone === sellerData.phone);
//     if (seller) {
//         seller.phone2 = sellerData.phone2 || seller.phone2;
//         seller.phone3 = sellerData.phone3 || seller.phone3;

//         sellerData.carAd.forEach(newAd => {
//             let existingAd = seller.carAd.find(ad => ad.id === newAd.id || ad.url === newAd.url);
//             if (existingAd) {
//                 Object.assign(existingAd, newAd);
//             } else {
//                 seller.carAd.push(newAd);
//             }
//         });
//     } else {
//         sellersBase.push(sellerData);
//     }

//     saveSellerNumbers(filePath, sellersBase);
// }

// // Основная функция для извлечения данных о машине
// async function extractCarDetails(url, regionsId) {
//     const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

//     const adMatch = url.match(/auto_[\w-]+_(\d+)\.html/);
//     const adId = adMatch ? adMatch[1] : 'не указан';
//     const currentDate = getCurrentFormattedDate();

//     const { phone1, phone2, phone3 } = await extractPhoneNumbers(page);

//     const [carMakeModelYear, carInfo, vinElement, sellerInfo, transmission, driveType, bodyType] = await Promise.all([
//         getCarMakeModelYear(page),
//         getCarInfo(page),
//         getVIN(page),
//         getSellerInfo(page),
//         getTransmission(page),
//         getDriveType(page),
//         getBodyType(page)
//     ]);

//     const wasDamaged = await getDamageDetails(page);
//     const { make, model, year } = carMakeModelYear;
//     const { engineVol, fuelType } = carInfo;
//     const { sellerName, location } = sellerInfo;

//     // Проверка телефона и поиск дополнительных объявлений
//     const additionalData = await checkPhoneNumber(phone1); // ВАЖНО!
//     const filteredData = additionalData.filter(data => data.id !== adId); // Исключаем текущее объявление

//     const licensePlate = (await getTextContent(page, '.state-num.ua') || '').match(/[A-Z]{2}\s?\d{4}\s?[A-Z]{2}/)?.[0].replace(/\s+/g, '') || 'не указан';
//     const mileage = await getTextContent(page, '.price.mb-15.mhide .base-information.bold span:nth-child(1)') || 'не указано';
//     const priceUSD = (await getTextContent(page, '.price.mb-15.mhide .price_value strong') || 'не указана').replace(/\s+/g, '').replace(/[^0-9]/g, '') + ' $';

//     // Собираем данные об автомобиле
//     const newCarData = {
//         vin: vinElement,
//         brand: make,
//         model: model,
//         year: Number(year),
//         engineVol: engineVol,
//         fuelType: fuelType,
//         transmission: transmission,
//         driveType: driveType,
//         bodyType: bodyType,
//         wasDamaged: wasDamaged,
//         ads: [{
//             id: adId,
//             licensePlate,
//             link: url,
//             millage: `${mileage} тис. км`,
//             price: priceUSD,
//             date: currentDate,
//             phone: phone1,
//             phone2: phone2,
//             phone3: phone3,
//             name: sellerName,
//             location: location
//         }]
//     };
//     await saveCarData(newCarData); // Сохраняем в MongoDB
//     addOrUpdateCar(newCarData);

//     // Собираем данные о продавце, включая другие объявления
//     const sellerNumber = {
//         phone: phone1,
//         phone2: phone2,
//         phone3: phone3,
//         name: sellerName,
//         location: location,
//         carAd: [
//             {
//                 vin: vinElement,
//                 licensePlate,
//                 id: adId,
//                 url: url,
//                 platform: "autoria",
//                 date: currentDate,
//                 mark: make,
//                 model: model,
//                 year: Number(year),
//                 price: priceUSD
//             },
//             ...filteredData
//         ]
//     };

//     await saveSellerData(sellerNumber); // Сохраняем в MongoDB
//     addOrUpdateSellerNumbers(sellerNumber);

//     const carAdCount = sellerNumber.carAd.length;

//     if (carAdCount < 3) {
//         const priceData = await generatePriceQuote(
//             make,
//             model,
//             priceUSD,
//             fuelType,
//             transmission,
//             driveType,
//             bodyType,
//             year,
//             mileage,
//             engineVol,
//             location,
//             wasDamaged
//         );

//         const proposePrice = priceData.proposePrice;

//         const message = `Новый автомобильный пост:
// Ссылка: ${url}
// Количество объявлений: ${carAdCount}
// Номер телефона: ${sellerNumber.phone}
// Предлагаемая цена: ${proposePrice}`;
//         await sendTelegramNotification(message);

//         sendSMSorIMessage(phone1, make, model, proposePrice, true);
//     }

//     console.log('Информация о машине:', JSON.stringify(newCarData, null, 2));
//     // console.log('Информация о продавце:', JSON.stringify(sellerNumber, null, 2));

//     await browser.close();
// }

// // Вспомогательные функции
// const { getTextContent } = require('./utils/getTextContentExtractor.js');
// const { getCarMakeModelYear } = require('./utils/getCarMakeModelYear.js');
// const { getCarInfo } = require('./utils/getCarInfo.js');
// const { getVIN } = require('./utils/getVIN.js');
// const { getSellerInfo } = require('./utils/getSellerInfo.js');
// const { getTransmission } = require('./utils/getTransmission.js');
// const { getDriveType } = require('./utils/getDriveType.js');
// const { getBodyType } = require('./utils/getBodyType.js');
// const { getDamageDetails } = require('./utils/getDamageDetails.js');

// module.exports = { extractCarDetails };




// _________________________________(без последовательности)___________________________
// const fs = require('fs');
// const puppeteer = require('puppeteer');
// const { extractPhoneNumbers } = require('./phoneExtractor'); // Импорт функции извлечения телефонов
// const { checkPhoneNumber } = require('./check.js'); // Импорт функции проверки телефонов
// const { sendTelegramNotification } = require('./telegram'); // Импорт функции отправки уведомления в Telegram
// const { saveCarData, saveSellerData } = require('./mongoConnector'); // Импорт функций для работы с MongoDB
// const { sendSMSorIMessage } = require('./sendMessage');
// const { generatePriceQuote } = require('./generatePriceQuote');


// // Вспомогательная функция ожидания
// async function wait(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// // Функция для загрузки и сохранения JSON-файлов
// function loadJsonFile(filePath) {
//     if (fs.existsSync(filePath)) {
//         const data = fs.readFileSync(filePath);
//         return JSON.parse(data);
//     } else {
//         return [];
//     }
// }

// function saveJsonFile(filePath, data) {
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
// }

// // Функция загрузки JSON файла с номерами продавцов
// function loadSellerNumbers(filePath) {
//     if (fs.existsSync(filePath)) {
//         const data = fs.readFileSync(filePath);
//         return JSON.parse(data);
//     } else {
//         return [];
//     }
// }

// // Функция сохранения JSON файла с номерами продавцов
// function saveSellerNumbers(filePath, data) {
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
// }

// // Функция для поиска VIN в базе данных
// function findCarByVin(cars, vin) {
//     return cars.find(car => car.vin === vin);
// }

// // Функция для поиска объявления по ID
// function findAdById(ads, adId) {
//     return ads.find(ad => ad.id === adId);
// }

// // Функция для получения текущей форматированной даты
// function getCurrentFormattedDate() {
//     return new Date().toLocaleString('ru-UA', {
//         timeZone: 'Europe/Kiev',
//         year: 'numeric',
//         month: 'numeric',
//         day: 'numeric',
//         hour: 'numeric',
//         minute: 'numeric'
//     });
// }

// // Основная функция для добавления или обновления данных автомобиля
// function addOrUpdateCar(carData) {
//     const filePath = 'carsbase.json';
//     const carsBase = loadJsonFile(filePath);

//     // Пропускаем автомобили без VIN
//     if (!carData.vin || carData.vin === "не указан") {
//         console.log(`Автомобиль с VIN 'не указан' пропущен.`);
//         return;
//     }

//     let car = findCarByVin(carsBase, carData.vin);

//     // Если VIN уже есть в базе
//     if (car) {
//         let ad = findAdById(car.ads, carData.ads[0].id);

//         if (ad) {
//             const currentDate = getCurrentFormattedDate();

//             // Проверяем изменения цены
//             if (ad.price !== carData.ads[0].price) {
//                 if (!ad.priceHistory) {
//                     ad.priceHistory = [];
//                 }
//                 ad.priceHistory.push({
//                     oldValue: ad.price,
//                     newValue: carData.ads[0].price,
//                     dateChanges: currentDate
//                 });
//                 ad.price = carData.ads[0].price;
//             }
//         } else {
//             // Добавляем новое объявление
//             car.ads.push(carData.ads[0]);
//         }
//     } else {
//         // Если VIN нет, добавляем новый объект
//         carsBase.push(carData);
//     }

//     saveJsonFile(filePath, carsBase);
// }

// // Основная функция для добавления/обновления информации о продавцах и их номерах телефонов
// function addOrUpdateSellerNumbers(sellerData) {
//     const filePath = 'sellersnumbers.json';
//     const sellersBase = loadSellerNumbers(filePath);

//     let seller = sellersBase.find(s => s.phone === sellerData.phone);

//     if (seller) {
//         seller.phone2 = sellerData.phone2 || seller.phone2;
//         seller.phone3 = sellerData.phone3 || seller.phone3;

//         sellerData.carAd.forEach(newAd => {
//             let existingAd = seller.carAd.find(ad => ad.id === newAd.id || ad.url === newAd.url);
//             if (existingAd) {
//                 // Если объявление уже существует, обновляем его
//                 Object.assign(existingAd, newAd);
//             } else {
//                 // Если объявления нет, добавляем его как уникальное
//                 seller.carAd.push(newAd);
//             }
//         });
//     } else {
//         // Если продавца не существует, добавляем его полностью
//         sellersBase.push(sellerData);
//     }

//     saveSellerNumbers(filePath, sellersBase);
// }

// async function extractCarDetails(url, regionsId) {
//     const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

//     const adMatch = url.match(/auto_[\w-]+_(\d+)\.html/);
//     const adId = adMatch ? adMatch[1] : 'не указан';
//     const currentDate = getCurrentFormattedDate();

//     const { phone1, phone2, phone3 } = await extractPhoneNumbers(page);

//     const [carMakeModelYear, carInfo, vinElement, sellerInfo, transmission, driveType, bodyType] = await Promise.all([
//         getCarMakeModelYear(page),
//         getCarInfo(page),
//         getVIN(page),
//         getSellerInfo(page),
//         getTransmission(page),
//         getDriveType(page),
//         getBodyType(page)
//     ]);
//     const wasDamaged = await getDamageDetails(page);

//     const { make, model, year } = carMakeModelYear;
//     const { engineVol, fuelType } = carInfo;
//     const { sellerName, location } = sellerInfo;

//     const additionalData = await checkPhoneNumber(phone1);
//     const filteredData = additionalData.filter(data => data.id !== adId);

//     const licensePlate = (await getTextContent(page, '.state-num.ua') || '').match(/[A-Z]{2}\s?\d{4}\s?[A-Z]{2}/)?.[0].replace(/\s+/g, '') || 'не указан';
//     const mileage = await getTextContent(page, '.price.mb-15.mhide .base-information.bold span:nth-child(1)') || 'не указано';
//     const priceUSD = (await getTextContent(page, '.price.mb-15.mhide .price_value strong') || 'не указана').replace(/\s+/g, '').replace(/[^0-9]/g, '') + ' $';


//     const newCarData = {
//         vin: vinElement,
//         brand: make,
//         model: model,
//         year: Number(year),
//         engineVol: engineVol,
//         fuelType: fuelType,
//         transmission: transmission,
//         driveType: driveType,
//         bodyType: bodyType,
//         wasDamaged: wasDamaged,
//         ads: [{
//             id: adId,
//             licensePlate,
//             link: url,
//             millage: `${mileage} тис. км`,
//             price: priceUSD,
//             date: currentDate,
//             phone: phone1,
//             phone2: phone2,
//             phone3: phone3,
//             name: sellerName,
//             location: location
//         }]
//     };
//     await saveCarData(newCarData); // Сохраняем в MongoDB

//     addOrUpdateCar(newCarData);

//     const sellerNumber = [{
//         phone: phone1,
//         phone2: phone2,
//         phone3: phone3,
//         name: sellerName,
//         location: location,
//         carAd: [{
//             vin: vinElement,
//             licensePlate: licensePlate,
//             id: adId,
//             url: url,
//             platform: "autoria",
//             date: currentDate,
//             mark: make,
//             model: model,
//             year: Number(year),
//             price: `${priceUSD}`
//         }, ...filteredData]
//     }];

//     console.log('Данные для сохранения в MongoDB (продавец):', JSON.stringify(sellerNumber, null, 2));
//     await saveSellerData(sellerNumber[0]);

//     addOrUpdateSellerNumbers(sellerNumber[0]);
//     const carAdCount = sellerNumber[0].carAd.length;

//     if (carAdCount < 3) {
//         generatePriceQuote(
//             make, 
//             model, 
//             priceUSD, 
//             fuelType,        // тип топлива
//             transmission,    // коробка передач
//             driveType,       // тип привода
//             bodyType,        // тип кузова
//             year,            // год
//             mileage,         // пробег
//             engineVol,       // объём двигателя
//             location,         // местоположение
//             wasDamaged
//         );
//         const message = `Новый автомобильный пост от ${sellerNumber[0].phone} (тел: ${phone1}). Всего объявлений: ${carAdCount}. Подробности: ${url}`;
//         await sendTelegramNotification(message);
    
//         // Отправка SMS/iMessage с данными об автомобиле
//         sendSMSorIMessage(phone1, make, model, priceUSD, true); // true для тестового режима
//     }
//     // const carAdCount = sellerNumber[0].carAd.length;

//     // if (carAdCount < 3) {
//     //     const message = `Новый автомобильный пост от ${sellerName} (тел: ${phone1}). Всего объявлений: ${carAdCount}. Подробности: ${url}`;
//     //     await sendTelegramNotification(message);
//     // }

//     console.log('Информация о машине:');
//     console.log(JSON.stringify(newCarData, null, 2));

//     console.log('Информация о продавце:');
//     console.log(JSON.stringify(sellerNumber, null, 2));

//     await browser.close();
// }

// // Вспомогательные функции для получения данных автомобиля и продавца
// const { getTextContent } = require('./utils/getTextContentExtractor.js');
// const { getCarMakeModelYear } = require('./utils/getCarMakeModelYear.js');
// const { getCarInfo } = require('./utils/getCarInfo.js');
// const { getVIN } = require('./utils/getVIN.js');
// const { getSellerInfo } = require('./utils/getSellerInfo.js');
// const { getTransmission } = require('./utils/getTransmission.js');
// const { getDriveType } = require('./utils/getDriveType.js');
// const { getBodyType } = require('./utils/getBodyType.js');
// const { getDamageDetails } = require('./utils/getDamageDetails.js');

// module.exports = { extractCarDetails };
//____________________________Внизу рабочий КОД(без добавлния в базу carsbase________________________
// const puppeteer = require('puppeteer');
// const { extractPhoneNumbers } = require('./phoneExtractor'); // Импорт функции извлечения телефонов
// const { checkPhoneNumber } = require('./check.js'); // Импорт функции проверки телефонов
// const { sendTelegramNotification } = require('./telegram'); // Импорт функции отправки уведомления в Telegram

// // Вспомогательная функция ожидания
// async function wait(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// async function extractCarDetails(url) {
//     const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

//     const adMatch = url.match(/auto_[\w-]+_(\d+)\.html/);
//     const adId = adMatch ? adMatch[1] : 'не указан';

//     const currentDate = new Date().toLocaleString('ru-UA', {
//         timeZone: 'Europe/Kiev',
//         year: 'numeric',
//         month: 'numeric',
//         day: 'numeric'
//     });

//     // Извлекаем номера телефонов параллельно
//     const { phone1, phone2, phone3 } = await extractPhoneNumbers(page);

//     // Параллельное извлечение данных об автомобиле
//     const [carMakeModelYear, carInfo, vinElement, sellerInfo, transmission, driveType] = await Promise.all([
//         getCarMakeModelYear(page), // Извлекает марку, модель и год
//         getCarInfo(page),          // Извлекает информацию о двигателе и типе топлива
//         getVIN(page),              // Извлекает VIN код
//         getSellerInfo(page),       // Извлекает информацию о продавце и местоположении
//         getTransmission(page),     // Извлекает тип трансмиссии
//         getDriveType(page)         // Извлекает тип привода
//     ]);

//     // Распаковка данных из результата функций
//     const { make, model, year } = carMakeModelYear;
//     const { engineVol, fuelType } = carInfo;
//     const { sellerName, location } = sellerInfo;

//     // Проверка номера телефона
//     const additionalData = await checkPhoneNumber(phone1);
//     const filteredData = additionalData.filter(data => data.id !== adId);

//     // Извлечение дополнительных данных
//     const licensePlate = (await getTextContent(page, '.state-num.ua') || '').match(/[A-Z]{2}\s?\d{4}\s?[A-Z]{2}/)?.[0].replace(/\s+/g, '') || 'не указан';
//     const mileage = await getTextContent(page, '.price.mb-15.mhide .base-information.bold span:nth-child(1)') || 'не указано';
//     const priceUSD = (await getTextContent(page, '.price.mb-15.mhide .price_value strong') || 'не указана').replace(/\s+/g, '').replace(/[^0-9]/g, '') + ' $';

//     // Формирование массива cars
//     const cars = [{
//         vin: vinElement,
//         brand: make,
//         model: model,
//         year: Number(year),
//         engineVol: engineVol,
//         fuelType: fuelType,
//         transmission: transmission,
//         driveType: driveType,
//         ads: [{
//             id: adId,
//             licensePlate,
//             link: url,
//             millage: `${mileage} тис. км`,
//             price: priceUSD,
//             date: currentDate,
//             phone: phone1,
//             phone2: phone2,
//             phone3: phone3,
//             name: sellerName,
//             location: location
//         }]
//     }];

//     // Формирование массива sellerNumber
//     const sellerNumber = [{
//         phone: phone1,
//         phone2: phone2,
//         phone3: phone3,
//         name: sellerName,
//         location: location,
//         carAd: [{
//             vin: vinElement,
//             licensePlate: licensePlate,
//             id: adId,
//             url: url,
//             platform: "autoria",
//             date: currentDate,
//             mark: make,
//             model: model,
//             year: Number(year),
//             price: `${priceUSD}`
//         }, ...filteredData]
//     }];

//     // Проверка количества объявлений у продавца
//     const carAdCount = sellerNumber[0].carAd.length;

//     // Если количество объявлений меньше 3, отправить уведомление в Telegram
//     if (carAdCount < 3) {
//         const message = `Новый автомобильный пост от ${sellerName} (тел: ${phone1}). Всего объявлений: ${carAdCount}. Подробности: ${url}`;
//         await sendTelegramNotification(message);
//     }

//     console.log('Информация о машине:');
//     console.log(JSON.stringify(cars, null, 2));

//     console.log('Информация о продавце:');
//     console.log(JSON.stringify(sellerNumber, null, 2));

//     await browser.close();
// }

// // Вспомогательная функция для извлечения текстового контента по селектору
// const getTextContent = async (page, selector) => {
//     try {
//         return await page.$eval(selector, el => el.textContent.trim());
//     } catch (error) {
//         return null;
//     }
// };

// // Функция для извлечения марки, модели и года автомобиля
// const getCarMakeModelYear = async (page) => {
//     let makeModelYear = await getTextContent(page, '.heading h1.head') || 'не указано';
//     const makeModelMatch = makeModelYear.match(/^(.*)\s(\d{4})$/);

//     let make = 'не указано';
//     let model = 'не указано';
//     let year = 'не указан';

//     if (makeModelMatch) {
//         make = makeModelMatch[1].split(' ')[0] || 'не указано';
//         model = makeModelMatch[1].split(' ').slice(1).join(' ') || 'не указано';
//         year = makeModelMatch[2];
//     }

//     return { make, model, year };
// };

// // Функция для извлечения информации о двигателе и типе топлива
// async function getCarInfo(page) {
//     return await page.evaluate(() => {
//         let engineVol = null;
//         let fuelType = null;

//         const detailsElements = document.querySelectorAll('dd');
//         detailsElements.forEach((element) => {
//             if (element.textContent.includes('Двигун')) {
//                 const argumentSpan = element.querySelector('span.argument');
//                 if (argumentSpan) {
//                     const textContent = argumentSpan.textContent.trim();
//                     const engineMatch = textContent.match(/(\d+(\.\d+)?)\s*л/);
//                     if (engineMatch) {
//                         engineVol = engineMatch[1];
//                     }
//                 }
//             }
//         });

//         if (!engineVol) {
//             engineVol = 'не указан';
//         } else {
//             if (engineVol.includes('.')) {
//                 engineVol = parseFloat(engineVol).toFixed(1);
//             } else {
//                 engineVol = `${engineVol}.0`;
//             }
//         }

//         detailsElements.forEach((element) => {
//             if (element.textContent.includes('Двигун')) {
//                 const argumentSpan = element.querySelector('span.argument');
//                 if (argumentSpan) {
//                     const clonedArgumentSpan = argumentSpan.cloneNode(true);
//                     const orangeElements = clonedArgumentSpan.querySelectorAll('.orange');
//                     orangeElements.forEach((orangeElement) => orangeElement.remove());

//                     const textContent = clonedArgumentSpan.textContent.trim();
//                     let fuelMatch = textContent.split('•');
//                     if (fuelMatch.length > 1) {
//                         fuelType = fuelMatch[1].trim();
//                     } else {
//                         fuelType = textContent;
//                     }

//                     fuelType = fuelType.trim();
//                 }
//             }
//         });

//         if (!fuelType) {
//             fuelType = 'не указан';
//         }

//         return { engineVol, fuelType };
//     });
// }

// // Функция для извлечения VIN автомобиля
// const getVIN = async (page) => {
//     try {
//         let vin = await getTextContent(page, '.label-vin');
//         if (vin && /x{4}/.test(vin)) return 'не указан';
//         if (vin) return vin;

//         vin = await page.evaluate(() => {
//             const vinElement = document.querySelector('.vin-code');
//             return vinElement ? vinElement.textContent.trim() : null;
//         });

//         if (vin && /x{4}/.test(vin)) return 'не указан';

//         return vin || 'не указан';
//     } catch (error) {
//         console.error('Ошибка при получении VIN кода:', error);
//         return 'не указан';
//     }
// };

// // Функция для извлечения информации о продавце и его местоположении
// const getSellerInfo = async (page) => {
//     try {
//         let sellerName = await page.evaluate(() => {
//             const h4SellerNameElement = document.querySelector('h4.seller_info_name a');
            
//             if (!h4SellerNameElement) {
//                 const sellerNameElement = document.querySelector('.seller_info_name.bold') || 
//                                           document.querySelector('.seller_info .bold');
//                 return sellerNameElement ? sellerNameElement.textContent.trim() : null;
//             }

//             return h4SellerNameElement.textContent.trim();
//         });

//         if (!sellerName) sellerName = 'не указан';

//         let location = await page.evaluate(() => {
//             const breadcrumbsElement = document.querySelector('#breadcrumbs');
//             if (breadcrumbsElement) {
//                 const breadcrumbsText = breadcrumbsElement.textContent.trim();
//                 const match = breadcrumbsText.match(/(?:[A-Za-zА-Яа-я]+)\s+(?:[A-Za-zА-Яа-я]+)\s+(.+)/);
//                 return match ? match[1].trim() : null;
//             }
//             return null;
//         });

//         if (!location) {
//             location = await page.evaluate(() => {
//                 const locationElement = document.querySelector('#userInfoBlock li.item .item_inner');
//                 return locationElement ? locationElement.textContent.trim() : null;
//             });
//         }

//         if (!location) location = 'не указан';

//         return { sellerName, location };
//     } catch (error) {
//         console.error('Ошибка при получении информации о продавце и местоположении:', error);
//         return { sellerName: 'не указан', location: 'не указан' };
//     }
// };

// // Функция для извлечения типа трансмиссии
// const getTransmission = async (page) => {
//     return await page.evaluate(() => {
//         const ddElements = Array.from(document.querySelectorAll('dd'));
//         const element = ddElements.find(el => el.textContent.includes('Коробка передач'));
//         return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
//     });
// };

// // Функция для извлечения типа привода
// const getDriveType = async (page) => {
//     return await page.evaluate(() => {
//         const ddElements = Array.from(document.querySelectorAll('dd'));
//         const element = ddElements.find(el => el.textContent.includes('Привід'));
//         return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
//     });
// };

// module.exports = { extractCarDetails };
//____________________________________________________________________________________________
// const puppeteer = require('puppeteer');

// async function wait(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }

// async function extractCarDetails(url) {
//     const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

//     const adId = url.match(/auto_[\w-]+_(\d+)\.html/)[1];
//     const currentDate = new Date().toLocaleString('ru-UA', {
//         timeZone: 'Europe/Kiev',
//         year: 'numeric',
//         month: 'numeric',
//         day: 'numeric'
//     });

//     const getPhoneNumber = async () => {
//         let attempts = 0;
//         const maxAttempts = 2;

//         while (attempts < maxAttempts) {
//             try {
//                 await page.waitForSelector('a.size14.phone_show_link', { visible: true, timeout: 5000 });
//                 await page.click('a.size14.phone_show_link');
//                 await wait(5000);
//                 await page.waitForSelector('span.phone.bold', { visible: true, timeout: 10000 });

//                 const phoneNumber = await page.$eval('span.phone.bold', el => el.textContent.trim().replace(/\D/g, ''));
//                 if (phoneNumber && phoneNumber.length === 10) {
//                     return phoneNumber;
//                 }
//             } catch (error) {
//                 console.error('Ошибка при получении номера телефона:', error);
//             }
//             attempts++;
//             if (attempts < maxAttempts) await wait(2000);
//         }

//         return 'не указан';
//     };

//     const getTextContent = async (selector) => {
//         try {
//             return await page.$eval(selector, el => el.textContent.trim());
//         } catch (error) {
//             return null;
//         }
//     };

//     const getCarMakeModelYear = async () => {
//         let makeModelYear = await getTextContent('.heading-cars h1.head') || 'не указано';
//         const [make, model, year] = makeModelYear.split(' ') || ['не указано', 'не указано', 'не указано'];
//         return { make, model, year: /^\d{4}$/.test(year) ? year : 'не указан' };
//     };

//     async function getCarInfo() {
//         return await page.evaluate(() => {
//             let engineVol = null;
//             let fuelType = null;

//             const engineVolumeElement = document.querySelector('h3.under-head') || document.querySelector('h4.under-head');
//             if (engineVolumeElement) {
//                 const textContent = engineVolumeElement.textContent;
//                 const engineMatch = textContent.match(/(\d+(\.\d+)?)/);
//                 engineVol = engineMatch ? engineMatch[1] : null;
//             }

//             if (!engineVol) {
//                 const detailsElements = document.querySelectorAll('dd');
//                 detailsElements.forEach((element) => {
//                     if (element.textContent.includes('Двигун')) {
//                         const argumentSpan = element.querySelector('span.argument');
//                         if (argumentSpan) {
//                             const textContent = argumentSpan.textContent.trim();
//                             const engineMatch = textContent.match(/(\d+(\.\d+)?)\s*л/);
//                             if (engineMatch) {
//                                 engineVol = engineMatch[1];
//                             }
//                         }
//                     }
//                 });
//             }

//             if (!engineVol) {
//                 engineVol = 'Не указан';
//             } else {
//                 if (engineVol.includes('.')) {
//                     engineVol = parseFloat(engineVol).toFixed(1);
//                 } else {
//                     engineVol = `${engineVol}.0`;
//                 }
//             }

//             const detailsElements = document.querySelectorAll('dd');
//             detailsElements.forEach((element) => {
//                 if (element.textContent.includes('Двигун')) {
//                     const argumentSpan = element.querySelector('span.argument');
//                     if (argumentSpan) {
//                         const clonedArgumentSpan = argumentSpan.cloneNode(true);
//                         const orangeElements = clonedArgumentSpan.querySelectorAll('.orange');
//                         orangeElements.forEach((orangeElement) => orangeElement.remove());
//                         const textContent = clonedArgumentSpan.textContent.trim();
//                         let fuelMatch = textContent.split('•');
//                         if (fuelMatch.length > 1) {
//                             fuelType = fuelMatch[1].trim();
//                         } else {
//                             fuelType = textContent;
//                         }
//                         fuelType = fuelType.trim();
//                     }
//                 }
//             });

//             return { engineVol, fuelType };
//         });
//     }

//     const getVIN = async () => {
//         try {
//             let vin = await getTextContent('.label-vin');
//             if (vin && /x{4}/.test(vin)) return 'не указан';
//             if (vin) return vin;

//             vin = await page.evaluate(() => {
//                 const vinElement = document.querySelector('.vin-code');
//                 return vinElement ? vinElement.textContent.trim() : null;
//             });

//             if (vin && /x{4}/.test(vin)) return 'не указан';

//             return vin || 'не указан';
//         } catch (error) {
//             console.error('Ошибка при получении VIN кода:', error);
//             return 'не указан';
//         }
//     };

//     const getColor = async () => {
//         try {
//             const colorElement = await page.$('.technical-info dd');
//             if (colorElement) {
//                 const labelText = await page.evaluate(el => el.querySelector('.label')?.textContent.trim(), colorElement);
//                 if (labelText && labelText.includes('Колір')) {
//                     const colorText = await page.evaluate(el => el.querySelector('.argument')?.textContent.trim(), colorElement);
//                     return colorText || 'не указан';
//                 }
//             }

//             const colorStyleElement = await page.$('.car-color');
//             if (colorStyleElement) {
//                 const colorText = await page.evaluate(el => el.nextSibling.textContent.trim(), colorStyleElement);
//                 return colorText || 'не указан';
//             }

//             return 'не указан';
//         } catch (error) {
//             console.error('Ошибка при получении цвета автомобиля:', error);
//             return 'не указан';
//         }
//     };

//     const getSellerInfo = async () => {
//         try {
//             let sellerName = await page.evaluate(() => {
//                 const sellerNameElement = document.querySelector('.seller_info_name.bold') || document.querySelector('.seller_info .bold');
//                 return sellerNameElement ? sellerNameElement.textContent.trim() : null;
//             });
    
//             if (!sellerName) sellerName = 'не указан';
    
//             let location = await page.evaluate(() => {
//                 const breadcrumbsElement = document.querySelector('#breadcrumbs');
//                 if (breadcrumbsElement) {
//                     const breadcrumbsText = breadcrumbsElement.textContent.trim();
                    
//                     const match = breadcrumbsText.match(/(?:[A-Za-zА-Яа-я]+)\s+(?:[A-Za-zА-Яа-я]+)\s+(.+)/);
//                     return match ? match[1].trim() : null;
//                 }
//                 return null;
//             });
    
//             if (!location) {
//                 location = await page.evaluate(() => {
//                     const locationElement = document.querySelector('li.item .item_inner');
//                     return locationElement ? locationElement.textContent.trim() : null;
//                 });
//             }
    
//             if (!location) location = 'не указан';
    
//             return { sellerName, location };
//         } catch (error) {
//             console.error('Ошибка при получении информации о продавце и местоположении:', error);
//             return { sellerName: 'не указан', location: 'не указан' };
//         }
//     };

//     const phoneNumber = await getPhoneNumber();
//     const { sellerName, location } = await getSellerInfo();

//     const { make, model, year } = await getCarMakeModelYear();
//     const { engineVol, fuelType } = await getCarInfo();

//     const vinElement = await getVIN();
//     const licensePlate = (await getTextContent('.state-num.ua') || '').match(/[A-Z]{2}\s?\d{4}\s?[A-Z]{2}/)?.[0].replace(/\s+/g, '') || 'не указан';
//     const color = await getColor();

//     const transmission = await page.evaluate(() => {
//         const ddElements = Array.from(document.querySelectorAll('dd'));
//         const element = ddElements.find(el => el.textContent.includes('Коробка передач'));
//         return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
//     });

//     const driveType = await page.evaluate(() => {
//         const ddElements = Array.from(document.querySelectorAll('dd'));
//         const element = ddElements.find(el => el.textContent.includes('Привід'));
//         return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
//     });

//     const mileage = await getTextContent('.price.mb-15.mhide .base-information.bold span:nth-child(1)') || 'не указано';
//     const priceUSD = (await getTextContent('.price.mb-15.mhide .price_value strong') || 'не указана').replace(/\s+/g, '').replace(/[^0-9]/g, '') + ' $';

//     const cars = [{
//         vin: vinElement,
//         brand: make,
//         model: model,
//         year: Number(year),
//         engineVol: engineVol,
//         fuelType: fuelType,
//         transmission: transmission,
//         driveType: driveType,
//         color: color,
//         ads: [{
//             id: adId,
//             licensePlate,
//             link: url,
//             millage: `${mileage} тис. км`,
//             price: priceUSD,
//             date: currentDate,
//             phone: phoneNumber,
//             name: sellerName,
//             location: location
//         }]
//     }];

//     const sellerNumber = [{
//         phone: phoneNumber,
//         name: sellerName,
//         location: location,
//         carAd: [{
//             vin: vinElement,
//             licensePlate: licensePlate,
//             id: adId,
//             url: url,
//             platform: "autoria",
//             date: currentDate,
//             mark: make,
//             model: model,
//             year: Number(year),
//             price: `${priceUSD} USD`
//         }]
//     }];

//     console.log('Информация о машине:');
//     console.log(JSON.stringify(cars, null, 2));

//     console.log('Информация о продавце:');
//     console.log(JSON.stringify(sellerNumber, null, 2));

//     await browser.close();
// }

// module.exports = { extractCarDetails };

// _______________________________________
// const puppeteer = require('puppeteer');

// async function extractCarDetails(url) {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();
  
//   await page.goto(url, { waitUntil: 'domcontentloaded' });

//   const adId = url.match(/auto_[\w-]+_(\d+)\.html/)[1];
//   const currentDate = new Date().toLocaleString('ru-UA', {
//     timeZone: 'Europe/Kiev', 
//     year: 'numeric',
//     month: 'numeric',
//     day: 'numeric'
//   });

//   const getPhoneNumber = async () => {
//     try {
//       const showPhoneLink = await page.$('.size14.phone_show_link.link-dotted.mhide');
//       if (showPhoneLink) {
//         await showPhoneLink.click();
//         await page.waitForSelector('#openCallMeBack .popup-successful-call-desk[data-value]', { timeout: 5000 });
//         const phoneNumberElement = await page.$('#openCallMeBack .popup-successful-call-desk[data-value]');
//         const phoneNumber = await page.evaluate(el => el.getAttribute('data-value'), phoneNumberElement);
//         return phoneNumber ? phoneNumber.replace(/\D/g, '') : 'не указан';
//       } else {
//         console.log('Кнопка показа телефона не найдена.');
//         return 'не указан';
//       }
//     } catch (error) {
//       console.error('Ошибка при попытке получить номер телефона:', error);
//       return 'не указан';
//     }
//   };

//   const getTextContent = async (selector) => {
//     try {
//       return await page.$eval(selector, el => el.textContent.trim());
//     } catch (error) {
//       return null;
//     }
//   };

//   const getValueFromSelectors = async (selectors) => {
//     for (const selector of selectors) {
//       const value = await getTextContent(selector);
//       if (value) return value.replace(/ \(.*\)/, '');
//     }
//     return 'не указано';
//   };

//   const phoneNumber = await getPhoneNumber();
//   const location = await getValueFromSelectors([
//     '.checked-list.unstyle.mb-15 .item:nth-child(2) .item_inner',
//     '.seller_info_area .seller_info_name.grey.bold'
//   ]);
//   const sellerName = await getValueFromSelectors([
//     '.seller_info_name.grey.bold',
//     '.seller_info_name .sellerPro',
//     '.seller_info_title.grey'
//   ]);
//   const makeModelYear = await getTextContent('dd:nth-of-type(2) .argument') || '';
//   const [make, model, year] = makeModelYear.split(' ');
//   const vinElement = await getTextContent('.label-vin') || 'не указан';
//   const licensePlate = (await getTextContent('.state-num.ua') || '').match(/[A-Z]{2}\s?\d{4}\s?[A-Z]{2}/)?.[0].replace(/\s+/g, '') || 'не указан';
//   const engine = await getTextContent('dd:nth-of-type(3) .argument') || 'не указано';
//   const color = await getTextContent('dd:nth-of-type(4) .argument') || 'не указан';
//   const transmission = await page.evaluate(() => {
//     const ddElements = Array.from(document.querySelectorAll('dd'));
//     const element = ddElements.find(el => el.textContent.includes('Коробка передач'));
//     return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
//   });
//   const driveType = await page.evaluate(() => {
//     const ddElements = Array.from(document.querySelectorAll('dd'));
//     const element = ddElements.find(el => el.textContent.includes('Привід'));
//     return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
//   });
//   const mileage = await getTextContent('.price.mb-15.mhide .base-information.bold span:nth-child(1)') || 'не указано';
//   const priceUSD = await getTextContent('.price.mb-15.mhide .price_value strong') || 'не указана';

//   const cars = [
//     {
//       vin: vinElement,
//       brand: make,
//       model: model,
//       year: Number(year),
//       volume: engine,
//       transmission: transmission,
//       drive: driveType,
//       color: color,
//       ads: [
//         {
//           id: adId,
//           licensePlate,
//           link: url,
//           millage: `${mileage} тис. км`,
//           price: `${priceUSD} USD`,
//           date: currentDate,
//           phone: phoneNumber,
//           name: sellerName,
//           city: location
//         }
//       ]
//     }
//   ];

//   const sellerNumber = [
//     {
//       phone: phoneNumber,
//       name: sellerName,
//       city: location,
//       carAd: [
//         {
//           vin: vinElement,
//           licensePlate,
//           id: adId,
//           url: url,
//           date: currentDate,
//           mark: make,
//           model: model,
//           year: Number(year),
//           price: `${priceUSD} USD`,
//         }
//       ]
//     }
//   ];

//   console.log('Информация о машине:');
//   console.log(JSON.stringify(cars, null, 2));

//   console.log('Информация о продавце:');
//   console.log(JSON.stringify(sellerNumber, null, 2));

//   await browser.close();
// }

// module.exports = { extractCarDetails };