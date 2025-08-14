import crypto from 'crypto'
import jwt from 'jsonwebtoken';
import Users from "../model/Users.js";
import PersDataKaryawanModel from "../model/PersDataKaryawan.js";
import PersDepartemenModel from "../model/PersDepartemen.js";
import PersJabatanModel from "../model/PersJabatan.js";
import PersLokasiModel from "../model/PersLokasi.js";
import PersPtModel from "../model/PersPt.js";
import Pegawai from '../model/Pegawai.js';
import { AppError } from '../utils/errorHandler.js';
import RefreshToken from '../model/RefreshToken.js';
import { Op, QueryTypes } from 'sequelize';
import AuthRoleHt from '../model/AuthRoleHt.js';
import { passwordValidation } from '../lib/password-validation.js';
import UserLog from '../model/UserLog.js';
import FcmToken from '../model/FcmToken.js';

// Fungsi untuk membuat access token
const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Fungsi untuk membuat refresh token
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '14d' });
};

// Simpan refresh token ke database
const saveRefreshToken = async (token, karyawanid) => {
    // Atur masa berlaku token untuk dua minggu dari sekarang
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDay() + 14);

    // Hapus token lama untuk user yang sama untuk mencegah penumpukan token
    await RefreshToken.destroy({ where: { karyawanid: karyawanid } });

    // Simpan token baru
    return await RefreshToken.create({
        token,
        karyawanid: karyawanid,
        expires_at: expiresAt
    });
};

export const Login = async (req, res, next) => {
    const JWT_SECRETTOKEN = process.env.JWT_SECRET;
    const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

    if (!JWT_SECRETTOKEN || !REFRESH_TOKEN_SECRET) {
        return next(new AppError('Konfigurasi server tidak lengkap (JWT Secret missing).', 500, 'JWT_SECRET_MISSING'));
    }

    try {
        const { namauser, password } = req.body;
        if (!namauser || !password) {
            return next(new AppError('Nama user dan password dibutuhkan.', 400, 'MISSING_CREDENTIALS'));
        }

        const foundUser = await Users.findOne({
            where: { namauser: namauser },
            include: [
                {
                    model: PersDataKaryawanModel,
                    attributes: [
                        'nik_kantor', 'nama_karyawan', 'status', 'golongan'
                    ],
                    include: [
                        { model: PersJabatanModel, attributes: ['kode'] },
                        { model: PersDepartemenModel, attributes: ['kode'] },
                        { model: PersPtModel, attributes: ['kode'] },
                        { model: PersLokasiModel, attributes: ['kode'] },
                    ]
                },
                {
                    model: AuthRoleHt,
                    attributes: [
                        'id_role', 'nama_role'
                    ]
                }
            ],
            attributes: ['namauser', 'password', 'karyawanid', 'status', 'password_changed_at'],
        });

        const hashPassword = crypto.createHash('md5').update(password).digest('hex');
        const isPasswordCorrect = foundUser ? hashPassword == foundUser.password : false;

        if (!foundUser || !isPasswordCorrect) {
            return next(new AppError('Username atau password salah.', 401, 'INVALID_CREDENTIALS'));
        }

        if (foundUser.status == 0) {
            return next(new AppError('User tidak aktif', 401, 'USER_INACTIVE'));
        }

        const userPin = await Pegawai.findOne({
            where: { pegawai_nip: foundUser.pers_datakaryawan?.nik_kantor },
            attributes: ['pegawai_pin']
        })

        if (!userPin) {
            return next(new AppError('Pin absensi belum terdaftar.', 404, 'PIN_NOT_FOUND'));
        }

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const isPasswordExpired = !foundUser.password_changed_at ||
            new Date(foundUser.password_changed_at) < threeMonthsAgo;

        // Payload untuk token
        const payload = {
            id: foundUser.karyawanid,
            id_role: foundUser.auth_roleht?.id_role,
            namauser: foundUser.namauser
        };

        // Generate tokens
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Simpan refresh token ke database
        await saveRefreshToken(refreshToken, foundUser.karyawanid);

        // Data user untuk response
        const userDataForResponse = {
            namauser: foundUser.namauser,
            karyawanid: foundUser.karyawanid,
            nik_kantor: foundUser.pers_datakaryawan?.nik_kantor,
            pin_absen: userPin.pegawai_pin,
            nama_karyawan: foundUser.pers_datakaryawan?.nama_karyawan,
            id_role: foundUser.auth_roleht?.id_role,
            jabatan: foundUser.pers_datakaryawan?.pers_jabatan?.kode,
            departemen: foundUser.pers_datakaryawan?.pers_departemen?.kode,
            pt: foundUser.pers_datakaryawan?.pers_pt?.kode,
            lokasi: foundUser.pers_datakaryawan?.pers_lokasi?.kode,
            status: foundUser.pers_datakaryawan?.status,
            golongan: foundUser.pers_datakaryawan?.golongan
        };

        console.log("Berhasil")
        // Kirim tokens dan data user
        res.success(
            {
                accessToken,
                refreshToken,
                user: userDataForResponse,
            },
            isPasswordExpired
                ? 'Login berhasil. Password Anda telah kedaluwarsa, mohon perbarui segera.'
                : 'Login berhasil.'
        );
    } catch (error) {
        next(error);
    }
};

export const refreshAccessToken = async (req, res, next) => {
    try {
        // verifyRefreshToken middleware sudah memeriksa validitas token
        // dan menambahkan data user ke req.user

        // Generate token baru
        const payload = {
            id: req.user.id,
            id_role: req.user.id_role,
            namauser: req.user.namauser
        };

        const newAccessToken = generateAccessToken(payload);

        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 14); // Set masa berlaku baru

        const [affectedRows] = await RefreshToken.update({
            expires_at: newExpiresAt
        }, {
            where: { token: req.refreshToken }
        })

        if (affectedRows > 0) {
            res.success({ accessToken: newAccessToken }, 'Token berhasil diperbarui');
        } else {
            return next(new AppError('Gagal memperbarui token.', 500, 'TOKEN_UPDATE_FAILED'));
        }
    } catch (error) {
        next(error);
    }
};

export const Logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return next(new AppError('Refresh token dibutuhkan', 400, 'REFRESH_TOKEN_REQUIRED'));
        }

        // Hapus refresh token dari database
        const deleted = await RefreshToken.destroy({ where: { token: refreshToken } });

        if (deleted === 0) {
            return res.success({}, 'Logout berhasil, tapi token tidak ditemukan');
        }

        res.success({}, 'Logout berhasil');
    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { namauser, new_password, confirm_password } = req.body;

        if (!namauser || !new_password || !confirm_password) {
            return next(
                new AppError(
                    "Field namauser, new_password, confirm_password dibutuhkan.",
                    400,
                    "MISSING_PARAMETERS"
                )
            );
        }

        const user = await Users.findOne({
            where: { namauser: namauser },
            attributes: ['password']
        });

        if (!user) {
            return next(
                new AppError(
                    "User tidak ditemukan.",
                    404,
                    "USER_NOT_FOUND"
                )
            );
        }

        if (new_password !== confirm_password) {
            return next(
                new AppError(
                    "Password baru tidak cocok dengan password konfirmasi",
                    400,
                    "PASSWORD_MISMATCH"
                )
            );
        }

        // Validate password complexity
        if (!passwordValidation(new_password)) {
            return next(
                new AppError(
                    "Password harus memenuhi kriteria berikut: minimal 8 karakter, mengandung huruf kecil, huruf kapital, angka, dan simbol (!@#$%^&*).",
                    400,
                    "INVALID_PASSWORD_FORMAT"
                )
            );
        }

        const hashNewPassword = crypto.createHash('md5').update(new_password).digest('hex');

        // Check if new password is the same as the current password
        if (hashNewPassword === user.password) {
            return next(
                new AppError(
                    "Password baru tidak boleh sama dengan password saat ini",
                    400,
                    "PASSWORD_SAME_AS_CURRENT"
                )
            );
        }

        const update = await Users.update(
            {
                password: hashNewPassword,
                password_changed_at: new Date()
            },
            { where: { namauser: namauser } }
        );

        return res.success(update, 'Berhasil mereset password');
    } catch (error) {
        next(error);
    }
};

export const cleanupExpiredTokens = async () => {
    try {
        const now = new Date();
        await RefreshToken.destroy({
            where: {
                expires_at: { [Op.lt]: now }
            }
        });
    } catch (error) {
        next(error)
    }
};

export const createLogUserLogin = async (req, res, next) => {
    try {
        const { namauser } = req.body;

        const log = await UserLog.create({
            namauser: namauser,
            action: "l"
        });

        res.created(log, "Berhasil membuat log login");
    } catch (error) {
        next(error)
    }
};

export const registerFCMToken = async (req, res, next) => {
    try {
        const { fcmToken, deviceId, platform } = req.body;
        const userId = req.user.id;

        // Check if token already exists and is active
        const existingToken = await FcmToken.findOne({
            where: {
                karyawanid: userId,
                token: fcmToken,
                is_active: true
            }
        });

        if (existingToken) {
            return res.success({}, 'FCM token sudah terdaftar');
        }

        // Deactivate old tokens for this user
        await FcmToken.update(
            { is_active: false },
            { where: { karyawanid: userId } }
        );

        // Create new token
        await FcmToken.create({
            karyawanid: userId,
            token: fcmToken,
            device_id: deviceId,
            platform: platform,
            is_active: true
        });

        res.success({}, 'FCM token berhasil didaftarkan');
    } catch (error) {
        next(error);
    }
};