const express = require("express");
const router = express.Router();

const Group = require("../models/Group");

router.post("/group", async (req, res) => {
  try {
    const existingGroup = await Group.findOne({ name: req.body.name.trim() });
    if (existingGroup) {
      return res.status(400).json({ error: "Group name already exists. Please choose a unique name." });
    }

    const group = new Group({
      name: req.body.name.trim(),
      members: []
    });

    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/group/:id/schedule", async (req, res) => {
  try {
    const { user, schedule } = req.body;

    console.log("BODY:", req.body); // debug

    if (!schedule) {
      return res.status(400).json({ error: "Schedule is required" });
    }

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const existingUser = group.members.find(m => m.user === user);

    if (existingUser) {
      existingUser.schedule = schedule;
    } else {
      group.members.push({ user, schedule });
    }

    await group.save();

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/group/:id", async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;