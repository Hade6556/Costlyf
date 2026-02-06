require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const supabaseAuth = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

// JSON body for API
app.use(express.json());
app.use(cookieParser());

// --- i18n: locales and detection (priority: cookie → Accept-Language → en) ---
const LOCALES = ['en', 'lt', 'lv', 'pl', 'es', 'de'];
const LOCALE_COOKIE = 'NEXT_LOCALE';
const DEFAULT_LOCALE = 'en';

function detectLocale(req) {
  const cookie = req.cookies && req.cookies[LOCALE_COOKIE];
  if (cookie && LOCALES.includes(cookie)) return cookie;
  const accept = req.headers['accept-language'];
  if (accept) {
    const parts = accept.split(',').map(function (p) {
      const s = p.trim().split(';')[0];
      const lang = (s && s.split('-')[0]) ? s.split('-')[0].toLowerCase() : '';
      const q = p.indexOf('q=') >= 0 ? parseFloat(p.split('q=')[1]) : 1;
      return { lang: lang, q: q };
    });
    parts.sort(function (a, b) { return b.q - a.q; });
    for (let i = 0; i < parts.length; i++) {
      if (LOCALES.includes(parts[i].lang)) return parts[i].lang;
    }
  }
  return DEFAULT_LOCALE;
}

function setLocaleCookie(res, locale) {
  res.cookie(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false, sameSite: 'lax' });
}

// Vercel serves static files from public/ only; when public/ exists (after build), use it for HTML and static paths.
const publicDir = path.join(__dirname, 'public');
const usePublic = fs.existsSync(publicDir);
const staticRoot = usePublic ? publicDir : __dirname;
const dashboardSegment = usePublic ? 'dashboard-app' : 'dashboard-build';

// Serve message files
app.get('/messages/:locale.json', function (req, res) {
  const locale = req.params.locale;
  if (!LOCALES.includes(locale)) return res.status(404).json({ error: 'Unknown locale' });
  const file = path.join(staticRoot, 'messages', locale + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Messages not found' });
  res.type('json').sendFile(file);
});

// Redirect root and locale-less app paths to /:locale/ or /:locale/path (preserve query)
const REDIRECT_PATHS = ['', 'home', 'join', 'share', 'wallet', 'offer', 'profile', 'subscription', 'help', 'guides', 'terms', 'privacy', 'legal', 'charter', 'inbox', 'login', 'signup'];
REDIRECT_PATHS.forEach(function (segment) {
  const pathExpr = segment === '' ? '/' : '/' + segment;
  app.get(pathExpr, function (req, res) {
    const locale = detectLocale(req);
    setLocaleCookie(res, locale);
    const target = segment === '' ? '/' + locale + '/' : '/' + locale + '/' + segment + '/';
    const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, target.replace(/\/+$/, '') + q);
  });
  if (segment !== '') app.get(pathExpr + '/', function (req, res) {
    const locale = detectLocale(req);
    setLocaleCookie(res, locale);
    const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, '/' + locale + '/' + segment + q);
  });
});
app.get('/guides/:slug', function (req, res) {
  const locale = detectLocale(req);
  setLocaleCookie(res, locale);
  res.redirect(302, '/' + locale + '/guides/' + encodeURIComponent(req.params.slug) + (req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : ''));
});
app.get('/join/:service', function (req, res) {
  const locale = detectLocale(req);
  setLocaleCookie(res, locale);
  res.redirect(302, '/' + locale + '/join/' + encodeURIComponent(req.params.service) + (req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : ''));
});

// Locale-prefixed routes: serve same HTML (client reads locale from pathname)
const localeRegex = '(' + LOCALES.join('|') + ')';
app.get(new RegExp('^/' + localeRegex + '/?$'), function (req, res) {
  res.sendFile(path.join(staticRoot, 'index.html'));
});
// React dashboard SPA or legacy app (locale-prefixed). Fallback to app/*.html when dashboard-app is missing (e.g. Vercel build without dashboard).
const dashboardIndexPath = path.join(staticRoot, dashboardSegment, 'index.html');
const hasDashboardApp = fs.existsSync(dashboardIndexPath);
const dashboardPathToLegacy = { home: 'home.html', join: 'join.html', share: 'share.html', wallet: 'wallet.html', offer: 'offer.html', profile: 'profile.html', subscription: 'subscription.html', help: 'help.html', inbox: 'inbox.html', login: 'login.html', signup: 'signup.html', charter: 'charter.html' };
const dashboardPaths = ['home', 'join', 'share', 'wallet', 'offer', 'profile', 'subscription', 'help', 'inbox', 'login', 'signup', 'charter'];
dashboardPaths.forEach(function (segment) {
  app.get(new RegExp('^/' + localeRegex + '/' + segment + '/?$'), function (req, res) {
    if (hasDashboardApp) return res.sendFile(dashboardIndexPath);
    const legacyFile = dashboardPathToLegacy[segment];
    if (legacyFile) return res.sendFile(path.join(staticRoot, 'app', legacyFile));
    res.sendFile(dashboardIndexPath);
  });
});
app.get(new RegExp('^/' + localeRegex + '/join/([^/]+)/?$'), function (req, res) {
  if (hasDashboardApp) return res.sendFile(dashboardIndexPath);
  res.sendFile(path.join(staticRoot, 'app', 'service.html'));
});
app.get(new RegExp('^/' + localeRegex + '/guides/?$'), function (req, res) {
  res.sendFile(path.join(staticRoot, 'app', 'guides.html'));
});
app.get(new RegExp('^/' + localeRegex + '/guides/([^/]+)/?$'), function (req, res) {
  res.sendFile(path.join(staticRoot, 'app', 'guide.html'));
});
app.get(new RegExp('^/' + localeRegex + '/terms/?$'), function (req, res) {
  res.sendFile(path.join(staticRoot, 'app', 'terms.html'));
});
app.get(new RegExp('^/' + localeRegex + '/privacy/?$'), function (req, res) {
  res.sendFile(path.join(staticRoot, 'app', 'privacy.html'));
});
app.get(new RegExp('^/' + localeRegex + '/legal/?$'), function (req, res) {
  res.sendFile(path.join(staticRoot, 'app', 'legal.html'));
});

// React dashboard SPA static assets (built bundle at /dashboard-app/assets/*). Local dev only; Vercel serves public/.
const dashboardBuildDir = path.join(staticRoot, dashboardSegment);
if (fs.existsSync(dashboardBuildDir)) {
  app.use('/dashboard-app', express.static(dashboardBuildDir));
}

// Serve main site (styles.css, media/, etc.). Local dev only; on Vercel static files are served from public/ by the platform.
app.use(express.static(staticRoot));

// Dashboard app assets (CSS, JS for legacy and shared)
app.use('/app', express.static(path.join(staticRoot, 'app')));

// Avatar uploads (profile pictures). On Vercel /var/task is read-only; use /tmp (writable but ephemeral).
let uploadsBase = process.env.VERCEL ? path.join('/tmp', 'costlyf-uploads') : path.join(__dirname, 'uploads');
let uploadsDir = path.join(uploadsBase, 'avatars');
try {
  if (!fs.existsSync(uploadsBase)) fs.mkdirSync(uploadsBase, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.warn('Uploads dir not created (e.g. read-only fs), falling back to /tmp:', e.message);
  uploadsBase = path.join('/tmp', 'costlyf-uploads');
  uploadsDir = path.join(uploadsBase, 'avatars');
  try {
    if (!fs.existsSync(uploadsBase)) fs.mkdirSync(uploadsBase, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e2) {
    console.warn('Fallback /tmp uploads dir also failed:', e2.message);
  }
}
const avatarStorage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, uploadsDir); },
  filename: function (_req, file, cb) {
    const ext = (file.mimetype === 'image/png') ? 'png' : (file.mimetype === 'image/gif') ? 'gif' : 'jpg';
    cb(null, 'avatar-' + Date.now() + '.' + ext);
  }
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: function (_req, file, cb) {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') return cb(null, true);
  cb(new Error('Only JPEG, PNG and GIF allowed'));
} }).single('avatar');
app.use('/uploads', express.static(uploadsBase));

// App: Home (wallet + 3 buttons only)
app.get('/home', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'home.html'));
});

// App: Join (search, filters, subscription cards)
app.get('/join', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'join.html'));
});

// Service marketplace (e.g. /join/netflix)
app.get('/join/:service', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'service.html'));
});

// App: Share (placeholder)
app.get('/share', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'share.html'));
});

// Wallet (My wallet screen)
app.get('/wallet', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'wallet.html'));
});

// My offer detail (e.g. /offer or /offer#0)
app.get('/offer', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'offer.html'));
});

// Profile (account settings, personal info)
app.get('/profile', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'profile.html'));
});

// Subscription detail (first-time or returning view by hash index)
app.get('/subscription', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'subscription.html'));
});

// Help (FAQ, contact owner, contact support)
app.get('/help', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'help.html'));
});

// Guides (sharing guides by service)
app.get('/guides', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'guides.html'));
});
app.get('/guides/:slug', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'guide.html'));
});

// Terms & Conditions
app.get('/terms', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'privacy.html'));
});

app.get('/legal', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'legal.html'));
});

// Charter (read and accept required before going public with share offer)
app.get('/charter', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'charter.html'));
});

// Inbox (list of contacts, chat on tap)
app.get('/inbox', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'inbox.html'));
});

// Redirect old dashboard URL to locale-prefixed home
app.get('/dashboard', (req, res) => {
  const locale = detectLocale(req);
  res.redirect(301, '/' + locale + '/home');
});

// --- Helper: get current user from Bearer token (returns null if none) ---
async function getCurrentUser(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseAdmin) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return (error || !user) ? null : user;
}

// Compute period end for a 30-day subscription from slot (or removal date).
function slotPeriodEnd(slot) {
  if (slot && slot.removal_effective_at) return slot.removal_effective_at;
  const start = (slot && (slot.accepted_at || slot.reserved_at)) || new Date().toISOString();
  const d = new Date(start);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}
function daysLeftUntil(periodEndIso) {
  if (!periodEndIso) return 0;
  const end = new Date(periodEndIso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

// --- Offers API (Supabase) ---

// List public offers for a service (no auth). Only shows offers with at least one available slot (hidden when all seats are taken or reserved).
app.get('/api/offers', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' });
  const service = (req.query.service && String(req.query.service).trim()) || null;
  const minSeats = Math.max(1, parseInt(req.query.minSeats, 10) || 1);
  if (!service) return res.status(400).json({ error: 'Query parameter service is required' });
  try {
    const { data: offers, error: offersErr } = await supabaseAdmin
      .from('offers')
      .select('id, owner_id, service, service_name, plan, price, max_slots, visibility, instant, verified, trust_score, created_at')
      .eq('service', service)
      .eq('visibility', 'public');
    if (offersErr) return res.status(500).json({ error: offersErr.message });
    if (!offers || offers.length === 0) return res.status(200).json([]);
    const ownerIds = [...new Set(offers.map(o => o.owner_id))];
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, alias, first_name, last_name, avatar_url, trust_score')
      .in('id', ownerIds);
    if (profilesErr) { /* non-fatal */ }
    const profileByOwner = {};
    (profiles || []).forEach(p => { profileByOwner[String(p.id).toLowerCase()] = p; });
    const offerIds = offers.map(o => o.id);
    const { data: slots, error: slotsErr } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id, slot_index, status')
      .in('offer_id', offerIds);
    if (slotsErr) return res.status(500).json({ error: slotsErr.message });
    const slotsByOffer = {};
    (slots || []).forEach(s => {
      if (!slotsByOffer[s.offer_id]) slotsByOffer[s.offer_id] = [];
      slotsByOffer[s.offer_id].push(s);
    });
    const takenByOffer = {};
    offers.forEach(o => {
      const list = slotsByOffer[o.id] || [];
      const taken = list.filter(s => s.status === 'taken').length;
      const available = list.filter(s => s.status === 'available').length;
      const reserved = list.filter(s => s.status === 'reserved').length;
      takenByOffer[o.id] = { taken, available, reserved, total: list.length };
    });
    const out = offers
      .filter(o => {
        const t = takenByOffer[o.id];
        if (!t || t.total !== o.max_slots) return false;
        const available = t.available || 0;
        if (available === 0) return false;
        const seatsLeft = t.available + t.reserved;
        return seatsLeft >= minSeats;
      })
      .map(o => {
        const t = takenByOffer[o.id];
        const taken = t ? t.taken : 0;
        const contribution = Number(o.price) != null ? Number(Number(o.price).toFixed(2)) : 0;
        const profile = profileByOwner[String(o.owner_id).toLowerCase()] || {};
        const ownerName = [profile.alias, [profile.first_name, profile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'Host';
        const ownerTrust = profile.trust_score != null ? Math.min(10, Math.max(0, parseInt(profile.trust_score, 10))) : 0;
        const { trust_score: _offerTrust, ...offerRest } = o;
        return {
          ...offerRest,
          seats_taken: t ? t.taken : 0,
          seats_left: t ? t.available + t.reserved : o.max_slots,
          contribution_per_month: contribution,
          owner_avatar_url: profile.avatar_url || null,
          owner_alias: profile.alias || null,
          owner_name: ownerName,
          trust_score: ownerTrust
        };
      });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List offers failed' });
  }
});

// List offers I've joined (auth required) – offers where the user has a slot (reserved or taken)
app.get('/api/offers/joined', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let { data: mySlots, error: slotsErr } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id, slot_index, status, reserved_at, accepted_at, removal_effective_at')
      .eq('user_id', user.id)
      .in('status', ['reserved', 'taken']);
    if (slotsErr) return res.status(500).json({ error: slotsErr.message });
    if (!mySlots || mySlots.length === 0) return res.status(200).json([]);
    const offerIds = [...new Set(mySlots.map(s => s.offer_id))];
    const nowIso = new Date().toISOString();
    const { data: toClear } = await supabaseAdmin.from('offer_slots').select('offer_id, slot_index').in('offer_id', offerIds).not('removal_effective_at', 'is', null).lte('removal_effective_at', nowIso);
    if (toClear && toClear.length > 0) {
      for (const row of toClear) {
        await supabaseAdmin.from('subscriptions').update({ status: 'ended', updated_at: nowIso }).eq('offer_id', row.offer_id).eq('slot_index', row.slot_index);
      }
      await supabaseAdmin.from('offer_slots').update({ status: 'available', user_id: null, reserved_at: null, removal_requested_at: null, removal_effective_at: null }).in('offer_id', offerIds).not('removal_effective_at', 'is', null).lte('removal_effective_at', nowIso);
    }
    const { data: mySlotsAfter } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id, slot_index, status, reserved_at, accepted_at, removal_effective_at')
      .eq('user_id', user.id)
      .in('status', ['reserved', 'taken']);
    mySlots = mySlotsAfter && mySlotsAfter.length > 0 ? mySlotsAfter : [];
    if (mySlots.length === 0) return res.status(200).json([]);
    const offerIdsAfter = [...new Set(mySlots.map(s => s.offer_id))];
    const { data: offers, error: offersErr } = await supabaseAdmin
      .from('offers')
      .select('id, owner_id, service, service_name, plan, price, max_slots, created_at')
      .in('id', offerIdsAfter);
    if (offersErr) return res.status(500).json({ error: offersErr.message });
    if (!offers || offers.length === 0) return res.status(200).json([]);
    const { data: allSlots } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id, status')
      .in('offer_id', offerIdsAfter);
    const takenByOffer = {};
    (allSlots || []).forEach(s => {
      if (!takenByOffer[s.offer_id]) takenByOffer[s.offer_id] = { taken: 0 };
      if (s.status === 'taken') takenByOffer[s.offer_id].taken++;
    });
    const mySlotByOffer = {};
    mySlots.forEach(s => { mySlotByOffer[s.offer_id] = s; });
    const joinedOnly = offers.filter(o => o.owner_id !== user.id);
    const out = joinedOnly.map(o => {
      const taken = (takenByOffer[o.id] && takenByOffer[o.id].taken) || 0;
      const contribution = Number(o.price) != null ? Number(Number(o.price).toFixed(2)) : 0;
      const mySlot = mySlotByOffer[o.id];
      const period_end = mySlot ? slotPeriodEnd(mySlot) : null;
      const days_left = period_end ? daysLeftUntil(period_end) : 0;
      return {
        id: o.id,
        service: o.service,
        service_name: o.service_name,
        plan: o.plan,
        price: o.price,
        max_slots: o.max_slots,
        created_at: o.created_at,
        contribution_per_month: contribution,
        my_slot_index: mySlot ? mySlot.slot_index : null,
        my_slot_status: mySlot ? mySlot.status : null,
        period_end: period_end || null,
        days_left
      };
    });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List joined failed' });
  }
});

// List my offers (auth required)
app.get('/api/offers/mine', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: offers, error: offersErr } = await supabaseAdmin
      .from('offers')
      .select('id, owner_id, service, service_name, plan, price, max_slots, visibility, instant, verified, trust_score, created_at, updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });
    if (offersErr) return res.status(500).json({ error: offersErr.message });
    if (!offers || offers.length === 0) return res.status(200).json([]);
    const offerIds = offers.map(o => o.id);
    const { data: slots, error: slotsErr } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id, slot_index, status, user_id, reserved_at, removal_requested_at, removal_effective_at')
      .in('offer_id', offerIds);
    if (slotsErr) return res.status(500).json({ error: slotsErr.message });
    const slotsByOffer = {};
    (slots || []).forEach(s => {
      if (!slotsByOffer[s.offer_id]) slotsByOffer[s.offer_id] = [];
      slotsByOffer[s.offer_id].push(s);
    });
    const withMeta = offers.map(o => {
      const list = slotsByOffer[o.id] || [];
      const taken = list.filter(s => s.status === 'taken').length;
      const contribution = Number(o.price) != null ? Number(Number(o.price).toFixed(2)) : 0;
      return {
        ...o,
        slots: list.sort((a, b) => a.slot_index - b.slot_index),
        seats_taken: taken,
        seats_left: o.max_slots - taken - list.filter(s => s.status === 'reserved').length,
        contribution_per_month: contribution
      };
    });
    return res.status(200).json(withMeta);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List my offers failed' });
  }
});

// Get one offer by id with slots (auth optional; public readable by anyone; private with token or owner/slot user)
app.get('/api/offers/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Database not configured' });
  const id = req.params.id;
  const shareToken = (req.query && req.query.token) ? String(req.query.token).trim() : null;
  if (!id) return res.status(400).json({ error: 'Offer id required' });
  const user = await getCurrentUser(req);
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('id', id)
      .single();
    if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.visibility === 'private') {
      const isOwner = user && user.id === offer.owner_id;
      const hasValidToken = shareToken && offer.share_token && offer.share_token === shareToken;
      if (!isOwner && !hasValidToken) {
        if (!user) return res.status(404).json({ error: 'Offer not found' });
        const { data: slotUser } = await supabaseAdmin.from('offer_slots').select('id').eq('offer_id', id).eq('user_id', user.id).limit(1).single();
        if (!slotUser) return res.status(404).json({ error: 'Offer not found' });
      }
    }
    const { data: ownerProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, alias, first_name, last_name, avatar_url, trust_score')
      .eq('id', offer.owner_id)
      .single();
    const profile = !profileErr && ownerProfile ? ownerProfile : {};
    const ownerName = [profile.alias, [profile.first_name, profile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'Host';
    const ownerTrust = profile.trust_score != null ? Math.min(10, Math.max(0, parseInt(profile.trust_score, 10))) : 0;

    const nowIso = new Date().toISOString();
    const { data: toClear } = await supabaseAdmin.from('offer_slots').select('offer_id, slot_index').eq('offer_id', id).not('removal_effective_at', 'is', null).lte('removal_effective_at', nowIso);
    if (toClear && toClear.length > 0) {
      for (const row of toClear) {
        await supabaseAdmin.from('subscriptions').update({ status: 'ended', updated_at: nowIso }).eq('offer_id', row.offer_id).eq('slot_index', row.slot_index);
      }
      await supabaseAdmin.from('offer_slots').update({ status: 'available', user_id: null, reserved_at: null, removal_requested_at: null, removal_effective_at: null }).eq('offer_id', id).not('removal_effective_at', 'is', null).lte('removal_effective_at', nowIso);
    }

    const { data: slots, error: slotsErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, offer_id, slot_index, status, user_id, reserved_at, accepted_at, removal_requested_at, removal_effective_at')
      .eq('offer_id', id)
      .order('slot_index', { ascending: true });
    if (slotsErr) return res.status(500).json({ error: slotsErr.message });
    let list = slots || [];
    const slotUserIds = [...new Set(list.map(s => s.user_id).filter(Boolean))];
    let slotProfiles = {};
    if (slotUserIds.length > 0) {
      const { data: slotProfs } = await supabaseAdmin.from('profiles').select('id, alias, first_name, last_name, avatar_url').in('id', slotUserIds);
      (slotProfs || []).forEach(p => {
        slotProfiles[p.id] = p;
      });
    }
    list = list.map(s => {
      const out = { ...s, period_end: slotPeriodEnd(s), days_left: daysLeftUntil(slotPeriodEnd(s)) };
      if (s.user_id && slotProfiles[s.user_id]) {
        const p = slotProfiles[s.user_id];
        out.slot_user_name = [p.alias, [p.first_name, p.last_name].filter(Boolean).join(' ')].find(Boolean) || 'User';
        out.slot_user_avatar_url = p.avatar_url || null;
      }
      return out;
    });
    const taken = list.filter(s => s.status === 'taken').length;
    const contribution = Number(offer.price) != null ? Number(Number(offer.price).toFixed(2)) : 0;
    const isOwner = user && user.id === offer.owner_id;
    const out = {
      ...offer,
      slots: list,
      seats_taken: taken,
      contribution_per_month: contribution,
      owner_avatar_url: profile.avatar_url || null,
      owner_alias: profile.alias || null,
      owner_name: ownerName,
      trust_score: ownerTrust
    };
    if (!isOwner && out.share_token) delete out.share_token;
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Get offer failed' });
  }
});

// Create offer (auth required). Public visibility only if charter accepted. One offer per service per user.
app.post('/api/offers', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const { service, service_name, plan, price, max_slots, visibility, instant, verified } = req.body || {};
  if (!service || !service_name || price == null) return res.status(400).json({ error: 'service, service_name and price are required' });
  const serviceSlug = String(service).trim();
  const maxSlots = Math.max(1, parseInt(max_slots, 10) || 1);
  const vis = (visibility === 'public') ? 'public' : 'private';
  if (vis === 'public') {
    const { data: profile } = await supabaseAdmin.from('profiles').select('charter_accepted_at').eq('id', user.id).single();
    if (!profile?.charter_accepted_at) return res.status(400).json({ error: 'Charter must be read and signed before making an offer public' });
  }
  try {
    const { data: existingOffer } = await supabaseAdmin
      .from('offers')
      .select('id')
      .eq('owner_id', user.id)
      .eq('service', serviceSlug)
      .limit(1)
      .maybeSingle();
    if (existingOffer) {
      return res.status(409).json({ error: 'You already have an offer for this service. Edit or stop the existing one first.' });
    }
    const crypto = require('crypto');
    const row = {
      owner_id: user.id,
      service: serviceSlug,
      service_name: String(service_name).trim(),
      plan: (plan && String(plan).trim()) || 'premium',
      price: Number(price),
      max_slots: maxSlots,
      visibility: vis,
      instant: Boolean(instant),
      verified: Boolean(verified),
      trust_score: 0,
      share_token: crypto.randomUUID(),
      updated_at: new Date().toISOString()
    };
    const { data: created, error: insertErr } = await supabaseAdmin.from('offers').insert(row).select().single();
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    const slotRows = [];
    for (let i = 1; i <= maxSlots; i++) slotRows.push({ offer_id: created.id, slot_index: i, status: 'available' });
    const { error: slotsErr } = await supabaseAdmin.from('offer_slots').insert(slotRows);
    if (slotsErr) return res.status(500).json({ error: slotsErr.message });
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Create offer failed' });
  }
});

// Update offer (owner only)
app.patch('/api/offers/:id', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  const { service, service_name, plan, price, max_slots, visibility, instant, verified } = req.body || {};
  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin.from('offers').select('id, owner_id, max_slots').eq('id', id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Offer not found' });
    if (existing.owner_id !== user.id) return res.status(403).json({ error: 'Not the offer owner' });
    if (visibility === 'public') {
      const { data: profile } = await supabaseAdmin.from('profiles').select('charter_accepted_at').eq('id', user.id).single();
      if (!profile?.charter_accepted_at) return res.status(400).json({ error: 'Charter must be read and signed before making an offer public' });
    }
    const updates = { updated_at: new Date().toISOString() };
    if (service !== undefined) updates.service = String(service).trim();
    if (service_name !== undefined) updates.service_name = String(service_name).trim();
    if (plan !== undefined) updates.plan = String(plan).trim();
    if (price !== undefined) updates.price = Number(price);
    if (max_slots !== undefined) updates.max_slots = Math.max(1, parseInt(max_slots, 10) || 1);
    if (visibility !== undefined) updates.visibility = (visibility === 'public') ? 'public' : 'private';
    if (instant !== undefined) updates.instant = Boolean(instant);
    if (verified !== undefined) updates.verified = Boolean(verified);
    const { data: updated, error: updateErr } = await supabaseAdmin.from('offers').update(updates).eq('id', id).select().single();
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.status(200).json(updated);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update offer failed' });
  }
});

// Helper: get or create chat thread for (offerId, ownerId, otherUserId), then post system message (for join request).
async function getOrCreateThreadAndNotifyJoinRequest(supabase, offerId, ownerId, subscriberId, systemMessageText) {
  const user1 = ownerId < subscriberId ? ownerId : subscriberId;
  const user2 = ownerId < subscriberId ? subscriberId : ownerId;
  let { data: thread, error: findErr } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('offer_id', offerId)
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!thread) {
    const { data: created, error: insertErr } = await supabase
      .from('chat_threads')
      .insert({ offer_id: offerId, user1_id: user1, user2_id: user2, updated_at: new Date().toISOString() })
      .select('id')
      .single();
    if (insertErr) throw new Error(insertErr.message);
    thread = created;
  }
  const { error: msgErr } = await supabase
    .from('chat_messages')
    .insert({ thread_id: thread.id, sender_id: null, content: systemMessageText, is_system: true });
  if (msgErr) throw new Error(msgErr.message);
  await supabase.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
  return thread.id;
}

const JOIN_REQUEST_SYSTEM_MESSAGE = 'The owner should choose whether to accept or to decline the join request. If the owner accepts, he/she should provide the login credentials and wait for the subscriber\'s confirmation that he/she received and everything is working. Those confirmations and buttons are in this chat: the owner sees Accept / Decline, the subscriber sees Confirm or Support.';

// Helper: find or create chat thread for (offerId, ownerId, subscriberId), then post a system message.
async function postSystemMessageToThread(supabase, offerId, ownerId, subscriberId, content) {
  const user1 = ownerId < subscriberId ? ownerId : subscriberId;
  const user2 = ownerId < subscriberId ? subscriberId : ownerId;
  let { data: thread, error: findErr } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('offer_id', offerId)
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .maybeSingle();
  if (findErr) return;
  if (!thread) {
    const { data: created, error: insertErr } = await supabase
      .from('chat_threads')
      .insert({ offer_id: offerId, user1_id: user1, user2_id: user2, updated_at: new Date().toISOString() })
      .select('id')
      .single();
    if (insertErr || !created) return;
    thread = created;
  }
  await supabase
    .from('chat_messages')
    .insert({ thread_id: thread.id, sender_id: null, content, is_system: true });
  await supabase.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
}

// Reserve a slot (auth required). Slot must be available. Creates chat thread and system message to notify owner.
app.post('/api/offers/:id/slots/:slotIndex/reserve', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id').eq('id', offerId).single();
    if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, offer_id, status, user_id')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'available') return res.status(400).json({ error: 'Slot is not available' });
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ status: 'reserved', user_id: user.id, reserved_at: new Date().toISOString() })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    try {
      await getOrCreateThreadAndNotifyJoinRequest(supabaseAdmin, offerId, offer.owner_id, user.id, JOIN_REQUEST_SYSTEM_MESSAGE);
    } catch (e) {
      // non-fatal: slot is reserved even if chat notify fails
    }
    return res.status(200).json({ message: 'Slot reserved' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Reserve failed' });
  }
});

// Owner accepts a reserved slot (reserved -> taken). Creates subscription record.
app.post('/api/offers/:id/slots/:slotIndex/accept', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id, plan, price').eq('id', offerId).single();
    if (offerErr || !offer || offer.owner_id !== user.id) return res.status(403).json({ error: 'Not the offer owner' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'reserved') return res.status(400).json({ error: 'Slot is not reserved' });
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ status: 'taken', accepted_at: now })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    const contribution = Number(offer.price) || 0;
    await supabaseAdmin.from('subscriptions').upsert({
      user_id: slot.user_id,
      offer_id: offerId,
      slot_index: slotIndex,
      period_start: now,
      period_end: periodEnd.toISOString(),
      plan: offer.plan || 'premium',
      contribution_price: contribution,
      status: 'active',
      updated_at: now
    }, { onConflict: 'offer_id,slot_index' });
    return res.status(200).json({ message: 'Join request accepted' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Accept failed' });
  }
});

// Owner declines a reserved slot (slot becomes available again).
app.post('/api/offers/:id/slots/:slotIndex/decline', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id, service, service_name').eq('id', offerId).single();
    if (offerErr || !offer || offer.owner_id !== user.id) return res.status(403).json({ error: 'Not the offer owner' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'reserved') return res.status(400).json({ error: 'Slot is not reserved' });
    const declinedUserId = slot.user_id;
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ status: 'available', user_id: null, reserved_at: null, removal_requested_at: null, removal_effective_at: null })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    if (declinedUserId) {
      const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('alias, first_name, last_name').eq('id', offer.owner_id).single();
      const ownerName = ownerProfile ? [ownerProfile.alias, [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'The owner' : 'The owner';
      const systemContent = `${ownerName} has declined your seat. We're sorry — head to the Join page to find more listings that might be a better fit.`;
      await supabaseAdmin.from('user_system_messages').insert({ user_id: declinedUserId, content: systemContent });
      const u1 = offer.owner_id < declinedUserId ? offer.owner_id : declinedUserId;
      const u2 = offer.owner_id < declinedUserId ? declinedUserId : offer.owner_id;
      const { data: thread } = await supabaseAdmin.from('chat_threads').select('id').eq('offer_id', offerId).eq('user1_id', u1).eq('user2_id', u2).maybeSingle();
      if (thread) await supabaseAdmin.from('chat_threads').delete().eq('id', thread.id);
    }
    return res.status(200).json({ message: 'Join request declined' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Decline failed' });
  }
});

// Unreserve a slot (auth required). Caller must be the one who reserved it.
app.delete('/api/offers/:id/slots/:slotIndex/reserve', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'reserved' || slot.user_id !== user.id) return res.status(403).json({ error: 'Not your reserved slot' });
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ status: 'available', user_id: null, reserved_at: null, removal_requested_at: null, removal_effective_at: null })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.status(200).json({ message: 'Reservation removed' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unreserve failed' });
  }
});

// Request removal from a slot (co-subscriber). Sets 3-day notice.
app.post('/api/offers/:id/slots/:slotIndex/request-removal', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if ((slot.status !== 'reserved' && slot.status !== 'taken') || slot.user_id !== user.id) return res.status(403).json({ error: 'Not your slot' });
    const effective = new Date();
    effective.setDate(effective.getDate() + 3);
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ removal_requested_at: new Date().toISOString(), removal_effective_at: effective.toISOString() })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    await supabaseAdmin.from('subscriptions').update({ period_end: effective.toISOString(), status: 'canceling', updated_at: new Date().toISOString() }).eq('offer_id', offerId).eq('slot_index', slotIndex);
    return res.status(200).json({ message: 'Removal requested', removal_effective_at: effective.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Request removal failed' });
  }
});

// Cancel subscription (co-subscriber): removal at end of 30-day period from subscription start; no refund.
app.post('/api/offers/:id/slots/:slotIndex/cancel-subscription', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id, reserved_at')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if ((slot.status !== 'reserved' && slot.status !== 'taken') || slot.user_id !== user.id) return res.status(403).json({ error: 'Not your slot' });
    const periodStart = slot.reserved_at ? new Date(slot.reserved_at) : new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 30);
    const now = new Date();
    if (periodEnd <= now) periodEnd.setTime(now.getTime() + 1);
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ removal_requested_at: new Date().toISOString(), removal_effective_at: periodEnd.toISOString() })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    await supabaseAdmin.from('subscriptions').update({ period_end: periodEnd.toISOString(), status: 'canceling', updated_at: new Date().toISOString() }).eq('offer_id', offerId).eq('slot_index', slotIndex);
    return res.status(200).json({ message: 'Subscription cancelled at period end', removal_effective_at: periodEnd.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Cancel subscription failed' });
  }
});

// Owner schedules removal of a co-subscriber at end of 30-day period.
app.post('/api/offers/:id/slots/:slotIndex/schedule-removal', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id, service, service_name').eq('id', offerId).single();
    if (offerErr || !offer || offer.owner_id !== user.id) return res.status(offerErr ? 404 : 403).json({ error: offerErr ? 'Offer not found' : 'Not the offer owner' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id, reserved_at')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'taken' || !slot.user_id) return res.status(400).json({ error: 'Slot has no active subscriber' });
    const periodStart = slot.reserved_at ? new Date(slot.reserved_at) : new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 30);
    const now = new Date();
    if (periodEnd <= now) periodEnd.setTime(now.getTime() + 1);
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ removal_requested_at: new Date().toISOString(), removal_effective_at: periodEnd.toISOString() })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    await supabaseAdmin.from('subscriptions').update({ period_end: periodEnd.toISOString(), status: 'canceling', updated_at: new Date().toISOString() }).eq('offer_id', offerId).eq('slot_index', slotIndex);
    const subscriberId = slot.user_id;
    if (subscriberId) {
      const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('alias, first_name, last_name').eq('id', offer.owner_id).single();
      const ownerName = ownerProfile ? [ownerProfile.alias, [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'The owner' : 'The owner';
      const serviceLabel = [offer.service_name || offer.service].filter(Boolean).join(' ') || 'this share';
      const daysLeft = Math.max(0, Math.ceil((periodEnd - now) / (24 * 60 * 60 * 1000)));
      const periodEndStr = periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const systemContent = `${ownerName} has cancelled your place on ${serviceLabel} for the next billing period. You still have access until ${periodEndStr}. Enjoy the remaining ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;
      await postSystemMessageToThread(supabaseAdmin, offerId, offer.owner_id, subscriberId, systemContent);
    }
    return res.status(200).json({ message: 'Removal scheduled at period end', removal_effective_at: periodEnd.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Schedule removal failed' });
  }
});

// Owner accepts removal (immediate) or system can remove after removal_effective_at
app.patch('/api/offers/:id/slots/:slotIndex/removal', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id, service, service_name').eq('id', offerId).single();
    if (offerErr || !offer || offer.owner_id !== user.id) return res.status(offerErr ? 404 : 403).json({ error: offerErr ? 'Offer not found' : 'Not the offer owner' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status, user_id')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status === 'available') return res.status(200).json({ message: 'Slot already free' });
    const removedUserId = slot.user_id;
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ status: 'available', user_id: null, reserved_at: null, removal_requested_at: null, removal_effective_at: null })
      .eq('id', slot.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    await supabaseAdmin.from('subscriptions').update({ status: 'ended', updated_at: new Date().toISOString() }).eq('offer_id', offerId).eq('slot_index', slotIndex);
    if (removedUserId) {
      const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('alias, first_name, last_name').eq('id', offer.owner_id).single();
      const ownerName = ownerProfile ? [ownerProfile.alias, [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'The owner' : 'The owner';
      const serviceLabel = [offer.service_name || offer.service].filter(Boolean).join(' ') || 'this share';
      const systemContent = `${ownerName} has removed you from ${serviceLabel}. You no longer have access to this share.`;
      await postSystemMessageToThread(supabaseAdmin, offerId, offer.owner_id, removedUserId, systemContent);
    }
    return res.status(200).json({ message: 'Co-subscriber removed' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Removal failed' });
  }
});

// Delete offer (owner only). Cascades to slots. Notifies subscribers via system message.
app.delete('/api/offers/:id', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin.from('offers').select('id, owner_id, service, service_name, plan').eq('id', id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Offer not found' });
    if (existing.owner_id !== user.id) return res.status(403).json({ error: 'Not the offer owner' });
    const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('id, alias, first_name, last_name').eq('id', existing.owner_id).single();
    const ownerName = ownerProfile ? [ownerProfile.alias, [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'The owner' : 'The owner';
    const offerLabel = [existing.service_name || existing.service, existing.plan].filter(Boolean).join(' ') || 'this offer';
    const { data: slots } = await supabaseAdmin.from('offer_slots').select('user_id').eq('offer_id', id).not('user_id', 'is', null);
    const subscriberIds = [...new Set((slots || []).map(s => s.user_id).filter(Boolean))];
    const { error: deleteErr } = await supabaseAdmin.from('offers').delete().eq('id', id);
    if (deleteErr) return res.status(500).json({ error: deleteErr.message });
    const systemContent = `We're sorry — ${ownerName} has stopped sharing ${offerLabel}. The money will be refunded to your balance shortly.`;
    if (subscriberIds.length > 0) {
      const systemRows = subscriberIds.map(uid => ({ user_id: uid, content: systemContent }));
      await supabaseAdmin.from('user_system_messages').insert(systemRows);
    }
    return res.status(200).json({ message: 'Offer deleted' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Delete failed' });
  }
});

// --- Chat API (Supabase) ---
async function getOfferForChat(supabase, offerId) {
  if (!offerId) return null;
  const { data } = await supabase.from('offers').select('service, service_name, plan').eq('id', offerId).single();
  return data;
}

// List chat threads for current user (other user + offer info + unread_count)
app.get('/api/chat/threads', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: threads, error: threadsErr } = await supabaseAdmin
      .from('chat_threads')
      .select('id, offer_id, user1_id, user2_id, created_at, updated_at')
      .or('user1_id.eq.' + user.id + ',user2_id.eq.' + user.id)
      .order('updated_at', { ascending: false });
    if (threadsErr) return res.status(500).json({ error: threadsErr.message });
    if (!threads || threads.length === 0) return res.status(200).json([]);
    const threadIds = threads.map(t => t.id);
    const { data: unreadRows } = await supabaseAdmin
      .from('chat_messages')
      .select('thread_id, sender_id')
      .in('thread_id', threadIds)
      .is('read_at', null);
    const unreadByThread = {};
    (unreadRows || []).forEach(r => {
      if (r.sender_id === user.id) return;
      if (!unreadByThread[r.thread_id]) unreadByThread[r.thread_id] = 0;
      unreadByThread[r.thread_id]++;
    });
    const offerIds = [...new Set(threads.map(t => t.offer_id))];
    const { data: offers } = await supabaseAdmin.from('offers').select('id, service, service_name, plan').in('id', offerIds);
    const offerById = {};
    (offers || []).forEach(o => { offerById[o.id] = o; });
    const otherIds = threads.map(t => t.user1_id === user.id ? t.user2_id : t.user1_id);
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, alias, first_name, last_name, avatar_url').in('id', otherIds);
    const profileById = {};
    (profiles || []).forEach(p => { profileById[p.id] = p; });
    const out = threads.map(t => {
      const otherId = t.user1_id === user.id ? t.user2_id : t.user1_id;
      const profile = profileById[otherId] || {};
      const name = [profile.alias, [profile.first_name, profile.last_name].filter(Boolean).join(' ')].find(Boolean) || 'User';
      const offer = offerById[t.offer_id] || {};
      const subLabel = [offer.service_name || offer.service, offer.plan].filter(Boolean).join(' ') || 'Subscription';
      const unread = unreadByThread[t.id] || 0;
      return {
        id: t.id,
        offer_id: t.offer_id,
        other_user_id: otherId,
        other_name: name,
        other_avatar_url: profile.avatar_url || null,
        subscription_label: subLabel,
        created_at: t.created_at,
        updated_at: t.updated_at,
        unread_count: unread
      };
    });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List threads failed' });
  }
});

// Total unread count for navbar badge (thread messages + system messages)
app.get('/api/chat/unread-count', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(200).json({ count: 0 });
  try {
    let count = 0;
    const { data: threads } = await supabaseAdmin
      .from('chat_threads')
      .select('id')
      .or('user1_id.eq.' + user.id + ',user2_id.eq.' + user.id);
    if (threads && threads.length > 0) {
      const threadIds = threads.map(t => t.id);
      const { data: rows } = await supabaseAdmin
        .from('chat_messages')
        .select('sender_id')
        .in('thread_id', threadIds)
        .is('read_at', null);
      count += (rows || []).filter(r => r.sender_id !== user.id).length;
    }
    const { count: systemUnread } = await supabaseAdmin.from('user_system_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null);
    count += (systemUnread != null ? systemUnread : 0);
    return res.status(200).json({ count });
  } catch (e) {
    return res.status(200).json({ count: 0 });
  }
});

// System messages (read-only for user; e.g. offer stopped, refund notice)
app.get('/api/chat/system-messages', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const markRead = req.query.mark_read === '1' || req.query.mark_read === 'true';
  try {
    const { data: messages, error: listErr } = await supabaseAdmin
      .from('user_system_messages')
      .select('id, content, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (listErr) return res.status(500).json({ error: listErr.message });
    const list = messages || [];
    const unreadCount = list.filter(m => !m.read_at).length;
    if (markRead && unreadCount > 0) {
      await supabaseAdmin.from('user_system_messages').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
    }
    const out = list.map(m => ({ id: m.id, content: m.content, created_at: m.created_at, is_system: true, sender_id: null }));
    return res.status(200).json({ messages: out, unread_count: markRead ? 0 : unreadCount });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load system messages' });
  }
});

// Get or create a thread for (offer_id, other_user_id). Other user must be owner or a slot user of the offer.
app.post('/api/chat/threads', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const { offer_id, other_user_id } = req.body || {};
  if (!offer_id || !other_user_id) return res.status(400).json({ error: 'offer_id and other_user_id required' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id').eq('id', offer_id).single();
    if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
    const isOwner = offer.owner_id === user.id;
    const isOtherOwner = offer.owner_id === other_user_id;
    if (other_user_id !== offer.owner_id) {
      const { data: slot } = await supabaseAdmin.from('offer_slots').select('id').eq('offer_id', offer_id).eq('user_id', other_user_id).limit(1).single();
      if (!slot) return res.status(403).json({ error: 'Cannot start chat: user is not part of this offer' });
    }
    if (user.id === other_user_id) return res.status(400).json({ error: 'other_user_id must be different from current user' });
    const user1 = user.id < other_user_id ? user.id : other_user_id;
    const user2 = user.id < other_user_id ? other_user_id : user.id;
    const { data: existing, error: findErr } = await supabaseAdmin
      .from('chat_threads')
      .select('id, offer_id, user1_id, user2_id, created_at, updated_at')
      .eq('offer_id', offer_id)
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .maybeSingle();
    if (findErr) return res.status(500).json({ error: findErr.message });
    if (existing) {
      const otherId = existing.user1_id === user.id ? existing.user2_id : existing.user1_id;
      const { data: profile } = await supabaseAdmin.from('profiles').select('id, alias, first_name, last_name, avatar_url').eq('id', otherId).single();
      const name = [profile?.alias, [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')].find(Boolean) || 'User';
      const o = await getOfferForChat(supabaseAdmin, existing.offer_id);
      return res.status(200).json({
        id: existing.id,
        offer_id: existing.offer_id,
        other_user_id: otherId,
        other_name: name,
        other_avatar_url: profile?.avatar_url || null,
        subscription_label: o ? [o.service_name || o.service, o.plan].filter(Boolean).join(' ') : 'Subscription',
        created_at: existing.created_at,
        updated_at: existing.updated_at
      });
    }
    const { data: created, error: insertErr } = await supabaseAdmin
      .from('chat_threads')
      .insert({ offer_id, user1_id: user1, user2_id: user2, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    const { data: profile } = await supabaseAdmin.from('profiles').select('id, alias, first_name, last_name, avatar_url').eq('id', other_user_id).single();
    const name = [profile?.alias, [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')].find(Boolean) || 'User';
    const o = await getOfferForChat(supabaseAdmin, offer_id);
    return res.status(201).json({
      id: created.id,
      offer_id: created.offer_id,
      other_user_id: other_user_id,
      other_name: name,
      other_avatar_url: profile?.avatar_url || null,
      subscription_label: o ? [o.service_name || o.service, o.plan].filter(Boolean).join(' ') : 'Subscription',
      created_at: created.created_at,
      updated_at: created.updated_at
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Get or create thread failed' });
  }
});

// Get messages for a thread (paginated; default limit 50). Marks messages sent to current user as read.
app.get('/api/chat/threads/:id/messages', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const threadId = req.params.id;
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const before = req.query.before || null;
  try {
    const { data: thread, error: threadErr } = await supabaseAdmin
      .from('chat_threads')
      .select('id, user1_id, user2_id')
      .eq('id', threadId)
      .single();
    if (threadErr || !thread) return res.status(404).json({ error: 'Thread not found' });
    if (thread.user1_id !== user.id && thread.user2_id !== user.id) return res.status(403).json({ error: 'Not a participant' });
    const readAt = new Date().toISOString();
    // Mark messages sent to me (by the other participant or system) as read
    await supabaseAdmin.from('chat_messages').update({ read_at: readAt }).eq('thread_id', threadId).is('read_at', null).neq('sender_id', user.id);
    await supabaseAdmin.from('chat_messages').update({ read_at: readAt }).eq('thread_id', threadId).is('read_at', null).is('sender_id', null);
    let q = supabaseAdmin.from('chat_messages').select('id, thread_id, sender_id, content, created_at, read_at, is_system').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(limit);
    if (before) q = q.lt('created_at', before);
    const { data: rows, error: msgErr } = await q;
    if (msgErr) return res.status(500).json({ error: msgErr.message });
    const messages = (rows || []).reverse();
    return res.status(200).json(messages);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List messages failed' });
  }
});

// Send a message in a thread
app.post('/api/chat/threads/:id/messages', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const threadId = req.params.id;
  const { content } = req.body || {};
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return res.status(400).json({ error: 'content required' });
  try {
    const { data: thread, error: threadErr } = await supabaseAdmin
      .from('chat_threads')
      .select('id, user1_id, user2_id')
      .eq('id', threadId)
      .single();
    if (threadErr || !thread) return res.status(404).json({ error: 'Thread not found' });
    if (thread.user1_id !== user.id && thread.user2_id !== user.id) return res.status(403).json({ error: 'Not a participant' });
    const { data: msg, error: insertErr } = await supabaseAdmin
      .from('chat_messages')
      .insert({ thread_id: threadId, sender_id: user.id, content: text, read_at: null })
      .select()
      .single();
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    await supabaseAdmin.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
    return res.status(201).json(msg);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Send message failed' });
  }
});

// --- Auth API (Supabase) ---

// Sign up: create auth user + profile (Phone, E-mail, DOB, Alias, First/Last name, password)
app.post('/api/auth/signup', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Auth not configured' });
  const { email, password, phone, first_name, last_name, alias, date_of_birth } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
      user_metadata: { first_name: first_name || '', last_name: last_name || '', alias: alias || '', phone: phone || '', date_of_birth: date_of_birth || null }
    });
    if (authError) return res.status(400).json({ error: authError.message });
    const userId = userData.user?.id;
    if (!userId) return res.status(500).json({ error: 'User not created' });
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: String(email).trim(),
      phone: (phone && String(phone).trim()) || null,
      date_of_birth: date_of_birth && String(date_of_birth).trim() ? String(date_of_birth).trim() : null,
      alias: (alias && String(alias).trim()) || null,
      first_name: (first_name && String(first_name).trim()) || null,
      last_name: (last_name && String(last_name).trim()) || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (profileError) return res.status(500).json({ error: profileError.message });
    const { data: sessionData, error: signInError } = await supabaseAuth.auth.signInWithPassword({ email: String(email).trim(), password: String(password) });
    if (signInError) return res.status(200).json({ user: userData.user, message: 'Account created. Please log in.' });
    return res.status(200).json({ access_token: sessionData.session?.access_token, refresh_token: sessionData.session?.refresh_token, user: sessionData.user });
  } catch (e) {
    const msg = e.message || 'Signup failed';
    const isNetwork = msg === 'fetch failed' || (e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'ECONNREFUSED'));
    return res.status(500).json({ error: isNetwork ? 'Cannot reach Supabase. Set SUPABASE_URL in .env to your project URL (Project Settings → API).' : msg });
  }
});

// Login: email + password
app.post('/api/auth/login', async (req, res) => {
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email: String(email).trim(), password: String(password) });
    if (error) return res.status(401).json({ error: error.message });
    return res.status(200).json({ access_token: data.session?.access_token, refresh_token: data.session?.refresh_token, user: data.user });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Login failed' });
  }
});

// Refresh session (get new access token from refresh token)
app.post('/api/auth/refresh', async (req, res) => {
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });
  const { refresh_token } = req.body || {};
  if (!refresh_token || typeof refresh_token !== 'string') return res.status(401).json({ error: 'Refresh token required' });
  try {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refresh_token.trim() });
    if (error) return res.status(401).json({ error: error.message });
    if (!data.session) return res.status(401).json({ error: 'No session' });
    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token || refresh_token
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Refresh failed' });
  }
});

// Get current user profile (Bearer token). Includes trust_stats for profile trust criteria.
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
    if (profileError && profileError.code !== 'PGRST116') return res.status(500).json({ error: profileError.message });

    let trust_stats = { first_subscription: false, subscription_12h: false, shared_30_days: false, invoices_count: 0 };
    const { data: myOffers } = await supabaseAdmin.from('offers').select('id').eq('owner_id', user.id);
    const offerIds = (myOffers || []).map(o => o.id);
    if (offerIds.length > 0) {
      const { data: takenSlots } = await supabaseAdmin
        .from('offer_slots')
        .select('reserved_at, accepted_at')
        .in('offer_id', offerIds)
        .eq('status', 'taken');
      const slots = takenSlots || [];
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      trust_stats.first_subscription = slots.length >= 1;
      trust_stats.subscription_12h = slots.some(s => {
        const requested = s.reserved_at ? new Date(s.reserved_at).getTime() : null;
        const accepted = s.accepted_at ? new Date(s.accepted_at).getTime() : requested;
        return requested != null && accepted != null && (accepted - requested) <= twelveHoursMs;
      });
      trust_stats.shared_30_days = slots.some(s => {
        const start = s.accepted_at || s.reserved_at;
        return start && (now - new Date(start).getTime()) >= thirtyDaysMs;
      });
    }

    const p = profile || {};
    const done = [
      !!(p.avatar_url && String(p.avatar_url).trim()),
      !!(p.phone && String(p.phone).trim()),
      true,
      !!(p.date_of_birth && String(p.date_of_birth).trim()),
      !!trust_stats.first_subscription,
      !!trust_stats.subscription_12h,
      !!trust_stats.shared_30_days,
      false,
      false,
      (trust_stats.invoices_count || 0) >= 1
    ];
    const computedScore = Math.min(10, done.filter(Boolean).length);
    const storedScore = p.trust_score != null ? Math.min(10, Math.max(0, parseInt(p.trust_score, 10))) : 0;
    if (computedScore !== storedScore) {
      await supabaseAdmin.from('profiles').update({ trust_score: computedScore, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (profile) profile.trust_score = computedScore;
    }

    return res.status(200).json({
      user: { id: user.id, email: user.email },
      profile: profile || null,
      trust_stats
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Request failed' });
  }
});

// Update profile (Bearer token). When charter is accepted for the first time, increment trust_score (cap 10).
app.patch('/api/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    const { phone, email, date_of_birth, alias, first_name, last_name, avatar_url: bodyAvatarUrl, charter_accepted_at: charterAcceptedAt } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (email !== undefined) updates.email = String(email).trim() || null;
    if (phone !== undefined) updates.phone = String(phone).trim() || null;
    if (date_of_birth !== undefined) updates.date_of_birth = (date_of_birth && String(date_of_birth).trim()) || null;
    if (alias !== undefined) updates.alias = String(alias).trim() || null;
    if (first_name !== undefined) updates.first_name = String(first_name).trim() || null;
    if (last_name !== undefined) updates.last_name = String(last_name).trim() || null;
    if (bodyAvatarUrl !== undefined) updates.avatar_url = bodyAvatarUrl ? String(bodyAvatarUrl).trim() : null;
    if (charterAcceptedAt !== undefined) updates.charter_accepted_at = charterAcceptedAt ? String(charterAcceptedAt).trim() : null;
    // When user accepts charter for the first time, bump trust_score (max 10)
    if (charterAcceptedAt && String(charterAcceptedAt).trim()) {
      const { data: current } = await supabaseAdmin.from('profiles').select('charter_accepted_at, trust_score').eq('id', user.id).single();
      if (current && !current.charter_accepted_at) {
        const next = Math.min(10, (current.trust_score != null ? parseInt(current.trust_score, 10) : 0) + 1);
        updates.trust_score = next;
      }
    }
    const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update failed' });
  }
});

// Upload profile picture (Bearer token). On Vercel use Supabase Storage (persistent); locally use /uploads.
const AVATAR_BUCKET = 'avatars';
app.post('/api/profile/avatar', (req, res) => {
  uploadAvatar(req, res, async function (err) {
    if (err) return res.status(400).json({ error: err.message || 'Invalid file' });
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token || !supabaseAdmin) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      if (!req.file || !req.file.filename) return res.status(400).json({ error: 'No image file' });
      let avatarUrl;
      if (process.env.VERCEL && req.file.path && fs.existsSync(req.file.path)) {
        const fileBuffer = fs.readFileSync(req.file.path);
        const ext = path.extname(req.file.filename) || '.jpg';
        const storagePath = user.id + '/avatar-' + Date.now() + ext;
        const { error: uploadErr } = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(storagePath, fileBuffer, {
          contentType: req.file.mimetype || 'image/jpeg',
          upsert: true
        });
        fs.unlinkSync(req.file.path);
        if (uploadErr) return res.status(500).json({ error: uploadErr.message || 'Storage upload failed' });
        const { data: urlData } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
        avatarUrl = urlData.publicUrl;
      } else {
        avatarUrl = '/uploads/avatars/' + req.file.filename;
      }
      await supabaseAdmin.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      return res.status(200).json({ avatar_url: avatarUrl });
    } catch (e) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: e.message || 'Upload failed' });
    }
  });
});

// Change password (Bearer token)
app.post('/api/auth/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const { new_password } = req.body || {};
  if (!new_password || String(new_password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: String(new_password) });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Password updated' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update failed' });
  }
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'login.html'));
});

// Sign up page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(staticRoot, 'app', 'signup.html'));
});

// Export for Vercel serverless (handles /home, /login, /terms, etc.). Local dev: run listen.
module.exports = app;
if (typeof process.env.VERCEL === 'undefined') {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Main site: http://localhost:${PORT}/`);
    console.log(`Home: http://localhost:${PORT}/home`);
    console.log(`Join: http://localhost:${PORT}/join`);
  });
}
