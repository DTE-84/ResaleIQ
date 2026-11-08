// Retire the unprotected legacy proxy; use the authenticated Edge Function.
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'This endpoint is no longer available.' });
}
