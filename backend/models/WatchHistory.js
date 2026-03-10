import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const WatchHistory = sequelize.define("WatchHistory", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.STRING, // 🔥 FIXED: Now accepts text UUIDs
    allowNull: false,
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  lessonId: {
    type: DataTypes.STRING, // 🔥 FIXED: Now accepts text like 'what-is-react'
    allowNull: false,
  },
  watchedSeconds: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalDuration: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
});

export default WatchHistory;