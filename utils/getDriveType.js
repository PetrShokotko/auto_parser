const getDriveType = async (page) => {
    return await page.evaluate(() => {
        const ddElements = Array.from(document.querySelectorAll('dd'));
        const element = ddElements.find(el => el.textContent.includes('Привід'));
        return element ? element.querySelector('.argument').textContent.trim() : 'не указано';
    });
};

module.exports = { getDriveType };