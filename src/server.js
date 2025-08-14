import app from "./app.js";
import { cleanupExpiredTokens } from "./controllers/AuthController.js";
import schedulerService from "./services/schedulerService.js";
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);

    scheduleTokenCleanup();
    schedulerService.start();
});

// Fungsi untuk menjadwalkan pembersihan token
function scheduleTokenCleanup() {
    // Bersihkan token kedaluwarsa setiap 24 jam
    setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);

    // Jalankan pembersihan saat server dimulai
    cleanupExpiredTokens();
}