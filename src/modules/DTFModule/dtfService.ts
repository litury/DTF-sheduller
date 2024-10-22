import * as puppeteer from 'puppeteer'
import { config } from '../../shared/config';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DTFService {
  private async getBrowser(telegramId: number, dtfUsername: string): Promise<puppeteer.Browser> {
    const userDir = await this.createUserDirectory(telegramId, dtfUsername);
    console.log(`Инициализация браузера для пользователя ${dtfUsername}...`);
    return await puppeteer.launch({
      headless: false,
      userDataDir: userDir
    });
  }

  async login(telegramId: number, username: string, password: string): Promise<boolean> {
    const browser = await this.getBrowser(telegramId, username);
    const page = await browser.newPage();

    try {
      console.log('Проверка текущего состояния авторизации...');
      const isAlreadyLoggedIn = await this.checkLoggedIn(page);
      if (isAlreadyLoggedIn) {
        console.log('Пользователь уже авторизован');
        return true;
      }

      console.log('Переход на страницу авторизации...');
      await page.goto('https://dtf.ru/?modal=auth/login/email');
      console.log('Ввод учетных данных...');
      await page.type('input[name="email"]', username);
      await page.type('input[name="password"]', password);
      console.log('Нажатие кнопки входа...');
      await page.click('button.button--size-xl.button--type-primary');
     
      console.log('Ожидание завершения процесса авторизации...');
      await page.waitForFunction(() => {
        const modal = document.querySelector('.modal-window');
        const errorMessage = document.querySelector('.alert__text');
        return !modal || errorMessage;
      });

      const errorMessage = await page.$('.alert__text');
      if (errorMessage) {
        const errorText = await errorMessage.evaluate(el => el.textContent);
        console.error(`Ошибка авторизации: ${errorText}`);
        return false;
      }

      console.log('Проверка наличия аватара пользователя...');
      await page.waitForFunction(() => {
        const desktopAvatar = document.querySelector('.account-button__inner .andropov-media');
        const mobileAvatar = document.querySelector('.tabbar__avatar.andropov-image');
        return desktopAvatar || mobileAvatar;
      }, { timeout: 5000 });
      console.log('Авторизация прошла успешно');
      return true;
    } finally {
      await page.close();
      await browser.close();
    }
  }

  async getDrafts(telegramId: number, username: string, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
      const browser = await this.getBrowser(telegramId, username);
      const page = await browser.newPage();

      try {
        console.log('Проверка авторизации перед получением черновиков...');
        const isLoggedIn = await this.checkLoggedIn(page);
        console.log('Пользователь авторизован:', isLoggedIn);
        
        if (!isLoggedIn) {
          console.log('Пользователь не авторизован');
          throw new Error('User not logged in');
        }
        
        console.log('Переход на страницу черновиков...');
        await page.goto('https://dtf.ru/drafts', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log('Ожидание загрузки контента...');
        await page.waitForSelector('.content-list > .content', { timeout: 10000 });
        
        console.log('Получение черновиков...');
        const drafts = await page.evaluate(() => {
          const draftElements = document.querySelectorAll('.content-list > .content');
          console.log('Найдено элементов черновиков:', draftElements.length);
          
          return Array.from(draftElements).map((element) => {
            const linkElement = element.querySelector('a.content__link');
            const href = linkElement?.getAttribute('href') || '';
            const id = href.split('/').pop()?.split('-')[0] || null;
            const title = element.querySelector('.content-title')?.textContent?.trim() || null;
            const createdTime = element.querySelector('time')?.getAttribute('datetime') || null;
            const topic = element.querySelector('.content-header__topic')?.textContent?.trim() || null;
            const summary = element.querySelector('.content__body p')?.textContent?.trim() || null;
            
            return {
              id,
              title,
              createdTime,
              url: id ? `https://dtf.ru/drafts?modal=editor&action=edit&id=${id}` : null,
              topic,
              summary
            };
          });
        });

        console.log('Получено черновиков:', drafts.length);
        return drafts;
      } catch (error) {
        console.error(`Ошибка при получении черновиков (попытка ${retries + 1}):`, error);
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем 5 секунд перед повторной попыткой
      } finally {
        await page.close();
        await browser.close();
      }
    }
  }

  private async checkLoggedIn(page: puppeteer.Page): Promise<boolean> {
    await page.goto('https://dtf.ru');
    return await page.evaluate(() => {
      const desktopAvatar = document.querySelector('.account-button__inner .andropov-media');
      const mobileAvatar = document.querySelector('.tabbar__avatar.andropov-image');
      return Boolean(desktopAvatar || mobileAvatar);
    });
  }

  async createUserDirectory(telegramId: number, dtfUsername: string) {
    const userDir = path.join('./user_data', telegramId.toString(), dtfUsername);
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
  }

  async publishDraft(telegramId: number, username: string, draftId: string): Promise<boolean> {
    const browser = await this.getBrowser(telegramId, username);
    const page = await browser.newPage();
    let retries = 0;
    const maxRetries = 3;

    try {
      while (retries < maxRetries) {
        try {
          console.log(`Попытка публикации ${retries + 1}/${maxRetries}`);
          console.log(`Переход к черновику с ID ${draftId}...`);
          await page.goto(`https://dtf.ru/drafts?modal=editor&action=edit&id=${draftId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
          
          console.log('Ожидание загрузки редактора...');
          await page.waitForSelector('.editor', { visible: true, timeout: 10000 });
          
          console.log('Поиск кнопки публикации...');
          await page.waitForSelector('.editor-control-bar__controls button, .editor-control-bar__controls .button', { visible: true, timeout: 10000 });
          
          page.on('dialog', async (dialog) => {
            console.log('Обнаружено диалоговое окно:', dialog.message());
            await dialog.accept();
          });

          console.log('Нажатие кнопки публикации...');
          await page.evaluate(() => {
            const publishButton = document.querySelector('.editor-control-bar__controls button, .editor-control-bar__controls .button');
            if (publishButton) {
              (publishButton as HTMLElement).click();
            }
          });
          
          console.log('Ожидание подтверждения публикации или ошибки...');
          await Promise.race([
            page.waitForNavigation({ timeout: 30000 }),
            page.waitForSelector('.alert__text', { visible: true, timeout: 30000 })
          ]);
          
          const errorElement = await page.$('.alert__text');
          if (errorElement) {
            const errorText = await errorElement.evaluate(el => el.textContent);
            if (errorText && errorText.includes('Ошибка при сохранении поста')) {
              console.log('Обнаружена ошибка при сохранении поста. Перезагрузка страницы...');
              await page.reload({ waitUntil: 'networkidle0' });
              retries++;
              continue;
            }
          }
          
          const currentUrl = page.url();
          if (currentUrl.includes('drafts?modal=editor')) {
            throw new Error('Редирект после публикации не произошел');
          }
          
          console.log('Черновик успешно опубликован');
          return true;
        } catch (error) {
          console.error(`Ошибка при публикации черновика (попытка ${retries + 1}/${maxRetries}):`, error);
          retries++;
          if (retries >= maxRetries) {
            return false;
          }
          await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем 5 секунд перед повторной попыткой
        }
      }
      return false;
    } finally {
      await page.close();
      await browser.close();
    }
  }
}
