import { DataTypes } from "sequelize";
import { db } from "../config/database.js";
import Users from "./Users.js";

const TrainingWajah = db.define(
    "training_wajah",
    {
        pin: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        descriptor: {
            type: DataTypes.JSON, // Simpan array 128 float
            allowNull: false
        },
        hash: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        freezeTableName: true,
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);

// Definisikan relasi dengan Users
TrainingWajah.belongsTo(Users, { foreignKey: "pin" });
Users.hasMany(TrainingWajah, { foreignKey: "pin" });

export default TrainingWajah;
