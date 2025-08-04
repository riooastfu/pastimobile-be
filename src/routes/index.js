import express from 'express';
import authRouter from './authRouter.js';
import cutiRouter from './cutiRouter.js';
import absensiRouter from './absensiRouter.js';
import { checkPasswordExpiration, checkRole, verifyToken } from '../middleware/middleware.js';
import homeRouter from './homeRouter.js';
import aktivitasRouter from './aktivitasRouter.js';
import profileRouter from './profileRouter.js';
import faceRecognitionRouter from './faceRecognitionRouter.js';

const rootRouter = express.Router();

rootRouter.use('/auth', authRouter);
rootRouter.use('/home', [verifyToken, checkPasswordExpiration], homeRouter);
rootRouter.use('/cuti', [verifyToken, checkPasswordExpiration], cutiRouter);
rootRouter.use('/absensi', [verifyToken, checkPasswordExpiration], absensiRouter);
rootRouter.use('/aktivitas', [verifyToken, checkPasswordExpiration], aktivitasRouter);
rootRouter.use('/profile', [verifyToken, checkPasswordExpiration], profileRouter);
rootRouter.use('/face', [verifyToken, checkPasswordExpiration], faceRecognitionRouter);

export default rootRouter;