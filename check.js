const puppeteer = require('puppeteer');

async function checkPhoneNumber(phoneNumber) {
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
    });
    const page = await browser.newPage();

    await page.goto('https://autopartner.incolor.agency/auth/login');

    await page.waitForSelector('input[name="phone"]');
    await page.type('input[name="phone"]', phoneNumber);

    const inputValue = await page.$eval('input[name="phone"]', el => el.value);
    console.log(`Номер телефона введен: ${inputValue}`);

    await page.click('input[type="submit"]');
    await page.waitForSelector('table tbody');

    const tableData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.map(row => {
            const columns = row.querySelectorAll('td');
            const link = columns[10]?.querySelector('a')?.href || '';
            const id = link ? link.match(/_(\d+)\.html$/)?.[1] || '' : '';
            
            let phone = columns[7]?.innerText.trim() || '';
            if (phone.startsWith('+380')) {
                phone = phone.replace('+380', '0');
            }

            return {
                id,
                brand: columns[3]?.innerText.trim() || '',
                model: columns[4]?.innerText.trim() || '',
                year: columns[5]?.innerText.trim() || '',
                price: columns[6]?.innerText.trim() || '',
                platform: columns[9]?.innerText.trim() || '',
                link,
                phone,
                city: columns[2]?.innerText.trim() || '',
                dateAdded: columns[1]?.innerText.trim() || ''
            };
        });
    });

    try {
        console.log('Закрытие браузера после извлечения данных...');
        await browser.close();
    } catch (error) {
        console.error('Ошибка при закрытии браузера:', error);
    }

    const filteredTableData = tableData.filter(row => 
        row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
    );

    const cars = filteredTableData.map(car => ({
        vin: "не указан",
        licensePlate: "не указан",
        id: car.id,
        url: car.link,
        platform: car.platform,
        date: car.dateAdded,
        mark: car.brand,
        model: car.model,
        year: parseInt(car.year, 10),
        price: car.price.replace('$', '') + ' $'
    }));

    
    return cars;
}

module.exports = { checkPhoneNumber };
// const puppeteer = require('puppeteer');

// (async () => {
//     // Запускаем браузер в фоновом режиме
//     const browser = await puppeteer.launch({
//         headless: true, // скрываем браузер
//         defaultViewport: null, // полноразмерный браузер
//     });
//     const page = await browser.newPage();

//     // Переходим по указанной ссылке
//     await page.goto('https://autopartner.incolor.agency/auth/login');

//     // Ваша переменная с номером телефона
//     const phoneNumber = '0979097544';

//     // Ждем появления формы и вводим номер телефона
//     await page.waitForSelector('input[name="phone"]'); // Ждем, пока элемент появится на странице
//     await page.type('input[name="phone"]', phoneNumber); // Вводим номер телефона

//     // Убедимся, что номер телефона был введен
//     const inputValue = await page.$eval('input[name="phone"]', el => el.value);
//     console.log(`Номер телефона введен: ${inputValue}`);

//     // Находим кнопку "найти" и кликаем по ней для отправки формы
//     await page.click('input[type="submit"]');

//     // Ждем появления таблицы
//     await page.waitForSelector('table tbody'); // Ждем, пока таблица с результатами появится на странице

//     // Извлекаем данные таблицы и преобразуем их в массив объектов
//     const tableData = await page.evaluate(() => {
//         const rows = Array.from(document.querySelectorAll('table tbody tr')); // Находим все строки таблицы

//         // Преобразуем строки таблицы в массив объектов с нужной структурой
//         return rows.map(row => {
//             const columns = row.querySelectorAll('td'); // Все ячейки строки
//             const link = columns[10]?.querySelector('a')?.href || ''; // Ссылка
//             // Извлекаем ID из ссылки
//             const id = link ? link.match(/_(\d+)\.html$/)?.[1] || '' : '';
            
//             // Преобразуем номер телефона к нужному формату
//             let phone = columns[7]?.innerText.trim() || '';
//             if (phone.startsWith('+380')) {
//                 phone = phone.replace('+380', '0'); // Заменяем +380 на 0
//             }

//             return {
//                 id, // Добавляем id из ссылки
//                 brand: columns[3]?.innerText.trim() || '',
//                 model: columns[4]?.innerText.trim() || '',
//                 year: columns[5]?.innerText.trim() || '',
//                 price: columns[6]?.innerText.trim() || '',
//                 platform: columns[9]?.innerText.trim() || '',
//                 link,
//                 phone, // Преобразованный номер телефона
//                 city: columns[2]?.innerText.trim() || '',
//                 dateAdded: columns[1]?.innerText.trim() || ''
//             };
//         });
//     });

//     // Фильтруем пустые записи (если все поля пустые)
//     const filteredTableData = tableData.filter(row => 
//         row.id || row.brand || row.model || row.year || row.price || row.platform || row.link || row.phone || row.city || row.dateAdded
//     );

//     // Преобразуем данные к новому формату
//     const cars = filteredTableData.map(car => ({
//         vin: "не указан", // Значение по умолчанию
//         licensePlate: "не указан", // Значение по умолчанию
//         id: car.id, // ID из ссылки
//         url: car.link, // Ссылка на страницу авто
//         platform: car.platform, // Платформа
//         date: car.dateAdded, // Дата добавления
//         mark: car.brand, // Бренд авто
//         model: car.model, // Модель авто
//         year: parseInt(car.year, 10), // Год выпуска как число
//         price: car.price // Цена авто
//     }));

//     console.log(cars);

//     // Ждем немного, чтобы убедиться, что данные выведены
//     await new Promise(resolve => setTimeout(resolve, 10000));

//     await browser.close();
// })();