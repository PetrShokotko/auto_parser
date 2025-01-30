const fs = require('fs');

// Путь к файлу с данными о локациях
const filePath = './data/ria-values/locations.json';

// Функция для получения regionValueId и cityValueId по названию города
function getLocationIds(location) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const region of data.regions) {
        const city = region.cities.find(c => c.city === location);
        if (city) {
            return {
                regionValueId: region.id,
                cityValueId: city.id
            };
        }
    }

    console.error(`Город ${location} не найден`);
    return null;
}

module.exports = { getLocationIds };
// const fs = require('fs');

// // Путь к файлу
// const filePath = './data/ria-values/locations.json';

// // Название города для поиска
// const cityName = "Дніпро (Дніпропетровськ)";

// // Функция для поиска города
// function findCityInfo(filePath, cityName) {
//     // Чтение файла
//     fs.readFile(filePath, 'utf8', (err, data) => {
//         if (err) {
//             console.error("Ошибка чтения файла:", err);
//             return;
//         }

//         // Парсим JSON
//         const locations = JSON.parse(data);

//         // Проходим по всем регионам
//         for (const region of locations.regions) {
//             // Ищем город в текущем регионе
//             const city = region.cities.find(c => c.city === cityName);
//             if (city) {
//                 console.log(`Город: ${city.city}`);
//                 console.log(`ID города (cityValueId): ${city.id}`);
//                 console.log(`ID региона (regionValueId): ${region.id}`);
//                 return;
//             }
//         }

//         // Если город не найден
//         console.log("Город не найден");
//     });
// }

// // Вызываем функцию
// findCityInfo(filePath, cityName);