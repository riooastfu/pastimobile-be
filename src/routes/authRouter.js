import express from 'express';
import { createLogUserLogin, Login, Logout, refreshAccessToken, resetPassword, registerFCMToken } from '../controllers/AuthController.js';
import { verifyRefreshToken, verifyToken } from '../middleware/middleware.js';

const authRouter = express.Router();

authRouter.post('/login', Login);
authRouter.post('/refresh-token', [verifyRefreshToken], refreshAccessToken);
authRouter.post('/logout', Logout);
authRouter.post('/password/reset', resetPassword);
authRouter.post('/login/log', createLogUserLogin);
authRouter.post('/register-fcm-token', [verifyToken], registerFCMToken);

export default authRouter;