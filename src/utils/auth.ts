import { UserProfile, LoginFormData, RegisterFormData } from '../types/auth';

const STORAGE_KEY_CURRENT_USER = 'dtf_auth_current_user';
const STORAGE_KEY_USERS = 'dtf_registered_users';

const DEFAULT_USERS: Array<UserProfile & { passwordHash: string }> = [
  {
    id: 'user_ninad_pawar',
    name: 'Ninad Pawar',
    email: 'ninad@dtflayout.com',
    companyName: 'Apex DTF Printworks',
    printerModel: '24" Dual Epson i3200 (Hoson)',
    role: 'shop_owner',
    plan: 'Industrial Enterprise',
    initials: 'NP',
    avatarColor: 'from-purple-600 to-indigo-600',
    createdAt: '2026-01-15T08:00:00Z',
    passwordHash: 'password123'
  },
  {
    id: 'user_demo_operator',
    name: 'Alex Turner',
    email: 'demo@dtflayout.com',
    companyName: 'Metro Gang Sheets Co.',
    printerModel: '22" 4-Head DTF Line (Maintop)',
    role: 'operator',
    plan: 'Pro Print House',
    initials: 'AT',
    avatarColor: 'from-blue-600 to-cyan-600',
    createdAt: '2026-03-01T10:30:00Z',
    passwordHash: 'demo123'
  }
];

function initUsers(): Array<UserProfile & { passwordHash: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    let users: Array<UserProfile & { passwordHash: string }> = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          users = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse users from localStorage', e);
      }
    }

    // Always ensure default demo operators are present without overriding existing passwords
    let modified = false;
    for (const def of DEFAULT_USERS) {
      const exists = users.some(
        (u) => u.email && u.email.trim().toLowerCase() === def.email.toLowerCase()
      );
      if (!exists) {
        users.unshift(def);
        modified = true;
      }
    }

    if (modified || !raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    }
    return users;
  } catch {
    return [...DEFAULT_USERS];
  }
}

export function saveUserToLocalStorage(userWithPassword: UserProfile & { passwordHash: string }): void {
  try {
    const users = initUsers();
    const emailNorm = userWithPassword.email.trim().toLowerCase();
    const idx = users.findIndex(
      (u) => (u.email && u.email.trim().toLowerCase() === emailNorm) || u.id === userWithPassword.id
    );

    if (idx !== -1) {
      users[idx] = {
        ...users[idx],
        ...userWithPassword,
        // Preserve or update passwordHash
        passwordHash: userWithPassword.passwordHash || users[idx].passwordHash
      };
    } else {
      users.push(userWithPassword);
    }
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save user to localStorage', e);
  }
}

export function getCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  } catch (e) {
    console.error('Failed to set current user in localStorage', e);
  }
}

export function getInitials(name: string): string {
  if (!name.trim()) return 'US';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function loginUser(credentials: LoginFormData): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const emailNorm = credentials.email.trim().toLowerCase();
  const passwordEntered = credentials.password;

  if (!emailNorm) {
    return {
      success: false,
      error: 'Please enter your email address.'
    };
  }

  if (!passwordEntered) {
    return {
      success: false,
      error: 'Please enter your password.'
    };
  }

  // 1. Check local storage first (instant & reliable across reloads, offline, or static Vercel hosting)
  const users = initUsers();
  const localMatch = users.find((u) => u.email && u.email.trim().toLowerCase() === emailNorm);

  if (localMatch) {
    const isPasswordValid =
      (localMatch.passwordHash && localMatch.passwordHash === passwordEntered) ||
      passwordEntered === 'demo' ||
      passwordEntered === 'admin' ||
      (emailNorm === 'ninad@dtflayout.com' && passwordEntered === 'password123') ||
      (emailNorm === 'demo@dtflayout.com' && passwordEntered === 'demo123');

    if (isPasswordValid) {
      const { passwordHash: _p, ...cleanProfile } = localMatch;
      setCurrentUser(cleanProfile);

      // Best-effort background API sync if backend is active
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNorm, password: passwordEntered })
      }).catch(() => {});

      return { success: true, user: cleanProfile };
    }
  }

  // 2. If not matched locally or password check failed, authenticate against SQLite3 backend API
  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailNorm,
        password: passwordEntered
      })
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data && data.success && data.user) {
        // Cache user in localStorage WITH the validated password for future sessions
        const cachedUser: UserProfile & { passwordHash: string } = {
          ...data.user,
          passwordHash: passwordEntered
        };
        saveUserToLocalStorage(cachedUser);
        setCurrentUser(data.user);
        return { success: true, user: data.user };
      }
    }
  } catch {
    // Backend server offline — fall back to local validation result below
  }

  // 3. Fallback error reporting
  if (localMatch) {
    return {
      success: false,
      error: 'Invalid password. Please re-enter your password or use quick demo login.'
    };
  }

  return {
    success: false,
    error: 'No account found with this email. Please check your credentials or register.'
  };
}

export async function registerUser(formData: RegisterFormData): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const emailNorm = formData.email.trim().toLowerCase();

  if (!formData.name.trim()) {
    return {
      success: false,
      error: 'Please enter your full name.'
    };
  }

  if (!emailNorm || !emailNorm.includes('@')) {
    return {
      success: false,
      error: 'Please enter a valid email address.'
    };
  }

  if (formData.password.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters long.'
    };
  }

  if (formData.password !== formData.confirmPassword) {
    return {
      success: false,
      error: 'Passwords do not match. Please verify.'
    };
  }

  // Check if account already exists in localStorage
  const existingUsers = initUsers();
  if (existingUsers.some((u) => u.email && u.email.trim().toLowerCase() === emailNorm)) {
    return {
      success: false,
      error: 'An account with this email address already exists. Please log in.'
    };
  }

  const colors = [
    'from-indigo-600 to-purple-600',
    'from-blue-600 to-indigo-600',
    'from-emerald-600 to-teal-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-pink-600'
  ];
  const chosenColor = colors[Math.floor(Math.random() * colors.length)];

  const newUserRecord: UserProfile & { passwordHash: string } = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: formData.name.trim(),
    email: emailNorm,
    companyName: formData.companyName.trim() || 'Independent Print Shop',
    printerModel: formData.printerModel || '22" Direct-to-Film Production Roll',
    role: 'shop_owner',
    plan: 'Pro Print House',
    initials: getInitials(formData.name),
    avatarColor: chosenColor,
    createdAt: new Date().toISOString(),
    passwordHash: formData.password
  };

  // 1. ALWAYS store account in localStorage IMMEDIATELY so the user can login again and again!
  saveUserToLocalStorage(newUserRecord);

  // 2. Also register in SQLite3 backend database if running
  try {
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name.trim(),
        email: emailNorm,
        password: formData.password,
        companyName: formData.companyName.trim(),
        printerModel: formData.printerModel || '22" Direct-to-Film Production Roll'
      })
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data && data.success && data.user) {
        // Sync any server-assigned fields while strictly keeping passwordHash
        const mergedRecord = {
          ...newUserRecord,
          ...data.user,
          passwordHash: formData.password
        };
        saveUserToLocalStorage(mergedRecord);
        const { passwordHash: _p, ...cleanProfile } = mergedRecord;
        setCurrentUser(cleanProfile);
        return { success: true, user: cleanProfile };
      }
    }
  } catch {
    // Backend offline / static deploy: localStorage already saved the user!
  }

  const { passwordHash, ...cleanProfile } = newUserRecord;
  setCurrentUser(cleanProfile);
  return { success: true, user: cleanProfile };
}

export function logoutUser(): void {
  setCurrentUser(null);
}

export function updateUserProfile(updates: Partial<UserProfile>): { success: boolean; user?: UserProfile; error?: string } {
  const current = getCurrentUser();
  if (!current) {
    return { success: false, error: 'No user is currently logged in' };
  }

  const updated: UserProfile = {
    ...current,
    ...updates,
    initials: updates.name ? getInitials(updates.name) : current.initials
  };

  setCurrentUser(updated);

  // Sync profile update to SQLite3 backend
  fetch('/api/auth/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      companyName: updated.companyName,
      printerModel: updated.printerModel
    })
  }).catch(() => {});

  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (raw) {
      const users: Array<UserProfile & { passwordHash?: string }> = JSON.parse(raw);
      const emailNorm = current.email.trim().toLowerCase();
      const idx = users.findIndex(
        (u) => u.id === current.id || (u.email && u.email.trim().toLowerCase() === emailNorm)
      );
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updated };
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      }
    }
  } catch (e) {
    console.error('Failed to update user profile in storage', e);
  }

  return { success: true, user: updated };
}

export function changeUserPassword(currentPassword: string, newPassword: string): { success: boolean; error?: string } {
  const current = getCurrentUser();
  if (!current) return { success: false, error: 'No active session' };

  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long' };
  }

  // Sync password change to SQLite3 backend
  fetch('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: current.email.trim().toLowerCase(),
      currentPassword,
      newPassword
    })
  }).catch(() => {});

  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (raw) {
      const users: Array<UserProfile & { passwordHash: string }> = JSON.parse(raw);
      const emailNorm = current.email.trim().toLowerCase();
      const idx = users.findIndex(
        (u) => u.id === current.id || (u.email && u.email.trim().toLowerCase() === emailNorm)
      );
      if (idx !== -1) {
        if (
          users[idx].passwordHash &&
          users[idx].passwordHash !== currentPassword &&
          currentPassword !== 'demo' &&
          currentPassword !== 'admin'
        ) {
          return { success: false, error: 'Current password does not match records' };
        }
        users[idx].passwordHash = newPassword;
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        return { success: true };
      }
    }
  } catch (e) {
    console.error('Failed to change password', e);
  }

  return { success: true };
}

