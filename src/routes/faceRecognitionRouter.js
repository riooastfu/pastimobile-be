// routes/faceRecognitionRouter.js
import express from 'express';
import {
    registerFace,
    updateFace,
    verifyFace,
    deleteFace,
    checkFaceStatus,
    getFaceStats,
    testFaceModels
} from '../controllers/FaceRecognitionController.js';
// import {
//     absenCheckInWithFace,
//     absenCheckOutWithFace
// } from '../controllers/AbsensiController.js';
import { multerImageUpload } from '../config/image.js';
import { verifyToken } from '../middleware/middleware.js';

const faceRecognitionRouter = express.Router();

// === FACE MANAGEMENT ROUTES ===
// Test endpoint untuk memastikan models ter-load
faceRecognitionRouter.get('/test', testFaceModels);

// Get statistik face recognition
faceRecognitionRouter.get('/stats', verifyToken, getFaceStats);

// Cek status registrasi wajah untuk user tertentu
faceRecognitionRouter.get('/status/:pin', verifyToken, checkFaceStatus);

// Register wajah baru
faceRecognitionRouter.post('/register', verifyToken, multerImageUpload.single("image"), registerFace);

// Update data wajah yang sudah ada
faceRecognitionRouter.put('/update/:pin', verifyToken, multerImageUpload.single("image"), updateFace);

// Verifikasi wajah (standalone)
faceRecognitionRouter.post('/verify', verifyToken, multerImageUpload.single("image"), verifyFace);

// Hapus data wajah
faceRecognitionRouter.delete('/delete/:pin', verifyToken, deleteFace);

// === ABSENSI WITH FACE RECOGNITION ROUTES ===
// Check-in dengan face recognition
// faceRecognitionRouter.post('/absensi/masuk', verifyToken, multerImageUpload.single("image"), absenCheckInWithFace);

// Check-out dengan face recognition
// faceRecognitionRouter.post('/absensi/keluar', verifyToken, multerImageUpload.single("image"), absenCheckOutWithFace);

export default faceRecognitionRouter;