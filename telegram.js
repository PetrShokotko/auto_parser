//-----------------------------------------------------
require('dotenv').config(); // Подключение переменных окружения из файла .env
const axios = require('axios');

// Получение токена и chat_id из переменных окружения
const botToken = process.env.BOT_TOKEN; 
const chatId = process.env.CHAT_ID; 

// Функция для отправки уведомления в Telegram
async function sendTelegramNotification(message) {
    // Отладочный вывод для проверки токена и chat_id
    console.log('botToken:', botToken);
    console.log('chatId:', chatId);

    try {
        // Отправка POST-запроса в Telegram API
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('Уведомление успешно отправлено в Telegram:', response.data);
    } catch (error) {
        console.error('Ошибка при отправке уведомления в Telegram:', error.response?.data || error.message);
    }
}

// Экспорт функции для использования в других файлах
module.exports = { sendTelegramNotification };
