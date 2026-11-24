const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;

const BLOCKED_FILES = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/.env',
  '/.env.example',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.txt']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const rateBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function checkRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      ok: false,
      error: 'Too many submissions in a short period. Please wait a few minutes and try again.',
    });
  }

  bucket.count += 1;
  return next();
}

function sanitizeCheckoutUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function stripNewlines(value) {
  return String(value || '').replace(/[\r\n\0]+/g, ' ').trim();
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'attachment'));
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'attachment';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || 'smtp.mail.me.com').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || 'b.p.bennett@icloud.com').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const to = (process.env.CONTACT_TO_EMAIL || 'novascholarsacademy@icloud.com').trim();

  if (!pass) {
    return null;
  }

  return { host, port, user, pass, to };
}

function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port === 587,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
}

function formatMailError(err, defaultMsg) {
  if (err && (err.code === 'EAUTH' || err.responseCode === 535)) {
    return 'Mail server rejected the login (535). Verify that SMTP_USER is the primary Apple/Google account email used to create SMTP_PASS (not an email alias) and that SMTP_PASS is a valid App-Specific Password.';
  }
  return defaultMsg;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error('Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, TXT.');
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  if (BLOCKED_FILES.has(req.path)) {
    return res.status(404).send('Not Found');
  }
  next();
});

app.get('/api/public-config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    singleSessionCheckoutUrl: sanitizeCheckoutUrl(process.env.STRIPE_SINGLE_SESSION_URL),
    monthlyPlanCheckoutUrl: sanitizeCheckoutUrl(process.env.STRIPE_MONTHLY_PLAN_URL),
    emailDeliveryConfigured: Boolean(getSmtpConfig()),
  });
});

app.post('/api/contact', checkRateLimit, async (req, res) => {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return res.status(503).json({
      ok: false,
      code: 'SMTP_NOT_CONFIGURED',
      error: 'Direct email delivery is not configured on the server yet.',
    });
  }

  const name = stripNewlines(req.body.name).slice(0, 120);
  const email = stripNewlines(req.body.email);
  const service = stripNewlines(req.body.service || 'General Question').slice(0, 120);
  const message = String(req.body.message || '').trim().slice(0, 5000);

  if (name.length < 2) {
    return res.status(400).json({ ok: false, error: 'Please enter your full name.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (message.length < 10) {
    return res.status(400).json({ ok: false, error: 'Please enter a message of at least 10 characters.' });
  }

  try {
    const transporter = createTransporter(smtp);
    await transporter.sendMail({
      from: `"NovaScholars Website" <${smtp.user}>`,
      to: smtp.to,
      replyTo: `"${name}" <${email}>`,
      subject: `NovaScholars Contact Inquiry: ${service} (${name})`,
      text: [
        'New Contact Form Inquiry',
        '========================',
        `Name: ${name}`,
        `Email: ${email}`,
        `Interested In: ${service}`,
        '',
        'Message:',
        message,
      ].join('\n'),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Contact Email Error]', err.message);
    return res.status(502).json({
      ok: false,
      error: formatMailError(err, 'Unable to send email through the mail server right now.'),
    });
  }
});

app.post('/api/request-materials', checkRateLimit, upload.array('attachment', MAX_FILES), async (req, res) => {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return res.status(503).json({
      ok: false,
      code: 'SMTP_NOT_CONFIGURED',
      error: 'Direct email delivery with attachments requires SMTP configuration on the server.',
    });
  }

  const service = stripNewlines(req.body.service);
  const tier = stripNewlines(req.body.tier);
  const name = stripNewlines(req.body.name).slice(0, 120);
  const email = stripNewlines(req.body.email);
  const subject = stripNewlines(req.body.subject).slice(0, 150);
  const gradeLevel = stripNewlines(req.body.grade_level || 'Not specified').slice(0, 80);
  const targetDate = stripNewlines(req.body.target_date || 'Flexible').slice(0, 40);
  const materialLink = stripNewlines(req.body.material_link || '').slice(0, 1000);
  const details = String(req.body.details || '').trim().slice(0, 5000);
  const files = Array.isArray(req.files) ? req.files : [];

  const SERVICE_LABELS = {
    notes: {
      label: 'Notes Refinement',
      prices: { standard: '$20 / set', pro: '$40 / set' },
    },
    'study-guide': {
      label: 'Study Guides & Exam Preparation',
      prices: { standard: '$25', pro: '$60' },
    },
  };

  if (!SERVICE_LABELS[service] || (tier !== 'standard' && tier !== 'pro')) {
    return res.status(400).json({ ok: false, error: 'Please select a valid service and tier.' });
  }
  if (name.length < 2) {
    return res.status(400).json({ ok: false, error: 'Please enter your full name.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (subject.length < 2) {
    return res.status(400).json({ ok: false, error: 'Please enter the course or subject.' });
  }
  if (materialLink && !isValidHttpUrl(materialLink)) {
    return res.status(400).json({ ok: false, error: 'Please provide a valid http:// or https:// link.' });
  }
  if (service === 'notes' && !materialLink && files.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'For Notes Refinement, please share a link or attach at least one file.',
    });
  }
  if (details.length < 10) {
    return res.status(400).json({
      ok: false,
      error: 'Please describe your topics and goals (at least 10 characters).',
    });
  }

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return res.status(400).json({
      ok: false,
      error: 'Total attachment size exceeds the 25 MB limit per email.',
    });
  }

  const svcInfo = SERVICE_LABELS[service];
  const tierName = tier === 'pro' ? 'Pro Tier' : 'Standard Tier';
  const price = svcInfo.prices[tier];

  try {
    const transporter = createTransporter(smtp);
    await transporter.sendMail({
      from: `"NovaScholars Website" <${smtp.user}>`,
      to: smtp.to,
      replyTo: `"${name}" <${email}>`,
      subject: `Material Request: ${svcInfo.label} — ${tierName} (${price}) — ${subject}`,
      text: [
        'New Study Material Request',
        '==========================',
        `Service: ${svcInfo.label} — ${tierName} (${price})`,
        `Student / Parent Name: ${name}`,
        `Email: ${email}`,
        `Course / Subject: ${subject}`,
        `Grade Level: ${gradeLevel}`,
        `Target / Exam Date: ${targetDate}`,
        `Shared Material Link: ${materialLink || 'None provided'}`,
        `Attached Files: ${files.length ? files.map((f) => sanitizeFilename(f.originalname)).join(', ') : 'None'}`,
        '',
        'Topics, Chapters & Specific Goals:',
        details,
      ].join('\n'),
      attachments: files.map((f) => ({
        filename: sanitizeFilename(f.originalname),
        content: f.buffer,
        contentType: f.mimetype,
      })),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Material Request Email Error]', err.message);
    return res.status(502).json({
      ok: false,
      error: formatMailError(err, 'Unable to send email with attachments through the mail server right now.'),
    });
  }
});

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, error: 'Each uploaded file must be 10 MB or smaller.' });
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ ok: false, error: 'You can attach up to 5 files per request.' });
  }
  if (err && err.status === 400) {
    return res.status(400).json({ ok: false, error: err.message });
  }
  return next(err);
});

app.use(
  express.static(ROOT_DIR, {
    dotfiles: 'ignore',
    extensions: ['html'],
  })
);

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`NovaScholars Academy server listening on http://${HOST}:${PORT}`);
});
