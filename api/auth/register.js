import crypto from 'crypto';
import { getUserByEmail, insertUser, hashPassword, getInitials, formatUserResponse } from '../_db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const companyName = (body.companyName || '').trim() || 'Independent Print Shop';
    const printerModel = (body.printerModel || '').trim() || '22" Direct-to-Film Production Roll';

    if (!name) {
      return res.status(200).json({ success: false, error: 'Full name is required.' });
    }
    if (!email) {
      return res.status(200).json({ success: false, error: 'Email address is required.' });
    }
    if (password.length < 6) {
      return res.status(200).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(200).json({
        success: false,
        error: 'An account with this email address already exists. Please log in.'
      });
    }

    const colorGradients = [
      'from-indigo-600 to-purple-600',
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-600',
      'from-amber-600 to-orange-600',
      'from-rose-600 to-pink-600'
    ];
    const avatarColor = colorGradients[Math.floor(Math.random() * colorGradients.length)];
    const userId = `user_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const initials = getInitials(name);
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    const newUser = {
      id: userId,
      name,
      email,
      company_name: companyName,
      printer_model: printerModel,
      role: 'shop_owner',
      plan: 'Pro Print House',
      initials,
      avatar_color: avatarColor,
      created_at: createdAt,
      password_hash: passwordHash
    };

    await insertUser(newUser);

    return res.status(200).json({
      success: true,
      user: formatUserResponse(newUser)
    });
  } catch (error) {
    console.error('Register handler error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing registration.'
    });
  }
}
