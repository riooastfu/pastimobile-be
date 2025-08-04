import express from 'express';
import { absenCheckIn, absenCheckInFace, absenCheckOut, getDataAbsenUser, getRadiusAbsenByRole } from '../controllers/AbsensiController.js';
import { multerImageUpload } from '../config/image.js';
const absensiRouter = express.Router();

absensiRouter.get('/maps/radius', getRadiusAbsenByRole);
absensiRouter.get('/:pin', getDataAbsenUser);
absensiRouter.post('/masuk', multerImageUpload.single("image"), absenCheckIn);
absensiRouter.post('/keluar', multerImageUpload.single("image"), absenCheckOut);
absensiRouter.post('/masuk/face', multerImageUpload.single("image"), absenCheckInFace);


export default absensiRouter;