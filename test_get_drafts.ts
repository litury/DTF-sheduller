import { DTFService } from './src/modules/DTFModule/dtfService';
import { config } from './src/shared/config';

async function testGetDrafts() {
  const dtfService = new DTFService();
  const telegramId = 12345; 
  const dtfUsername = config.DTF_LOGIN;
  
  try {
    console.log('Получение черновиков...');
    const drafts = await dtfService.getDrafts(telegramId, dtfUsername);
    if (drafts) {
      console.log('Получение черновиков завершено');
      console.log('Количество черновиков:', drafts.length);
      console.log('Черновики:');
      console.log(JSON.stringify(drafts, null, 2));
    } else {
      console.log('Черновики не найдены или произошла ошибка при их получении.');
    }
  } catch (error) {
    console.error('Ошибка при получении черновиков:', error);
  }
}

testGetDrafts();
