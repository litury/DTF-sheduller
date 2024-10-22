import { Bot, Context } from "grammy";
import { DTFService } from "./src/modules/DTFModule/dtfService";
import { config } from "./src/shared/config";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
const dtfService = new DTFService();

const userSessions = new Map<number, { state: string; dtfUsername?: string; isLoggedIn: boolean }>();

bot.command("start", (ctx) => ctx.reply("Привет! Я бот для работы с черновиками DTF. Используйте /login для входа."));

bot.command("login", async (ctx) => {
  console.log("Команда /login вызвана");
  if (ctx.from) {
    userSessions.set(ctx.from.id, { state: "AWAITING_USERNAME", isLoggedIn: false });
    await ctx.reply("Пожалуйста, введите ваш логин DTF:");
  }
});

bot.command("drafts", async (ctx) => {
  console.log("Команда /drafts вызвана");
  if (!checkAuth(ctx)) return;

  if (ctx.from) {
    const loadingMessage = await ctx.reply("Загрузка черновиков...");
    console.log("Пользователь авторизован, получаем черновики");
    const session = userSessions.get(ctx.from.id)!;
    try {
      const drafts = await dtfService.getDrafts(ctx.from.id, session.dtfUsername!);
      console.log("Получены черновики:", drafts);
      if (drafts && drafts.length > 0) {
        let message = "Ваши черновики:\n\n";
        drafts.forEach((draft, index) => {
          message += `${index + 1}. ${draft.title || 'Без названия'}\n`;
          message += `   Создан: ${new Date(draft.createdTime!).toLocaleString()}\n`;
          message += `   Тема: ${draft.topic || 'Не указана'}\n`;
          message += `   ID: ${draft.id}\n\n`;
        });
        message += "Для публикации черновика используйте команду /publish <номер черновика>";
        await ctx.api.editMessageText(ctx.chat.id, loadingMessage.message_id, message);
      } else {
        await ctx.api.editMessageText(ctx.chat.id, loadingMessage.message_id, "У вас нет черновиков.");
      }
    } catch (error) {
      console.error("Ошибка при получении черновиков:", error);
      await ctx.api.editMessageText(ctx.chat.id, loadingMessage.message_id, `Ошибка при получении черновиков: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }
});

bot.command("publish", async (ctx) => {
  console.log("Команда /publish вызвана");
  if (!checkAuth(ctx)) return;

  const draftNumber = parseInt(ctx.match);
  if (isNaN(draftNumber)) {
    return ctx.reply("Пожалуйста, укажите номер черновика для публикации.");
  }

  if (ctx.from) {
    const session = userSessions.get(ctx.from.id)!;
    try {
      const drafts = await dtfService.getDrafts(ctx.from.id, session.dtfUsername!);
      if (drafts && draftNumber >= 1 && draftNumber <= drafts.length) {
        const draft = drafts[draftNumber - 1];
        // Здесь нужно реализовать метод publishDraft в DTFService
        await dtfService.publishDraft(ctx.from.id, session.dtfUsername!, draft.id!);
        await ctx.reply(`Черновик "${draft.title || 'Без названия'}" успешно опубликован.`);
      } else {
        await ctx.reply("Указан неверный номер черновика.");
      }
    } catch (error) {
      await ctx.reply(`Ошибка при публикации черновика: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }
});

bot.command("logout", async (ctx) => {
  console.log("Команда /logout вызвана");
  if (!checkAuth(ctx)) return;

  if (ctx.from) {
    userSessions.delete(ctx.from.id);
    await ctx.reply("Вы успешно вышли из системы. Используйте /login для повторного входа.");
  }
});

bot.on("message:text", async (ctx) => {
  console.log("Получено текстовое сообщение:", ctx.message.text);
  if (ctx.from) {
    const session = userSessions.get(ctx.from.id) || { state: "IDLE", isLoggedIn: false };
    if (session.state === "AWAITING_USERNAME") {
      if (isValidEmail(ctx.message.text)) {
        session.dtfUsername = ctx.message.text;
        session.state = "AWAITING_PASSWORD";
        await ctx.reply("Теперь введите ваш пароль:");
      } else {
        await ctx.reply("Пожалуйста, введите корректный email адрес.");
      }
    } else if (session.state === "AWAITING_PASSWORD") {
      const dtfUsername = session.dtfUsername!;
      const password = ctx.message.text;
      try {
        const loginSuccess = await dtfService.login(ctx.from.id, dtfUsername, password);
        if (loginSuccess) {
          session.isLoggedIn = true;
          session.state = "IDLE";
          userSessions.set(ctx.from.id, session);
          console.log("Сессия пользователя после входа:", userSessions.get(ctx.from.id));
          await ctx.reply(
            "Вы успешно вошли в систему! Теперь вы можете использовать следующие команды:\n" +
            "/drafts - получить список черновиков\n" +
            "/publish <номер черновика> - опубликовать черновик\n" +
            "/logout - выйти из системы"
          );
        } else {
          await ctx.reply("Неверный логин или пароль. Попробуйте еще раз с помощью команды /login");
        }
      } catch (error) {
        await ctx.reply(`Ошибка при входе: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    } else if (!session.isLoggedIn) {
      await ctx.reply("Используйте команду /login для входа в систему.");
    }
    userSessions.set(ctx.from.id, session);
  }
});

bot.catch((err) => {
  console.error("Ошибка в боте:", err);
});

bot.start();
console.log("Бот запущен");

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function checkAuth(ctx: Context): boolean {
  if (ctx.from) {
    const session = userSessions.get(ctx.from.id);
    if (session && session.isLoggedIn) {
      return true;
    }
  }
  ctx.reply("Для использования этой команды необходимо войти в систему. Используйте /login");
  return false;
}
