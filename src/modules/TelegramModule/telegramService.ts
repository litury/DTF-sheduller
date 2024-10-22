// src/modules/TelegramModule/telegramService.ts
import { Bot, Context, session, SessionFlavor } from "grammy";
import { DTFService } from "../DTFModule/dtfService";
import { config } from "../../shared/config";

interface SessionData {
  dtfUsername?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

export class TelegramService {
  private bot: Bot<MyContext>;
  private dtfService: DTFService;

  constructor() {
    this.bot = new Bot<MyContext>(config.TELEGRAM_BOT_TOKEN);
    this.dtfService = new DTFService();
    this.setupMiddleware();
    this.setupCommands();
  }

  private setupMiddleware() {
    this.bot.use(session({ initial: () => ({}) }));
  }

  private setupCommands() {
    this.bot.command("start", (ctx) => ctx.reply("Добро пожаловать! Используйте /login для входа в DTF."));
    this.bot.command("login", this.handleLogin.bind(this));
    this.bot.command("drafts", this.handleDrafts.bind(this));
  }

  private async handleLogin(ctx: MyContext) {
    // Здесь нужно реализовать логику входа
    // Например, запросить у пользователя логин и пароль
    ctx.reply("Пожалуйста, введите ваш логин DTF:");
    // Ожидание ввода логина...
  }

  private async handleDrafts(ctx: MyContext) {
    if (!ctx.session.dtfUsername) {
      return ctx.reply("Сначала войдите в аккаунт DTF с помощью команды /login");
    }
    
    const drafts = await this.dtfService.getDrafts(ctx.session.dtfUsername);
    // Отправка списка черновиков пользователю
  }

  public start() {
    this.bot.start();
  }
}

