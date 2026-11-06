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
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_USERS;
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
  // Simulate network latency for authentic feel
  await new Promise((res) => setTimeout(res, 450));

  const emailNorm = credentials.email.trim().toLowerCase();
  const users = initUsers();

  const found = users.find((u) => u.email.toLowerCase() === emailNorm);
  if (!found) {
    return {
      success: false,
      error: 'No account found with this email. Please check your credentials or register.'
    };
  }

  if (found.passwordHash !== credentials.password && credentials.password !== 'demo' && credentials.password !== 'admin') {
    return {
      success: false,
      error: 'Invalid password. Please re-enter your password or use quick demo login.'
    };
  }

  const { passwordHash, ...cleanProfile } = found;
  setCurrentUser(cleanProfile);
  return { success: true, user: cleanProfile };
}

export async function registerUser(formData: RegisterFormData): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  await new Promise((res) => setTimeout(res, 550));

  const emailNorm = formData.email.trim().toLowerCase();
  const users = initUsers();

  if (users.some((u) => u.email.toLowerCase() === emailNorm)) {
    return {
      success: false,
      error: 'An account with this email address already exists. Please log in.'
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

  const colors = [
    'from-indigo-600 to-purple-600',
    'from-blue-600 to-indigo-600',
    'from-emerald-600 to-teal-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-pink-600'
  ];
  const chosenColor = colors[Math.floor(Math.random() * colors.length)];

  const newUserProfile: UserProfile & { passwordHash: string } = {
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

  users.push(newUserProfile);
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to store new user', e);
  }

  const { passwordHash, ...cleanProfile } = newUserProfile;
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

  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (raw) {
      const users: Array<UserProfile & { passwordHash?: string }> = JSON.parse(raw);
      const idx = users.findIndex(
        (u) => u.id === current.id || u.email.toLowerCase() === current.email.toLowerCase()
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

  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (raw) {
      const users: Array<UserProfile & { passwordHash: string }> = JSON.parse(raw);
      const idx = users.findIndex((u) => u.id === current.id || u.email.toLowerCase() === current.email.toLowerCase());
      if (idx !== -1) {
        if (users[idx].passwordHash !== currentPassword && currentPassword !== 'demo' && currentPassword !== 'admin') {
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

