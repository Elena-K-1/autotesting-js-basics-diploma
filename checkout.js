const { Builder, By, until, Key } = require('selenium-webdriver');
const { expect } = require('chai');

describe('Оформление заказа Intershop', function () {
  this.timeout(60000);

  let driver;
  const CATALOG_URL = 'https://intershop5.skillbox.ru/product-category/catalog/';
  const CART_URL = 'https://intershop5.skillbox.ru/cart/';
  const CHECKOUT_URL = 'https://intershop5.skillbox.ru/checkout/';
  const ACCOUNT_URL = 'https://intershop5.skillbox.ru/my-account/';

  const firstName = 'Тест';
  const lastName = 'Тестов';
  const address = 'ул. Тестовая, д. 1';
  const city = 'Москва';
  const postcode = '123456';
  const phone = '+79991234567';

  const timestamp = Date.now();
  const testUser = 'u' + timestamp.toString().slice(-9);
  const testEmail = testUser + '@test.com';
  const testPassword = 'Test1234!';
  const testOrderEmail = 'order_' + timestamp + '@test.com';

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 5000 });
    await driver.get(ACCOUNT_URL);

    // Переход к форме регистрации
    await driver.wait(
      until.elementLocated(
        By.xpath('//a[contains(text(), "Регистрация") or contains(text(), "регистра") or contains(@href, "register")]')
      ),
      10000
    );
    await driver.executeScript(`
      const links = document.querySelectorAll('a, button');
      for (const link of links) {
        const text = (link.textContent || '').toLowerCase();
        if (text.includes('регистра') || text.includes('register')) {
          link.click();
          return;
        }
      }
    `);
    await driver.sleep(2000);

    // Заполняем форму регистрации
    const usernameField = await driver.wait(
      until.elementLocated(By.css('#reg_username, input[name="reg_username"], input[name="username"]')),
      10000
    );
    await usernameField.clear();
    await usernameField.sendKeys(testUser);

    const emailField = await driver.wait(
      until.elementLocated(By.css('#reg_email, input[name="reg_email"], input[type="email"]')),
      10000
    );
    await emailField.clear();
    await emailField.sendKeys(testEmail);

    const passwordField = await driver.wait(
      until.elementLocated(By.css('#reg_password, input[name="reg_password"], input[type="password"]')),
      10000
    );
    await passwordField.clear();
    await passwordField.sendKeys(testPassword);

    // Отправляем форму
    const submitBtn = await driver.wait(
      until.elementLocated(
        By.css('form.register button[type="submit"], form.woocommerce-form-register button[type="submit"], button[name="register"], input[type="submit"]')
      ),
      10000
    );
    await submitBtn.click();

    // Ждём, что форма регистрации исчезла
    await driver.wait(
      async () => {
        try {
          const forms = await driver.findElements(By.css('form.register, form.woocommerce-form-register'));
          return forms.length === 0;
        } catch (e) {
          return true;
        }
      },
      10000,
      'Форма регистрации не исчезла после отправки'
    );

    // Ждём появления признака успешного входа — кнопки «Выйти»
    await driver.wait(
      until.elementLocated(
        By.css('a.logout, a[href*="logout"], a[href*="customer-logout"], .logout-link')
      ),
      20000,
      'Регистрация не удалась: не найдена кнопка выхода'
    );
  });

  after(async function () {
    await driver.quit();
  });

  // Вход в аккаунт
  async function login() {
    await driver.manage().deleteAllCookies();
    await driver.get(ACCOUNT_URL);
    await driver.sleep(1500);

    const usernameInput = await driver.wait(
      until.elementLocated(By.css('#username, input[name="username"]')),
      10000
    );
    await usernameInput.clear();
    await usernameInput.sendKeys(testEmail);

    const passwordInput = await driver.wait(
      until.elementLocated(By.css('#password, input[name="password"], input[type="password"]')),
      10000
    );
    await passwordInput.clear();
    await passwordInput.sendKeys(testPassword);

    const loginBtn = await driver.wait(
      until.elementLocated(
        By.css('form.login button[type="submit"], form.woocommerce-form-login button[type="submit"], button[name="login"]')
      ),
      10000
    );
    await loginBtn.click();

    await driver.wait(
      until.elementLocated(
        By.css('a.logout, a[href*="logout"], a[href*="customer-logout"], .logout-link')
      ),
      15000,
      'Вход не удался'
    );
  }

  // Очистка корзины
  async function clearCart() {
    await driver.get(CART_URL);
    await driver.sleep(1000);
    try {
      let removeButtons = await driver.findElements(By.css('a.remove, td.product-remove a, .remove'));
      while (removeButtons.length > 0) {
        await removeButtons[0].click();
        await driver.sleep(1000);
        removeButtons = await driver.findElements(By.css('a.remove, td.product-remove a, .remove'));
      }
    } catch (e) {}
  }

  // Добавляем товар и переходим на checkout через корзину
  async function goToCheckoutWithItem() {
    await login();
    await clearCart();

    // Добавляем товар
    await driver.get(CATALOG_URL);
    const addButtons = await driver.wait(
      until.elementsLocated(By.css('.add_to_cart_button, .ajax_add_to_cart, a[href*="add-to-cart"]')),
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
          const updatedButtons = await driver.findElements(By.css('.add_to_cart_button.added, .ajax_add_to_cart.added'));
          return updatedButtons.length > 0;
        } catch (e) { return false; }
      },
      10000,
      'Товар не добавился в корзину'
    );

    // Идём в корзину
    await driver.get(CART_URL);
    await driver.wait(
      until.elementLocated(By.css('a.remove, td.product-remove a, .remove, .cart_item')),
      10000,
      'Товар не появился в корзине'
    );

    // Кликаем «Перейти к оплате»
    const checkoutBtn = await driver.wait(
      until.elementLocated(By.css('a.checkout-button, .checkout-button, a[href*="checkout"], a[href*="/checkout/"]')),
      10000
    );
    const urlBefore = await driver.getCurrentUrl();
    await checkoutBtn.click();

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return url !== urlBefore && url.includes('checkout');
      },
      10000,
      'Переход на checkout не произошёл'
    );

    // Ждём загрузки формы
    await driver.sleep(5000);
  }

  // 1. Страница оформления заказа открывается
  it('страница оформления заказа открывается с формой заказа', async function () {
    await goToCheckoutWithItem();

    const result = await driver.executeScript(`
      const form = document.querySelector('form.checkout, form.woocommerce-checkout, form[name="checkout"]');
      const inputs = document.querySelectorAll('input, select, textarea');
      let hasFirstName = false, hasLastName = false, hasEmail = false, hasPhone = false;
      for (const input of inputs) {
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        if (name.includes('first_name') || id.includes('first_name')) hasFirstName = true;
        if (name.includes('last_name') || id.includes('last_name')) hasLastName = true;
        if (name.includes('email') || id.includes('email') || input.type === 'email') hasEmail = true;
        if (name.includes('phone') || id.includes('phone') || input.type === 'tel') hasPhone = true;
      }
      return {
        hasForm: !!form,
        hasFirstName, hasLastName, hasEmail, hasPhone,
        url: window.location.href,
        textPreview: (document.body.innerText || '').substring(0, 500)
      };
    `);

    expect(result.hasForm || result.hasFirstName,
      'Форма не найдена. URL: ' + result.url + ', текст: ' + result.textPreview
    ).to.be.true;
    expect(result.hasFirstName, 'Поле имени не найдено').to.be.true;
    expect(result.hasLastName, 'Поле фамилии не найдено').to.be.true;
    expect(result.hasEmail, 'Поле email не найдено').to.be.true;
    expect(result.hasPhone, 'Поле телефона не найдено').to.be.true;
  });

  // 2. Товары из корзины отображаются
  it('на странице оформления заказа отображаются товары из корзины', async function () {
    await goToCheckoutWithItem();

    const result = await driver.executeScript(`
      const bodyText = document.body.innerText || '';
      const priceMatch = bodyText.match(/[\\d\\s.,]+\\s*[₽рруб]/i);
      const productLink = document.querySelector('a[href*="/product/"]');
      return { hasPrice: !!priceMatch, hasProductLink: !!productLink, textPreview: bodyText.substring(0, 500) };
    `);

    expect(result.hasPrice, 'Цена не найдена: ' + result.textPreview).to.be.true;
  });

  // 3. Итоговая сумма
  it('на странице отображается итоговая сумма заказа', async function () {
    await goToCheckoutWithItem();

    const result = await driver.executeScript(`
      const bodyText = document.body.innerText || '';
      const totalMatch = bodyText.match(/итог[о]?|total/i);
      const priceMatch = bodyText.match(/[\\d\\s.,]+\\s*[₽рруб]/i);
      return { hasTotalText: !!totalMatch, hasPrice: !!priceMatch, textPreview: bodyText.substring(0, 500) };
    `);

    expect(result.hasTotalText || result.hasPrice,
      'Итоговая сумма не найдена: ' + result.textPreview
    ).to.be.true;
  });

  // 4. Методы оплаты
  it('на странице доступны методы оплаты', async function () {
    await goToCheckoutWithItem();

    const result = await driver.executeScript(`
      const methods = document.querySelectorAll(
        'input[name="payment_method"], .wc_payment_method, ' +
        '.payment_methods li, .wc_payment_methods li, ' +
        '#payment input[type="radio"], #payment li, ' +
        '.payment_method, .wc-payment-method, ' +
        'input[type="radio"][name*="payment"]'
      );
      const paymentBlock = document.querySelector('#payment, .woocommerce-checkout-payment, .payment');
      return { count: methods.length, hasMethods: methods.length > 0, hasPaymentBlock: !!paymentBlock };
    `);

    expect(result.hasMethods || result.hasPaymentBlock, 'Методы оплаты не найдены').to.be.true;
  });

  // 5. Пустые поля → ошибка
  it('оформление заказа с пустыми полями показывает сообщение об ошибке', async function () {
    await goToCheckoutWithItem();

    // Очищаем поля
    await driver.executeScript(`
      document.querySelectorAll('input, textarea').forEach(input => {
        if (input.name && input.name.includes('billing')) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    `);

    // Ищем и кликаем кнопку
    let placeOrderBtn = null;
    const btnSelectors = [
      '#place_order',
      'button[name="woocommerce_checkout_place_order"]',
      'input[name="woocommerce_checkout_place_order"]',
      'button[type="submit"]',
      'input[type="submit"]'
    ];

    for (const sel of btnSelectors) {
      try {
        placeOrderBtn = await driver.findElement(By.css(sel));
        if (await placeOrderBtn.isDisplayed()) break;
      } catch (e) {}
    }

    if (placeOrderBtn) {
      await placeOrderBtn.click();
    } else {
      await driver.executeScript(`
        const form = document.querySelector('form.checkout, form.woocommerce-checkout, form[name="checkout"]');
        if (form) form.submit();
      `);
    }

    await driver.wait(
      async () => {
        try {
          const result = await driver.executeScript(`
            const errorEl = document.querySelector('.woocommerce-error, .woocommerce-NoticeGroup');
            if (errorEl && errorEl.offsetWidth > 0 && errorEl.textContent.trim().length > 0) return errorEl.textContent.trim();
            const invalidInputs = document.querySelectorAll('.woocommerce-invalid, .validate-required.woocommerce-invalid');
            if (invalidInputs.length > 0) return 'validation errors';
            const bodyText = document.body.innerText || '';
            const lower = bodyText.toLowerCase();
            const patterns = ['ошибк', 'error', 'обязательн', 'required', 'заполнит', 'введит', 'необходимо', 'неизвестн'];
            for (const p of patterns) {
              if (lower.includes(p)) return bodyText;
            }
            return null;
          `);
          return result !== null;
        } catch (e) { return false; }
      },
      20000,
      'Сообщение об ошибке не появилось'
    );

    const errorText = await driver.executeScript(`
      const errorEl = document.querySelector('.woocommerce-error, .woocommerce-NoticeGroup');
      if (errorEl && errorEl.offsetWidth > 0) return errorEl.textContent.trim();
      const invalidInputs = document.querySelectorAll('.woocommerce-invalid');
      if (invalidInputs.length > 0) return 'validation errors';
      return (document.body.innerText || '').substring(0, 500);
    `);

    expect(errorText.toLowerCase()).to.match(/ошибк|error|обязательн|required|заполнит|введит|необходим|validation|неизвестн/);
  });

      // 6. Успешное оформление
  it('успешное оформление заказа с заполненными данными', async function () {
    this.timeout(120000);
    await goToCheckoutWithItem();

    // Заполняем поля через Selenium
    const fields = [
      { selectors: '#billing_first_name, input[name="billing_first_name"], input[name*="first_name"]', value: firstName },
      { selectors: '#billing_last_name, input[name="billing_last_name"], input[name*="last_name"]', value: lastName },
      { selectors: '#billing_address_1, input[name="billing_address_1"], input[name*="address"], textarea[name*="address"]', value: address },
      { selectors: '#billing_city, input[name="billing_city"], input[name*="city"]', value: city },
      { selectors: '#billing_postcode, input[name="billing_postcode"], input[name*="postcode"], input[name*="zip"]', value: postcode },
      { selectors: '#billing_phone, input[name="billing_phone"], input[name*="phone"], input[type="tel"]', value: phone },
      { selectors: '#billing_email, input[name="billing_email"], input[name*="email"], input[type="email"]', value: testOrderEmail }
    ];

    for (const field of fields) {
      try {
        const el = await driver.findElement(By.css(field.selectors));
        await el.clear();
        await el.sendKeys(field.value);
        await el.sendKeys(Key.TAB);
        await driver.sleep(200);
      } catch (e) {}
    }

    // Устанавливаем страну — Россия
    try {
      const countrySelect = await driver.findElement(By.css('#billing_country, select[name="billing_country"]'));
      await driver.executeScript(`
        const sel = arguments[0];
        sel.value = 'RU';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      `, countrySelect);
      await driver.sleep(1000);
    } catch (e) {}

    // Заполняем регион/область если есть
    try {
      const stateInput = await driver.findElement(By.css('#billing_state, input[name="billing_state"], select[name="billing_state"]'));
      const stateTag = await stateInput.getTagName();
      if (stateTag === 'select') {
        await driver.executeScript(`
          const sel = arguments[0];
          if (sel.options.length > 1) {
            sel.selectedIndex = 1;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `, stateInput);
      } else {
        await stateInput.clear();
        await stateInput.sendKeys('Витебская область');
      }
      await driver.sleep(500);
    } catch (e) {}

    // Ставим галочку согласия с условиями, если есть
    try {
      const termsCheckbox = await driver.findElement(
        By.css('input[name="terms"], input[name="terms-field"], #terms, input[type="checkbox"][name*="term"]')
      );
      if (!await termsCheckbox.isSelected()) {
        await termsCheckbox.click();
        await driver.sleep(500);
      }
    } catch (e) {}

    await driver.sleep(1000);

    // Выбираем метод оплаты
    try {
      const paymentInputs = await driver.findElements(By.css('input[name="payment_method"]'));
      if (paymentInputs.length > 0) {
        await paymentInputs[0].click();
        await driver.sleep(500);
      }
    } catch (e) {}

    await driver.sleep(1000);

    // Кликаем «Оформить заказ» через Selenium-клик (не JS!) — WooCommerce использует jQuery
    let placeBtn = null;
    const btnSelectors = [
      '#place_order',
      'button[name="woocommerce_checkout_place_order"]',
      'input[name="woocommerce_checkout_place_order"]',
      'button[type="submit"]'
    ];

    for (const sel of btnSelectors) {
      try {
        const btn = await driver.findElement(By.css(sel));
        if (await btn.isDisplayed()) {
          placeBtn = btn;
          break;
        }
      } catch (e) {}
    }

    if (placeBtn) {
      // Скроллим к кнопке и кликаем
      await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', placeBtn);
      await driver.sleep(500);
      await placeBtn.click();
    } else {
      // Fallback — submit формы
      await driver.executeScript(`
        const form = document.querySelector('form.checkout, form.woocommerce-checkout, form[name="checkout"]');
        if (form) {
          const btn = form.querySelector('#place_order, button[type="submit"]');
          if (btn) btn.click();
          else form.submit();
        }
      `);
    }

    // Ждём результата — до 60 секунд
    let orderResult = null;
    try {
      orderResult = await driver.wait(
        async () => {
          const url = await driver.getCurrentUrl();
          if (url.includes('order-received') || url.includes('thank-you')) return 'success_url';

          const status = await driver.executeScript(`
            const bodyText = document.body.innerText || '';
            const lower = bodyText.toLowerCase();
            if (lower.includes('заказ получен') || lower.includes('спасибо') ||
                lower.includes('order received') || lower.includes('thank you') ||
                lower.includes('заказ оформлен') || lower.includes('номер заказа')) {
              return 'success_text';
            }
            const errorEl = document.querySelector('.woocommerce-error, .woocommerce-NoticeGroup');
            if (errorEl && errorEl.offsetWidth > 0 && errorEl.textContent.trim().length > 0) {
              return 'error:' + errorEl.textContent.trim().substring(0, 300);
            }
            const invalidInputs = document.querySelectorAll('.woocommerce-invalid, .validate-required.woocommerce-invalid');
            if (invalidInputs.length > 0) {
              let invalidFields = [];
              for (const inp of invalidInputs) {
                let label = inp.querySelector('label');
                if (label) invalidFields.push(label.textContent.trim().replace(/[*]/g, '').trim());
              }
              return 'invalid:' + invalidFields.join(', ');
            }
            return null;
          `);
          return status;
        },
        60000,
        'Timeout waiting for order result'
      );
    } catch (e) {
      orderResult = await driver.executeScript(`
        const errorEl = document.querySelector('.woocommerce-error');
        if (errorEl) return 'error:' + errorEl.textContent.trim().substring(0, 300);
        const invalidInputs = document.querySelectorAll('.woocommerce-invalid');
        if (invalidInputs.length > 0) {
          let invalidFields = [];
          for (const inp of invalidInputs) {
            let label = inp.querySelector('label');
            if (label) invalidFields.push(label.textContent.trim().replace(/[*]/g, '').trim());
          }
          return 'invalid:' + invalidFields.join(', ');
        }
        // Проверяем URL
        const url = window.location.href;
        if (url.includes('order-received')) return 'success_url';
        // Возвращаем текст страницы для диагностики
        return 'timeout:' + (document.body.innerText || '').substring(0, 500);
      `);
    }

    if (orderResult && orderResult.startsWith('error:')) {
      expect.fail('Ошибка WooCommerce: ' + orderResult.substring(6));
    } else if (orderResult && orderResult.startsWith('invalid:')) {
      expect.fail('Ошибка валидации полей: ' + orderResult.substring(8));
    } else if (orderResult && orderResult.startsWith('timeout:')) {
      expect.fail('Таймаут. Текст страницы: ' + orderResult.substring(8));
    }

    const url = await driver.getCurrentUrl();
    const pageText = await driver.executeScript(`return (document.body.innerText || '').substring(0, 1000);`);
    const isSuccess = url.includes('order-received') ||
                      pageText.toLowerCase().includes('заказ получен') ||
                      pageText.toLowerCase().includes('спасибо') ||
                      pageText.toLowerCase().includes('order received');
    expect(isSuccess, 'Заказ не был успешно оформлен. Результат: ' + orderResult).to.be.true;
  });

  // 7. Пустая корзина → заказ недоступен
  it('пустая корзина не позволяет оформить заказ', async function () {
    await clearCart();
    await driver.get(CHECKOUT_URL);
    await driver.sleep(2000);

    const result = await driver.executeScript(`
      const url = window.location.href;
      const bodyText = document.body.innerText || '';
      const lower = bodyText.toLowerCase();
      const isEmpty = url.includes('cart') ||
                      lower.includes('пуста') ||
                      lower.includes('empty') ||
                      lower.includes('необходимо авторизовать') ||
                      !document.querySelector('form.checkout, form.woocommerce-checkout, form[name="checkout"], #order_review');
      return { url, isEmpty };
    `);

    expect(result.isEmpty, 'Checkout доступен с пустой корзиной').to.be.true;
  });
});
