async function extractPhoneNumbers(page) {
    let attempt = 0; // Счетчик попыток

    while (attempt < 3) {
        attempt++;
        console.log(`Попытка ${attempt}`);

        try {
            // Проверяем, удалено ли объявление
            const isDeleted = await page.evaluate(() => {
                const deletedNotice = document.querySelector('div#autoDeletedTopBlock');
                return deletedNotice !== null;
            });

            if (isDeleted) {
                console.log(`Объявление на странице удалено или продано.`);
                break;
            }

            // Ждем кнопку для показа номера телефона
            await page.waitForSelector('a.size14.phone_show_link.link-dotted.mhide', { visible: true, timeout: 10000 });

            // Прокручиваем к кнопке "показати"
            await page.evaluate(() => {
                const element = document.querySelector('a.size14.phone_show_link.link-dotted.mhide');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });

            // Небольшая задержка для завершения прокрутки
            await new Promise(resolve => setTimeout(resolve, 500));

            // Клик по кнопке для отображения номера телефона
            await page.click('a.size14.phone_show_link.link-dotted.mhide');
            console.log('Выполнен клик для показа номера(ов) телефона.');

            // Дополнительная задержка для загрузки номеров
            await new Promise(resolve => setTimeout(resolve, 500));

            // Ожидание появления номеров телефонов на странице
            await page.waitForSelector('span.phone.bold', { visible: true, timeout: 20000 });

            // Извлечение всех номеров телефонов
            const phoneNumbers = await page.evaluate(() => {
                const phoneElements = Array.from(document.querySelectorAll('span.phone.bold'));
                return phoneElements.map(el => el.textContent.trim().replace(/[()\s-]/g, ''));
            });

            // Удаляем дубликаты и проверяем, что номера корректные
            const uniquePhoneNumbers = [...new Set(phoneNumbers)].filter(num => num !== '' && !num.includes('показати'));

            console.log(`Найдено номера на странице:`, uniquePhoneNumbers);

            // Если найдены корректные номера, возвращаем их
            return {
                phone1: uniquePhoneNumbers[0] || 'не указан',
                phone2: uniquePhoneNumbers[1] || 'не указан',
                phone3: uniquePhoneNumbers[2] || 'не указан'
            };
        } catch (error) {
            console.error('Ошибка при извлечении номеров телефонов:', error);
        }
    }

    return { phone1: 'не указан', phone2: 'не указан', phone3: 'не указан' };
}

module.exports = { extractPhoneNumbers };
// const puppeteer = require('puppeteer');

// // Функция для извлечения номера телефона со страницы
// async function extractPhoneNumbers(url) {
//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();
//     await page.goto(url);

//     try {
//         // Ожидание кнопки показа номера телефона
//         await page.waitForSelector('a.size14.phone_show_link.link-dotted.mhide', { visible: true, timeout: 20000 });

//         // Клик по кнопке, чтобы отобразить номер телефона
//         await page.click('a.size14.phone_show_link.link-dotted.mhide');

//         // Ожидание появления номера телефона
//         await page.waitForSelector('div.popup-successful-call-desk.size24.bold.green.mhide, span.phone.bold', { visible: true, timeout: 20000 });

//         // Извлечение номера телефона
//         const phoneNumbers = await page.evaluate(() => {
//             // Ищем элементы с номерами телефона
//             const phoneElements = Array.from(document.querySelectorAll('div.popup-successful-call-desk.size24.bold.green.mhide, span.phone.bold'));
//             // Возвращаем текстовое содержание первых двух элементов с номерами телефона
//             return phoneElements.slice(0, 2).map(el => el.textContent.trim());
//         });

//         // Форматирование номеров телефона
//         const formattedPhoneNumbers = phoneNumbers.map(number =>
//             number.replace(/[()\s-]/g, '')
//         );

//         console.log(`Extracted Phone Numbers for ${url}:`, formattedPhoneNumbers);

//         return {
//             phone1: formattedPhoneNumbers[0] || 'не указан',
//             phone2: formattedPhoneNumbers[1] || 'не указан'
//         };
//     } catch (error) {
//         console.error('Ошибка при извлечении номеров телефонов:', error);
//         return { phone1: 'не указан', phone2: 'не указан' };
//     } finally {
//         await page.close();
//         await browser.close();
//     }
// }

// module.exports = { extractPhoneNumbers };