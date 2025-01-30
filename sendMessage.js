const osaScript = require('node-osascript');
const fs = require('fs');
const path = require('path');

// Путь к файлам состояния, истории и разрешённых марок
const stateFilePath = path.join(__dirname, './smsData/smsState.json');
const historyFilePath = path.join(__dirname, './smsData/smsHistory.json');
const brandsFilePath = path.join(__dirname, './data/ria-values/smsIdAuto.json');

// Загрузка списка разрешённых марок
const brandsData = JSON.parse(fs.readFileSync(brandsFilePath, 'utf8'));
const allowedBrands = brandsData.brands.map(brand => brand.name);

// Функция для выбора случайного варианта сообщения
function getRandomMessage() {
    const messages = [
        "Добрый день! Интересует ваш {make} {model}. Могу предложить {price}$. Жду вашего ответа!",
    "Здравствуйте! Рассматриваю ваш {make} {model}. Готов предложить {price}$. Напишите, если интересно!",
    "Добрый день! Хочу купить ваш {make} {model} за {price}$. Если вам это подходит, дайте знать!",
    "Здравствуйте! Заинтересован в вашем {make} {model}. Предлагаю {price}$. Буду рад вашему ответу!",
    "Добрый день! Очень понравился ваш {make} {model}. Готов предложить {price}$. Жду вашего ответа!"
                // "Добрый день! Интересуюсь вашим {make} {model}. Могу предложить сумму в размере {price}$. Если предложение вам интересно, буду рад продолжить общение. Хорошего дня!",
                // "Здравствуйте! Рассматриваю возможность приобрести ваш {make} {model}. Готов предложить {price}$. Если вас это заинтересует, напишите, пожалуйста. Всего хорошего!",
                // "Здравствуйте! Хотел бы обсудить покупку вашего {make} {model}. Предлагаю рассмотреть сумму {price}$. Если есть интерес, буду рад вашегому ответу. Хорошего дня!",
                // "Добрый день! Я заинтересован в вашем {make} {model}. Со своей стороны готов предложить {price}$. Если вы готовы к диалогу, дайте знать. Всего вам доброго!",
                // "Здравствуйте! Очень заинтересовался вашим {make} {model}. Могу предложить {price}$ за авто. Если предложение вас устраивает, буду рад связаться. Хорошего дня!",
                // "Добрый день! Увидел ваш {make} {model} и хотел бы предложить сумму в размере {price}$. Надеюсь, предложение вызовет интерес, и мы сможем обсудить детали. Хорошего дня!",
                // "Здравствуйте! Предлагаю {price}$ за ваш {make} {model}. Если вам интересно мое предложение, буду рад ответу. Желаю вам всего наилучшего!",
                // "Добрий день! Я зацікавлений у вашому {make} {model}. Зі свого боку готовий запропонувати {price}$. Якщо ви готові до діалогу, дайте знати. Усього вам доброго!",
                // "Добрий день! Дуже сподобався ваш {make} {model}. Готовий запропонувати {price}$ і обговорити всі деталі. Напишіть, якщо пропозиція здасться вам підходящою. Гарного настрою!"

            ];
    return messages[Math.floor(Math.random() * messages.length)];
}

// Функция для чтения состояния
function readState() {
    if (!fs.existsSync(stateFilePath)) {
        const initialState = { sentCount: 0, sendingEnabled: true, limit: 1000, sendInterval: 25 };
        fs.writeFileSync(stateFilePath, JSON.stringify(initialState, null, 2));
        return initialState;
    }
    const data = fs.readFileSync(stateFilePath, 'utf8');
    return JSON.parse(data);
}

// Функция для сохранения состояния
function saveState(state) {
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
}

// Функция для получения текущей даты в формате YYYY-MM-DD HH:MM:SS
function getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Функция для записи истории
function logHistory(phoneNumber, messageText) {
    const historyEntry = {
        phoneNumber: phoneNumber,
        message: messageText,
        date: getFormattedDate()
    };

    let history = [];
    if (fs.existsSync(historyFilePath)) {
        try {
            const data = fs.readFileSync(historyFilePath, 'utf8');
            history = JSON.parse(data);
        } catch (error) {
            console.error("Ошибка чтения истории сообщений:", error);
        }
    }

    history.push(historyEntry);

    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
}

// Функция для получения времени последней отправки
function getLastSentTime() {
    if (!fs.existsSync(historyFilePath)) {
        return null;
    }

    const data = fs.readFileSync(historyFilePath, 'utf8');
    const history = JSON.parse(data);
    if (history.length === 0) {
        return null;
    }

    return new Date(history[history.length - 1].date);
}

// Функция для отправки сообщения через iMessage или SMS
// _________________________без 8183_____________________________
function sendSMSorIMessage(phoneNumber, make, model, proposePrice) {
    const state = readState();

    // Проверка, входит ли марка в список разрешённых
    if (!allowedBrands.includes(make)) {
        console.log(`Марка ${make} не разрешена для отправки сообщения.`);
        return;
    }

    const lastSentTime = getLastSentTime();
    const now = new Date();
    // 8183
    const fullPhoneNumber = `81838${phoneNumber}`;
    const sendMessage = () => {
        const messageText = getRandomMessage()
            .replace("{make}", make)
            .replace("{model}", model)
            .replace("{price}", proposePrice);

        console.log(`Сообщение на ${phoneNumber}: "${messageText}"`);

        if (!state.sendingEnabled) {
            console.log("Отправка сообщений отключена.");
            return;
        }

        if (state.sentCount >= state.limit) {
            console.log(`Превышен лимит сообщений (${state.limit}). Отправка отключена.`);
            state.sendingEnabled = false;
            saveState(state);
            return;
        }

        const appleScript = `
        set phoneNumber to "${fullPhoneNumber}"
        set messageText to "${messageText}"

        tell application "Messages"
            set targetService to 1st service whose service type = SMS
            set targetBuddy to buddy phoneNumber of targetService
            send messageText to targetBuddy
            return "Сообщение отправлено через SMS на " & phoneNumber
        end tell
        `;

        osaScript.execute(appleScript, (error, result, raw) => {
            if (error) {
                console.error("Ошибка при отправке сообщения:", error);
            } else {
                console.log(result);
                state.sentCount += 1;
                saveState(state);
                logHistory(phoneNumber, messageText);
            }
        });
    };

    if (lastSentTime) {
        const timeDifference = Math.floor((now - lastSentTime) / 1000);
        if (timeDifference < state.sendInterval) {
            const waitTime = (state.sendInterval - timeDifference) * 1000;
            console.log(`Пропуск отправки. До следующей отправки осталось ${state.sendInterval - timeDifference} секунд.`);
            setTimeout(sendMessage, waitTime);
            return;
        }
    }

    sendMessage();
}

// Экспортируем функции
module.exports = { sendSMSorIMessage, getRandomMessage };
// _________________________(Рабочий код)______________
// const osaScript = require('node-osascript');
// const fs = require('fs');

// // Загрузка списка марок из файла JSON
// const brandsData = JSON.parse(fs.readFileSync('./data/ria-values/smsIdAuto.json', 'utf8'));
// const allowedBrands = brandsData.brands.map(brand => brand.name);

// // Функция для выбора случайного варианта сообщения
// function getRandomMessage() {
//     const messages = [
//         "Готов предложить за ваш {make} {model} {price}. Если вас это устраивает, жду ответа. Хорошего дня!",
//         "Могу предложить {price} за ваш {make} {model}. Если интересно, дайте знать. Хорошего дня!",
//         "Предлагаю {price} за ваш {make} {model}. Если предложение вас заинтересует, ответьте, пожалуйста. Хорошего дня!",
//         "Мое предложение за ваш {make} {model} – {price}. Если согласны, буду рад ответу. Хорошего дня!",
//         "Предлагаю {price} за ваш {make} {model}. Напишите, если это предложение вас устраивает. Хорошего дня!",
//         "Готов купить ваш {make} {model} за {price}. Жду вашего ответа, если заинтересованы. Хорошего дня!",
//         "За ваш {make} {model} могу предложить {price}. Если заинтересует, напишите мне. Хорошего дня!",
//         "Готов предложить {price} за ваш {make} {model}. Если предложение подходит, прошу ответить. Хорошего дня!",
//         "Могу предложить {price} за ваш {make} {model}. Жду вашего ответа, если вы согласны. Хорошего дня!"
//     ];
//     return messages[Math.floor(Math.random() * messages.length)];
// }

// // Функция отправки сообщения через iMessage или SMS с проверкой марки
// function sendSMSorIMessage(phoneNumber, make, model, price, testMode = true) {
//     // Проверка, входит ли марка в список разрешенных
//     if (!allowedBrands.includes(make)) {
//         console.log(`Марка ${make} не разрешена для отправки сообщения.`);
//         return;
//     }

//     const messageText = getRandomMessage()
//         .replace("{make}", make)
//         .replace("{model}", model)
//         .replace("{price}", price);

//     if (testMode) {
//         console.log(`Сообщение отправлено на ${phoneNumber}: ${messageText}`);
//         return;
//     }

//     const appleScript = `
//     set phoneNumber to "${phoneNumber}"
//     set messageText to "${messageText}"

//     tell application "Messages"
//         set targetService to 1st service whose service type = iMessage
//         if exists (buddy phoneNumber of targetService) then
//             set targetBuddy to buddy phoneNumber of targetService
//             send messageText to targetBuddy
//             return "Сообщение отправлено через iMessage на " & phoneNumber
//         else
//             set targetService to 1st service whose service type = SMS
//             set targetBuddy to buddy phoneNumber of targetService
//             send messageText to targetBuddy
//             return "Сообщение отправлено через SMS на " & phoneNumber
//         end if
//     end tell
//     `;

//     osaScript.execute(appleScript, (error, result, raw) => {
//         if (error) {
//             console.error("Ошибка при отправке сообщения:", error);
//         } else {
//             console.log(result);
//         }
//     });
// }

// module.exports = { sendSMSorIMessage, getRandomMessage };
// _______________________________________________________________
// const osaScript = require('node-osascript');

// // Функция для выбора случайного варианта сообщения
// function getRandomMessage() {
//     const messages = [
        // "Готов предложить за ваш {make} {model} {price}. Если вас это устраивает, жду ответа. Хорошего дня!",
        // "Могу предложить {price} за ваш {make} {model}. Если интересно, дайте знать. Хорошего дня!",
        // "Предлагаю {price} за ваш {make} {model}. Если предложение вас заинтересует, ответьте, пожалуйста. Хорошего дня!",
        // "Мое предложение за ваш {make} {model} – {price}. Если согласны, буду рад ответу. Хорошего дня!",
        // "Предлагаю {price} за ваш {make} {model}. Напишите, если это предложение вас устраивает. Хорошего дня!",
        // "Готов купить ваш {make} {model} за {price}. Жду вашего ответа, если заинтересованы. Хорошего дня!",
        // "За ваш {make} {model} могу предложить {price}. Если заинтересует, напишите мне. Хорошего дня!",
        // "Готов предложить {price} за ваш {make} {model}. Если предложение подходит, прошу ответить. Хорошего дня!",
        // "Могу предложить {price} за ваш {make} {model}. Жду вашего ответа, если вы согласны. Хорошего дня!"
//     ];
    
//     // Возвращаем случайное сообщение
//     return messages[Math.floor(Math.random() * messages.length)];
// }

// // Функция для отправки сообщения через iMessage или SMS
// function sendSMSorIMessage(phoneNumber) {
//     const messageText = getRandomMessage();  // Получаем случайное сообщение

//     const appleScript = `
//     set phoneNumber to "${phoneNumber}"
//     set messageText to "${messageText}"

//     tell application "Messages"
//         set targetService to 1st service whose service type = iMessage
//         if exists (buddy phoneNumber of targetService) then
//             -- Если iMessage доступен, отправляем через iMessage
//             set targetBuddy to buddy phoneNumber of targetService
//             send messageText to targetBuddy
//             return "Сообщение отправлено через iMessage на " & phoneNumber
//         else
//             -- Если iMessage недоступен, отправляем через SMS
//             set targetService to 1st service whose service type = SMS
//             set targetBuddy to buddy phoneNumber of targetService
//             send messageText to targetBuddy
//             return "Сообщение отправлено через SMS на " & phoneNumber
//         end if
//     end tell
//     `;

//     // Выполнение AppleScript через osascript
//     osaScript.execute(appleScript, (error, result, raw) => {
//         if (error) {
//             console.error("Ошибка при отправке сообщения:", error);
//         } else {
//             console.log(result);  // Логирование результата
//         }
//     });
// }

// // Отправка сообщения на номер 0972227256
// sendSMSorIMessage('0972227256');