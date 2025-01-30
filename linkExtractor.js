const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const locations = JSON.parse(fs.readFileSync('./data/ria-values/locations.json', 'utf8'));
const { extractCarDetails } = require('./carDetailsExtractor'); // добавляем импорт extractCarDetails

let visitedLinks = [];

// Функция для чтения существующего файла visitedLinks.json
function loadVisitedLinks() {
    if (fs.existsSync('visitedLinks.json')) {
        const data = fs.readFileSync('visitedLinks.json');
        visitedLinks = JSON.parse(data);
    } else {
        visitedLinks = [];
    }
}

// Функция для поиска ссылки
function findLink(url) {
    return visitedLinks.find(link => link.url === url);
}

// Функция для получения ID города по названию
function getCityIdByName(regionId, cityName) {
    const region = locations.regions.find(r => r.id === regionId);
    if (!region) return 'Регион не найден';

    const city = region.cities.find(c => c.city === cityName);
    return city ? city.id : 'Город не найден';
}

// Функция для извлечения ID региона и города из HTML разметки
function extractRegionIds(html) {
    const $ = cheerio.load(html);

    // Извлекаем название города
    const cityName = $('li.item-char.view-location.js-location')
        .contents()
        .filter(function() {
            return this.type === 'text';
        })
        .text()
        .trim();

    if (!cityName) {
        console.warn('Название города не найдено в разметке');
        return {};
    }

    // Ищем ID региона и города
    let regionId;
    let cityId;
    for (const region of locations.regions) {
        cityId = getCityIdByName(region.id, cityName);
        if (cityId !== 'Город не найден') {
            regionId = region.id;
            break;
        }
    }

    if (!regionId) {
        console.warn(`Регион для города "${cityName}" не найден`);
        return {};
    }

    console.log(`Извлечены ID: regionId = ${regionId}, cityId = ${cityId}`);
    return { regionId, cityId };
}

// Помечаем функцию как async, чтобы использовать await внутри
async function extractLinksFromPage(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const links = [];
        const contentBars = $('.content-bar'); // Захватываем все элементы с этим селектором

        // Используем for...of для обхода элементов
        for (const contentBar of contentBars.toArray()) {
            const link = $(contentBar).find('.m-link-ticket').attr('href');
            const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

            // Извлечение региона и города
            const regionInfo = extractRegionIds($.html(contentBar));
            console.log('Извлеченная информация о регионе:', regionInfo);


            if (link && link !== 'undefined') {
                const processedDate = new Date().toLocaleString('ru-RU', {
                    timeZone: 'Europe/Kiev',
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric'
                });

                const existingLink = findLink(link);

                if (existingLink) {
                    // Проверяем, изменилась ли цена
                    if (existingLink.currentPrice !== currentPrice) {
                        console.log(`Цена изменилась для ссылки ${link}. Старая цена: ${existingLink.currentPrice}, новая цена: ${currentPrice}`);

                        // Добавляем изменение в массив history
                        if (!existingLink.priceHistory) {
                            existingLink.priceHistory = [];
                        }
                        existingLink.priceHistory.push({
                            oldPrice: existingLink.currentPrice,
                            newPrice: currentPrice,
                            dateChanged: processedDate
                        });

                        // Обновляем текущую цену
                        existingLink.currentPrice = currentPrice;
                        existingLink.dateProcessed = processedDate;

                        // Вызов extractCarDetails для обновленного объявления
                        await extractCarDetails(link); // вызываем функцию для извлечения обновленных данных
                    } else {
                        console.log(`Цена для ссылки ${link} не изменилась.`);
                    }
                } else {
                    // Добавляем новый объект, если ссылка ранее не встречалась
                    visitedLinks.push({
                        url: link,
                        dateProcessed: processedDate,
                        currentPrice: currentPrice,
                        priceHistory: [], // Изначально массив пуст
                    });

                    // Добавляем ссылку в список для дальнейшей обработки
                    links.push({
                        url: link,
                        currentPrice: currentPrice
                    });
                }
            } else {
                console.warn(`Пропущен блок с некорректной ссылкой: ${link}`);
            }
        }

        return links;
    } catch (error) {
        console.error('Ошибка при извлечении ссылок:', error);
        return [];
    }
}

async function extractAllLinks(baseUrl) {
    loadVisitedLinks(); // Загрузка существующих ссылок перед началом
    let allLinks = [];
    let pageIndex = 0;
    let keepGoing = true;

    baseUrl = baseUrl.replace(/size=\d+/, 'size=100');

    while (keepGoing) {
        let pageUrl = baseUrl.replace(/&page=\d+/, `&page=${pageIndex}`);
        const links = await extractLinksFromPage(pageUrl);

        allLinks = [...allLinks, ...links];

        if (links.length === 100) {
            pageIndex++;
            console.log('Переход на следующую страницу:', pageIndex);
        } else {
            keepGoing = false;
            console.log('Меньше 100 объявлений на странице. Остановка обработки.');
        }

        console.log(`Обработано страниц: ${pageIndex + 1}, ссылок: ${allLinks.length}`);
    }

    // Сохранение массива visitedLinks в файл
    fs.writeFileSync('visitedLinks.json', JSON.stringify(visitedLinks, null, 2));
    console.log('Список обработанных ссылок сохранен в visitedLinks.json');

    return allLinks;
}

module.exports = { extractAllLinks, extractRegionIds };

// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');


// let visitedLinks = [];

// // Функция для чтения существующего файла visitedLinks.json
// function loadVisitedLinks() {
//   if (fs.existsSync('visitedLinks.json')) {
//     const data = fs.readFileSync('visitedLinks.json');
//     visitedLinks = JSON.parse(data);
//   } else {
//     visitedLinks = [];
//   }
// }

// // Функция для поиска ссылки
// function findLink(url) {
//   return visitedLinks.find(link => link.url === url);
// }

// async function extractLinksFromPage(url) {
//   try {
//     const response = await axios.get(url);
//     const html = response.data;
//     const $ = cheerio.load(html);

//     const links = [];
//     $('.content-bar').each((i, contentBar) => {
//       const link = $(contentBar).find('.m-link-ticket').attr('href');
//       const currentPrice = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//       if (link && link !== 'undefined') {
//         const processedDate = new Date().toLocaleString('ru-RU', {
//           timeZone: 'Europe/Kiev',
//           year: 'numeric',
//           month: 'numeric',
//           day: 'numeric',
//           hour: 'numeric',
//           minute: 'numeric'
//         });

//         const existingLink = findLink(link);

//         if (existingLink) {
//           // Проверяем, изменилась ли цена
//           if (existingLink.currentPrice !== currentPrice) {
//             console.log(`Цена изменилась для ссылки ${link}. Старая цена: ${existingLink.currentPrice}, новая цена: ${currentPrice}`);

//             // Добавляем изменение в массив history
//             if (!existingLink.priceHistory) {
//               existingLink.priceHistory = [];
//             }
//             existingLink.priceHistory.push({
//               oldPrice: existingLink.currentPrice,
//               newPrice: currentPrice,
//               dateChanged: processedDate
//             });

//             // Обновляем текущую цену
//             existingLink.currentPrice = currentPrice;
//             existingLink.dateProcessed = processedDate; // Обновляем дату обработки
//           } else {
//             console.log(`Цена для ссылки ${link} не изменилась.`);
//           }
//         } else {
//           // Добавляем новый объект, если ссылка ранее не встречалась
//           visitedLinks.push({
//             url: link,
//             dateProcessed: processedDate,
//             currentPrice: currentPrice,
//             priceHistory: [] // Изначально массив пуст
//           });

//           // Добавляем ссылку в список для дальнейшей обработки
//           links.push({
//             url: link,
//             currentPrice: currentPrice
//           });
//         }
//       } else {
//         console.warn(`Пропущен блок с некорректной ссылкой: ${link}`);
//       }
//     });

//     return links;
//   } catch (error) {
//     console.error('Ошибка при извлечении ссылок:', error);
//     return [];
//   }
// }

// async function extractAllLinks(baseUrl) {
//   loadVisitedLinks(); // Загрузка существующих ссылок перед началом
//   let allLinks = [];
//   let pageIndex = 0;
//   let keepGoing = true;

//   baseUrl = baseUrl.replace(/size=\d+/, 'size=100');

//   while (keepGoing) {
//     let pageUrl = baseUrl.replace(/&page=\d+/, `&page=${pageIndex}`);
//     const links = await extractLinksFromPage(pageUrl);
    
//     allLinks = [...allLinks, ...links];

//     if (links.length === 100) {
//       pageIndex++;
//       console.log('Переход на следующую страницу:', pageIndex);
//     } else {
//       keepGoing = false;
//       console.log('Меньше 100 объявлений на странице. Остановка обработки.');
//     }

//     console.log(`Обработано страниц: ${pageIndex + 1}, ссылок: ${allLinks.length}`);
//   }

//   // Сохранение массива visitedLinks в файл
//   fs.writeFileSync('visitedLinks.json', JSON.stringify(visitedLinks, null, 2));
//   console.log('Список обработанных ссылок сохранен в visitedLinks.json');

//   return allLinks;
// }

// module.exports = { extractAllLinks };
//__________________________________________________________________________________
// const fs = require('fs');
// const axios = require('axios');
// const cheerio = require('cheerio');

// let visitedLinks = [];

// // Функция для чтения существующего файла visitedLinks.json
// function loadVisitedLinks() {
//   if (fs.existsSync('visitedLinks.json')) {
//     const data = fs.readFileSync('visitedLinks.json');
//     visitedLinks = JSON.parse(data);
//   } else {
//     visitedLinks = [];
//   }
// }

// // Функция для проверки, была ли ссылка уже обработана
// function isLinkVisited(url) {
//   return visitedLinks.some(link => link.url === url);
// }

// async function extractLinksFromPage(url) {
//   try {
//     const response = await axios.get(url);
//     const html = response.data;
//     const $ = cheerio.load(html);

//     const links = [];
//     $('.content-bar').each((i, contentBar) => {
//       const link = $(contentBar).find('.m-link-ticket').attr('href');
//       const price = $(contentBar).find('.price-ticket .size22.green').first().text().trim();

//       // Проверка на наличие корректного URL и его отсутствие в массиве visitedLinks
//       if (link && link !== 'undefined' && !isLinkVisited(link)) {
//         const processedDate = new Date().toLocaleString('ru-RU', {
//           timeZone: 'Europe/Kiev',
//           year: 'numeric',
//           month: 'numeric',
//           day: 'numeric',
//           hour: 'numeric',
//           minute: 'numeric',
//           second: 'numeric'
//         });

//         // Добавление новой ссылки в массив visitedLinks
//         visitedLinks.push({
//           url: link,
//           dateProcessed: processedDate,
//           price: price || 'не указана'
//         });

//         links.push({
//           url: link,
//           price: price
//         });
//       } else {
//         console.log(`Ссылка уже ранее была уже добавлена: ${link}`);
//       }
//     });

//     return links;
//   } catch (error) {
//     console.error('Ошибка при извлечении ссылок:', error);
//     return [];
//   }
// }

// async function extractAllLinks(baseUrl) {
//   loadVisitedLinks(); // Загрузка существующих ссылок перед началом
//   let allLinks = [];
//   let pageIndex = 0;
//   let keepGoing = true;

//   baseUrl = baseUrl.replace(/size=\d+/, 'size=100');

//   while (keepGoing) {
//     let pageUrl = baseUrl.replace(/&page=\d+/, `&page=${pageIndex}`);
//     const links = await extractLinksFromPage(pageUrl);
    
//     allLinks = [...allLinks, ...links];

//     if (links.length === 100) {
//       pageIndex++;
//       console.log('Переход на следующую страницу:', pageIndex);
//     } else {
//       keepGoing = false;
//       console.log('Меньше 100 объявлений на странице. Остановка обработки.');
//     }

//     console.log(`Обработано страниц: ${pageIndex + 1}, ссылок: ${allLinks.length}`);
//   }

//   // Сохранение массива visitedLinks в файл
//   fs.writeFileSync('visitedLinks.json', JSON.stringify(visitedLinks, null, 2));
//   console.log('Список обработанных ссылок сохранен в visitedLinks.json');

//   return allLinks;
// }

// module.exports = { extractAllLinks };