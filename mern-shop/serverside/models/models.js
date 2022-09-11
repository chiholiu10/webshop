const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    minLength: 3,
    unique: true
  },
  email: {
    type: String,
    required: true,
    minLength: 5,
    unique: true
  },
  password: {
    type: String,
    required: true,
    minLength: 5
  }
});

const User = mongoose.model("User", UserSchema);

module.exports = User;