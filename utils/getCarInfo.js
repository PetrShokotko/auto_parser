const getCarInfo = async (page) => {
    return await page.evaluate(() => {
        let engineVol = null;
        let fuelType = null;

        const detailsElements = document.querySelectorAll('dd');
        detailsElements.forEach((element) => {
            if (element.textContent.includes('Двигун')) {
                const argumentSpan = element.querySelector('span.argument');
                if (argumentSpan) {
                    const textContent = argumentSpan.textContent.trim();
                    const engineMatch = textContent.match(/(\d+(\.\d+)?)\s*л/);
                    if (engineMatch) {
                        engineVol = engineMatch[1];
                    }
                }
            }
        });

        if (!engineVol) {
            engineVol = 'не указан';
        } else {
            if (engineVol.includes('.')) {
                engineVol = parseFloat(engineVol).toFixed(1);
            } else {
                engineVol = `${engineVol}.0`;
            }
        }

        detailsElements.forEach((element) => {
            if (element.textContent.includes('Двигун')) {
                const argumentSpan = element.querySelector('span.argument');
                if (argumentSpan) {
                    const clonedArgumentSpan = argumentSpan.cloneNode(true);
                    const orangeElements = clonedArgumentSpan.querySelectorAll('.orange');
                    orangeElements.forEach((orangeElement) => orangeElement.remove());

                    const textContent = clonedArgumentSpan.textContent.trim();
                    let fuelMatch = textContent.split('•');
                    if (fuelMatch.length > 1) {
                        fuelType = fuelMatch[1].trim();
                    } else {
                        fuelType = textContent;
                    }

                    fuelType = fuelType.trim();
                }
            }
        });

        if (!fuelType) {
            fuelType = 'не указан';
        }

        return { engineVol, fuelType };
    });
};

module.exports = { getCarInfo };