// services/FaceRecognitionService.js
import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs';
import canvas from 'canvas';
import crypto from 'crypto';
import { AppError } from '../utils/errorHandler.js';
import TrainingWajah from '../model/TrainingWajah.js';

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

class FaceRecognitionService {
    constructor() {
        this.isModelsLoaded = false;
        this.faceDescriptors = new Map();
    }

    async loadModels() {
        if (this.isModelsLoaded) return;

        try {
            console.log('Loading face recognition models...');
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromDisk('models'),
                faceapi.nets.faceLandmark68Net.loadFromDisk('models'),
                faceapi.nets.faceRecognitionNet.loadFromDisk('models'),
                faceapi.nets.faceExpressionNet.loadFromDisk('models')
            ]);
            this.isModelsLoaded = true;
            console.log('Models loaded successfully.');
        } catch (err) {
            throw new AppError('Gagal memuat model face recognition', 500, 'MODEL_LOAD_ERROR');
        }
    }

    async extractFaceDescriptor(imageBuffer) {
        await this.loadModels();
        try {
            const img = new Image();
            img.src = imageBuffer;
            const detection = await faceapi
                .detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                throw new AppError('Tidak ada wajah yang terdeteksi', 400, 'NO_FACE_DETECTED');
            }

            return detection.descriptor;
        } catch (err) {
            throw new AppError('Gagal mengekstrak data wajah', 500, 'FACE_EXTRACTION_ERROR');
        }
    }

    async saveFaceDescriptor(pin, descriptor) {
        try {
            const descriptorArray = Array.from(descriptor);
            const hash = crypto.createHash('sha256').update(JSON.stringify(descriptorArray)).digest('hex');

            await TrainingWajah.upsert({
                pin,
                descriptor: descriptorArray,
                hash,
                updatedAt: new Date()
            });

            this.faceDescriptors.set(pin, new Float32Array(descriptorArray));
        } catch (err) {
            throw new AppError('Gagal menyimpan data wajah ke database', 500, 'FACE_SAVE_ERROR');
        }
    }

    async loadFaceDescriptor(pin) {
        if (this.faceDescriptors.has(pin)) return this.faceDescriptors.get(pin);

        const record = await TrainingWajah.findByPk(pin);
        if (!record) return null;

        const descriptorArray = JSON.parse(record.descriptor); // ubah dari string ke array
        if (!Array.isArray(descriptorArray) || descriptorArray.length !== 128) {
            throw new AppError('Data descriptor tidak valid', 500, 'INVALID_DESCRIPTOR_LENGTH');
        }
        const descriptor = new Float32Array(descriptorArray);
        this.faceDescriptors.set(pin, descriptor);

        return descriptor;
    }

    async verifyFace(imageBuffer, pin, threshold = 0.6) {
        try {
            const currentDescriptor = await this.extractFaceDescriptor(imageBuffer);
            const savedDescriptor = await this.loadFaceDescriptor(pin);
            if (!savedDescriptor) {
                return { isMatch: false, distance: null, message: 'Data wajah tidak ditemukan' };
            }

            const distance = faceapi.euclideanDistance(currentDescriptor, savedDescriptor);
            const isMatch = distance <= threshold;

            return {
                isMatch,
                distance,
                threshold,
                confidence: Math.max(0, (1 - distance) * 100),
                message: isMatch ? 'Wajah cocok' : 'Wajah tidak cocok'
            };
        } catch (err) {
            console.log(err);
            throw new AppError('Gagal memverifikasi wajah', 500, 'FACE_VERIFICATION_ERROR');
        }
    }

    async registerFace(imageBuffer, pin) {
        const descriptor = await this.extractFaceDescriptor(imageBuffer);
        await this.saveFaceDescriptor(pin, descriptor);
        return { success: true, message: 'Wajah berhasil diregistrasi', pin };
    }

    async updateFace(imageBuffer, pin) {
        const existing = await this.loadFaceDescriptor(pin);
        if (!existing) throw new AppError('Data wajah belum terdaftar', 404, 'FACE_NOT_FOUND');

        const descriptor = await this.extractFaceDescriptor(imageBuffer);
        await this.saveFaceDescriptor(pin, descriptor);
        return { success: true, message: 'Wajah berhasil diperbarui', pin };
    }

    async deleteFace(pin) {
        try {
            this.faceDescriptors.delete(pin);
            await TrainingWajah.destroy({ where: { pin } });
            return { success: true, message: 'Data wajah dihapus', pin };
        } catch (err) {
            throw new AppError('Gagal menghapus data wajah', 500, 'FACE_DELETE_ERROR');
        }
    }

    async hasFaceData(pin) {
        const descriptor = await this.loadFaceDescriptor(pin);
        return descriptor !== null;
    }

    async getStats() {
        const totalRegistered = await TrainingWajah.count();
        return {
            totalRegistered,
            modelsLoaded: this.isModelsLoaded,
            memoryCache: this.faceDescriptors.size
        };
    }
}

export default new FaceRecognitionService();
