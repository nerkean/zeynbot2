const mongoose = require('mongoose');
require('dotenv').config();
const CommandStats = require('./models/CommandStats');
const Item = require('./models/Item');
const Inventory = require('./models/Inventory');

exports.handler = async (event, context) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

        const { uuid, userId, itemName, quantity } = JSON.parse(event.body);

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await CommandStats.findOne({ uuid, userId }).session(session);
            if (!user) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Пользователь не найден' })
                };
            }

            const item = await Item.findOne({ name: itemName }).session(session);
            if (!item) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Товар не найден' })
                };
            }

            if (item.stock !== -1 && item.stock < quantity) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Недостаточно товара в наличии' })
                };
            }

            const today = new Date().getDay();
            const isDiscountDay = today === 0 || today === 6;
            let discountPercentage = isDiscountDay ? 5 : 0;

            const discountedPrice = Math.round(item.price * (1 - discountPercentage / 100));

            if (user.stars < discountedPrice * quantity) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Недостаточно звезд' })
                };
            }

            user.stars -= discountedPrice * quantity;
            await user.save({ session });

            if (item.stock !== -1) {
                item.stock -= quantity;
                await item.save({ session });
            }

            let inventory = await Inventory.findOne({ userId }).session(session);
            if (!inventory) {
                inventory = new Inventory({ userId, items: [] });
            }

            const existingItemIndex = inventory.items.findIndex(i => i.itemId.toString() === item._id.toString());
            if (existingItemIndex !== -1) {
                inventory.items[existingItemIndex].quantity += quantity;
            } else {
                inventory.items.push({ itemId: item._id, itemName: item.name, quantity });
            }
            await inventory.save({ session });

            await session.commitTransaction();
            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Вы успешно купили ${quantity}x ${item.name} за ${discountedPrice * quantity} звезд!` })
            };
        } catch (innerError) {
            await session.abortTransaction();
            console.error('Ошибка при покупке товара:', innerError);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Ошибка при покупке товара' })
            };
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error("Ошибка в buy.js:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Ошибка сервера' })
        };
    }
};