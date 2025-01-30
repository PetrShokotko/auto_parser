const { getTextContent } = require('./getTextContentExtractor');

const getVIN = async (page) => {
    try {
        let vin = await getTextContent(page, '.label-vin');
        if (vin && /x{4}/.test(vin)) return 'не указан';
        if (vin) return vin;

        vin = await page.evaluate(() => {
            const vinElement = document.querySelector('.vin-code');
            return vinElement ? vinElement.textContent.trim() : null;
        });

        if (vin && /x{4}/.test(vin)) return 'не указан';

        return vin || 'не указан';
    } catch (error) {
        console.error('Ошибка при получении VIN кода:', error);
        return 'не указан';
    }
};

module.exports = { getVIN };