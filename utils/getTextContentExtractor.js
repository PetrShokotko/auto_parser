const getTextContent = async (page, selector) => {
    try {
        return await page.$eval(selector, el => el.textContent.trim());
    } catch (error) {
        return null;
    }
};

module.exports = { getTextContent };