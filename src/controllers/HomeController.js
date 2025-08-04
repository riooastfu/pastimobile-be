import { Sequelize, Op } from "sequelize";
import PersDataKaryawan from "../model/PersDataKaryawan.js";
import PersDepartemen from "../model/PersDepartemen.js";
import { findBirthdaysInWeek } from "../lib/birthday.js";
import MobileVersion from "../model/MobileVersion.js";
import { PredictAllAgeAndGenderWithFaceAlignmentTask } from "face-api.js/build/commonjs/globalApi/PredictAgeAndGenderTask.js";

PredictAllAgeAndGenderWithFaceAlignmentTask

export const getKaryawanUlangTahun = async (req, res, next) => {
    try {
        const { pt } = req.params;

        if (!pt) {
            return next(new AppError('PT karyawan dibutuhkan pada parameter URL.', 400, 'MISSING_PARAMETER'));
        }

        const karyawan = await PersDataKaryawan.findAll({
            attributes: ['nama_karyawan', 'tanggal_lahir'],
            include: [{
                model: PersDepartemen,
                attributes: ['desc'],
                required: false
            }],
            where: {
                perusahaan: pt,
                [Op.and]: [
                    Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('tanggal_lahir')), Sequelize.fn('MONTH', Sequelize.fn('NOW'))),
                    Sequelize.literal("tanggal_keluar = '0000-00-00'")
                ]
            },
            order: [
                [Sequelize.fn('DAY', Sequelize.col('tanggal_lahir')), 'ASC']
            ],
        })

        const restrukturData = karyawan.map(item => ({
            nama_karyawan: item.nama_karyawan,
            tanggal_lahir: item.tanggal_lahir,
            departemen_desc: item.pers_departemen.desc
        }));

        if (restrukturData) { // Gunakan processedData
            const ulangTahun = findBirthdaysInWeek(restrukturData); // Sesuaikan jika findBirthdaysThisWeek perlu data mentah
            res.success(ulangTahun, 'Data ulang tahun berhasil diambil.');
        }
    } catch (error) {
        next(error);
    }
}

export const getAppVersion = async (req, res, next) => {
    try {
        const version = await MobileVersion.findOne({
            order: [
                ['id', 'DESC']
            ]
        });

        res.success(version, 'Versi terbaru dari PASTI Mobile sudah tersedia.');
    } catch (error) {
        next(error);
    }
}