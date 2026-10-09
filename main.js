const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

describe('Главная страница Intershop', function () {
  this.timeout(30000);

  let driver;
  const BASE_URL = 'https://intershop5.skillbox.ru/';

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 5000 });
    await driver.get(BASE_URL);
  });

  after(async function () {
    await driver.quit();
  });

  // 1. Заголовок страницы
  it('заголовок страницы — «Skillbox — Интернет магазин»', async function () {
    const title = await driver.getTitle();
    expect(title).to.include('Skillbox');
  });

  // 2. Логотип
  it('логотип Skillbox отображается на странице', async function () {
    const logo = await driver.wait(
      until.elementLocated(
        By.css('.site-logo, .logo, img[alt*="Skillbox"], img[alt*="skillbox"], a[href*="skillbox"] img, .custom-logo')
      ),
      10000
    );
    expect(await logo.isDisplayed()).to.be.true;
  });

  // 3. Меню навигации — проверяем по href, а не по тексту
  it('меню навигации содержит ссылки на разделы', async function () {
    const nav = await driver.wait(
      until.elementLocated(
        By.css('nav, .main-navigation, .menu, .primary-menu, .site-navigation')
      ),
      10000
    );
    expect(await nav.isDisplayed()).to.be.true;

    const links = await nav.findElements(By.css('a'));
    expect(links.length).to.be.greaterThan(0);

    // Проверяем, что хотя бы одна ссылка ведёт на каталог/магазин
    let hasCatalog = false;
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && (href.includes('shop') || href.includes('product-category') || href.includes('catalog'))) {
        hasCatalog = true;
        break;
      }
    }
    expect(hasCatalog, 'Ссылка на каталог не найдена в меню').to.be.true;
  });

  // 4. Форма поиска
  it('форма поиска принимает ввод и переходит к результатам', async function () {
    let searchInput;
    try {
      searchInput = await driver.findElement(
        By.css('input[type="search"], input[name="s"], input.search-field, .woocommerce-product-search input')
      );
    } catch (e) {
      const searchToggle = await driver.findElement(
        By.css('.search-toggle, .search-button, a[href*="search"], button.search')
      );
      await searchToggle.click();
      await driver.sleep(1000);
      searchInput = await driver.wait(
        until.elementLocated(
          By.css('input[type="search"], input[name="s"], input.search-field')
        ),
        5000
      );
    }

    await searchInput.clear();
    await searchInput.sendKeys('товар');

    const searchForm = await searchInput.findElement(By.xpath('ancestor::form'));
    await searchForm.submit();

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url.includes('?s=') || url.includes('search');
      },
      10000,
      'Переход к результатам поиска не произошёл'
    );

    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.match(/\?s=|search/i);
  });

  // 5. Блок «Распродажа» — через CSS, не XPath :has()
  it('блок «Распродажа» присутствует и отображается', async function () {
    await driver.get(BASE_URL);
    await driver.sleep(1000);

    // Ищем по тексту через JS — надёжнее, чем XPath
    const result = await driver.executeScript(`
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text === 'Распродажа' || text === 'распродажа' || text === 'Sale' || text === 'sale') {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            return { found: true, tag: el.tagName, text: text };
          }
        }
      }
      // Также ищем .onsale бейдж
      const onsale = document.querySelector('.onsale');
      if (onsale && onsale.offsetWidth > 0) return { found: true, tag: 'onsale', text: onsale.textContent };
      return { found: false };
    `);

    expect(result.found, 'Блок «Распродажа» не найден').to.be.true;
  });

  // 6. Блок «Новые поступления» — через JS
  it('блок «Новые поступления» присутствует и отображается', async function () {
    const result = await driver.executeScript(`
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text === 'Новые поступления' || text === 'новые поступления' ||
            text === 'New arrivals' || text === 'New' || text === 'new') {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            return { found: true, tag: el.tagName, text: text };
          }
        }
      }
      return { found: false };
    `);

    expect(result.found, 'Блок «Новые поступления» не найден').to.be.true;
  });

  // 7. Кнопка добавления в корзину
  it('на странице есть кнопка добавления товара в корзину', async function () {
    const addButtons = await driver.findElements(
      By.css('.add_to_cart_button, .ajax_add_to_cart, a[href*="add-to-cart"], button[type="submit"][name="add-to-cart"]')
    );
    expect(addButtons.length).to.be.greaterThan(0);
  });

  // 8. Подвал сайта
  it('подвал сайта присутствует на странице', async function () {
    const footer = await driver.wait(
      until.elementLocated(By.css('footer, .site-footer, .footer, #colophon')),
      10000
    );
    expect(await footer.isDisplayed()).to.be.true;
  });

  // 9. Клик по ссылке «Каталог» — ищем по href
  it('клик по ссылке «Каталог» открывает страницу каталога', async function () {
    await driver.get(BASE_URL);

    // Ищем ссылку на каталог по href — надёжнее, чем по тексту
    const catalogLink = await driver.wait(
      until.elementLocated(
        By.css('a[href*="product-category"], a[href*="/shop"], a[href*="catalog"]')
      ),
      10000
    );

    const urlBefore = await driver.getCurrentUrl();
    await catalogLink.click();

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url !== urlBefore;
      },
      10000,
      'Переход на страницу каталога не произошёл'
    );

    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.match(/shop|product-category|catalog/i);
  });
});
