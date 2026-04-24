const jwt = require('jsonwebtoken');

// Supabase signs JWTs with the JWT_SECRET from your project settings
// We verify using the Supabase JWT secret (set as SUPABASE_JWT_SECRET in Railway env)
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];

    // Decode without verifying first to get the user id
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify signature using Supabase JWT secret
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (secret) {
      jwt.verify(token, secret);
    }

    // Attach user info from Supabase token claims
    req.user = {
      _id: decoded.sub,  // Supabase user UUID
      name: decoded.user_metadata?.name || decoded.email || 'Anonymous',
      age: decoded.user_metadata?.age || null,
      gender: decoded.user_metadata?.gender || null,
      interests: decoded.user_metadata?.interests || []
    };

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
