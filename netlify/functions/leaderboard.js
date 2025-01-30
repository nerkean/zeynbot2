// netlify/functions/leaderboard.js
const mongoose = require('mongoose'); // Assuming you're using Mongoose for MongoDB
require('dotenv').config()
const CommandStats = require('./CommandStats'); // Your Mongoose model

exports.handler = async (event, context) => {
  try {

    mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => console.log('💾 Подключено к MongoDB'))
      .catch(err => console.error('Ошибка подключения:', err));

    const sortBy = event.queryStringParameters.sortBy || 'totalMessages'; // Get sortBy from query string
    const page = parseInt(event.queryStringParameters.page) || 1;
    const limit = parseInt(event.queryStringParameters.limit) || 100;
    const skip = (page - 1) * limit;

    let sortOption = {};
    if (sortBy === 'voiceTime') {
      sortOption = { voiceTime: -1 };
    } else if (sortBy === 'stars') {
      sortOption = { stars: -1 };
    } else {
      sortOption = { totalMessages: -1 };
    }

    const topUsers = await CommandStats.find({})
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .select('username totalMessages voiceTime stars')
      .lean();

    return {
      statusCode: 200,
      body: JSON.stringify({ data: topUsers }),
    };
  } catch (error) {
    console.error("Ошибка:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ошибка сервера' }),
    };
  }
};