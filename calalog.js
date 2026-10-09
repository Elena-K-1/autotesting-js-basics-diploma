const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

describe('Каталог товаров Intershop', function () {
  this.timeout(30000);

  let driver;
  const CATALOG_URL = 'https://intershop5.skillbox.ru/product-category/catalog/';

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 5000 });
    await driver.get(CATALOG_URL);
  });

  after(async function () {
    await driver.quit();
  });

  // 1. Заголовок и URL страницы каталога
  it('страница каталога открывается с корректным URL', async function () {
    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.include('/product-category/catalog/');

    const title = await driver.getTitle();
    expect(title).to.include('Skillbox');
  });

  // 2. Хлебные крошки присутствуют
  it('хлебные крошки отображаются на странице каталога', async function () {
    const breadcrumbs = await driver.wait(
      until.elementLocated(
        By.css('.woocommerce-breadcrumb, .breadcrumbs, .breadcrumb, nav.breadcrumb')
      ),
      10000
    );
    expect(await breadcrumbs.isDisplayed()).to.be.true;
  });

  // 3. На странице отображаются товары
  it('на странице каталога отображаются карточки товаров', async function () {
    const products = await driver.wait(
      until.elementsLocated(
        By.css('ul.products li.product, .wc-block-grid__product, li.type-product, .product-inner')
      ),
      10000
    );
    expect(products.length).to.be.greaterThan(0);
  });

  // 4. Карточки товаров содержат название, цену и изображение
  it('карточки товаров содержат название, цену и изображение', async function () {
    const result = await driver.executeScript(`
      const container = document.querySelector('ul.products, .wc-block-grid, .products');
      if (!container) return { found: false, reason: 'Контейнер товаров не найден' };

      const images = container.querySelectorAll('img');
      const hasVisibleImage = Array.from(images).some(
        img => img.offsetWidth > 0 && img.offsetHeight > 0 && img.src
      );

      const titles = container.querySelectorAll('h2, h3, h4, .woocommerce-loop-product__title, .product-title, .title');
      const hasTitle = Array.from(titles).some(
        el => el.textContent.trim().length > 0 && el.offsetWidth > 0
      );

      let hasTitleLink = false;
      if (!hasTitle) {
        const links = container.querySelectorAll('a');
        hasTitleLink = Array.from(links).some(
          a => a.textContent.trim().length > 3 && a.offsetWidth > 0
        );
      }

      const allText = container.innerText || container.textContent || '';
      const priceMatch = allText.match(/[\\d\\s.,]+\\s*[₽рруб]/i);

      return {
        found: true,
        hasImage: hasVisibleImage,
        hasTitle: hasTitle || hasTitleLink,
        hasPrice: !!priceMatch,
        debug: {
          imageCount: images.length,
          titleCount: titles.length,
          textPreview: allText.substring(0, 300)
        }
      };
    `);

    expect(result.found, 'Секция товаров не найдена').to.be.true;
    expect(result.hasImage, 'Изображение товара отсутствует').to.be.true;
    expect(result.hasTitle, 'Название товара отсутствует').to.be.true;
    expect(result.hasPrice, 'Цена не найдена: ' + (result.debug?.textPreview || '')).to.be.true;
  });

  // 5. У товаров есть кнопка добавления в корзину
  it('у товаров на странице есть кнопка «В корзину»', async function () {
    const addButtons = await driver.findElements(
      By.css(
        '.add_to_cart_button, .ajax_add_to_cart, a[href*="add-to-cart"], button[type="submit"][name="add-to-cart"]'
      )
    );
    expect(addButtons.length).to.be.greaterThan(0);
  });

  // 6. Отображается информация о количестве товаров
  it('на странице отображается счётчик количества товаров', async function () {
    const resultCount = await driver.wait(
      until.elementLocated(
        By.css('.woocommerce-result-count, .result-count, .products-count')
      ),
      10000
    );
    expect(await resultCount.isDisplayed()).to.be.true;
    expect(await resultCount.getText()).to.not.be.empty;
  });

  // 7. Пагинация присутствует и работает
  it('пагинация позволяет перейти на следующую страницу', async function () {
    let pagination;
    try {
      pagination = await driver.findElement(
        By.css('.woocommerce-pagination, .pagination, .page-numbers, nav.pagination')
      );
    } catch (e) {
      this.skip();
    }

    expect(await pagination.isDisplayed()).to.be.true;

    const nextLink = await pagination.findElement(
      By.css('a.next, .next.page-numbers, a[rel="next"], li a.next')
    );

    const urlBefore = await driver.getCurrentUrl();
    await nextLink.click();

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url !== urlBefore;
      },
      10000,
      'URL не изменился после перехода на следующую страницу'
    );

    const products = await driver.wait(
      until.elementsLocated(
        By.css('ul.products li.product, .wc-block-grid__product, li.type-product, .product-inner')
      ),
      10000
    );
    expect(products.length).to.be.greaterThan(0);
  });

  // 8. Клик по товару открывает его карточку
  it('клик по товару открывает страницу товара', async function () {
    await driver.get(CATALOG_URL);

    const productLink = await driver.wait(
      until.elementLocated(By.css('a[href*="/product/"]')),
      10000
    );

    const urlBefore = await driver.getCurrentUrl();
    await productLink.click();

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url !== urlBefore && url.includes('/product/');
      },
      10000,
      'Переход на страницу товара не произошёл'
    );

    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.include('/product/');
  });
});
