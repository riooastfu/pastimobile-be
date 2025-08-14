import { Sequelize } from "sequelize";
import { db } from "../config/database.js";
import Users from "./Users.js";

const { DataTypes } = Sequelize;

const FcmToken = db.define(
  "fcm_token",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    karyawanid: {
      type: DataTypes.INTEGER(10).UNSIGNED.ZEROFILL,
      allowNull: false,
      references: {
        model: Users,
        key: 'karyawanid'
      }
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    device_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    platform: {
      type: DataTypes.ENUM('android', 'ios'),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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

Users.hasMany(FcmToken, { foreignKey: "karyawanid" });
FcmToken.belongsTo(Users, { foreignKey: "karyawanid" });

export default FcmToken;