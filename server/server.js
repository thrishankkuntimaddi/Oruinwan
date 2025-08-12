const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcrypt');

mongoose.connect('mongodb://127.0.0.1:27017/chttrix', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log("MongoDB connected ✅");

  try {
    const existing = await User.findOne({ email: "testfinal2213@example.com" });
    if (existing) {
      console.log("⚠️ User already exists:", existing);
    } else {
      const hashedPassword = await bcrypt.hash("testpass123", 10);

      const newUser = new User({
        username: "Thrisaank",
        email: "testfinal2213@example.com",
        phone: "1234567890",
        password: hashedPassword
      });

      const savedUser = await newUser.save();
      console.log("✅ User inserted:", savedUser);
    }
  } catch (err) {
    console.error("❌ Error inserting user:", err);
  }
})
.catch(err => {
  console.error("❌ MongoDB connection failed:", err);
});
