import dotenv from 'dotenv';

dotenv.config();

export const config = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  DTF_LOGIN: process.env.DTF_LOGIN || '',
  DTF_PASSWORD: process.env.DTF_PASSWORD || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
};