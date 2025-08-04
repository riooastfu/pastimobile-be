// controllers/FaceRecognitionController.js
import FaceRecognitionService from '../services/faceRecognitionService.js';
import { AppError } from '../utils/errorHandler.js';
import { validateImageFile } from '../schema/AbsensiSchema.js';
import { ensureUploadsDirectory } from '../config/image.js';

/**
 * Register wajah baru untuk user
 */
export const registerFace = async (req, res, next) => {
    try {
        await ensureUploadsDirectory();

        const file = validateImageFile(req.file);
        const { pin } = req.body;

        if (!pin) {
            return next(new AppError('PIN user diperlukan untuk registrasi wajah', 400, 'MISSING_PIN'));
        }

        // Cek apakah user sudah memiliki data wajah
        const hasExistingFace = await FaceRecognitionService.hasFaceData(pin);
        if (hasExistingFace) {
            return next(new AppError('User sudah memiliki data wajah. Gunakan endpoint update untuk memperbarui.', 409, 'FACE_ALREADY_EXISTS'));
        }

        // Register wajah
        const result = await FaceRecognitionService.registerFace(file.buffer, pin);

        res.created(result, 'Wajah berhasil didaftarkan');
    } catch (error) {
        next(error);
    }
};

/**
 * Update data wajah untuk user yang sudah ada
 */
export const updateFace = async (req, res, next) => {
    try {
        await ensureUploadsDirectory();

        const file = validateImageFile(req.file);
        const { pin } = req.params;

        if (!pin) {
            return next(new AppError('PIN user diperlukan', 400, 'MISSING_PIN'));
        }

        // Update wajah
        const result = await FaceRecognitionService.updateFace(file.buffer, pin);

        res.success(result, 'Data wajah berhasil diperbarui');
    } catch (error) {
        next(error);
    }
};

/**
 * Verifikasi wajah untuk absensi
 */
export const verifyFace = async (req, res, next) => {
    try {
        await ensureUploadsDirectory();

        const file = validateImageFile(req.file);
        const { pin, threshold } = req.body;

        if (!pin) {
            return next(new AppError('PIN user diperlukan untuk verifikasi wajah', 400, 'MISSING_PIN'));
        }

        // Parse threshold (opsional, default 0.6)
        const verificationThreshold = threshold ? parseFloat(threshold) : 0.6;

        if (verificationThreshold < 0 || verificationThreshold > 1) {
            return next(new AppError('Threshold harus antara 0 dan 1', 400, 'INVALID_THRESHOLD'));
        }

        // Verifikasi wajah
        const result = await FaceRecognitionService.verifyFace(file.buffer, pin, verificationThreshold);

        // Set status code berdasarkan hasil verifikasi
        const statusCode = result.isMatch ? 200 : 401;
        const message = result.message;

        res.status(statusCode).json({
            status: result.isMatch ? 'success' : 'fail',
            message,
            data: {
                isMatch: result.isMatch,
                confidence: result.confidence,
                distance: result.distance,
                threshold: result.threshold,
                pin
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Hapus data wajah user
 */
export const deleteFace = async (req, res, next) => {
    try {
        const { pin } = req.params;

        if (!pin) {
            return next(new AppError('PIN user diperlukan', 400, 'MISSING_PIN'));
        }

        // Hapus data wajah
        const result = await FaceRecognitionService.deleteFace(pin);

        res.success(result, 'Data wajah berhasil dihapus');
    } catch (error) {
        next(error);
    }
};

/**
 * Cek status registrasi wajah user
 */
export const checkFaceStatus = async (req, res, next) => {
    try {
        const { pin } = req.params;

        if (!pin) {
            return next(new AppError('PIN user diperlukan', 400, 'MISSING_PIN'));
        }

        // Cek apakah user sudah memiliki data wajah
        const hasFaceData = await FaceRecognitionService.hasFaceData(pin);

        res.success({
            pin,
            hasFaceData,
            status: hasFaceData ? 'registered' : 'not_registered'
        }, 'Status registrasi wajah berhasil diambil');
    } catch (error) {
        next(error);
    }
};

/**
 * Get statistik face recognition
 */
export const getFaceStats = async (req, res, next) => {
    try {
        const stats = await FaceRecognitionService.getStats();

        res.success(stats, 'Statistik face recognition berhasil diambil');
    } catch (error) {
        next(error);
    }
};

/**
 * Test endpoint untuk memverifikasi model sudah ter-load
 */
export const testFaceModels = async (req, res, next) => {
    try {
        // Force load models
        await FaceRecognitionService.loadModels();

        res.success({
            modelsLoaded: true,
            message: 'Face recognition models berhasil dimuat'
        }, 'Test face recognition berhasil');
    } catch (error) {
        next(error);
    }
};