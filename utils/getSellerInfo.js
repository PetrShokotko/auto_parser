const getSellerInfo = async (page) => {
    try {
        let sellerName = await page.evaluate(() => {
            const h4SellerNameElement = document.querySelector('h4.seller_info_name a');
            
            if (!h4SellerNameElement) {
                const sellerNameElement = document.querySelector('.seller_info_name.bold') || 
                                          document.querySelector('.seller_info .bold');
                return sellerNameElement ? sellerNameElement.textContent.trim() : null;
            }

            return h4SellerNameElement.textContent.trim();
        });

        if (!sellerName) sellerName = 'не указан';

        let location = await page.evaluate(() => {
            const breadcrumbsElement = document.querySelector('#breadcrumbs');
            if (breadcrumbsElement) {
                const breadcrumbsText = breadcrumbsElement.textContent.trim();
                const match = breadcrumbsText.match(/(?:[A-Za-zА-Яа-я]+)\s+(?:[A-Za-zА-Яа-я]+)\s+(.+)/);
                return match ? match[1].trim() : null;
            }
            return null;
        });

        if (!location) {
            location = await page.evaluate(() => {
                const locationElement = document.querySelector('#userInfoBlock li.item .item_inner');
                return locationElement ? locationElement.textContent.trim() : null;
            });
        }

        if (!location) location = 'не указан';

        return { sellerName, location };
    } catch (error) {
        console.error('Ошибка при получении информации о продавце и местоположении:', error);
        return { sellerName: 'не указан', location: 'не указан' };
    }
};

module.exports = { getSellerInfo };