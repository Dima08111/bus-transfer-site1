// Публічна конфігурація для браузера. Містить ТІЛЬКИ Meta Pixel ID (він і так видимий у коді сторінки).
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ pixelId: (process.env.META_PIXEL_ID || "").replace(/\D/g, "") });
};
