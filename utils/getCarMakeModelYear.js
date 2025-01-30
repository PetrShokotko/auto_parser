const { getTextContent } = require('./getTextContentExtractor');

const getCarMakeModelYear = async (page) => {
    let makeModelYear = await getTextContent(page, '.heading h1.head') || 'не указано';
    const makeModelMatch = makeModelYear.match(/^(.*)\s(\d{4})$/);

    let make = 'не указано';
    let model = 'не указано';
    let year = 'не указан';

    if (makeModelMatch) {
        make = makeModelMatch[1].split(' ')[0] || 'не указано';
        model = makeModelMatch[1].split(' ').slice(1).join(' ') || 'не указано';
        year = makeModelMatch[2];
    }

    return { make, model, year };
};
module.exports = { getCarMakeModelYear };