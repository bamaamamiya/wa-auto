export const sendMessage = async (bot, chatId, message) => {
  await bot.sendMessage(chatId, { text: message });
};