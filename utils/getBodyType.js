const getBodyType = async (page) => {
    return await page.evaluate(() => {
        // Определяем возможные типы кузова
        const bodyTypes = [
            "Седан", "Позашляховик / Кросовер", "Мінівен", "Мікровен", "Хетчбек", "Універсал", 
            "Купе", "Кабріолет", "Пікап", "Ліфтбек", "Фастбек", "Лімузин", "Родстер"
        ];

        // Ищем элемент, содержащий тип кузова на странице
        const bodyTypeElement = Array.from(document.querySelectorAll('dd')).find(el => 
            bodyTypes.some(type => el.textContent.includes(type))
        );

        // Если нашли элемент, проверяем и возвращаем тип кузова, иначе - "не указано"
        if (bodyTypeElement) {
            const matchedType = bodyTypes.find(type => bodyTypeElement.textContent.includes(type));
            return matchedType || 'не указано';
        }
        return 'не указано';
    });
};

module.exports = { getBodyType };