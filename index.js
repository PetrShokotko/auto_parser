const fs = require('fs');
const { extractAllLinks, extractRegionIds } = require('./linkExtractor');
const { extractCarDetails } = require('./carDetailsExtractor');

// Вспомогательная функция ожидания
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Основной процесс обработки ссылок
async function processAllPages() {
  try {
    // Шаг 1: Чтение ссылок из файла links.json
    const data = fs.readFileSync('links.json', 'utf8');
    const links = JSON.parse(data);

    console.log('Извлеченные ссылки из JSON:', links);

    // Шаг 2: Проход по каждой основной ссылке из файла
    for (const key in links) {
      if (links.hasOwnProperty(key)) {
        const searchPageUrl = links[key].url;

        // Шаг 3: Извлечение всех ссылок на объявления
        const extractedLinks = await extractAllLinks(searchPageUrl);
        console.log(`Извлечено ${extractedLinks.length} ссылок с ${searchPageUrl}`);

        // Шаг 4: Обработка каждой извлечённой ссылки
        for (const link of extractedLinks) {
          try {
            // Извлечение деталей объявления
            await extractCarDetails(link.url);
            console.log(`Ссылка успешно обработана: ${link.url}`);
          } catch (error) {
            console.error(`Ошибка при обработке ссылки ${link.url}:`, error);
          }
        }

        console.log(`Обработка завершена для ${extractedLinks.length} ссылок с ${searchPageUrl}`);
      }
    }

    // Шаг 5: Ожидание перед повторным запуском
    console.log('Все ссылки обработаны. Ожидание перед перезапуском...');
    await wait(10000); // 10 секунд ожидания перед перезапуском

    // Повторный запуск
    await processAllPages();

  } catch (error) {
    console.error('Ошибка в процессе обработки:', error);
    console.log('Перезапуск после ошибки...');
    await wait(10000); // Ожидание перед перезапуском
    await processAllPages();
  }
}

// Запуск основного процесса
processAllPages();
// ----------------------------

// const fs = require('fs');
// const { extractAllLinks, extractRegionIds } = require('./linkExtractor');
// const { extractCarDetails } = require('./carDetailsExtractor');

// // Основная функция обработки
// async function wait(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }


// async function processAllPages() {
//   try {
//     // Чтение ссылок из файла links.json
//     const data = fs.readFileSync('links.json', 'utf8');
//     const links = JSON.parse(data);

//     console.log('Извлеченные ссылки из JSON:', links);

//     // Проход по каждой ссылке из файла links.json
//     for (const key in links) {
//       if (links.hasOwnProperty(key)) {
//         const searchPageUrl = links[key].url;

//         const regionsId = extractRegionIds(searchPageUrl);

//         console.log('Извлеченные regionsId:', regionsId);

//         // Извлечение всех ссылок с текущей страницы поиска
//         const extractedLinks = await extractAllLinks(searchPageUrl);
//         console.log(`Извлеченные ссылки с ${searchPageUrl}:`, extractedLinks);

//         // Обработка каждой извлечённой ссылки
//         for (const link of extractedLinks) {
//           try {
//             await extractCarDetails(link.url, regionsId); // Передаём региональные данные
//             console.log(`Ссылка успешно обработана: ${link.url} с ценой ${link.currentPrice}`);
//           } catch (error) {
//             console.error(`Ошибка при обработке ссылки ${link.url}:`, error);
//           }
//         }

//         console.log(`Количество обработанных ссылок с ${searchPageUrl}:`, extractedLinks.length);
//       }
//     }

//     console.log('Все ссылки обработаны. Перезапуск процесса...');
//     await processAllPages(); // Рекурсивный вызов для перезапуска процесса

//   } catch (error) {
//     console.error('Ошибка:', error);
//     console.log('Перезапуск после ошибки...');
//     console.log('Все ссылки обработаны. Ожидание 10 секунд перед перезапуском...');
// await wait(10000);
//     await processAllPages(); // Перезапуск даже в случае ошибки
//   }
// }

// // Запуск основного процесса
// processAllPages();
// ___________________________________(рабочий без перезапуска)_________________________
// const fs = require('fs');
// const { extractAllLinks, extractRegionIds } = require('./linkExtractor');
// const { extractCarDetails } = require('./carDetailsExtractor');

// // Функция для извлечения всех значений region.id[] из URL

// async function processAllPages() {
//   try {
//     // Чтение ссылок из файла links.json
//     const data = fs.readFileSync('links.json', 'utf8');
//     const links = JSON.parse(data);

//     console.log('Извлеченные ссылки из JSON:', links);

//     // Проход по каждой ссылке из файла links.json
//     for (const key in links) {
//       if (links.hasOwnProperty(key)) {
//         const searchPageUrl = links[key].url;

//         const regionsId = extractRegionIds(searchPageUrl);

//         console.log('Извлеченные regionsId:', regionsId);

//         // Извлечение всех ссылок с текущей страницы поиска
//         const extractedLinks = await extractAllLinks(searchPageUrl);
//         console.log(`Извлеченные ссылки с ${searchPageUrl}:`, extractedLinks);

//         // Проход по извлеченным ссылкам с каждой страницы
//         for (const link of extractedLinks) {
//             try {
//                 await extractCarDetails(link.url, regionsId); // Передаем региональные данные
//                 console.log(`Ссылка успешно обработана: ${link.url} с ценой ${link.currentPrice}`);
//             } catch (error) {
//                 console.error(`Ошибка при обработке ссылки ${link.url}:`, error);
//             }
//         }

//         console.log(`Количество обработанных ссылок с ${searchPageUrl}:`, extractedLinks.length);
//       }
//     }

//   } catch (error) {
//     console.error('Ошибка:', error);
//   }
// }

// // Запуск основной функции
// processAllPages();
//_________________________________________________________________________
// const fs = require('fs');
// const { extractAllLinks } = require('./linkExtractor');
// const { extractCarDetails } = require('./carDetailsExtractor');

// async function processAllPages() {
//   try {
//     // Чтение ссылок из файла links.json
//     const data = fs.readFileSync('links.json', 'utf8');
//     const links = JSON.parse(data);

//     console.log('Извлеченные ссылки из JSON:', links);

//     // Проход по каждой ссылке из файла links.json
//     for (const key in links) {
//       if (links.hasOwnProperty(key)) {
//         const searchPageUrl = links[key].url;
//         const extractedLinks = await extractAllLinks(searchPageUrl);
//         console.log(`Извлеченные ссылки с ${searchPageUrl}:`, extractedLinks);

//         // Проход по извлеченным ссылкам с каждой страницы
//         for (const link of extractedLinks) {
//           try {
//             // Обработка каждой ссылки и извлечение деталей авто
//             await extractCarDetails(link.url);
//             console.log(`Ссылка успешно обработана: ${link.url} с ценой ${link.currentPrice}`);
//           } catch (error) {
//             console.error(`Ошибка при обработке ссылки ${link.url}:`, error);
//           }
//         }

//         console.log(`Количество обработанных ссылок с ${searchPageUrl}:`, extractedLinks.length);
//       }
//     }

//   } catch (error) {
//     console.error('Ошибка:', error);
//   }
// }

// processAllPages();
// _________________________________________________________________________________
// const fs = require('fs');
// const { extractAllLinks } = require('./linkExtractor');
// const { extractCarDetails } = require('./carDetailsExtractor');

// // В файле index.js больше не нужно сохранять ссылки в visitedLinks
// async function processAllPages() {
//   try {
//     // Чтение ссылок из файла links.json
//     const data = fs.readFileSync('links.json', 'utf8');
//     const links = JSON.parse(data);

//     console.log('Извлеченные ссылки из JSON:', links);

//     // Проход по каждой ссылке из файла links.json
//     for (const key in links) {
//       if (links.hasOwnProperty(key)) {
//         const searchPageUrl = links[key].url;
//         const extractedLinks = await extractAllLinks(searchPageUrl);
//         console.log(`Извлеченные ссылки с ${searchPageUrl}:`, extractedLinks);

//         // Проход по извлеченным ссылкам с каждой страницы
//         for (const link of extractedLinks) {
//           try {
//             // Обработка каждой ссылки и извлечение деталей авто
//             await extractCarDetails(link.url);
//             console.log(`Ссылка успешно обработана: ${link.url} с ценой ${link.currentPrice}`);
//           } catch (error) {
//             console.error(`Ошибка при обработке ссылки ${link.url}:`, error);
//           }
//         }

//         console.log(`Количество обработанных ссылок с ${searchPageUrl}:`, extractedLinks.length);
//       }
//     }

//   } catch (error) {
//     console.error('Ошибка:', error);
//   }
// }

// processAllPages();
//--------------------------------------------------------
// const fs = require('fs');
// const { extractAllLinks } = require('./linkExtractor');
// const { extractCarDetails } = require('./carDetailsExtractor');

// let visitedLinks = []; // Массив для хранения пройденных ссылок, даты их обработки и цены

// async function processAllPages() {
//   try {
//     // Чтение ссылок из файла links.json
//     const data = fs.readFileSync('links.json', 'utf8');
//     const links = JSON.parse(data);

//     console.log('Извлеченные ссылки из JSON:', links);

//     // Проход по каждой ссылке из файла links.json
//     for (const key in links) {
//       if (links.hasOwnProperty(key)) {
//         const searchPageUrl = links[key].url;
//         const extractedLinks = await extractAllLinks(searchPageUrl);
//         console.log(`Извлеченные ссылки с ${searchPageUrl}:`, extractedLinks);

//         // Проход по извлеченным ссылкам с каждой страницы
//         for (const link of extractedLinks) {
//           try {
//             // Обработка каждой ссылки и извлечение деталей авто
//             await extractCarDetails(link.url);

//             // Получение текущей даты
//             const processedDate = new Date().toLocaleString('ru-RU', {
//               timeZone: 'Europe/Kiev',
//               year: 'numeric',
//               month: 'numeric',
//               day: 'numeric',
//               hour: 'numeric',
//               minute: 'numeric',
//               second: 'numeric'
//             });

//             // Сохранение ссылки, даты обработки и цены в массив visitedLinks
//             visitedLinks.push({
//               url: link.url,
//               dateProcessed: processedDate,
//               price: link.price // Сохранение цены
//             });

//             console.log(`Ссылка успешно обработана: ${link.url} с ценой ${link.price}`);
//           } catch (error) {
//             console.error(`Ошибка при обработке ссылки ${link.url}:`, error);
//           }
//         }

//         console.log(`Количество обработанных ссылок с ${searchPageUrl}:`, extractedLinks.length);
//       }
//     }

//     // Сохранение массива visitedLinks в файл после обработки всех страниц
//     fs.writeFileSync('visitedLinks.json', JSON.stringify(visitedLinks, null, 2));
//     console.log('Список обработанных ссылок сохранен в visitedLinks.json');

//   } catch (error) {
//     console.error('Ошибка:', error);
//   }
// }

// processAllPages();
// -------------------------------------------------------------------
// const { extractAllLinks } = require('./linkExtractor');
// const { extractCarDetails } = require('./carDetailsExtractor');

// async function processAllPages() {
// const searchPageUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2006&year[0].lte=2020&categories.main.id=1&country.import.usa.not=-1&region.id[0]=11&price.USD.gte=5000&price.USD.lte=16000&price.currency=1&sort[0].order=price.asc&top=2&abroad.not=0&custom.not=1&page=0&size=20';
//   // const searchPageUrl = 'https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&year[0].gte=2018&year[0].lte=2023&categories.main.id=1&brand.id[0]=52&model.id[0]=53277&country.import.usa.not=-1&region.id[0]=11&price.currency=1&sort[0].order=price.asc&abroad.not=0&custom.not=1&page=0&size=20';
//   try {
//     const links = await extractAllLinks(searchPageUrl);
//     console.log('Извлеченные ссылки:', links);

//     for (const link of links) {
//       await extractCarDetails(link.url);
//     }

//     console.log('Количество обработанных ссылок:', links.length);
//   } catch (error) {
//     console.error('Ошибка:', error);
//   }
// }

// processAllPages();