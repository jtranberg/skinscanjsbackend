import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fileUpload from 'express-fileupload';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import chatbotRoutes from './routes/chatbot.js';
import predictRoutes from './routes/predict.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Routes
app.use('/register', authRoutes);
app.use('/login', authRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/predict', predictRoutes);

// Launch
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
