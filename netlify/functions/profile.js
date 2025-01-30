const mongoose = require('mongoose');
require('dotenv').config();
const CommandStats = require('./models/CommandStats');
const { fetchUserGuildMember } = require('./utils'); // Импортируем утилиту

exports.handler = async (event, context) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const uuid = event.path.split('/').pop(); // Получаем UUID из пути
    const userStats = await CommandStats.findOne({ uuid }).select('-__v').lean();

    if (!userStats) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Пользователь не найден' }),
      };
    }

    const userId = userStats.userId;
    const userGuildMember = await fetchUserGuildMember(userId);

    if (!userGuildMember) {
      console.error('Failed to fetch user guild member');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch user guild member' }),
      };
    }

    const userRankAllTime = await CommandStats.countDocuments({ totalMessages: { $gt: userStats.totalMessages } }) + 1;
    const userRankToday = await CommandStats.countDocuments({ messagesToday: { $gt: userStats.messagesToday } }) + 1;
    const userRankLast7Days = await CommandStats.countDocuments({ messagesLast7Days: { $gt: userStats.messagesLast7Days } }) + 1;
    const userRankLast30Days = await CommandStats.countDocuments({ messagesLast30Days: { $gt: userStats.messagesLast30Days } }) + 1;
    const userRoles = Object.keys(userStats.roleAcquisitionDates); // Фильтрация по allowedRoleIds (если нужно)

    const profileData = {
      ...userStats,
      userAvatar: userStats.userAvatar,
      userRankAllTime,
      userRankToday,
      userRankLast7Days,
      userRankLast30Days,
      roles: userRoles,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(profileData),
    };
  } catch (error) {
    console.error("Ошибка в profile.js:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ошибка сервера' }),
    };
  }
};