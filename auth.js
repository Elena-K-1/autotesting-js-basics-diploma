const { Builder, By, until, Key } = require('selenium-webdriver');
const { expect } = require('chai');

describe('Регистрация и авторизация Intershop', function () {
  this.timeout(30000);

  let driver;
  const ACCOUNT_URL = 'https://intershop5.skillbox.ru/my-account/';

  const timestamp = Date.now();
  const testUser = 'u' + timestamp.toString().slice(-9);
  const testEmail = testUser + '@test.com';
  const testPassword = 'Test1234!';

  before(async function () {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 5000 });
  });

  after(async function () {
    await driver.quit();
  });

  // Выход — удаляем cookies
  async function logout() {
    await driver.manage().deleteAllCookies();
    await driver.get(ACCOUNT_URL);
    await driver.sleep(2000);
  }

  // Переключение на форму регистрации
  async function switchToRegister() {
    await driver.get(ACCOUNT_URL);
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
  }

  // Заполнение формы входа через Selenium sendKeys
  async function fillLoginForm(email, password) {
    await driver.get(ACCOUNT_URL);
    await driver.sleep(1500);

    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css('#username, input[name="username"], input[name="login"]')
          );
          await el.clear();
          await el.sendKeys(email);
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css('#password, input[name="password"], input[type="password"]')
          );
          await el.clear();
          await el.sendKeys(password);
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );
  }

  // Отправка формы входа — Selenium-клик по кнопке с retry
  async function submitLoginForm() {
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css(
              'form.login button[type="submit"], ' +
              'form.woocommerce-form-login button[type="submit"], ' +
              'form.login input[type="submit"], ' +
              'form.woocommerce-form-login input[type="submit"], ' +
              'button[name="login"], input[name="login"]'
            )
          );
          await el.click();
          return true;
        } catch (e) {
          return false;
        }
      },
      10000,
      'Не удалось отправить форму входа'
    );
  }

  // Отправка формы регистрации — Selenium-клик по кнопке с retry
  async function submitRegisterForm() {
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css(
              'form.register button[type="submit"], ' +
              'form.woocommerce-form-register button[type="submit"], ' +
              'form.register input[type="submit"], ' +
              'form.woocommerce-form-register input[type="submit"], ' +
              'button[name="register"], input[name="register"]'
            )
          );
          await el.click();
          return true;
        } catch (e) {
          try {
            await driver.executeScript(`
              const form = document.querySelector('form.register, form.woocommerce-form-register');
              if (form) {
                const submit = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submit) submit.click();
              }
            `);
            return true;
          } catch (e2) {
            return false;
          }
        }
      },
      10000,
      'Не удалось отправить форму регистрации'
    );
  }

  // 1. Страница my-account открывается, форма входа видна
  it('страница личного кабинета открывается с формой входа', async function () {
    await logout();

    const result = await driver.executeScript(`
      const inputs = document.querySelectorAll('input');
      let hasUsername = false, hasPassword = false;
      for (const input of inputs) {
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const type = (input.type || '').toLowerCase();
        if (name.includes('username') || name.includes('login') ||
            id.includes('username') || id.includes('login')) {
          hasUsername = true;
        }
        if (type === 'password' || name.includes('password') || id.includes('password')) {
          hasPassword = true;
        }
      }
      return { hasUsername, hasPassword };
    `);

    expect(result.hasUsername, 'Поле логина не найдено').to.be.true;
    expect(result.hasPassword, 'Поле пароля не найдено').to.be.true;
  });

  // 2. Переключение на форму регистрации
  it('переключение на форму регистрации отображает поля для регистрации', async function () {
    await switchToRegister();

    const result = await driver.executeScript(`
      const inputs = document.querySelectorAll('input');
      let hasEmail = false, hasPassword = false;
      for (const input of inputs) {
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const type = (input.type || '').toLowerCase();
        if (name.includes('email') || id.includes('email') || type === 'email') {
          hasEmail = true;
        }
        if (type === 'password' || name.includes('password') || id.includes('password')) {
          hasPassword = true;
        }
      }
      return { hasEmail, hasPassword };
    `);

    expect(result.hasEmail, 'Поле email для регистрации не найдено').to.be.true;
    expect(result.hasPassword, 'Поле пароля для регистрации не найдено').to.be.true;
  });

  // 3. Успешная регистрация нового пользователя
  it('новый пользователь успешно регистрируется', async function () {
    await switchToRegister();

    // Username
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css(
              'form.register #reg_username, form.register input[name="username"], ' +
              'form.woocommerce-form-register #reg_username, ' +
              'form.woocommerce-form-register input[name="username"], ' +
              '#reg_username, input[name="reg_username"]'
            )
          );
          await el.clear();
          await el.sendKeys(testUser);
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    // Email
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css(
              'form.register #reg_email, form.register input[name="email"], ' +
              'form.register input[type="email"], ' +
              'form.woocommerce-form-register #reg_email, ' +
              '#reg_email, input[name="reg_email"]'
            )
          );
          await el.clear();
          await el.sendKeys(testEmail);
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    // Password
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css(
              'form.register #reg_password, form.register input[name="password"], ' +
              'form.register input[type="password"], ' +
              'form.woocommerce-form-register #reg_password, ' +
              '#reg_password, input[name="reg_password"]'
            )
          );
          await el.clear();
          await el.sendKeys(testPassword);
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    await submitRegisterForm();

    await driver.wait(
      async () => {
        try {
          const text = await driver.findElement(By.css('body')).getText();
          return text.includes('Выйти') || text.includes('Log out');
        } catch (e) {
          return false;
        }
      },
      15000,
      'Регистрация не удалась'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText).to.include.oneOf(['Выйти', 'Log out']);

    await logout();
  });

  // 4. Регистрация с пустыми полями
  it('регистрация с пустыми полями показывает сообщение об ошибке', async function () {
    await logout();
    await switchToRegister();
    await submitRegisterForm();

    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return (
            pageText.includes('Ошибка') ||
            pageText.includes('ошибка') ||
            pageText.includes('Error') ||
            pageText.includes('обязательно') ||
            pageText.includes('заполните') ||
            pageText.includes('Введите') ||
            pageText.includes('required') ||
            pageText.includes('пуст')
          );
        } catch (e) {
          return false;
        }
      },
      15000,
      'Сообщение об ошибке при пустой регистрации не появилось'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText.toLowerCase()).to.match(/ошибк|error|обязательн|required|заполнит|введит|пуст/);
  });

  // 5. Успешный вход с валидными данными
  it('авторизация с валидными данными выполняется успешно', async function () {
    await logout();
    await fillLoginForm(testEmail, testPassword);
    await submitLoginForm();

    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return pageText.includes('Выйти') || pageText.includes('Log out');
        } catch (e) {
          return false;
        }
      },
      15000,
      'Авторизация не удалась'
    );

    const pageText = await driver.findElement(By.css('body')).getText();
    expect(pageText).to.include.oneOf(['Выйти', 'Log out']);
  });

  // 6. Вход с неверными данными
  it('авторизация с неверными данными показывает сообщение об ошибке', async function () {
    await logout();

    // Заполняем форму через Selenium sendKeys
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css('#username, input[name="username"]')
          );
          await el.clear();
          await el.sendKeys('wronguser@test.com');
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css('#password, input[name="password"], input[type="password"]')
          );
          await el.clear();
          await el.sendKeys('wrongpass123');
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    // Кликаем кнопку входа
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css(
              'form.login button[type="submit"], ' +
              'form.woocommerce-form-login button[type="submit"], ' +
              'form.login input[type="submit"], ' +
              'form.woocommerce-form-login input[type="submit"], ' +
              'button[name="login"]'
            )
          );
          await el.click();
          return true;
        } catch (e) {
          return false;
        }
      },
      10000
    );

    // Ждём ошибку — проверяем через JS (body.innerText)
    await driver.wait(
      async () => {
        try {
          const result = await driver.executeScript(`
            const errorEl = document.querySelector('.woocommerce-error');
            if (errorEl && errorEl.offsetWidth > 0 && errorEl.textContent.trim().length > 0) {
              return errorEl.textContent.trim();
            }
            const bodyText = document.body.innerText || document.body.textContent || '';
            const lower = bodyText.toLowerCase();
            const patterns = ['ошибк', 'error', 'неверн', 'неправильн', 'не существует', 'invalid', 'unknown', 'не удалось', 'неизвестн'];
            for (const p of patterns) {
              if (lower.includes(p)) return bodyText;
            }
            return null;
          `);
          return result !== null;
        } catch (e) {
          return false;
        }
      },
      20000,
      'Сообщение об ошибке при неверном входе не появилось'
    );

    const errorText = await driver.executeScript(`
      const errorEl = document.querySelector('.woocommerce-error');
      if (errorEl && errorEl.offsetWidth > 0) return errorEl.textContent.trim();
      return (document.body.innerText || '').substring(0, 500);
    `);

    expect(errorText.toLowerCase()).to.match(
      /ошибк|error|неверн|неправильн|не существует|invalid|unknown|не удалось|неизвестн/
    );
  });

  // 7. Выход из аккаунта
  it('выход из аккаунта возвращает на форму входа', async function () {
    // Входим
    await logout();
    await fillLoginForm(testEmail, testPassword);
    await submitLoginForm();

    // Ждём успешного входа
    await driver.wait(
      async () => {
        try {
          const pageText = await driver.findElement(By.css('body')).getText();
          return pageText.includes('Выйти') || pageText.includes('Log out');
        } catch (e) {
          return false;
        }
      },
      15000,
      'Не удалось войти для теста выхода'
    );

    // Кликаем "Выйти" — с retry
    await driver.wait(
      async () => {
        try {
          const el = await driver.findElement(
            By.css('a[href*="logout"], a[href*="customer-logout"]')
          );
          await el.click();
          return true;
        } catch (e) {
          return false;
        }
      },
      10000,
      'Не удалось кликнуть кнопку выхода'
    );

    // Ждём редиректа
    await driver.sleep(3000);

    // Переходим на my-account
    await driver.get(ACCOUNT_URL);
    await driver.sleep(2000);

    // Проверяем наличие формы входа
    const hasForm = await driver.executeScript(`
      return document.querySelectorAll('input[type="password"]').length > 0;
    `);
    expect(hasForm, 'Форма входа не отображается после выхода').to.be.true;
  });
});