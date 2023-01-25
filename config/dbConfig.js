const mongoose = require('mongoose');
const config = require('./config');

const dbConnect = () => {
	try {
		mongoose.set('strictQuery', true);
		mongoose.connect(config.mongoDB_URI, () => {
			console.log(`MongoDB connected successfully`);
		});
	} catch (error) {
		console.log(`DB err: ${error.message}`);
	}
};

module.exports = dbConnect;
