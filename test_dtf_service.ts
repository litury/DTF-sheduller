import { DTFService } from './src/modules/DTFModule/dtfService';
import { config } from './src/shared/config';

async function testDTFService() {
  const dtfService = new DTFService();
  const telegramId = 12345; 
  const dtfUsername = config.DTF_LOGIN;
  const dtfPassword = config.DTF_PASSWORD;
  
  try {
    console.log('Попытка входа...');
    const isLoggedIn = await dtfService.login(telegramId, dtfUsername, dtfPassword);
    console.log('Статус авторизации:', isLoggedIn);

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

testDTFService();
