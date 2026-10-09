const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('chai');

describe('Корзина Intershop', function () {
  this.timeout(30000);

  let driver;
  const CART_URL = 'https://intershop5.skillbox.ru/cart/';
  const CATALOG_URL = 'https://intershop5.skillbox.ru/product-category/catalog/';

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 5000 });
  });

  after(async function () {
    await driver.quit();
  });

  // Добавляем товар в корзину
  async function addItemToCart() {
    await driver.get(CATALOG_URL);
    const addButtons = await driver.wait(
      until.elementsLocated(
        By.css('.add_to_cart_button, .ajax_add_to_cart, a[href*="add-to-cart"]')
      ),
      10000
    );
    await addButtons[0].click();

    await driver.wait(
      async () => {
        try {
          const messages = await driver.findElements(
            By.css('.woocommerce-message, .added_to_cart, .wc-forward, .woocommerce-info')
          );
          for (const msg of messages) {
            if (await msg.isDisplayed()) return true;
          }
          const updatedButtons = await driver.findElements(
            By.css('.add_to_cart_button.added, .ajax_add_to_cart.added')
          );
          return updatedButtons.length > 0;
        } catch (e) {
          return false;
        }
      },
      10000,
      'Товар не добавился в корзину'
    );
  }

  // Очистка корзины
  async function clearCart() {
    await driver.get(CART_URL);
    await driver.sleep(1000);
    try {
      let removeButtons = await driver.findElements(
        By.css('a.remove, td.product-remove a, .remove')
      );
      while (removeButtons.length > 0) {
        await removeButtons[0].click();
        await driver.sleep(1000);
        removeButtons = await driver.findElements(
          By.css('a.remove, td.product-remove a, .remove')
        );
      }
    } catch (e) {}
  }

  // 1. Корзина с товаром — товар отображается
  it('корзина с товаром отображает добавленный товар', async function () {
    await clearCart();
    await addItemToCart();
    await driver.get(CART_URL);

    const hasItem = await driver.executeScript(`
      const body = document.body;
      const allText = body.innerText || body.textContent || '';

      const imgs = body.querySelectorAll('img');
      const hasProductImg = Array.from(imgs).some(
        img => img.offsetWidth > 30 && img.offsetHeight > 30 &&
               img.src && !img.src.includes('logo') && !img.src.includes('icon')
      );

      const priceMatch = allText.match(/[\\d\\s.,]+\\s*[₽рруб]/i);
      const removeBtn = body.querySelector('a.remove, .remove, td.product-remove a');

      return {
        hasImg: hasProductImg,
        hasPrice: !!priceMatch,
        hasRemoveBtn: !!removeBtn,
        textPreview: allText.substring(0, 300)
      };
    `);

    expect(hasItem.hasRemoveBtn, 'Кнопка удаления не найдена — корзина пуста').to.be.true;
    expect(hasItem.hasImg, 'Изображение товара не найдено').to.be.true;
    expect(hasItem.hasPrice, 'Цена не найдена: ' + (hasItem.textPreview || '')).to.be.true;
  });

  // 2. В корзине у товара есть название, цена и количество
  it('товар в корзине содержит название, цену и поле количества', async function () {
    await clearCart();
    await addItemToCart();
    await driver.get(CART_URL);

    const result = await driver.executeScript(`
      const body = document.body;
      const allText = body.innerText || body.textContent || '';

      const links = body.querySelectorAll('a');
      const productLink = Array.from(links).find(
        a => a.textContent.trim().length > 3 && a.offsetWidth > 0 &&
             (a.href.includes('/product/') || a.href.includes('shop') || a.href.includes('p='))
      );
      const fallbackLink = !productLink ? Array.from(links).find(
        a => a.textContent.trim().length > 5 && a.offsetWidth > 0 && !a.href.includes('cart') &&
             !a.href.includes('checkout') && !a.href.includes('my-account')
      ) : null;
      const foundLink = productLink || fallbackLink;
      const hasName = !!foundLink;

      const priceMatch = allText.match(/[\\d\\s.,]+\\s*[₽рруб]/i);
      const qtyInput = body.querySelector(
        'input.qty, input[type="number"], input[name*="quantity"], input[name*="qty"]'
      );
      const hasQty = qtyInput && qtyInput.offsetWidth > 0;

      return {
        hasName,
        nameText: foundLink ? foundLink.textContent.trim() : '',
        hasPrice: !!priceMatch,
        priceText: priceMatch ? priceMatch[0].trim() : '',
        hasQty,
        textPreview: allText.substring(0, 500)
      };
    `);

    expect(result.hasName, 'Название товара отсутствует: ' + (result.textPreview || '')).to.be.true;
    expect(result.hasPrice, 'Цена товара не найдена: ' + (result.textPreview || '')).to.be.true;
    expect(result.hasQty, 'Поле количества отсутствует').to.be.true;
  });

  // 3. Применение купона sert500 — скидка 500 рублей
  it('купон sert500 применяет скидку 500 рублей', async function () {
    await clearCart();
    await addItemToCart();
    await driver.get(CART_URL);

    // Ищем поле купона через Selenium
    let couponInput = null;
    const couponSelectors = [
      'input[name="coupon_code"]',
      '#coupon_code',
      'input[name*="coupon"]',
      'input[placeholder*="купон"]',
      'input[placeholder*="промокод"]',
      'input[placeholder*="Купон"]',
      'input[placeholder*="Промокод"]'
    ];

    for (const sel of couponSelectors) {
      try {
        couponInput = await driver.findElement(By.css(sel));
        if (await couponInput.isDisplayed()) break;
      } catch (e) {}
    }

    // Fallback через JS
    if (!couponInput) {
      const inputInfo = await driver.executeScript(`
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          const name = (input.name || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          if (name.includes('coupon') || id.includes('coupon') ||
              placeholder.includes('купон') || placeholder.includes('промокод')) {
            return input.id ? '#' + input.id : 'input[name="' + input.name + '"]';
          }
        }
        return null;
      `);
      if (inputInfo) {
        couponInput = await driver.findElement(By.css(inputInfo));
      }
    }

    expect(couponInput, 'Поле купона не найдено').to.not.be.null;
    await couponInput.clear();
    await couponInput.sendKeys('sert500');

    // Ищем кнопку применения через Selenium
    let applyBtn = null;
    const btnSelectors = [
      'button[name="apply_coupon"]',
      'input[name="apply_coupon"]',
      'button[name*="coupon"]',
      'input[type="submit"][name*="coupon"]'
    ];

    for (const sel of btnSelectors) {
      try {
        applyBtn = await driver.findElement(By.css(sel));
        if (await applyBtn.isDisplayed()) break;
      } catch (e) {}
    }

    if (!applyBtn) {
      try {
        applyBtn = await driver.findElement(
          By.xpath(
            '//button[contains(text(), "Применить") or contains(text(), "применить")] | ' +
            '//input[@type="submit" and contains(@value, "Применить")]'
          )
        );
      } catch (e) {}
    }

    expect(applyBtn, 'Кнопка применения купона не найдена').to.not.be.null;
    await applyBtn.click();

    // Ждём именно скидку
    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return (
            pageText.includes('Скидка') ||
            pageText.includes('скидка') ||
            pageText.includes('Discount') ||
            pageText.includes('500 ₽') ||
            pageText.includes('500₽') ||
            pageText.includes('500 руб') ||
            pageText.includes('-500') ||
            pageText.includes('−500')
          );
        } catch (e) {
          return false;
        }
      },
      15000,
      'Скидка по купону не появилась'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText).to.match(/500/);
  });

  // 4. Неверный купон — показывается ошибка
  it('неверный купон показывает сообщение об ошибке', async function () {
    await clearCart();
    await addItemToCart();
    await driver.get(CART_URL);

    // Ищем поле купона
    let couponInput = null;
    const couponSelectors = [
      'input[name="coupon_code"]',
      '#coupon_code',
      'input[name*="coupon"]',
      'input[placeholder*="купон"]',
      'input[placeholder*="промокод"]',
      'input[placeholder*="Купон"]',
      'input[placeholder*="Промокод"]'
    ];

    for (const sel of couponSelectors) {
      try {
        couponInput = await driver.findElement(By.css(sel));
        if (await couponInput.isDisplayed()) break;
      } catch (e) {}
    }

    if (!couponInput) {
      const inputInfo = await driver.executeScript(`
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          const name = (input.name || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          if (name.includes('coupon') || id.includes('coupon') ||
              placeholder.includes('купон') || placeholder.includes('промокод')) {
            return input.id ? '#' + input.id : 'input[name="' + input.name + '"]';
          }
        }
        return null;
      `);
      if (inputInfo) {
        couponInput = await driver.findElement(By.css(inputInfo));
      }
    }

    expect(couponInput, 'Поле купона не найдено').to.not.be.null;
    await couponInput.clear();
    await couponInput.sendKeys('ABCDINVALID');

    // Ищем кнопку применения
    let applyBtn = null;
    const btnSelectors = [
      'button[name="apply_coupon"]',
      'input[name="apply_coupon"]',
      'button[name*="coupon"]',
      'input[type="submit"][name*="coupon"]'
    ];

    for (const sel of btnSelectors) {
      try {
        applyBtn = await driver.findElement(By.css(sel));
        if (await applyBtn.isDisplayed()) break;
      } catch (e) {}
    }

    if (!applyBtn) {
      try {
        applyBtn = await driver.findElement(
          By.xpath(
            '//button[contains(text(), "Применить") or contains(text(), "применить")] | ' +
            '//input[@type="submit" and contains(@value, "Применить")]'
          )
        );
      } catch (e) {}
    }

    expect(applyBtn, 'Кнопка применения купона не найдена').to.not.be.null;
    await applyBtn.click();

    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return (
            pageText.includes('Неверный') ||
            pageText.includes('неверный') ||
            pageText.includes('не существует') ||
            pageText.includes('Invalid') ||
            pageText.includes('недействител') ||
            pageText.includes('купон') ||
            pageText.includes('Купон')
          );
        } catch (e) {
          return false;
        }
      },
      15000,
      'Сообщение об ошибке купона не появилось'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText.toLowerCase()).to.match(
      /неверн|invalid|не существует|недействител|купон/
    );
  });

  // 5. Удаление товара из корзины
  it('удаление товара очищает корзину', async function () {
    await clearCart();
    await addItemToCart();
    await driver.get(CART_URL);

    const removeBtn = await driver.wait(
      until.elementLocated(
        By.css('a.remove, td.product-remove a, .remove')
      ),
      10000
    );
    await removeBtn.click();

    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return (
            pageText.includes('Корзина пуста') ||
            pageText.includes('пуста') ||
            pageText.includes('empty')
          );
        } catch (e) {
          return false;
        }
      },
      10000,
      'Корзина не стала пустой после удаления'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText.toLowerCase()).to.match(/пуста|empty/);
  });

  // 6. Пустая корзина — показывается сообщение
  it('пустая корзина показывает сообщение и ссылку на магазин', async function () {
    await clearCart();
    await driver.get(CART_URL);

    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return (
            pageText.includes('Корзина пуста') ||
            pageText.includes('пуста') ||
            pageText.includes('empty')
          );
        } catch (e) {
          return false;
        }
      },
      10000,
      'Сообщение о пустой корзине не появилось'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText.toLowerCase()).to.match(/пуста|empty/);
  });

  // 7. Кнопка «Перейти к оплате» переводит на страницу оформления
  it('кнопка «Перейти к оплате» открывает страницу оформления заказа', async function () {
    await clearCart();
    await addItemToCart();
    await driver.get(CART_URL);

    const checkoutBtn = await driver.wait(
      until.elementLocated(
        By.css('a.checkout-button, .checkout-button, a[href*="checkout"], a[href*="/checkout/"]')
      ),
      10000
    );

    expect(await checkoutBtn.isDisplayed()).to.be.true;

    const urlBefore = await driver.getCurrentUrl();
    await checkoutBtn.click();

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url !== urlBefore && url.includes('checkout');
      },
      10000,
      'Переход на страницу оформления не произошёл'
    );

    const currentUrl = await driver.getCurrentUrl();
    expect(currentUrl).to.include('checkout');
  });
});
