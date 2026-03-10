import express from "express";
import WatchHistory from "../models/WatchHistory.js";

const router = express.Router();

// 1. POST route to save progress (The one working perfectly!)
router.post("/update", async (req, res) => {
  try {
    const { userId, courseId, lessonId, watchedSeconds, totalDuration } = req.body;
    
    // Find existing history or create a new one
    let history = await WatchHistory.findOne({ where: { userId, courseId, lessonId } });
    
    if (history) {
      history.watchedSeconds = watchedSeconds;
      history.totalDuration = totalDuration;
      await history.save();
    } else {
      history = await WatchHistory.create({ userId, courseId, lessonId, watchedSeconds, totalDuration });
    }
    
    res.status(200).json({ message: "Progress saved", history });
  } catch (error) {
    console.error("History update error:", error);
    res.status(500).json({ error: "Failed to update watch history" });
  }
});

// 2. NEW GET route to fetch progress for the Dashboard!
router.get("/", async (req, res) => {
  try {
    // Fetch all history and sort by most recently watched
    const history = await WatchHistory.findAll({
      order: [['updatedAt', 'DESC']]
    });
    res.status(200).json(history);
  } catch (error) {
    console.error("Fetch history error:", error);
    res.status(500).json({ error: "Failed to fetch watch history" });
  }
});

export default router;