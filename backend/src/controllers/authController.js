const { getDatabase } = require('../config/database');

const otpStore = new Map();

exports.register = (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const avatar = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;
    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, avatar)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase().trim(), password, role || 'Inventory Manager', avatar);

    const user = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: role || 'Inventory Manager',
      avatar
    };

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.login = (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT id, name, email, password, role, avatar FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const { password: _, ...userData } = user;
    res.json({ success: true, data: userData });
  } catch (err) {
    next(err);
  }
};

exports.requestOtp = (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(user.email, {
      code: otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    res.json({
      success: true,
      data: {
        email: user.email,
        otp,
        message: 'OTP generated and simulated to email'
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyOtpAndResetPassword = (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' });
    }

    const record = otpStore.get(email.toLowerCase().trim());
    if (!record) {
      return res.status(400).json({ success: false, error: 'No active OTP session. Please request a new OTP' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email.toLowerCase().trim());
      return res.status(400).json({ success: false, error: 'OTP has expired' });
    }

    if (record.code !== otp.trim()) {
      return res.status(400).json({ success: false, error: 'Invalid OTP code' });
    }

    const db = getDatabase();
    db.prepare('UPDATE users SET password = ? WHERE email = ?').run(newPassword, email.toLowerCase().trim());
    otpStore.delete(email.toLowerCase().trim());

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};
