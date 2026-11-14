import { getUserByEmail, updateUser, formatUserResponse } from '../_db.ts';

export default async function handler(req: any, res: any) {
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

    if (!email) {
      return res.status(200).json({ success: false, error: 'Email address is required.' });
    }

    const updates: any = {};
    if (body.name) updates.name = body.name.trim();
    if (body.companyName) updates.company_name = body.companyName.trim();
    if (body.printerModel) updates.printer_model = body.printerModel.trim();

    const updated = await updateUser(email, updates);
    if (!updated) {
      return res.status(200).json({ success: false, error: 'User account not found.' });
    }

    return res.status(200).json({
      success: true,
      user: formatUserResponse(updated)
    });
  } catch (error: any) {
    console.error('Profile update handler error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error updating profile.'
    });
  }
}
