// StockSense Authentication & Access Control Module
const Auth = {
  currentUser: null,
  otpSession: {
    email: null,
    code: null,
    expiry: null
  },

  init() {
    this.currentUser = DataStore.get(STORAGE_KEYS.CURRENT_USER, null);
    this.bindEvents();
    this.renderSession();
  },

  getCurrentUser() {
    return this.currentUser;
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  login(email, password) {
    const users = DataStore.get(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      throw new Error('User not found. Please check your email or sign up.');
    }

    if (user.password !== password) {
      throw new Error('Invalid password. Please try again or use OTP Reset.');
    }

    this.setCurrentUser(user);
    return user;
  },

  quickLogin(email) {
    const users = DataStore.get(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (user) {
      this.setCurrentUser(user);
      return user;
    }
    throw new Error('Quick login profile not found.');
  },

  register(userData) {
    const users = DataStore.get(STORAGE_KEYS.USERS, []);
    const exists = users.some(u => u.email.toLowerCase() === userData.email.toLowerCase().trim());

    if (exists) {
      throw new Error('An account with this email already exists.');
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      role: userData.role || 'Inventory Manager',
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      joined: new Date().toISOString().split('T')[0]
    };

    users.push(newUser);
    DataStore.set(STORAGE_KEYS.USERS, users);
    this.setCurrentUser(newUser);
    return newUser;
  },

  logout() {
    this.currentUser = null;
    DataStore.set(STORAGE_KEYS.CURRENT_USER, null);
    this.renderSession();
    App.showToast('You have been logged out successfully.', 'info');
    this.showAuthModal('login');
  },

  setCurrentUser(user) {
    this.currentUser = user;
    DataStore.set(STORAGE_KEYS.CURRENT_USER, user);
    this.renderSession();
    this.closeAuthModal();
    App.showToast(`Welcome back, ${user.name}!`, 'success');
    if (typeof App !== 'undefined' && App.onAuthChanged) {
      App.onAuthChanged(user);
    }
  },

  // OTP Password Reset Flow
  requestPasswordResetOtp(email) {
    const users = DataStore.get(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      throw new Error('No user account found with this email address.');
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpSession = {
      email: user.email,
      code: otpCode,
      expiry: Date.now() + 5 * 60 * 1000 // 5 minutes
    };

    return {
      email: user.email,
      code: otpCode
    };
  },

  verifyOtpAndSetPassword(enteredOtp, newPassword) {
    if (!this.otpSession.code) {
      throw new Error('No active OTP session. Please request a new OTP.');
    }

    if (Date.now() > this.otpSession.expiry) {
      throw new Error('OTP has expired. Please request a new code.');
    }

    if (this.otpSession.code !== enteredOtp.trim()) {
      throw new Error('Invalid 6-digit OTP code. Please check and try again.');
    }

    // Update user password in storage
    const users = DataStore.get(STORAGE_KEYS.USERS, []);
    const userIndex = users.findIndex(u => u.email.toLowerCase() === this.otpSession.email.toLowerCase());

    if (userIndex === -1) {
      throw new Error('User not found.');
    }

    users[userIndex].password = newPassword;
    DataStore.set(STORAGE_KEYS.USERS, users);

    // Clear OTP session
    const resetEmail = this.otpSession.email;
    this.otpSession = { email: null, code: null, expiry: null };

    return resetEmail;
  },

  // UI Event Bindings
  bindEvents() {
    // Topbar Profile signout
    const btnSignout = document.getElementById('btn-signout');
    if (btnSignout) {
      btnSignout.addEventListener('click', () => this.logout());
    }

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        try {
          this.login(email, pass);
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // Register Form Submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPass = document.getElementById('reg-confirm-password').value;
        const role = document.getElementById('reg-role').value;

        if (password !== confirmPass) {
          App.showToast('Passwords do not match.', 'error');
          return;
        }

        if (password.length < 6) {
          App.showToast('Password should be at least 6 characters.', 'error');
          return;
        }

        try {
          this.register({ name, email, password, role });
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // OTP Request Step Submit
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        try {
          const res = this.requestPasswordResetOtp(email);
          this.showOtpVerifyStep(res.email, res.code);
          App.showToast(`OTP generated: ${res.code}`, 'info');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // OTP Verify Step Submit
    const otpVerifyForm = document.getElementById('otp-verify-form');
    if (otpVerifyForm) {
      otpVerifyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const digits = Array.from(document.querySelectorAll('.otp-digit')).map(input => input.value).join('');
        const newPassword = document.getElementById('otp-new-password').value;
        const confirmPassword = document.getElementById('otp-confirm-password').value;

        if (digits.length !== 6) {
          App.showToast('Please enter all 6 digits of the OTP.', 'error');
          return;
        }

        if (newPassword.length < 6) {
          App.showToast('New password must be at least 6 characters.', 'error');
          return;
        }

        if (newPassword !== confirmPassword) {
          App.showToast('Passwords do not match.', 'error');
          return;
        }

        try {
          this.verifyOtpAndSetPassword(digits, newPassword);
          App.showToast('Password reset successfully! Please sign in.', 'success');
          this.showAuthForm('login');
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }

    // Auto-advance OTP input digits
    const otpDigits = document.querySelectorAll('.otp-digit');
    otpDigits.forEach((digit, index) => {
      digit.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < otpDigits.length - 1) {
          otpDigits[index + 1].focus();
        }
      });
      digit.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          otpDigits[index - 1].focus();
        }
      });
    });

    // Quick Login Demo Buttons
    document.querySelectorAll('[data-quick-login]').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-quick-login');
        try {
          this.quickLogin(email);
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });
  },

  showOtpVerifyStep(email, code) {
    this.showAuthForm('otp-verify');
    const alertBox = document.getElementById('otp-simulated-box');
    if (alertBox) {
      alertBox.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        <div>
          <span>Simulated OTP Sent to <strong>${email}</strong></span>:
          <span class="otp-code-highlight">${code}</span>
        </div>
      `;
    }
    // Clear and focus first digit
    document.querySelectorAll('.otp-digit').forEach(d => d.value = '');
    const firstDigit = document.querySelector('.otp-digit');
    if (firstDigit) firstDigit.focus();
  },

  showAuthForm(formId) {
    document.querySelectorAll('.auth-form-card').forEach(card => card.classList.remove('active'));
    const target = document.getElementById(`auth-form-${formId}`);
    if (target) target.classList.add('active');
  },

  showAuthModal(initialTab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.showAuthForm(initialTab);
    }
  },

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  renderSession() {
    const userNameEl = document.getElementById('user-display-name');
    const userRoleEl = document.getElementById('user-display-role');
    const userAvatarEl = document.getElementById('user-display-avatar');
    const authModal = document.getElementById('auth-modal');

    if (this.currentUser) {
      if (userNameEl) userNameEl.textContent = this.currentUser.name;
      if (userRoleEl) userRoleEl.textContent = this.currentUser.role;
      if (userAvatarEl) userAvatarEl.src = this.currentUser.avatar;
      if (authModal) authModal.style.display = 'none';
    } else {
      if (userNameEl) userNameEl.textContent = 'Guest User';
      if (userRoleEl) userRoleEl.textContent = 'Not Signed In';
      if (authModal) authModal.style.display = 'flex';
    }
  }
};
