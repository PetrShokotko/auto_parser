const fs = require('fs');

async function getDamageDetails(page) {
    const wasDamaged = await page.evaluate(() => {
        const listItems = document.querySelectorAll('.unstyle.label-param .item');
        // Проверяем наличие текста "Був в ДТП"
        return Array.from(listItems).some(item => item.textContent.includes('Був в ДТП'));
    });

    // Возвращаем соответствующую строку
    return wasDamaged ? "Був у ДТП" : "Не був у ДТП";
}

module.exports = { getDamageDetails };
