const fs = require('fs');
const { receiveData } = require('./creatorLinks.js'); // Импорт функции из creatorLinks.js
const { getLocationIds } = require('./utils/getLocationsId'); // Импорт функции для получения ID региона и города
const { searchPrice } = require('./searchPrice.js'); // Импорт обновленного searchPrice

// Чтение данных из файлов JSON
const locations = JSON.parse(fs.readFileSync('./data/ria-values/locations.json', 'utf8'));
const valueIdAuto = JSON.parse(fs.readFileSync('./data/ria-values/value_id_auto.json', 'utf8'));
const gearboxTypes = JSON.parse(fs.readFileSync('./data/ria-values/gearbox_types.json', 'utf8'));
const bodyTypes = JSON.parse(fs.readFileSync('./data/ria-values/body_types.json', 'utf8'));
const fuelTypes = JSON.parse(fs.readFileSync('./data/ria-values/fuel_types.json', 'utf8'));
const driveTypes = JSON.parse(fs.readFileSync('./data/ria-values/drive_types.json', 'utf8'));
const damageStatus = JSON.parse(fs.readFileSync('./data/ria-values/damage_status.json', 'utf8'));

// Функции поиска ID
function getMakeAndModelId(makeName, modelName) {
    const make = valueIdAuto.find(m => m.name === makeName);
    if (!make) return null;

    const model = make.models.find(m => m.name === modelName);
    return {
        makeId: make.id,
        modelId: model ? model.id : 'не найдено'
    };
}

function getIdByName(dataArray, name, key = 'name') {
    const item = dataArray.find(i => i[key] === name);
    return item ? item.id : 'не найдено';
}

function getFuelTypeIds(selectedFuelId) {
    const fuelGroup = [1, 3, 4, 8];
    return fuelGroup.includes(selectedFuelId) ? fuelGroup : [selectedFuelId];
}

async function generatePriceQuote(make, model, priceUSD, fuelType, transmission, driveType, bodyType, year, mileage, engineVol, location, wasDamaged) {
    console.log('wasDamaged перед обработкой:', wasDamaged);

    // Преобразование wasDamaged в строку
    if (typeof wasDamaged !== 'string') {
        console.error('Ошибка: wasDamaged должен быть строкой.', 'Получено:', wasDamaged);
        wasDamaged = String(wasDamaged);
    }

    const damageId = damageStatus.find(status => status.name.trim() === wasDamaged.trim())?.id;

    if (damageId === undefined) {
        console.error(`Ошибка: Значение "${wasDamaged}" не найдено в damage_status.json.`);
        console.error(`Доступные значения: ${damageStatus.map(status => status.name).join(', ')}`);
    }

    const locationIds = getLocationIds(location);

    if (!locationIds) {
        console.error(`Не удалось получить regionValueId и cityValueId для города ${location}`);
        return;
    }

    const { regionValueId, cityValueId } = locationIds;

    const makeAndModelData = getMakeAndModelId(make, model);
    const fuelTypeId = getIdByName(fuelTypes, fuelType);
    const fuelTypeIds = getFuelTypeIds(fuelTypeId);

    const gearboxTypeId = getIdByName(gearboxTypes, transmission);
    const bodyTypeId = getIdByName(bodyTypes, bodyType);
    const driveTypeId = getIdByName(driveTypes, driveType, 'type');

    let finalGearboxTypeIds;
    if (gearboxTypeId === 1) {
        finalGearboxTypeIds = [gearboxTypeId];
    } else if ([2, 3, 4, 5].includes(gearboxTypeId)) {
        finalGearboxTypeIds = [2, 3, 4, 5];
    } else {
        finalGearboxTypeIds = [gearboxTypeId];
    }

    const engineVolNum = parseFloat(engineVol);
    if (isNaN(engineVolNum)) {
        throw new TypeError('engineVol должен быть числом');
    }

    const engineVolumes = [
        parseFloat((engineVolNum - 0.1).toFixed(1)),
        parseFloat((engineVolNum + 0.1).toFixed(1))
    ];

    const data = {
        makeId: makeAndModelData ? makeAndModelData.makeId : 'не найдено',
        modelId: makeAndModelData ? makeAndModelData.modelId : 'не найдено',
        fuelTypeId: fuelTypeIds,
        gearboxTypeId: finalGearboxTypeIds,
        driveTypeId,
        bodyTypeId,
        priceUSD,
        year,
        mileage,
        engineVol: engineVolumes,
        locationId: regionValueId,
        damage: damageId
    };

    console.log('Сформированные данные для поиска:', data);

    receiveData(data);

    // Вызов searchPrice для расчета цен
    const { url, currentPrice, proposePrice } = await searchPrice();

    console.log("Результаты из searchPrice:");
    console.log("Сгенерированный URL:", url);
    console.log("Текущая цена:", currentPrice);
    console.log("Предлагаемая цена:", proposePrice);

    return {
        ...data,
        url,
        currentPrice,
        proposePrice
    };
}

module.exports = { generatePriceQuote };

// __________(код рабочий без searchPRice.js)____________________________
// const fs = require('fs');
// const { receiveData } = require('./creatorLinks.js'); // Импорт функции из creatorLinks.js
// const { getLocationIds } = require('./utils/getLocationsId'); // Импорт функции для получения ID региона и города
// const { searchPrice } = require('./searchPrice.js');

// // Чтение данных из файлов JSON
// const locations = JSON.parse(fs.readFileSync('./data/ria-values/locations.json', 'utf8'));
// const valueIdAuto = JSON.parse(fs.readFileSync('./data/ria-values/value_id_auto.json', 'utf8'));
// const gearboxTypes = JSON.parse(fs.readFileSync('./data/ria-values/gearbox_types.json', 'utf8'));
// const bodyTypes = JSON.parse(fs.readFileSync('./data/ria-values/body_types.json', 'utf8'));
// const fuelTypes = JSON.parse(fs.readFileSync('./data/ria-values/fuel_types.json', 'utf8'));
// const driveTypes = JSON.parse(fs.readFileSync('./data/ria-values/drive_types.json', 'utf8'));
// const damageStatus = JSON.parse(fs.readFileSync('./data/ria-values/damage_status.json', 'utf8')); // Чтение damage_status.json

// // Функции поиска ID
// function getMakeAndModelId(makeName, modelName) {
//     const make = valueIdAuto.find(m => m.name === makeName);
//     if (!make) return null;

//     const model = make.models.find(m => m.name === modelName);
//     return {
//         makeId: make.id,
//         modelId: model ? model.id : 'не найдено'
//     };
// }

// function getIdByName(dataArray, name, key = 'name') {
//     const item = dataArray.find(i => i[key] === name);
//     return item ? item.id : 'не найдено';
// }

// // Определение топливных ID для заданного набора (1, 3, 4, 8)
// function getFuelTypeIds(selectedFuelId) {
//     const fuelGroup = [1, 3, 4, 8];
//     return fuelGroup.includes(selectedFuelId) ? fuelGroup : [selectedFuelId];
// }

// // Основная функция для генерации данных
// function generatePriceQuote(make, model, priceUSD, fuelType, transmission, driveType, bodyType, year, mileage, engineVol, location, wasDamaged) {
//     console.log('wasDamaged перед обработкой:', wasDamaged);

//     // Преобразование wasDamaged в строку
//     if (typeof wasDamaged !== 'string') {
//         console.error('Ошибка: wasDamaged должен быть строкой.', 'Получено:', wasDamaged);
//         wasDamaged = String(wasDamaged);
//     }

//     const damageId = damageStatus.find(status => status.name.trim() === wasDamaged.trim())?.id;

//     if (damageId === undefined) {
//         console.error(`Ошибка: Значение "${wasDamaged}" не найдено в damage_status.json.`);
//         console.error(`Доступные значения: ${damageStatus.map(status => status.name).join(', ')}`);
//     }

//     const locationIds = getLocationIds(location);

//     if (!locationIds) {
//         console.error(`Не удалось получить regionValueId и cityValueId для города ${location}`);
//         return;
//     }

//     const { regionValueId, cityValueId } = locationIds;

//     const makeAndModelData = getMakeAndModelId(make, model);
//     const fuelTypeId = getIdByName(fuelTypes, fuelType);
//     const fuelTypeIds = getFuelTypeIds(fuelTypeId); // Получаем подходящие ID топлива

//     const gearboxTypeId = getIdByName(gearboxTypes, transmission);
//     const bodyTypeId = getIdByName(bodyTypes, bodyType);
//     const driveTypeId = getIdByName(driveTypes, driveType, 'type');

//     // Логика для ID коробки передач
//     let finalGearboxTypeIds;
//     if (gearboxTypeId === 1) {
//         finalGearboxTypeIds = [gearboxTypeId];
//     } else if ([2, 3, 4, 5].includes(gearboxTypeId)) {
//         finalGearboxTypeIds = [2, 3, 4, 5];
//     } else {
//         finalGearboxTypeIds = [gearboxTypeId];
//     }

//     // Приведение engineVol к числу для корректных вычислений
//     const engineVolNum = parseFloat(engineVol);
//     if (isNaN(engineVolNum)) {
//         throw new TypeError('engineVol должен быть числом');
//     }

//     // Создание массива для объема двигателя с шагом ±0.1
//     const engineVolumes = [
//         parseFloat((engineVolNum - 0.1).toFixed(1)),
//         parseFloat((engineVolNum + 0.1).toFixed(1))
//     ];

//     // Формируем объект данных
//     const data = {
//         makeId: makeAndModelData ? makeAndModelData.makeId : 'не найдено',
//         modelId: makeAndModelData ? makeAndModelData.modelId : 'не найдено',
//         fuelTypeId: fuelTypeIds,
//         gearboxTypeId: finalGearboxTypeIds,
//         driveTypeId,
//         bodyTypeId,
//         priceUSD,
//         year,
//         mileage,
//         engineVol: engineVolumes, // Используем массив из двух значений
//         locationId: regionValueId, // Используем regionValueId
//         damage: damageId // Используем ID из damage_status
//     };
//     console.log({
//         make,
//         model,
//         priceUSD,
//         fuelType,
//         transmission,
//         driveType,
//         bodyType,
//         year,
//         mileage,
//         engineVol,
//         location,
//         wasDamaged
//     });

//     console.log(`Данные для передачи:`, data);


//     receiveData(data);

//     const { url, currentPrice } = searchPrice();

//     console.log("Результаты из searchPrice:");
//     console.log("Сгенерированная ссылка:", url);
//     console.log("Текущая цена:", currentPrice);
// }

// // Экспорт функции
// module.exports = { generatePriceQuote };
// __________________________________________
// const fs = require('fs');

// // Чтение данных из locations.json и value_id_auto.json
// const locations = JSON.parse(fs.readFileSync('./data/ria-values/locations.json', 'utf8'));
// const valueIdAuto = JSON.parse(fs.readFileSync('./data/ria-values/value_id_auto.json', 'utf8'));

// // Функция для поиска ID марки и модели
// function getMakeAndModelId(makeName, modelName) {
//     const make = valueIdAuto.find(m => m.name === makeName);
//     if (!make) return null;

//     const model = make.models.find(m => m.name === modelName);
//     return {
//         makeId: make.id,
//         modelId: model ? model.id : 'не найдено'
//     };
// }

// // Пример вывода данных
// function generatePriceQuote(make, model, priceUSD, fuelType, transmission, driveType, bodyType, year, mileage, engineVol, location, regionsId) {
//     console.log("Проверка полученных данных:");
//     console.log("Марка:", make);
//     console.log("Модель:", model);
//     console.log("Цена:", priceUSD);
//     console.log("Тип топлива:", fuelType);
//     console.log("Коробка передач:", transmission);
//     console.log("Тип привода:", driveType);
//     console.log("Тип кузова:", bodyType);
//     console.log("Год выпуска:", year);
//     console.log("Пробег:", mileage);
//     console.log("Объём двигателя:", engineVol);
//     console.log("Местоположение:", location);
//     console.log("ID регионов:", regionsId);

//     const makeAndModelData = getMakeAndModelId(make, model);
//     if (makeAndModelData) {
//         console.log("Марка ID:", makeAndModelData.makeId);
//         console.log("Модель ID:", makeAndModelData.modelId);
//     } else {
//         console.log("Марка или модель не найдены.");
//     }
// }

// // Экспорт функции
// module.exports = { generatePriceQuote };