const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: 'c:\\Users\\ASUS\\OneDrive\\Desktop\\CUET-SciBlitz-AI-Hackathon-main\\CUET-SciBlitz-AI-Hackathon-main\\server\\.env', override: true });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema, 'questions');

async function testQuery() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB!');

    const questions = await Question.find({ subject: 'Higher Math', paper: '1st', type: 'mcq' }).lean();
    console.log('Total questions found:', questions.length);
    questions.forEach((q, index) => {
      console.log(`\n--- Question ${index + 1} ---`);
      console.log('ID:', q._id);
      console.log('Text:', q.questionText);
      console.log('Subject:', q.subject);
      console.log('Paper:', q.paper);
      console.log('Type:', q.type);
      console.log('Tags:', JSON.stringify(q.tags, null, 2));
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

testQuery();
