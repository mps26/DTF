import { getUserByEmail, updateUser, hashPassword, verifyPassword } from '../_db.js';

export default async function handler(req, res) {
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
    const email = (body.email || '').trim().toLowerCase();
    const currentPassword = body.currentPassword || '';
    const newPassword = body.newPassword || '';

    if (!email) {
      return res.status(200).json({ success: false, error: 'Email address is required.' });
    }
    if (newPassword.length < 6) {
      return res.status(200).json({ success: false, error: 'New password must be at least 6 characters long.' });
    }

    const existing = await getUserByEmail(email);
    if (!existing) {
      return res.status(200).json({ success: false, error: 'User not found.' });
    }

    if (!verifyPassword(currentPassword, existing.password_hash)) {
      return res.status(200).json({ success: false, error: 'Current password does not match records.' });
    }

    const newHash = hashPassword(newPassword);
    await updateUser(email, { password_hash: newHash });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Password change handler error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error changing password.'
    });
  }
}

