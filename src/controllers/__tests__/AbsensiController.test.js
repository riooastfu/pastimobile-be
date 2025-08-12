import { jest } from '@jest/globals';
import { absenCheckIn } from '../AbsensiController.js';
import { AppError } from '../../utils/errorHandler.js';
import { absenCheckSchema, validateImageFile } from '../../schema/AbsensiSchema.js';
import sharp from 'sharp';
import moment from 'moment-timezone';
import path from 'path';
import { QueryTypes } from 'sequelize';

// Mock dependencies
jest.mock('sharp');
jest.mock('../../schema/AbsensiSchema.js');
jest.mock('../../utils/errorHandler.js');
jest.mock('moment-timezone');
jest.mock('path');

// Mock models
const mockAttLog = {
    sequelize: {
        query: jest.fn()
    }
};

// Mock functions
const mockEnsureUploadsDirectory = jest.fn();
const mockNext = jest.fn();
const mockRes = {
    created: jest.fn(),
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000')
};

describe('absenCheckIn', () => {
    let mockReq;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockReq = {
            file: {
                originalname: 'test.jpg',
                buffer: Buffer.from('test'),
                mimetype: 'image/jpeg'
            },
            body: {
                pin: '1328',
                coordinate: '{"lat": -6.2, "lng": 106.8}',
                scan_date: '2025-01-08T10:00:00.000Z'
            },
            protocol: 'http',
            get: jest.fn().mockReturnValue('localhost:3000')
        };

        // Setup default mocks
        validateImageFile.mockReturnValue(mockReq.file);
        absenCheckSchema.safeParse.mockReturnValue({
            success: true,
            data: mockReq.body
        });
        mockEnsureUploadsDirectory.mockResolvedValue();
        sharp.mockReturnValue({
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            png: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockResolvedValue()
        });
        moment.mockReturnValue({
            format: jest.fn().mockReturnValue('08012025100000')
        });
        path.join.mockReturnValue('public/uploads/test.jpg');
        mockAttLog.sequelize.query.mockResolvedValue([1]);
        
        // Mock global functions
        global.ensureUploadsDirectory = mockEnsureUploadsDirectory;
        global.AttLog = mockAttLog;
    });

    describe('Success Cases', () => {
        test('should successfully process check-in with valid data', async () => {
            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockEnsureUploadsDirectory).toHaveBeenCalled();
            expect(validateImageFile).toHaveBeenCalledWith(mockReq.file);
            expect(absenCheckSchema.safeParse).toHaveBeenCalledWith(mockReq.body);
            expect(sharp).toHaveBeenCalledWith(mockReq.file.buffer);
            expect(mockAttLog.sequelize.query).toHaveBeenCalled();
            expect(mockRes.created).toHaveBeenCalledWith(
                expect.objectContaining({
                    pin: '1328',
                    sn: 'Mobile',
                    verifymode: '5',
                    inoutmode: '1'
                }),
                'Berhasil Check-out.'
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should handle file without extension', async () => {
            mockReq.file.originalname = 'testfile';
            
            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockRes.created).toHaveBeenCalled();
        });
    });

    describe('Validation Errors', () => {
        test('should handle validation schema errors', async () => {
            const validationError = {
                success: false,
                error: {
                    flatten: () => ({
                        fieldErrors: { pin: ['Pin is required'] }
                    })
                }
            };
            absenCheckSchema.safeParse.mockReturnValue(validationError);

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                expect.any(AppError)
            );
            expect(mockRes.created).not.toHaveBeenCalled();
        });

        test('should handle invalid image file', async () => {
            const imageError = new AppError('Invalid image', 400, 'IMAGE_ERROR');
            validateImageFile.mockImplementation(() => {
                throw imageError;
            });

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(imageError);
        });
    });

    describe('Time Synchronization', () => {
        test('should reject when time difference exceeds 2 minutes', async () => {
            // Mock time difference > 120000ms (2 minutes)
            const mockTimeServer = new Date('2025-01-08T10:00:00.000Z');
            const mockTimeDevice = new Date('2025-01-08T10:03:00.000Z'); // 3 minutes difference
            
            jest.spyOn(global, 'Date')
                .mockImplementationOnce(() => mockTimeServer)
                .mockImplementationOnce(() => mockTimeDevice);

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Waktu server dan perangkat tidak sinkron.',
                    statusCode: 400,
                    errorCode: 'TIME_MISMATCH'
                })
            );
        });

        test('should accept when time difference is within 2 minutes', async () => {
            const mockTimeServer = new Date('2025-01-08T10:00:00.000Z');
            const mockTimeDevice = new Date('2025-01-08T10:01:00.000Z'); // 1 minute difference
            
            jest.spyOn(global, 'Date')
                .mockImplementationOnce(() => mockTimeServer)
                .mockImplementationOnce(() => mockTimeDevice);

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockRes.created).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalledWith(expect.any(AppError));
        });
    });

    describe('Image Processing', () => {
        test('should process image with correct parameters', async () => {
            const mockSharpInstance = {
                resize: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                png: jest.fn().mockReturnThis(),
                toFile: jest.fn().mockResolvedValue()
            };
            sharp.mockReturnValue(mockSharpInstance);

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockSharpInstance.resize).toHaveBeenCalledWith({ width: 1000 });
            expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 75, mozjpeg: true });
            expect(mockSharpInstance.png).toHaveBeenCalledWith({ compressionLevel: 8, quality: 75 });
            expect(mockSharpInstance.toFile).toHaveBeenCalled();
        });

        test('should handle image processing errors', async () => {
            const imageError = new Error('Image processing failed');
            sharp.mockReturnValue({
                resize: jest.fn().mockReturnThis(),
                jpeg: jest.fn().mockReturnThis(),
                png: jest.fn().mockReturnThis(),
                toFile: jest.fn().mockRejectedValue(imageError)
            });

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(imageError);
        });
    });

    describe('Database Operations', () => {
        test('should execute correct SQL with proper parameters', async () => {
            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockAttLog.sequelize.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO att_log'),
                expect.objectContaining({
                    replacements: expect.objectContaining({
                        sn: 'Mobile',
                        pin: '1328',
                        verifymode: '5',
                        inoutmode: '1'
                    }),
                    type: QueryTypes.INSERT
                })
            );
        });

        test('should handle database errors', async () => {
            const dbError = new Error('Database connection failed');
            mockAttLog.sequelize.query.mockRejectedValue(dbError);

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(dbError);
        });

        test('should parse coordinate JSON correctly', async () => {
            await absenCheckIn(mockReq, mockRes, mockNext);

            const queryCall = mockAttLog.sequelize.query.mock.calls[0];
            const replacements = queryCall[1].replacements;
            
            expect(replacements.coordinate).toEqual({ lat: -6.2, lng: 106.8 });
        });
    });

    describe('Response Data', () => {
        test('should generate correct att_id format', async () => {
            moment.mockReturnValue({
                format: jest.fn().mockReturnValue('08012025100000')
            });

            await absenCheckIn(mockReq, mockRes, mockNext);

            const responseData = mockRes.created.mock.calls[0][0];
            expect(responseData.att_id).toBe('08012025100000MOBILE1328');
        });

        test('should format scan_date correctly', async () => {
            moment.mockReturnValue({
                format: jest.fn()
                    .mockReturnValueOnce('08012025100000') // for att_id
                    .mockReturnValueOnce('2025-01-08 10:00:00') // for scan_date
            });

            await absenCheckIn(mockReq, mockRes, mockNext);

            const responseData = mockRes.created.mock.calls[0][0];
            expect(responseData.scan_date).toBe('2025-01-08 10:00:00');
        });

        test('should generate correct image URL', async () => {
            await absenCheckIn(mockReq, mockRes, mockNext);

            const responseData = mockRes.created.mock.calls[0][0];
            expect(responseData.image).toMatch(/^http:\/\/localhost:3000\/uploads\//);
        });
    });

    describe('Error Handling', () => {
        test('should handle unexpected errors', async () => {
            const unexpectedError = new Error('Unexpected error');
            mockEnsureUploadsDirectory.mockRejectedValue(unexpectedError);

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(unexpectedError);
        });

        test('should not call response methods when error occurs', async () => {
            const error = new Error('Test error');
            validateImageFile.mockImplementation(() => {
                throw error;
            });

            await absenCheckIn(mockReq, mockRes, mockNext);

            expect(mockRes.created).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});