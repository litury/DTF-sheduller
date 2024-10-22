import { Bot } from 'grammy';
import { config } from './src/shared/config';
import { DTFService } from './src/modules/DTFModule/dtfService';
import { SchedulerService } from './src/modules/SchedulerModule/schedulerService';
import { BotService } from './modules/BotModule/botService';

async function main() {
  const bot = new Bot(config.BOT_TOKEN);
  const dtfService = new DTFService();
  const schedulerService = new SchedulerService();
  const botService = new BotService(bot, dtfService, schedulerService);

  await dtfService.init();
  await botService.init();

  bot.start();
}

main().catch(console.error);