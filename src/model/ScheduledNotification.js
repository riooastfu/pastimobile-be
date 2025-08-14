import { Sequelize } from "sequelize";
import { db } from "../config/database.js";
import Users from "./Users.js";

const { DataTypes } = Sequelize;

const ScheduledNotification = db.define(
  "scheduled_notification",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    target_type: {
      type: DataTypes.ENUM('all', 'role', 'users'),
      allowNull: false,
    },
    target_value: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    created_by: {
      type: DataTypes.INTEGER(10).UNSIGNED.ZEROFILL,
      allowNull: false,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    charset: "latin1",
    collate: "latin1_swedish_ci",
  }
);

Users.hasMany(ScheduledNotification, { foreignKey: "created_by" });
ScheduledNotification.belongsTo(Users, { foreignKey: "created_by" });

export default ScheduledNotification;