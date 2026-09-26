const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/otp/request', authController.requestOtp);
router.post('/otp/reset-password', authController.verifyOtpAndResetPassword);

module.exports = router;
