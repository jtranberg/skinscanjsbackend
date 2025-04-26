// === Full Express Backend for DR.Epidermus ===
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fileUpload from 'express-fileupload';

import path from 'path';
import bcrypt from 'bcryptjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

import axios from 'axios';
import FormData from 'form-data';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(cors());
app.use(express.json());
app.use(fileUpload());

// === MongoDB Setup ===
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', userSchema);

// === Gemini AI Setup ===
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // === Model & Data Loading ===


// const fs = require('fs');
// const path = require('path');
// const axios = require('axios');
// const tf = require('@tensorflow/tfjs-node');

// let model, triageModel, classLabels, treatments;

// const downloadModelFile = async (url, filePath) => {
//   if (!fs.existsSync(filePath)) {
//     const writer = fs.createWriteStream(filePath);
//     const response = await axios.get(url, { responseType: 'stream' });
//     await new Promise((resolve, reject) => {
//       response.data.pipe(writer);
//       writer.on('finish', resolve);
//       writer.on('error', reject);
//     });
//     console.log(`⬇️ Downloaded: ${filePath}`);
//   }
// };

// (async () => {
//   try {
//     const modelDir = path.join(__dirname, 'model');
//     const mainModelPath = path.join(modelDir, 'best_model');
//     const triageModelPath = path.join(modelDir, 'best_model3');

//     fs.mkdirSync(mainModelPath, { recursive: true });
//     fs.mkdirSync(triageModelPath, { recursive: true });

//     // GitHub Release URLs
//     const GH_RELEASE = 'https://github.com/jtranberg/skinscanbackend/releases/download/v1.0.0';

//     // Main 8-class model
//     await downloadModelFile(`${GH_RELEASE}/best_model_model.json`, path.join(mainModelPath, 'model.json'));
//     await downloadModelFile(`${GH_RELEASE}/best_model_group1-shard1of1.bin`, path.join(mainModelPath, 'group1-shard1of1.bin'));

//     // 3-class triage model
//     await downloadModelFile(`${GH_RELEASE}/best_model3_model.json`, path.join(triageModelPath, 'model.json'));
//     await downloadModelFile(`${GH_RELEASE}/best_model3_group1-shard1of1.bin`, path.join(triageModelPath, 'group1-shard1of1.bin'));

//     // Load models
//     model = await tf.loadLayersModel(`file://${path.join(mainModelPath, 'model.json')}`);
//     triageModel = await tf.loadLayersModel(`file://${path.join(triageModelPath, 'model.json')}`);

//     // Load config JSON files
//     classLabels = JSON.parse(fs.readFileSync(path.join(modelDir, 'class_labels_8.json'), 'utf-8'));
//     treatments = JSON.parse(fs.readFileSync(path.join(modelDir, 'treatments.json'), 'utf-8'));

//     console.log('✅ Models and configs loaded');
//   } catch (error) {
//     console.error('❌ Error loading models:', error);
//   }
// })();


// === Auth Routes ===
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Invalid input' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'User exists' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email, password: hashed });
    res.status(201).json({ message: 'Registered', email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration error' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.status(200).json({ message: 'Login successful', email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login error' });
  }
});

// === Chatbot ===
app.post('/chatbot', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Prompt required' });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(query);
    const reply = result.response.text();

    res.json({ response: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chatbot error' });
  }
});

// === Predict ===
// === Predict (via Python microservice) ===
app.post('/predict', async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageFile = req.files.image;
    const form = new FormData();

    // Append the image and metadata
    form.append('image', imageFile.data, imageFile.name);
    form.append('age', req.body.age || '');
    form.append('gender', req.body.gender || '');
    form.append('weight', req.body.weight || '');
    form.append('lat', req.body.lat || '');
    form.append('lon', req.body.lon || '');

    const response = await axios.post(
      'https://skinscanbackend.onrender.com/predict', // ✅ your real microservice URL
      form,
      {
        headers: form.getHeaders(),
        timeout: 15000, // Optional: to prevent hanging
      }
    );

    // Forward the Python prediction response
    res.json(response.data);
  } catch (error) {
    console.error('❌ Predict proxy error:', error.message || error);
    res.status(500).json({ error: 'Prediction service unavailable' });
  }
});

//=== Launch ===
app.listen(PORT, () => {
  console.log(`🚀 DR.Epidermus JS Backend running on port ${PORT}`);
});
