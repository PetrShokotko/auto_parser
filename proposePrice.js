const fs = require('fs');
const puppeteer = require('puppeteer');
const URLSearchParams = require('url').URLSearchParams;

// Загружаем JSON файлы
const valueIdAuto = JSON.parse(fs.readFileSync('./data/ria-values/value_id_auto.json'));
const bodyTypes = JSON.parse(fs.readFileSync('./data/ria-values/body_types.json'));
const driveTypes = JSON.parse(fs.readFileSync('./data/ria-values/drive_types.json'));
const fuelTypes = JSON.parse(fs.readFileSync('./data/ria-values/fuel_types.json'));
const gearboxTypes = JSON.parse(fs.readFileSync('./data/ria-values/gearbox_types.json'));

// Функции для обработки данных
const validateVinOrLicensePlate = (vin, licensePlate) => {
    if (vin && vin.length === 17) return vin;
    if (licensePlate && licensePlate.length === 8) return licensePlate;
    return null;
};

const findBrandId = (brandName) => {
    const brand = valueIdAuto.find(b => b.name === brandName);
    return brand ? brand.id : null;
};

const findModelId = (brandName, modelName) => {
    const brand = valueIdAuto.find(b => b.name === brandName);
    if (brand) {
        const model = brand.models.find(m => m.name === modelName);
        return model ? model.id : null;
    }
    return null;
};

const findIdByName = (data, keyName, searchValue) => {
    const foundItem = data.find(item => item[keyName] === searchValue);
    return foundItem ? foundItem.id : '0';
};

const parseMileage = (mileage) => {
    const numericMileage = parseInt(mileage.replace(/[^\d]/g, ''), 10);
    return isNaN(numericMileage) ? null : numericMileage;
};

const calculateMileageRange = (mileage) => ({
    lowerBound: Math.max(0, mileage - 10),
    upperBound: mileage + 10
});

const roundDownToHundred = (price) => Math.floor(price / 100) * 100;

const calculateProposePrice = (averagePrice) => {
    let proposePrice;
    if (averagePrice <= 5000) {
        proposePrice = averagePrice - 700;
    } else if (averagePrice > 5000 && averagePrice <= 9000) {
        proposePrice = averagePrice - 1000;
    } else {
        proposePrice = averagePrice - 1500;
    }
    return roundDownToHundred(proposePrice);
};

// Основная функция
async function proposePrice(carInfo) {
    console.log('Полученные данные о машине:', carInfo);

    carInfo.mileage = parseMileage(carInfo.mileage);
    if (carInfo.mileage === null) {
        console.error('Некорректный пробег.');
        return null;
    }

    const validOmniId = validateVinOrLicensePlate(carInfo.vin, carInfo.licensePlate);
    let finalUrl;

    if (validOmniId) {
        finalUrl = `https://auto.ria.com/uk/price/average/?currentTab=byOmniId&omniId=${validOmniId}`;
    } else {
        const brandId = findBrandId(carInfo.brand);
        const modelId = findModelId(carInfo.brand, carInfo.model);

        if (!brandId || !modelId) {
            console.error('Ошибка: Не удалось найти ID для марки или модели автомобиля.');
            return null;
        }

        const { lowerBound, upperBound } = calculateMileageRange(carInfo.mileage);

        const urlParams = {
            currentTab: 'byParams',
            categoryId: '1',
            brandId,
            modelId,
            'year.gte': carInfo.year,
            'year.lte': carInfo.year,
            'mileage.gte': lowerBound,
            'mileage.lte': upperBound,
            fuelId: findIdByName(fuelTypes, 'name', carInfo.fuelType),
            'engineVolume.gte': carInfo.engineVol,
            'engineVolume.lte': carInfo.engineVol,
            gearBoxId: findIdByName(gearboxTypes, 'name', carInfo.transmission),
            driveId: findIdByName(driveTypes, 'type', carInfo.driveType),
            bodyId: findIdByName(bodyTypes, 'name', carInfo.bodyType)
        };

        const queryParams = new URLSearchParams(urlParams);
        finalUrl = `https://auto.ria.com/uk/price/average/?${queryParams.toString()}`;
    }

    console.log(`Сгенерированная ссылка: ${finalUrl}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const maxRetries = 2; // Максимальное количество попыток
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
        try {
            await page.goto(finalUrl, { waitUntil: 'networkidle2' });

            // Установка периода "за последний месяц"
            const selectHandle = await page.evaluateHandle(() => {
                const xpath = "//div[contains(@class, 'head-item')]//select[contains(@class, 'item select grey')]";
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                return result.singleNodeValue;
            });

            if (selectHandle) {
                await page.evaluate(select => {
                    select.value = "30"; // Устанавливаем выбор периода за последний месяц
                    select.dispatchEvent(new Event('change', { bubbles: true })); // Генерируем событие изменения
                }, selectHandle);

                // Задержка для обновления
                await new Promise(resolve => setTimeout(resolve, 1500)); // Задержка на обновление данных
            } else {
                console.error("Не удалось найти выпадающий список.");
            }

            // Извлечение средней цены
            const priceSelector = 'div.item.average div.bold.green.size40';
            await page.waitForSelector(priceSelector, { timeout: 2500 });
            const updatedPrice = await page.$eval(priceSelector, el => el.innerText.trim());
            const averagePrice = parseFloat(updatedPrice.replace(/\s|\$/g, ''));

            try {
                console.log('Закрытие браузера после извлечения данных...');
                await browser.close(); // Закрываем браузер сразу после извлечения данных
            } catch (error) {
                console.error('Ошибка при закрытии браузера:', error);
            }



            // Логирование средней цены
            console.log(`Средняя цена: ${averagePrice}`);

            // Первоначальный расчёт предложенной цены
            let proposePrice;
            if (averagePrice <= 5000) {
                proposePrice = averagePrice - 700;
            } else if (averagePrice > 5000 && averagePrice <= 9000) {
                proposePrice = averagePrice - 1000;
            } else {
                proposePrice = averagePrice - 1500;
            }

            proposePrice = Math.floor(proposePrice / 100) * 100; // Округление до ближайших 100

            // Логирование текущей и предложенной цены до корректировки
            console.log(`Текущая цена автомобиля: ${carInfo.price}`);
            console.log(`Предложенная цена (до проверки): ${proposePrice}`);

            // Парсинг текущей цены автомобиля
            const currentPrice = parseFloat(carInfo.price.replace(/\s|\$/g, ''));
            const deviationThreshold = currentPrice * 0.08; // 8% от текущей цены

            // Проверка и корректировка предложенной цены
            if (proposePrice > currentPrice) {
                console.log('Корректируем предложенную цену, так как она выше текущей...');
                if (currentPrice <= 5000) {
                    proposePrice = currentPrice - 700;
                } else if (currentPrice > 5000 && currentPrice <= 9000) {
                    proposePrice = currentPrice - 1000;
                } else {
                    proposePrice = currentPrice - 1500;
                }
            } else if ((currentPrice - proposePrice) <= deviationThreshold) {
                console.log('Корректируем предложенную цену, так как разница между предложенной и текущей <= 8%...');
                if (currentPrice <= 5000) {
                    proposePrice = currentPrice - 700;
                } else if (currentPrice > 5000 && currentPrice <= 9000) {
                    proposePrice = currentPrice - 1000;
                } else {
                    proposePrice = currentPrice - 1500;
                }
            }

            proposePrice = Math.floor(proposePrice / 100) * 100; // Округление после корректировки

            // Логирование предложенной цены после корректировки
            console.log(`Предложенная цена после проверки: ${proposePrice}`);

            success = true; // Завершаем цикл при успешном выполнении
            return { averagePrice, proposePrice };
        } catch (error) {
            console.error(`Ошибка на попытке ${attempt + 1}: ${error.message}`);
        } finally {
            attempt++;
            if (attempt === maxRetries && !success) {
                console.error("Достигнуто максимальное количество попыток. Скрипт завершён.");
            }
        }
    }

}



module.exports = { proposePrice };
// _________________________
// const fs = require('fs');
// const puppeteer = require('puppeteer');
// const URLSearchParams = require('url').URLSearchParams;

// // Загружаем JSON файлы
// const valueIdAuto = JSON.parse(fs.readFileSync('./data/ria-values/value_id_auto.json'));
// const bodyTypes = JSON.parse(fs.readFileSync('./data/ria-values/body_types.json'));
// const driveTypes = JSON.parse(fs.readFileSync('./data/ria-values/drive_types.json'));
// const fuelTypes = JSON.parse(fs.readFileSync('./data/ria-values/fuel_types.json'));
// const gearboxTypes = JSON.parse(fs.readFileSync('./data/ria-values/gearbox_types.json'));

// // Функции для обработки данных
// const validateVinOrLicensePlate = (vin, licensePlate) => {
//     if (vin && vin.length === 17) return vin;
//     if (licensePlate && licensePlate.length === 8) return licensePlate;
//     return null;
// };

// const findBrandId = (brandName) => {
//     const brand = valueIdAuto.find(b => b.name === brandName);
//     return brand ? brand.id : null;
// };

// const findModelId = (brandName, modelName) => {
//     const brand = valueIdAuto.find(b => b.name === brandName);
//     if (brand) {
//         const model = brand.models.find(m => m.name === modelName);
//         return model ? model.id : null;
//     }
//     return null;
// };

// const findIdByName = (data, keyName, searchValue) => {
//     const foundItem = data.find(item => item[keyName] === searchValue);
//     return foundItem ? foundItem.id : '0';
// };

// const parseMileage = (mileage) => {
//     const numericMileage = parseInt(mileage.replace(/[^\d]/g, ''), 10);
//     return isNaN(numericMileage) ? null : numericMileage;
// };

// const calculateMileageRange = (mileage) => ({
//     lowerBound: Math.max(0, mileage - 10),
//     upperBound: mileage + 10
// });

// const roundDownToHundred = (price) => Math.floor(price / 100) * 100;

// const calculateProposePrice = (averagePrice) => {
//     let proposePrice;
//     if (averagePrice <= 5000) {
//         proposePrice = averagePrice - 700;
//     } else if (averagePrice > 5000 && averagePrice <= 9000) {
//         proposePrice = averagePrice - 1000;
//     } else {
//         proposePrice = averagePrice - 1500;
//     }
//     return roundDownToHundred(proposePrice);
// };

// // Основная функция
// async function proposePrice(carInfo) {
//     console.log('Полученные данные о машине:', carInfo);

//     carInfo.mileage = parseMileage(carInfo.mileage);
//     if (carInfo.mileage === null) {
//         console.error('Некорректный пробег.');
//         return null;
//     }

//     const validOmniId = validateVinOrLicensePlate(carInfo.vin, carInfo.licensePlate);
//     let finalUrl;

//     if (validOmniId) {
//         finalUrl = `https://auto.ria.com/uk/price/average/?currentTab=byOmniId&omniId=${validOmniId}`;
//     } else {
//         const brandId = findBrandId(carInfo.brand);
//         const modelId = findModelId(carInfo.brand, carInfo.model);

//         if (!brandId || !modelId) {
//             console.error('Ошибка: Не удалось найти ID для марки или модели автомобиля.');
//             return null;
//         }

//         const { lowerBound, upperBound } = calculateMileageRange(carInfo.mileage);

//         const urlParams = {
//             currentTab: 'byParams',
//             categoryId: '1',
//             brandId,
//             modelId,
//             'year.gte': carInfo.year,
//             'year.lte': carInfo.year,
//             'mileage.gte': lowerBound,
//             'mileage.lte': upperBound,
//             fuelId: findIdByName(fuelTypes, 'name', carInfo.fuelType),
//             'engineVolume.gte': carInfo.engineVol,
//             'engineVolume.lte': carInfo.engineVol,
//             gearBoxId: findIdByName(gearboxTypes, 'name', carInfo.transmission),
//             driveId: findIdByName(driveTypes, 'type', carInfo.driveType),
//             bodyId: findIdByName(bodyTypes, 'name', carInfo.bodyType)
//         };

//         const queryParams = new URLSearchParams(urlParams);
//         finalUrl = `https://auto.ria.com/uk/price/average/?${queryParams.toString()}`;
//     }

//     console.log(`Сгенерированная ссылка: ${finalUrl}`);

//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();

//     const maxRetries = 2; // Максимальное количество попыток
//     let attempt = 0;
//     let success = false;

//     while (attempt < maxRetries && !success) {
//         try {
//             await page.goto(finalUrl, { waitUntil: 'networkidle2' });

//             // Поиск и установка периода
//             const selectHandle = await page.evaluateHandle(() => {
//                 const xpath = "//div[contains(@class, 'head-item')]//select[contains(@class, 'item select grey')]";
//                 const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
//                 return result.singleNodeValue;
//             });

//             if (selectHandle) {
//                 await page.evaluate(select => {
//                     select.value = "30"; // Установка значения
//                     select.dispatchEvent(new Event('change', { bubbles: true })); // Генерация события
//                 }, selectHandle);

//                 // Задержка для обновления
//                 await new Promise(resolve => setTimeout(resolve, 1500)); // Задержка на обновление

//                 // Извлечение цены
//                 const priceSelector = 'div.item.average div.bold.green.size40';
//                 await page.waitForSelector(priceSelector, { timeout: 2500 });
//                 const updatedPrice = await page.$eval(priceSelector, el => el.innerText.trim());
//                 const averagePrice = parseFloat(updatedPrice.replace(/\s|\$/g, ''));

//                 // Вывод нужной информации
//                 console.log(`Сгенерированная ссылка: ${finalUrl}`);
//                 console.log(`Текущая цена автомобиля: ${carInfo.price}`);
//                 console.log(`Средняя цена: ${averagePrice}`);

//                 // Расчёт и вывод предложенной цены
//                 const proposePrice = calculateProposePrice(averagePrice);
//                 console.log(`Предложенная цена: ${proposePrice}`);
//                 success = true; // Завершаем цикл при успешном выполнении
//                 return { averagePrice, proposePrice };
//             } else {
//                 console.error("Не удалось найти выпадающий список.");
//             }
//         } catch (error) {
//             console.error(`Ошибка на попытке ${attempt + 1}: ${error.message}`);
//         } finally {
//             attempt++;
//             if (attempt === maxRetries && !success) {
//                 console.error("Достигнуто максимальное количество попыток. Скрипт завершён.");
//             }
//         }
//     }

//     await browser.close();
// }

// module.exports = { proposePrice };

// __________
// function proposePrice(carInfo) {
//     console.log('Полученные данные о машине:', carInfo);

//     // Вы можете добавить любую дополнительную обработку carInfo, если нужно.
//     // Например, доступ к определенному полю:
//     // console.log(`Марка: ${carInfo.brand}, Модель: ${carInfo.model}`);
// }

// // Экспортируем функцию для использования в carDetailsExtractor.js
// module.exports = { proposePrice };
// ___________

// const fs = require('fs');
// const puppeteer = require('puppeteer');
// const URLSearchParams = require('url').URLSearchParams;

// // Загружаем JSON файлы
// const valueIdAuto = JSON.parse(fs.readFileSync('./data/ria-values/value_id_auto.json'));
// const bodyTypes = JSON.parse(fs.readFileSync('./data/ria-values/body_types.json'));
// const driveTypes = JSON.parse(fs.readFileSync('./data/ria-values/drive_types.json'));
// const fuelTypes = JSON.parse(fs.readFileSync('./data/ria-values/fuel_types.json'));
// const gearboxTypes = JSON.parse(fs.readFileSync('./data/ria-values/gearbox_types.json'));

// // Проверка корректности VIN и номера автомобиля
// const validateVinOrLicensePlate = (vin, licensePlate) => {
//     if (vin && vin.length === 17) {
//         return vin;
//     } else if (licensePlate && licensePlate.length === 8) {
//         return licensePlate;
//     } else {
//         return null;
//     }
// };

// // Найти ID бренда
// const findBrandId = (brandName) => {
//     const brand = valueIdAuto.find(b => b.name === brandName);
//     return brand ? brand.id : null;
// };

// // Найти ID модели
// const findModelId = (brandName, modelName) => {
//     const brand = valueIdAuto.find(b => b.name === brandName);
//     if (brand) {
//         const model = brand.models.find(m => m.name === modelName);
//         return model ? model.id : null;
//     }
//     return null;
// };

// // Функция для поиска ID по имени
// const findIdByName = (data, keyName, searchValue) => {
//     const foundItem = data.find(item => item[keyName] === searchValue);
//     return foundItem ? foundItem.id : '0';
// };

// // Функция для преобразования пробега
// const parseMileage = (mileage) => {
//     const numericMileage = parseInt(mileage.replace(/[^\d]/g, ''), 10);
//     if (isNaN(numericMileage)) {
//         console.error("Некорректное значение пробега.");
//         return null;
//     }
//     return numericMileage;
// };

// // Функция для расчета диапазона пробега
// const calculateMileageRange = (mileage) => {
//     const lowerBound = mileage - 10;
//     const upperBound = mileage + 10;
//     return {
//         lowerBound: lowerBound > 0 ? lowerBound : 0,
//         upperBound
//     };
// };



// // Входные данные
// const carInfo = {
//     vin: "JMYLRV93W7J71622",   // VIN-код
//     licensePlate: "AE8076I", // Номер машины
//     brand: "Mitsubishi",        // Марка автомобиля
//     model: "Pajero Wagon",      // Модель автомобиля
//     year: 2007,                 // Год выпуска
//     engineVol: "3.0",           // Объем двигателя
//     fuelType: "Газ пропан-бутан / Бензин", // Тип топлива
//     transmission: "Автомат",    // Тип КПП
//     driveType: "Повний",        // Тип привода
//     bodyType: "Позашляховик / Кросовер", // Тип кузова
//     price: "12 000 $",          // Цена
//     mileage: "297 тис. км",     // Пробег (в тысячах км)
//     color: "Сірий металік"      // Цвет
// };

// // Обработка пробега
// carInfo.mileage = parseMileage(carInfo.mileage);

// if (carInfo.mileage === null) {
//     console.error("Некорректный пробег. Скрипт завершён.");
//     process.exit(1);
// }

// // Проверяем VIN или номер автомобиля
// const validOmniId = validateVinOrLicensePlate(carInfo.vin, carInfo.licensePlate);

// let finalUrl;

// if (validOmniId) {
//     finalUrl = `https://auto.ria.com/uk/price/average/?currentTab=byOmniId&omniId=${validOmniId}`;
// } else {
//     const brandId = findBrandId(carInfo.brand);
//     const modelId = findModelId(carInfo.brand, carInfo.model);

//     if (!brandId || !modelId) {
//         console.error("Ошибка: Не удалось найти ID для марки или модели автомобиля.");
//         process.exit(1);
//     }

//     const { lowerBound, upperBound } = calculateMileageRange(carInfo.mileage);

//     const urlParams = {
//         currentTab: 'byParams',
//         categoryId: '1',
//         brandId: brandId,
//         modelId: modelId,
//         'year.gte': carInfo.year,
//         'year.lte': carInfo.year,
//         'mileage.gte': lowerBound,
//         'mileage.lte': upperBound,
//         fuelId: findIdByName(fuelTypes, 'name', carInfo.fuelType),
//         'engineVolume.gte': carInfo.engineVol,
//         'engineVolume.lte': carInfo.engineVol,
//         gearBoxId: findIdByName(gearboxTypes, 'name', carInfo.transmission),
//         driveId: findIdByName(driveTypes, 'type', carInfo.driveType),
//         bodyId: findIdByName(bodyTypes, 'name', carInfo.bodyType)
//     };

//     const queryParams = new URLSearchParams(urlParams);
//     finalUrl = `https://auto.ria.com/uk/price/average/?${queryParams.toString()}`;
// }

// // Использование Puppeteer
// const roundDownToHundred = (price) => {
//     return Math.floor(price / 100) * 100;
// };

// // Модифицированная функция для расчёта предложенной цены
// const calculateProposePrice = (averagePrice) => {
//     let proposePrice;
//     if (averagePrice <= 5000) {
//         proposePrice = averagePrice - 700;
//     } else if (averagePrice > 5000 && averagePrice <= 9000) {
//         proposePrice = averagePrice - 1000;
//     } else {
//         proposePrice = averagePrice - 1500;
//     }
//     return roundDownToHundred(proposePrice); // Округление до ближайших 100
// };

// (async () => {
//     const browser = await puppeteer.launch({ headless: false }); // Браузер с интерфейсом
//     const page = await browser.newPage();

//     try {
//         await page.goto(finalUrl, { waitUntil: 'networkidle2' });

//         // Поиск и установка периода
//         const selectHandle = await page.evaluateHandle(() => {
//             const xpath = "//div[contains(@class, 'head-item')]//select[contains(@class, 'item select grey')]";
//             const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
//             return result.singleNodeValue;
//         });

//         if (selectHandle) {
//             await page.evaluate(select => {
//                 select.value = "30"; // Установка значения
//                 select.dispatchEvent(new Event('change', { bubbles: true })); // Генерация события
//             }, selectHandle);

//             // Задержка для обновления
//             await new Promise(resolve => setTimeout(resolve, 3000)); // Задержка на обновление

//             // Извлечение цены
//             const priceSelector = 'div.item.average div.bold.green.size40';
//             await page.waitForSelector(priceSelector, { timeout: 5000 });
//             const updatedPrice = await page.$eval(priceSelector, el => el.innerText.trim());
//             const cleanedPrice = parseFloat(updatedPrice.replace(/\s|\$/g, ''));

//             // Вывод только нужной информации
//             console.log(`Сгенерированная ссылка: ${finalUrl}`);
//             console.log(`Текущая цена автомобиля: ${carInfo.price}`);
//             console.log(`Средняя цена: ${cleanedPrice}`);

//             // Расчёт и вывод предложенной цены
//             const proposePrice = calculateProposePrice(cleanedPrice);
//             console.log(`Предложенная цена: ${proposePrice}`);
//         } else {
//             console.error("Не удалось найти выпадающий список.");
//         }
//     } catch (error) {
//         console.error(`Ошибка: ${error.message}`);
//     } finally {
//         await browser.close();
//     }
// })();