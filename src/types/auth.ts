export interface UserProfile {
  id: string;
  name: string;
  email: string;
  companyName: string;
  printerModel: string;
  role: 'operator' | 'admin' | 'shop_owner';
  plan: 'Starter' | 'Pro Print House' | 'Industrial Enterprise';
  initials: string;
  avatarColor: string;
  createdAt: string;
  phone?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterFormData {
  name: string;
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
  printerModel: string;
  termsAccepted: boolean;
}

