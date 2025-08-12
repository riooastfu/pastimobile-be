// controllers/AbsensiController.js (Enhanced Version)
import { AppError } from '../utils/errorHandler.js';
import AttLog from '../model/AttLog.js';
import { col, fn, QueryTypes, where } from 'sequelize';
import AuthMaps from '../model/AuthMaps.js';
import AuthRoleHt from '../model/AuthRoleHt.js';
import MasterLokasiAbsen from '../model/MasterLokasiAbsen.js';
import moment from 'moment-timezone';
import { absenCheckSchema, validateImageFile } from '../schema/AbsensiSchema.js';
import { ensureUploadsDirectory } from '../config/image.js';
import path from 'path';
import sharp from 'sharp';
import FaceRecognitionService from '../services/faceRecognitionService.js';
import { Op } from 'sequelize';
import { Jimp } from 'jimp';

export const absenCheckInFace = async (req, res, next) => {
    try {
        await ensureUploadsDirectory();

        const file = validateImageFile(req.file);

        const validationResult = absenCheckSchema.safeParse(req.body);

        if (!validationResult.success) {
            const formattedErrors = validationResult.error.flatten().fieldErrors;
            return next(
                new AppError(
                    "Data input tidak valid.",
                    400,
                    "VALIDATION_ERROR",
                    formattedErrors
                )
            );
        }

        const validatedData = validationResult.data;

        // Face recognition verification - REQUIRED for all check-ins
        const faceResult = await FaceRecognitionService.verifyFace(
            file.buffer,
            validatedData.pin,
            validatedData.threshold
        );

        // If face verification fails, return error immediately - NO database insertion
        if (!faceResult.isMatch) {
            return res.status(401).json({
                status: 'fail',
                message: faceResult.message,
                data: {
                    isMatch: faceResult.isMatch,
                    confidence: faceResult.confidence,
                    distance: faceResult.distance,
                    threshold: faceResult.threshold,
                    pin: validatedData.pin
                }
            });
        }

        // Time synchronization check
        const timeServer = new Date();
        const timeDevice = new Date(validatedData.scan_date);
        const timeDiff = Math.abs(timeServer - timeDevice);

        if (timeDiff > 120000) {
            return next(new AppError('Waktu server dan perangkat tidak sinkron.', 400, 'TIME_MISMATCH'));
        }

        // Image processing and compression
        const originalNameParts = file.originalname.split('.');
        const extension = originalNameParts.length > 1 ? `.${originalNameParts.pop()}` : '.jpg';
        const baseFilename = originalNameParts.join('.');
        const compressedFilename = `${moment(validatedData.scan_date).format('DDMMYYYYHHmmss')}-${baseFilename}${extension}`;
        const compressedPath = path.join('public', 'uploads', compressedFilename);

        await sharp(file.buffer)
            .resize({ width: 1000 })
            .jpeg({ quality: 75, mozjpeg: true })
            .png({ compressionLevel: 8, quality: 75 })
            .toFile(compressedPath);

        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${compressedFilename}`;

        // Prepare data for database insertion
        const dataToCreate = {
            pin: validatedData.pin,
            coordinate: validatedData.coordinate,
            image: imageUrl,
            sn: 'Mobile',
            scan_date: moment(validatedData.scan_date).format('YYYY-MM-DD HH:mm:ss'),
            verifymode: '15', // Face recognition verify mode
            inoutmode: '1',
            att_id: moment(validatedData.scan_date).format('DDMMYYYYHHmmss') + "MOBILE" + validatedData.pin,
        };

        // Database insertion
        const sql = `INSERT INTO att_log (sn, scan_date, pin, verifymode, inoutmode, reserved, work_code, att_id, coordinate, image)
             VALUES (:sn, :scan_date, :pin, :verifymode, :inoutmode, '', '', :att_id, :coordinate, :image)`;

        const replacements = {
            sn: dataToCreate.sn,
            scan_date: dataToCreate.scan_date,
            pin: dataToCreate.pin,
            verifymode: dataToCreate.verifymode,
            inoutmode: dataToCreate.inoutmode,
            att_id: dataToCreate.att_id,
            coordinate: JSON.parse(dataToCreate.coordinate),
            image: dataToCreate.image
        };

        const [affectedRows] = await AttLog.sequelize.query(sql, {
            replacements: replacements,
            type: QueryTypes.INSERT
        });

        // Success response - includes face verification details
        const responseData = {
            ...dataToCreate,
            face_verification: {
                isMatch: true,
                confidence: faceResult.confidence,
                distance: faceResult.distance,
                threshold: validatedData.threshold
            }
        };

        res.created(responseData, "Berhasil Check-in.");

    } catch (error) {
        next(error);
    }
};

export const absenCheckIn = async (req, res, next) => {
    try {
        await ensureUploadsDirectory();

        const file = validateImageFile(req.file);

        const validationResult = absenCheckSchema.safeParse(req.body);

        if (!validationResult.success) {
            const formattedErrors = validationResult.error.flatten().fieldErrors;
            return next(
                new AppError(
                    "Data input tidak valid.",
                    422,
                    "VALIDATION_ERROR",
                    formattedErrors
                )
            );
        }

        const validatedData = validationResult.data;

        const timeServer = new Date();
        const timeDevice = new Date(validatedData.scan_date);

        const timeDiff = Math.abs(timeServer - timeDevice);

        if (timeDiff > 120000) {
            return next(new AppError('Waktu server dan perangkat tidak sinkron.', 400, 'TIME_MISMATCH'));
        }

        const originalNameParts = file.originalname.split('.');
        const extension = originalNameParts.length > 1 ? `.${originalNameParts.pop()}` : '.jpg';
        const baseFilename = originalNameParts.join('.');
        const compressedFilename = `${moment(timeDevice).format('DDMMYYYYHHmmss')}-${baseFilename}${extension}`;
        const compressedPath = path.join('public', 'uploads', compressedFilename);

        await sharp(file.buffer)
            .resize({ width: 1000 })
            .jpeg({ quality: 75, mozjpeg: true })
            .png({ compressionLevel: 8, quality: 75 })
            .toFile(compressedPath);

        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${compressedFilename}`;

        const dataToCreate = {
            ...validatedData,
            image: imageUrl,
            sn: 'Mobile',
            scan_date: moment(validatedData.scan_date).format('YYYY-MM-DD HH:mm:ss'),
            verifymode: '5',
            inoutmode: '1',
            att_id: moment(validatedData.scan_date).format('DDMMYYYYHHmmss') + "MOBILE" + validatedData.pin,
        };

        const sql = `INSERT INTO att_log (sn, scan_date, pin, verifymode, inoutmode, reserved, work_code, att_id, coordinate, image)
             VALUES (:sn, :scan_date, :pin, :verifymode, :inoutmode, '', '', :att_id, :coordinate, :image)`;

        const replacements = {
            sn: dataToCreate.sn,
            scan_date: dataToCreate.scan_date,
            pin: dataToCreate.pin,
            verifymode: dataToCreate.verifymode,
            inoutmode: dataToCreate.inoutmode,
            att_id: dataToCreate.att_id,
            coordinate: JSON.parse(dataToCreate.coordinate),
            image: dataToCreate.image
        };

        const [affectedRows] = await AttLog.sequelize.query(sql, {
            replacements: replacements,
            type: QueryTypes.INSERT
        });

        res.created(dataToCreate, "Berhasil Check-out.");

    } catch (error) {
        next(error);
    }
};

export const absenCheckOut = async (req, res, next) => {
    try {
        await ensureUploadsDirectory();

        const file = validateImageFile(req.file);

        const validationResult = absenCheckSchema.safeParse(req.body);

        if (!validationResult.success) {
            const formattedErrors = validationResult.error.flatten().fieldErrors;
            return next(
                new AppError(
                    "Data input tidak valid.",
                    422,
                    "VALIDATION_ERROR",
                    formattedErrors
                )
            );
        }

        const validatedData = validationResult.data;

        const timeServer = new Date();
        const timeDevice = new Date(validatedData.scan_date);

        const timeDiff = Math.abs(timeServer - timeDevice);

        if (timeDiff > 120000) {
            return next(new AppError('Waktu server dan perangkat tidak sinkron.', 400, 'TIME_MISMATCH'));
        }

        const originalNameParts = file.originalname.split('.');
        const extension = originalNameParts.length > 1 ? `.${originalNameParts.pop()}` : '.jpg';
        const baseFilename = originalNameParts.join('.');
        const compressedFilename = `${moment(timeDevice).format('DDMMYYYYHHmmss')}-${baseFilename}${extension}`;
        const compressedPath = path.join('public', 'uploads', compressedFilename);

        await sharp(file.buffer)
            .resize({ width: 1000 })
            .jpeg({ quality: 75, mozjpeg: true })
            .png({ compressionLevel: 8, quality: 75 })
            .toFile(compressedPath);

        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${compressedFilename}`;

        const dataToCreate = {
            ...validatedData,
            image: imageUrl,
            sn: 'Mobile',
            scan_date: moment(validatedData.scan_date).format('YYYY-MM-DD HH:mm:ss'),
            verifymode: '5',
            inoutmode: '0',
            att_id: moment(validatedData.scan_date).format('DDMMYYYYHHmmss') + "MOBILE" + validatedData.pin,
        };

        const sql = `INSERT INTO att_log (sn, scan_date, pin, verifymode, inoutmode, reserved, work_code, att_id, coordinate, image)
             VALUES (:sn, :scan_date, :pin, :verifymode, :inoutmode, '', '', :att_id, :coordinate, :image)`;

        const replacements = {
            sn: dataToCreate.sn,
            scan_date: dataToCreate.scan_date,
            pin: dataToCreate.pin,
            verifymode: dataToCreate.verifymode,
            inoutmode: dataToCreate.inoutmode,
            att_id: dataToCreate.att_id,
            coordinate: JSON.parse(dataToCreate.coordinate),
            image: dataToCreate.image
        };

        const [affectedRows] = await AttLog.sequelize.query(sql, {
            replacements: replacements,
            type: QueryTypes.INSERT
        });

        res.created(dataToCreate, "Berhasil Check-out.");

    } catch (error) {
        next(error);
    }
};

/**
 * Mengambil riwayat absen (9 hari terakhir) untuk NIP tertentu.
 */
export const getDataAbsenUser = async (req, res, next) => {
    try {
        const { pin } = req.params;

        if (!pin) {
            return next(new AppError('PIN absen Pegawai dibutuhkan.', 400, 'MISSING_PARAMETER'));
        }

        // Get current month and year
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11

        const dataAbsen = await AttLog.findAll({
            where: {
                pin,
                [Op.and]: [
                    where(fn('YEAR', col('att_log.scan_date')), currentYear),
                    where(fn('MONTH', col('att_log.scan_date')), currentMonth)
                ]
            },
            attributes: [
                'pin',
                [fn('DATE', col('att_log.scan_date')), 'tgl_masuk'],
                [fn('MIN', fn('TIME', col('att_log.scan_date'))), 'jam_masuk'],
                [fn('MAX', fn('TIME', col('att_log.scan_date'))), 'jam_pulang'],
            ],
            group: [
                fn('DATE', col('att_log.scan_date')),
                'pin',
            ],
            order: [
                [fn('DATE', col('att_log.scan_date')), 'DESC']
            ]
        });

        res.success(dataAbsen, 'Data absensi berhasil diambil.');

    } catch (error) {
        next(error);
    }
};

export const getRadiusAbsenByRole = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id_role) {
            return next(new AppError('Informasi pengguna atau peran tidak ditemukan.', 401, 'UNAUTHENTICATED_OR_ROLE_MISSING'));
        }

        const userRole = req.user.id_role;

        const maps = await AuthRoleHt.findAll({
            where: {
                id_role: userRole
            },
            include: [{
                model: MasterLokasiAbsen,
                attributes: ['tikor', 'nama_lokasi', 'radius'],
            }]
        });

        res.success(maps[0].master_lokasi_absens, 'Data radius absen by role berhasil diambil.');
    } catch (error) {
        next(error);
    }
};