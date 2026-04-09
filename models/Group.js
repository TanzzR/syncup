const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: String,
  members: [
    {
      user: String,
      schedule: {
        type: Object,
        default: {}
      }
    }
  ]
});

module.exports = mongoose.model("Group", groupSchema);