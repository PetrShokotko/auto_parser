const fs = require('fs');
const linkConstract = require('./data/ria-values/linkConstract.json');
const gearboxTypes = require('./data/ria-values/gearbox_types.json');
const bodyTypes = require('./data/ria-values/body_types.json');
const fuelTypes = require('./data/ria-values/fuel_types.json');

let generatedLink; // Переменная для хранения сгенерированной ссылки
let priceUSD; // Переменная для хранения переданной цены

function constructLink(data) {
    const baseURL = linkConstract.baseURL;
    const params = linkConstract.parameters;

    let url = `${baseURL}`;

    if (data.bodyTypeId) {
        const bodyType = bodyTypes.find(type => type.id === data.bodyTypeId);
        if (bodyType) {
            const bodyIndex = bodyType.index;
            url += params.body.replace('{bodyId}', data.bodyTypeId).replace('[0]', `[${bodyIndex}]`);
        }
    }

    if (data.year) {
        url += params.year.gte.replace('{yearGte}', data.year) + params.year.lte.replace('{yearLte}', data.year);
    }

    url += `&categories.main.id=1`;

    if (data.makeId) {
        url += params.brand.replace('{brandId}', data.makeId);
    }

    if (data.modelId) {
        url += params.model.replace('{modelId}', data.modelId);
    }

    url += `&country.import.usa.not=-1`;

    if (data.locationId) {
        url += params.region.replace('{regionId}', data.locationId);
    }

    url += `&price.currency=1`;

    if (data.gearboxTypeId && Array.isArray(data.gearboxTypeId)) {
        data.gearboxTypeId.forEach((gearboxId) => {
            const gearboxType = gearboxTypes.find(type => type.id === gearboxId);
            if (gearboxType) {
                const gearboxIndex = gearboxType.index;
                url += params.gearbox.replace('{gearboxId}', gearboxId).replace('[0]', `[${gearboxIndex}]`);
            }
        });
    }

    if (data.fuelTypeId && Array.isArray(data.fuelTypeId)) {
        data.fuelTypeId.forEach((fuelId) => {
            const fuelType = fuelTypes.find(type => type.id === fuelId);
            if (fuelType) {
                const fuelIndex = fuelType.index;
                url += params.fuel.replace('{fuelId}', fuelId).replace('[0]', `[${fuelIndex}]`);
            }
        });
    }

    if (data.driveTypeId && data.driveTypeId !== 'не найдено') {
        url += params.drive.replace('{driveId}', data.driveTypeId).replace('[0]', '[0]');
    }

    if (data.mileage) {
        const mileageRange = 50;
        const mileageFrom = Math.max(0, parseInt(data.mileage, 10) - mileageRange);
        const mileageTo = parseInt(data.mileage, 10) + mileageRange;
        url += params.mileage.gte.replace('{mileageGte}', mileageFrom) + params.mileage.lte.replace('{mileageLte}', mileageTo);
    }

    if (data.engineVol && Array.isArray(data.engineVol) && data.engineVol.length === 2) {
        const [engineGte, engineLte] = data.engineVol;
        url += params.engine.gte.replace('{engineGte}', engineGte) + params.engine.lte.replace('{engineLte}', engineLte);
    }

    url += `&abroad.not=0&custom.not=1`;

    if (data.damage !== undefined) {
        url += `&damage.not=${data.damage}`;
    }

    url += `&page=0&size=100`;

    return url;
}

function receiveData(data) {
    console.log("Полученные данные:", data);

    generatedLink = constructLink(data);
    priceUSD = data.priceUSD;

    console.log("Сгенерированная ссылка:", generatedLink);
    console.log("Переданная цена:", priceUSD);
}

// Экспорт данных и функций
module.exports = {
    receiveData,
    generatedLink: () => generatedLink,
    priceUSD: () => priceUSD
};
// ------------------------------------------------------------------------------
// function receiveData(data) {
//     console.log("Полученные данные:", data);

//     // Здесь вы можете обработать данные, записать в файл, отправить на сервер или выполнить другую логику
//     // Например, запись данных в JSON файл:
//     const fs = require('fs');
//     fs.writeFileSync('./receivedData.json', JSON.stringify(data, null, 2));
// }

// // Экспорт функции
// module.exports = { receiveData };