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

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeCurrency = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

app.use(cookieParser());

// Stripe webhook needs raw body for signature verification (must be before express.json())
// Configure endpoint in Stripe Dashboard → Developers → Webhooks → Add endpoint → Events: payment_intent.succeeded
if (stripe && stripeWebhookSecret) {
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (e) {
      return res.status(400).send('Webhook signature verification failed');
    }
    if (event.type === 'payment_intent.succeeded' && event.data && event.data.object) {
      const pi = event.data.object;
      const purpose = (pi.metadata && pi.metadata.purpose) || '';
      const userId = (pi.metadata && pi.metadata.user_id) || '';
      if (purpose === 'top_up' && userId && pi.status === 'succeeded' && pi.amount_received > 0 && supabaseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.rpc('apply_balance_transaction', {
            p_user_id: userId,
            p_amount_cents: pi.amount_received,
            p_type: 'top_up',
            p_reference_type: 'stripe_payment_intent',
            p_reference_id: pi.id,
            p_metadata: null
          });
          if (error) {
            console.error('Stripe webhook apply_balance_transaction error:', error.message);
            return res.status(500).send('Balance update failed');
          }
          if (process.env.NODE_ENV !== 'production') console.log('Stripe top-up credited:', pi.id, 'user:', userId, 'cents:', pi.amount_received);
        } catch (e) {
          console.error('Stripe webhook apply_balance_transaction exception:', e);
          return res.status(500).send('Balance update failed');
        }
      }
    }
    res.sendStatus(200);
  });
}

// JSON body for API (after webhook so webhook gets raw body)
app.use(express.json());

// Vercel serves static files from public/ only; when public/ exists (after build), use it for HTML and static paths.
const publicDir = path.join(__dirname, 'public');
const publicDirCwd = path.join(process.cwd(), 'public');
const usePublic = fs.existsSync(publicDir) || fs.existsSync(publicDirCwd);
const staticRoot = fs.existsSync(publicDir) ? publicDir : (fs.existsSync(publicDirCwd) ? publicDirCwd : __dirname);
const dashboardSegment = usePublic ? 'dashboard-app' : 'dashboard-build';

// Serve English messages (dashboard i18n)
app.get('/messages/en.json', function (req, res) {
  const file = path.join(staticRoot, 'messages', 'en.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  res.type('json').sendFile(file);
});

const dashboardIndexPath = path.join(staticRoot, dashboardSegment, 'index.html');
const hasDashboardApp = fs.existsSync(dashboardIndexPath);
const dashboardPaths = ['home', 'join', 'share', 'wallet', 'offer', 'profile', 'subscription', 'help', 'inbox', 'login', 'signup', 'charter', 'forgot-password', 'reset-password', 'terms', 'privacy', 'legal', 'guides'];

function sendDashboard(req, res) {
  if (hasDashboardApp) {
    res.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.sendFile(dashboardIndexPath);
  }
  res.sendFile(dashboardIndexPath);
}

// Landing page
app.get('/', function (req, res) {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

// App routes: React dashboard SPA
dashboardPaths.forEach(function (segment) {
  app.get('/' + segment, sendDashboard);
  app.get('/' + segment + '/', function (req, res) {
    const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, '/' + segment + q);
  });
});
app.get('/join/:service', sendDashboard);
app.get('/profile/payment-method', sendDashboard);
app.get('/profile/payment-method/', function (req, res) {
  const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, '/profile/payment-method' + q);
});
// Admin SPA: all /admin/* routes serve the dashboard (client-side routing)
app.get('/admin', sendDashboard);
app.get('/admin/', function (req, res) {
  const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, '/admin' + q);
});
app.get('/admin/*', sendDashboard);
app.get('/guides/:slug', sendDashboard);
app.get('/guides/:slug/', function (req, res) {
  const slug = req.params.slug || '';
  const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, '/guides/' + slug + q);
});
app.get('/terms/', function (req, res) {
  res.redirect(302, '/terms' + (req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : ''));
});
app.get('/privacy/', function (req, res) {
  res.redirect(302, '/privacy' + (req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : ''));
});
app.get('/legal/', function (req, res) {
  res.redirect(302, '/legal' + (req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : ''));
});

// Dashboard SPA assets: serve with correct MIME type so browsers accept them (fixes 404/MIME errors on Vercel).
const dashboardBuildDir = path.join(staticRoot, dashboardSegment);
const dashboardBuildDirCwd = path.join(process.cwd(), 'public', dashboardSegment);
function serveDashboardAsset(req, res) {
  const rawPath = (req.path || req.url || '').split('?')[0];
  const prefix = '/dashboard-app/assets/';
  const assetPath = rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : '';
  if (!assetPath || assetPath.includes('..') || path.isAbsolute(assetPath)) return res.status(404).end();
  const mime = assetPath.endsWith('.js') ? 'application/javascript' : assetPath.endsWith('.css') ? 'text/css' : assetPath.endsWith('.map') ? 'application/json' : null;
  const roots = [dashboardBuildDir, dashboardBuildDirCwd].filter((d) => fs.existsSync(d));
  for (const root of roots) {
    const filePath = path.join(root, 'assets', assetPath);
    const dir = path.join(root, 'assets');
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    if (mime) res.set('Content-Type', mime);
    return res.sendFile(filePath);
  }
  res.status(404).end();
}
app.get(/^\/dashboard-app\/assets\/.+/, serveDashboardAsset);
if (fs.existsSync(dashboardBuildDir) || fs.existsSync(dashboardBuildDirCwd)) {
  app.use('/dashboard-app', express.static(dashboardBuildDir));
}

// Serve main site (styles.css, media/, etc.). Local dev only; on Vercel static files are served from public/ by the platform.
app.use(express.static(staticRoot));

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

const chatUploadsDir = path.join(uploadsBase, 'chat');
try { if (!fs.existsSync(chatUploadsDir)) fs.mkdirSync(chatUploadsDir, { recursive: true }); } catch (_) {}
const chatImageStorage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, chatUploadsDir); },
  filename: function (_req, file, cb) {
    const ext = (file.mimetype === 'image/png') ? 'png' : (file.mimetype === 'image/gif') ? 'gif' : 'jpg';
    cb(null, 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext);
  }
});
const uploadChatImage = multer({ storage: chatImageStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: function (_req, file, cb) {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') return cb(null, true);
  cb(new Error('Only images allowed (JPEG, PNG, GIF)'));
} }).single('image');

app.use('/uploads', express.static(uploadsBase));

// Redirect old dashboard URL to home
app.get('/dashboard', (req, res) => {
  res.redirect(301, '/home');
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
    // Never expose login credentials in list response; joiners get them via GET access-details
    delete out.login_email;
    delete out.login_password;
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Get offer failed' });
  }
});

// Create offer (auth required). Public visibility only if charter accepted. One offer per service per user.
app.post('/api/offers', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const { service, service_name, plan, price, max_slots, visibility, instant, verified, login_email, login_password } = req.body || {};
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
    if (login_email !== undefined) row.login_email = login_email ? String(login_email).trim() : null;
    if (login_password !== undefined) row.login_password = login_password ? String(login_password) : null;
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
  const { service, service_name, plan, price, max_slots, visibility, instant, verified, login_email, login_password } = req.body || {};
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
    if (login_email !== undefined) updates.login_email = login_email ? String(login_email).trim() : null;
    if (login_password !== undefined) updates.login_password = login_password ? String(login_password) : null;
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

const JOIN_REQUEST_SYSTEM_MESSAGE = 'Welcome! This chat connects the subscription owner and co-subscriber.\n\nUse it only if you need to discuss access, profiles, or subscription-related questions.\n\nEverything is set up — you don\'t need to message unless something comes up 👍';

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

// Create PaymentIntent for joining an offer (pay by card). Amount = offer first period (contribution_per_month).
app.post('/api/offers/:id/slots/:slotIndex/create-payment-intent', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin || !stripe) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id, price').eq('id', offerId).single();
    if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'available') return res.status(400).json({ error: 'Slot is not available' });
    const amountEur = Number(offer.price) != null ? Math.max(0, Number(Number(offer.price).toFixed(2))) : 0;
    const amount_cents = Math.round(amountEur * 100) || 100; // min 1€ for Stripe
    let { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } });
      customerId = cust.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq('id', user.id);
    }
    const pi = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: stripeCurrency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: user.id, purpose: 'join', offer_id: offerId, slot_index: String(slotIndex) }
    });
    return res.status(200).json({
      client_secret: pi.client_secret,
      publishableKey: stripePublishableKey || undefined
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to create payment intent' });
  }
});

// Reserve a slot after successful card payment (PaymentIntent). Verifies payment with Stripe then reserves.
app.post('/api/offers/:id/slots/:slotIndex/reserve-after-card', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin || !stripe) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  const paymentIntentId = req.body && req.body.payment_intent_id;
  if (!offerId || !slotIndex || slotIndex < 1 || !paymentIntentId) return res.status(400).json({ error: 'Invalid request' });
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed' });
    const meta = pi.metadata || {};
    if (meta.purpose !== 'join' || meta.offer_id !== offerId || String(meta.slot_index) !== String(slotIndex) || String(meta.user_id) !== String(user.id)) {
      return res.status(400).json({ error: 'Payment does not match this slot' });
    }
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
      // non-fatal
    }
    return res.status(200).json({ message: 'Slot reserved' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Reserve failed' });
  }
});

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

// Reserve a slot and charge the first period from wallet balance immediately (debit_join).
app.post('/api/offers/:id/slots/:slotIndex/reserve-with-balance', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: offer, error: offerErr } = await supabaseAdmin.from('offers').select('id, owner_id, service, service_name, price').eq('id', offerId).single();
    if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, status')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'available') return res.status(400).json({ error: 'Slot is not available' });
    const amountEur = Number(offer.price) != null ? Math.max(0, Number(Number(offer.price).toFixed(2))) : 0;
    const amount_cents = Math.round(amountEur * 100) || 0;
    if (amount_cents <= 0) return res.status(400).json({ error: 'Invalid offer price' });
    const { data: balanceRow } = await supabaseAdmin.from('user_balances').select('balance_cents').eq('user_id', user.id).single();
    const balance_cents = (balanceRow && balanceRow.balance_cents != null) ? balanceRow.balance_cents : 0;
    if (balance_cents < amount_cents) return res.status(400).json({ error: 'Insufficient balance. Top up your wallet or pay by card.' });
    const referenceId = offerId + '_' + slotIndex;
    let ownerDisplay = 'Host';
    const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('alias, first_name, last_name').eq('id', offer.owner_id).single();
    if (ownerProfile) {
      ownerDisplay = ownerProfile.alias || [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ').trim() || 'Host';
    }
    const serviceName = offer.service_name || offer.service || 'Subscription';
    const metadata = { service_name: serviceName, owner_alias: ownerDisplay, offer_id: offerId, slot_index: slotIndex };
    const { error: txErr } = await supabaseAdmin.rpc('apply_balance_transaction', {
      p_user_id: user.id,
      p_amount_cents: -amount_cents,
      p_type: 'debit_join',
      p_reference_type: 'offer_slot',
      p_reference_id: referenceId,
      p_metadata: metadata
    });
    if (txErr) throw new Error(txErr.message);
    const { error: updateErr } = await supabaseAdmin
      .from('offer_slots')
      .update({ status: 'reserved', user_id: user.id, reserved_at: new Date().toISOString() })
      .eq('id', slot.id);
    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }
    try {
      await getOrCreateThreadAndNotifyJoinRequest(supabaseAdmin, offerId, offer.owner_id, user.id, JOIN_REQUEST_SYSTEM_MESSAGE);
    } catch (e) {
      // non-fatal
    }
    return res.status(200).json({ message: 'Slot reserved', amount_cents });
  } catch (e) {
    if (e.message && e.message.indexOf('balance would go negative') !== -1) return res.status(400).json({ error: 'Insufficient balance. Top up your wallet or pay by card.' });
    if (e.message && e.message.indexOf('idempotency') !== -1) return res.status(409).json({ error: 'This slot was already reserved.' });
    return res.status(500).json({ error: e.message || 'Reserve failed' });
  }
});

// Get login credentials for the subscription (joiner only, after they have reserved or taken the slot).
app.get('/api/offers/:id/slots/:slotIndex/access-details', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const offerId = req.params.id;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  if (!offerId || !slotIndex || slotIndex < 1) return res.status(400).json({ error: 'Invalid offer or slot' });
  try {
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('id, user_id, status')
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (!slot.user_id || String(slot.user_id) !== String(user.id)) return res.status(403).json({ error: 'Not your slot' });
    if (slot.status !== 'reserved' && slot.status !== 'taken') return res.status(403).json({ error: 'Slot not active' });
    const { data: offer, error: offerErr } = await supabaseAdmin
      .from('offers')
      .select('login_email, login_password')
      .eq('id', offerId)
      .single();
    if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
    return res.status(200).json({
      login_email: offer.login_email || '',
      login_password: offer.login_password || ''
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load access details' });
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

// Subscriber confirms details (credentials received, everything working). Sets subscriber_confirmed_at so the 30-day payout to the owner will run. Optionally converts hold_join to debit_join if present.
app.post('/api/offers/:id/slots/:slotIndex/confirm-details', async (req, res) => {
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
    if (slot.status !== 'taken' || slot.user_id !== user.id) return res.status(403).json({ error: 'Only the subscriber can confirm, and the slot must be accepted' });
    const now = new Date().toISOString();
    const { error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .update({ subscriber_confirmed_at: now, updated_at: now })
      .eq('offer_id', offerId)
      .eq('slot_index', slotIndex)
      .eq('user_id', user.id);
    if (subErr) return res.status(500).json({ error: subErr.message });
    const refId = offerId + '_' + slotIndex;
    await supabaseAdmin
      .from('balance_transactions')
      .update({ type: 'debit_join' })
      .eq('user_id', user.id)
      .eq('reference_type', 'offer_slot')
      .eq('reference_id', refId)
      .eq('type', 'hold_join');
    return res.status(200).json({ message: 'Details confirmed' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Confirm failed' });
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
    // Refund wallet payment for this slot (join paid by balance: debit_join or hold_join).
    const refId = offerId + '_' + slotIndex;
    const { data: chargeRow } = await supabaseAdmin.from('balance_transactions').select('id, amount_cents, metadata').eq('user_id', declinedUserId).eq('reference_type', 'offer_slot').eq('reference_id', refId).in('type', ['hold_join', 'debit_join']).maybeSingle();
    if (chargeRow && chargeRow.amount_cents < 0) {
      const refundCents = -chargeRow.amount_cents;
      const meta = chargeRow.metadata || {};
      await supabaseAdmin.rpc('apply_balance_transaction', {
        p_user_id: declinedUserId,
        p_amount_cents: refundCents,
        p_type: 'refund_hold_join',
        p_reference_type: 'offer_slot_refund',
        p_reference_id: refId,
        p_metadata: { ...meta, reason: 'owner_declined' }
      });
    }
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

// Upload chat image (images only; returns URL to use in message content as [img]url)
const CHAT_IMAGES_BUCKET = 'chat-images';
const CHAT_IMAGE_RETENTION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

function cleanupChatImagesOlderThan5Days() {
  const cutoff = Date.now() - CHAT_IMAGE_RETENTION_MS;
  // Local disk: filenames are img-{timestamp}-{random}.ext
  try {
    if (fs.existsSync(chatUploadsDir)) {
      const files = fs.readdirSync(chatUploadsDir);
      for (const name of files) {
        const m = /^img-(\d+)-/.exec(name);
        if (m) {
          const ts = parseInt(m[1], 10);
          if (ts < cutoff) {
            try { fs.unlinkSync(path.join(chatUploadsDir, name)); } catch (_) {}
          }
        }
      }
    }
  } catch (_) {}
  // Supabase Storage (e.g. on Vercel)
  if (supabaseAdmin && process.env.VERCEL) {
    supabaseAdmin.storage.from(CHAT_IMAGES_BUCKET).list('', { limit: 1000 })
      .then(({ data: roots }) => {
        (roots || []).forEach((root) => {
          if (!root.name) return;
          supabaseAdmin.storage.from(CHAT_IMAGES_BUCKET).list(root.name, { limit: 1000 })
            .then(({ data: files }) => {
              (files || []).forEach((file) => {
                const updated = file.updated_at ? new Date(file.updated_at).getTime() : 0;
                if (updated && updated < cutoff) {
                  supabaseAdmin.storage.from(CHAT_IMAGES_BUCKET).remove([root.name + '/' + file.name]).catch(() => {});
                }
              });
            })
            .catch(() => {});
        });
      })
      .catch(() => {});
  }
}

// Run cleanup every 6 hours
setInterval(cleanupChatImagesOlderThan5Days, 6 * 60 * 60 * 1000);

app.post('/api/chat/upload-image', uploadChatImage, async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    if (!req.file || !req.file.filename) return res.status(400).json({ error: 'No image file' });
    let imageUrl;
    if (process.env.VERCEL && req.file.path && fs.existsSync(req.file.path)) {
      const fileBuffer = fs.readFileSync(req.file.path);
      const ext = path.extname(req.file.filename) || '.jpg';
      const storagePath = user.id + '/img-' + Date.now() + ext;
      const { error: uploadErr } = await supabaseAdmin.storage.from(CHAT_IMAGES_BUCKET).upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype || 'image/jpeg',
        upsert: false
      });
      fs.unlinkSync(req.file.path);
      if (uploadErr) return res.status(500).json({ error: uploadErr.message || 'Storage upload failed' });
      const { data: urlData } = supabaseAdmin.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(storagePath);
      imageUrl = urlData.publicUrl;
    } else {
      imageUrl = '/uploads/chat/' + req.file.filename;
    }
    setImmediate(cleanupChatImagesOlderThan5Days);
    return res.status(200).json({ url: imageUrl });
  } catch (e) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

// --- Auth API (Supabase) ---

// Sign up: create auth user + profile (Phone, E-mail, DOB, Alias, First/Last name, password)
app.post('/api/auth/signup', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Auth not configured' });
  const { email, password, phone, first_name, last_name, alias, date_of_birth } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const emailVal = String(email).trim();
    const aliasVal = (alias && String(alias).trim()) || null;
    const phoneVal = (phone && String(phone).trim()) || null;
    if (emailVal) {
      const { data: existingEmail } = await supabaseAdmin.from('profiles').select('id').ilike('email', emailVal).limit(1).maybeSingle();
      if (existingEmail) return res.status(400).json({ error: 'This email is already registered.' });
    }
    if (aliasVal) {
      const { data: existingAlias } = await supabaseAdmin.from('profiles').select('id').ilike('alias', aliasVal).limit(1).maybeSingle();
      if (existingAlias) return res.status(400).json({ error: 'This nickname is already taken.' });
    }
    if (phoneVal) {
      const { data: existingPhone } = await supabaseAdmin.from('profiles').select('id').eq('phone', phoneVal).limit(1).maybeSingle();
      if (existingPhone) return res.status(400).json({ error: 'This phone number is already in use.' });
    }
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
      user_metadata: { first_name: first_name || '', last_name: last_name || '', alias: alias || '', phone: phone || '', date_of_birth: date_of_birth || null }
    });
    if (authError) {
      const m = authError.message || '';
      if (/already|registered|exists/i.test(m)) return res.status(400).json({ error: 'This email is already registered.' });
      return res.status(400).json({ error: authError.message });
    }
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

// Login: email + password (401 = Supabase rejected credentials: wrong email/password or unconfirmed email)
app.post('/api/auth/login', async (req, res) => {
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email: String(email).trim(), password: String(password) });
    if (error) return res.status(401).json({ error: error.message || 'Invalid login credentials' });
    return res.status(200).json({ access_token: data.session?.access_token, refresh_token: data.session?.refresh_token, user: data.user });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Login failed' });
  }
});

// Forgot password: send recovery email (Supabase redirects to SITE_URL/reset-password with hash)
app.post('/api/auth/forgot-password', async (req, res) => {
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'Email required' });
  const siteUrl = process.env.SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://www.costlyf.com');
  const redirectTo = siteUrl.replace(/\/$/, '') + '/reset-password';
  try {
    const { data, error } = await supabaseAuth.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'If an account exists for this email, you will receive a password reset link.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to send reset email' });
  }
});

// Update password (from recovery link: client sends access_token from hash + new password)
app.post('/api/auth/update-password', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Auth not configured' });
  const { access_token, new_password } = req.body || {};
  if (!access_token || typeof access_token !== 'string') return res.status(400).json({ error: 'Token required' });
  if (!new_password || String(new_password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(access_token.trim());
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired link. Please request a new password reset.' });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: String(new_password) });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Password updated. You can now log in.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update failed' });
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
    const { phone, email, date_of_birth, alias, first_name, last_name, avatar_url: bodyAvatarUrl, charter_accepted_at: charterAcceptedAt, withdrawal_iban: withdrawalIban, withdrawal_account_holder: withdrawalAccountHolder } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (email !== undefined) updates.email = String(email).trim() || null;
    if (phone !== undefined) updates.phone = String(phone).trim() || null;
    if (date_of_birth !== undefined) updates.date_of_birth = (date_of_birth && String(date_of_birth).trim()) || null;
    if (alias !== undefined) updates.alias = String(alias).trim() || null;
    if (first_name !== undefined) updates.first_name = String(first_name).trim() || null;
    if (last_name !== undefined) updates.last_name = String(last_name).trim() || null;
    if (bodyAvatarUrl !== undefined) updates.avatar_url = bodyAvatarUrl ? String(bodyAvatarUrl).trim() : null;
    if (withdrawalIban !== undefined) updates.withdrawal_iban = String(withdrawalIban).trim().replace(/\s/g, '') || null;
    if (withdrawalAccountHolder !== undefined) updates.withdrawal_account_holder = String(withdrawalAccountHolder).trim() || null;
    if (charterAcceptedAt !== undefined) updates.charter_accepted_at = charterAcceptedAt ? String(charterAcceptedAt).trim() : null;
    // Reject duplicate alias, email, or phone (must be unique across users)
    if (updates.email !== undefined && updates.email) {
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').ilike('email', updates.email).neq('id', user.id).limit(1).maybeSingle();
      if (existing) return res.status(400).json({ error: 'This email is already in use by another account.' });
    }
    if (updates.alias !== undefined && updates.alias) {
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').ilike('alias', updates.alias).neq('id', user.id).limit(1).maybeSingle();
      if (existing) return res.status(400).json({ error: 'This nickname is already taken.' });
    }
    if (updates.phone !== undefined && updates.phone) {
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('phone', updates.phone).neq('id', user.id).limit(1).maybeSingle();
      if (existing) return res.status(400).json({ error: 'This phone number is already in use by another account.' });
    }
    // When user accepts charter for the first time, bump trust_score (max 10)
    if (charterAcceptedAt && String(charterAcceptedAt).trim()) {
      const { data: current } = await supabaseAdmin.from('profiles').select('charter_accepted_at, trust_score').eq('id', user.id).single();
      if (current && !current.charter_accepted_at) {
        const next = Math.min(10, (current.trust_score != null ? parseInt(current.trust_score, 10) : 0) + 1);
        updates.trust_score = next;
      }
    }
    const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', user.id).select().single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'This nickname, email, or phone number is already in use.' });
      return res.status(500).json({ error: error.message });
    }
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

// --- Wallet & Stripe (top-up, setup payment method, balance) ---
app.get('/api/wallet/balance', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabaseAdmin.from('user_balances').select('balance_cents').eq('user_id', user.id).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    const balance_cents = (data && data.balance_cents != null) ? data.balance_cents : 0;
    return res.status(200).json({ balance_cents });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to get balance' });
  }
});

app.get('/api/wallet/transactions', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabaseAdmin
      .from('balance_transactions')
      .select('id, amount_cents, type, created_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ transactions: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to get transactions' });
  }
});

app.get('/api/wallet/withdrawal-details', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('withdrawal_iban, withdrawal_account_holder').eq('id', user.id).single();
    const iban = profile && profile.withdrawal_iban && String(profile.withdrawal_iban).trim().replace(/\s/g, '');
    const has_iban = !!(iban && iban.length >= 15);
    const iban_last4 = has_iban && iban.length >= 4 ? iban.slice(-4) : null;
    return res.status(200).json({
      has_iban,
      iban_last4,
      account_holder: (profile && profile.withdrawal_account_holder) ? String(profile.withdrawal_account_holder).trim() : null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to get withdrawal details' });
  }
});

app.post('/api/wallet/topup-intent', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin || !stripe) return res.status(401).json({ error: 'Unauthorized' });
  const amount_cents = Math.min(15000, Math.max(500, parseInt(req.body && req.body.amount_cents, 10) || 500)); // €5–150
  try {
    let { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } });
      customerId = cust.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq('id', user.id);
    }
    const pi = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: stripeCurrency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: user.id, purpose: 'top_up' }
    });
    return res.status(200).json({
      client_secret: pi.client_secret,
      publishableKey: stripePublishableKey || undefined
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to create payment intent' });
  }
});

app.post('/api/wallet/withdraw', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const amount_cents = Math.min(100000, Math.max(500, parseInt(req.body && req.body.amount_cents, 10) || 0)); // €5–1000
  if (amount_cents < 500) return res.status(400).json({ error: 'Minimum withdrawal is 5€' });
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('withdrawal_iban, withdrawal_account_holder').eq('id', user.id).single();
    const iban = profile && profile.withdrawal_iban && String(profile.withdrawal_iban).trim().replace(/\s/g, '');
    if (!iban || iban.length < 15) return res.status(400).json({ error: 'Add your bank IBAN on the Payment method page in profile first' });
    const { data: balanceRow } = await supabaseAdmin.from('user_balances').select('balance_cents').eq('user_id', user.id).single();
    const balance_cents = (balanceRow && balanceRow.balance_cents != null) ? balanceRow.balance_cents : 0;
    if (balance_cents < amount_cents) return res.status(400).json({ error: 'Insufficient balance' });
    const { data: requestRow, error: insertErr } = await supabaseAdmin.from('withdrawal_requests').insert({
      user_id: user.id,
      amount_cents,
      iban_snapshot: iban,
      account_holder_snapshot: (profile && profile.withdrawal_account_holder) ? String(profile.withdrawal_account_holder).trim() : null,
      status: 'pending'
    }).select('id').single();
    if (insertErr || !requestRow) throw new Error(insertErr ? insertErr.message : 'Failed to create withdrawal request');
    const metadata = { amount_eur: (amount_cents / 100).toFixed(2), purpose: 'withdraw_to_bank', withdrawal_request_id: requestRow.id };
    const { error: txErr } = await supabaseAdmin.rpc('apply_balance_transaction', {
      p_user_id: user.id,
      p_amount_cents: -amount_cents,
      p_type: 'withdrawal',
      p_reference_type: 'withdrawal_request',
      p_reference_id: requestRow.id,
      p_metadata: metadata
    });
    if (txErr) {
      await supabaseAdmin.from('withdrawal_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', requestRow.id);
      throw new Error(txErr.message);
    }
    return res.status(200).json({ message: 'Withdrawal requested', amount_cents, withdrawal_request_id: requestRow.id });
  } catch (e) {
    if (e.message && e.message.indexOf('balance would go negative') !== -1) return res.status(400).json({ error: 'Insufficient balance' });
    return res.status(500).json({ error: e.message || 'Withdrawal failed' });
  }
});

app.post('/api/wallet/setup-intent', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin || !stripe) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } });
      customerId = cust.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq('id', user.id);
    }
    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { user_id: user.id }
    });
    return res.status(200).json({
      client_secret: si.client_secret,
      publishableKey: stripePublishableKey || undefined
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to create setup intent' });
  }
});

// --- Admin: withdrawal requests (confirm payout to IBAN, e.g. via Stripe Dashboard) ---
function getAdminListEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function getUserEmail(user) {
  if (!user) return '';
  const fromMeta = user.user_metadata && (user.user_metadata.email || user.user_metadata.email_address);
  const fromIdentity = Array.isArray(user.identities) && user.identities[0] && user.identities[0].identity_data && (user.identities[0].identity_data.email || user.identities[0].identity_data.email_address);
  return (user.email || fromMeta || fromIdentity || '').trim().toLowerCase();
}

function isAdmin(user) {
  if (!user) return false;
  const ids = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const emails = getAdminListEmails();
  if (ids.includes(user.id)) return true;
  const userEmail = getUserEmail(user);
  if (userEmail && emails.includes(userEmail)) return true;
  if (process.env.NODE_ENV !== 'production' && userEmail) {
    if (!emails.length) console.warn('[Admin] ADMIN_EMAILS (or ADMIN_EMAIL) is not set in env; add your email to grant admin access.');
    else console.warn('[Admin] User email "%s" is not in admin list. Set ADMIN_EMAILS=%s (comma-separated).', userEmail, emails.join(','));
  }
  return false;
}

// Shared async admin check: resolves user + email (auth + profile fallback). Returns { ok, user?, email?, reason?, yourEmail?, message? }.
async function checkAdmin(req) {
  const user = await getCurrentUser(req);
  const emails = getAdminListEmails();
  if (!user) return { ok: false, reason: 'no-auth', message: 'Not logged in.' };
  let userEmail = getUserEmail(user);
  if (!userEmail && supabaseAdmin && user.id) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', user.id).single();
    if (profile && profile.email) userEmail = String(profile.email).trim().toLowerCase();
  }
  if (emails.length === 0) return { ok: false, reason: 'env-not-set', yourEmail: userEmail || null, message: 'ADMIN_EMAILS is not set on the server. Add your email in the server environment (e.g. Vercel → Project → Environment Variables).' };
  if (!userEmail || !emails.includes(userEmail)) return { ok: false, reason: 'not-in-list', yourEmail: userEmail || null, message: `Your login email is not in the admin list. Set ADMIN_EMAILS to include: ${userEmail || '(no email on account)'}` };
  return { ok: true, user, email: userEmail };
}

app.get('/api/admin/check', async (req, res) => {
  const result = await checkAdmin(req);
  if (result.ok) return res.status(200).json({ admin: true, email: result.email });
  return res.status(403).json({ admin: false, reason: result.reason, yourEmail: result.yourEmail, message: result.message });
});

app.get('/api/admin/withdrawal-requests', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  try {
    const status = (req.query.status || 'pending').toString();
    const { data: rows, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('id, user_id, amount_cents, iban_snapshot, account_holder_snapshot, status, stripe_payout_id, admin_notes, created_at, updated_at')
      .in('status', status === 'all' ? ['pending', 'paid', 'cancelled'] : [status])
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    const userIds = [...new Set((rows || []).map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, alias').in('id', userIds);
    const byId = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const list = (rows || []).map((r) => ({ ...r, user_email: byId[r.user_id]?.email, user_alias: byId[r.user_id]?.alias }));
    return res.status(200).json({ withdrawal_requests: list });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list withdrawal requests' });
  }
});

app.patch('/api/admin/withdrawal-requests/:id', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const id = (req.params && req.params.id) || '';
  const { status: newStatus, stripe_payout_id: stripePayoutId, admin_notes: adminNotes } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing withdrawal request id' });
  try {
    const { data: row, error: fetchErr } = await supabaseAdmin.from('withdrawal_requests').select('id, status').eq('id', id).single();
    if (fetchErr || !row) return res.status(404).json({ error: 'Withdrawal request not found' });
    const updates = { updated_at: new Date().toISOString() };
    if (adminNotes !== undefined) updates.admin_notes = typeof adminNotes === 'string' ? adminNotes.trim() || null : null;
    if (row.status === 'pending' && (newStatus === 'paid' || newStatus === 'cancelled')) {
      updates.status = newStatus;
      if (stripePayoutId !== undefined) updates.stripe_payout_id = String(stripePayoutId).trim() || null;
    }
    const { error: updateErr } = await supabaseAdmin.from('withdrawal_requests').update(updates).eq('id', id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.status(200).json({ message: updates.status ? (updates.status === 'paid' ? 'Marked as paid' : 'Cancelled') : 'Updated' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update failed' });
  }
});

// --- Admin: list all chat threads (search/filter), get messages, post as support ---
app.get('/api/admin/chat/threads', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const q = (req.query.q && String(req.query.q).trim()) || '';
  try {
    let threadsQuery = supabaseAdmin.from('chat_threads').select('id, offer_id, user1_id, user2_id, created_at, updated_at').order('updated_at', { ascending: false }).limit(200);
    const { data: threads, error: threadsErr } = await threadsQuery;
    if (threadsErr) return res.status(500).json({ error: threadsErr.message });
    if (!threads || threads.length === 0) return res.status(200).json([]);
    const offerIds = [...new Set(threads.map(t => t.offer_id))];
    const userIds = [...new Set(threads.flatMap(t => [t.user1_id, t.user2_id]))];
    const { data: offers } = await supabaseAdmin.from('offers').select('id, service, service_name, plan').in('id', offerIds);
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, alias, first_name, last_name').in('id', userIds);
    const offerById = (offers || []).reduce((acc, o) => { acc[o.id] = o; return acc; }, {});
    const profileById = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const searchLower = q ? q.toLowerCase() : '';
    const out = threads.map(t => {
      const o = offerById[t.offer_id] || {};
      const subLabel = [o.service_name || o.service, o.plan].filter(Boolean).join(' ') || 'Subscription';
      const p1 = profileById[t.user1_id] || {};
      const p2 = profileById[t.user2_id] || {};
      const name1 = [p1.alias, [p1.first_name, p1.last_name].filter(Boolean).join(' '), p1.email].find(Boolean) || 'User';
      const name2 = [p2.alias, [p2.first_name, p2.last_name].filter(Boolean).join(' '), p2.email].find(Boolean) || 'User';
      const match = !searchLower || [name1, name2, p1.email, p2.email, subLabel, (o.service_name || o.service || '')].some(s => (s || '').toLowerCase().includes(searchLower));
      return { id: t.id, offer_id: t.offer_id, user1_id: t.user1_id, user2_id: t.user2_id, user1_name: name1, user2_name: name2, user1_email: p1.email, user2_email: p2.email, subscription_label: subLabel, created_at: t.created_at, updated_at: t.updated_at, _match: match };
    });
    const filtered = q ? out.filter(r => r._match) : out;
    filtered.forEach(r => delete r._match);
    return res.status(200).json(filtered);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List threads failed' });
  }
});

app.get('/api/admin/chat/threads/:id/messages', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const threadId = req.params.id;
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
  try {
    const { data: thread, error: threadErr } = await supabaseAdmin.from('chat_threads').select('id, user1_id, user2_id, offer_id').eq('id', threadId).single();
    if (threadErr || !thread) return res.status(404).json({ error: 'Thread not found' });
    const { data: rows, error: msgErr } = await supabaseAdmin.from('chat_messages').select('id, thread_id, sender_id, content, created_at, read_at, is_system').eq('thread_id', threadId).order('created_at', { ascending: true }).limit(limit);
    if (msgErr) return res.status(500).json({ error: msgErr.message });
    const messages = rows || [];
    const offerIds = [thread.offer_id];
    const { data: offers } = await supabaseAdmin.from('offers').select('id, service_name, service').in('id', offerIds);
    const offer = (offers || [])[0] || {};
    const { data: profs } = await supabaseAdmin.from('profiles').select('id, alias, first_name, last_name, email').in('id', [thread.user1_id, thread.user2_id]);
    const byId = (profs || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    return res.status(200).json({ thread: { id: thread.id, user1_id: thread.user1_id, user2_id: thread.user2_id, user1_name: [byId[thread.user1_id]?.alias, [byId[thread.user1_id]?.first_name, byId[thread.user1_id]?.last_name].filter(Boolean).join(' '), byId[thread.user1_id]?.email].find(Boolean) || 'User', user2_name: [byId[thread.user2_id]?.alias, [byId[thread.user2_id]?.first_name, byId[thread.user2_id]?.last_name].filter(Boolean).join(' '), byId[thread.user2_id]?.email].find(Boolean) || 'User', subscription_label: [offer.service_name || offer.service].filter(Boolean).join(' ') || 'Subscription' }, messages });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List messages failed' });
  }
});

app.post('/api/admin/chat/threads/:id/messages', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const threadId = req.params.id;
  const { content } = req.body || {};
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return res.status(400).json({ error: 'content required' });
  try {
    const { data: thread, error: threadErr } = await supabaseAdmin.from('chat_threads').select('id').eq('id', threadId).single();
    if (threadErr || !thread) return res.status(404).json({ error: 'Thread not found' });
    const supportContent = '[Support] ' + text;
    const { data: msg, error: insertErr } = await supabaseAdmin.from('chat_messages').insert({ thread_id: threadId, sender_id: null, content: supportContent, read_at: null, is_system: true }).select().single();
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    await supabaseAdmin.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
    return res.status(201).json(msg);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Send failed' });
  }
});

// --- Support tickets: user creates and replies; admin lists, replies, sets status ---
app.post('/api/support/tickets', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const { subject, content } = req.body || {};
  const subj = typeof subject === 'string' ? subject.trim() : '';
  const text = typeof content === 'string' ? content.trim() : '';
  if (!subj || !text) return res.status(400).json({ error: 'subject and content required' });
  try {
    const { data: ticket, error: ticketErr } = await supabaseAdmin.from('support_tickets').insert({ user_id: user.id, subject: subj, status: 'open' }).select().single();
    if (ticketErr) return res.status(500).json({ error: ticketErr.message });
    const { error: msgErr } = await supabaseAdmin.from('support_ticket_messages').insert({ ticket_id: ticket.id, sender_id: user.id, is_admin: false, content: text });
    if (msgErr) return res.status(500).json({ error: msgErr.message });
    return res.status(201).json(ticket);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Create failed' });
  }
});

app.get('/api/support/tickets', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data: rows, error } = await supabaseAdmin.from('support_tickets').select('id, subject, status, created_at, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(rows || []);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List failed' });
  }
});

app.get('/api/support/tickets/:id', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  try {
    const { data: ticket, error: tErr } = await supabaseAdmin.from('support_tickets').select('id, subject, status, created_at, updated_at').eq('id', id).eq('user_id', user.id).single();
    if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { data: messages, error: mErr } = await supabaseAdmin.from('support_ticket_messages').select('id, sender_id, is_admin, content, created_at').eq('ticket_id', id).order('created_at', { ascending: true });
    if (mErr) return res.status(500).json({ error: mErr.message });
    return res.status(200).json({ ...ticket, messages: messages || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed' });
  }
});

app.post('/api/support/tickets/:id/messages', async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const id = req.params.id;
  const { content } = req.body || {};
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return res.status(400).json({ error: 'content required' });
  try {
    const { data: ticket, error: tErr } = await supabaseAdmin.from('support_tickets').select('id').eq('id', id).eq('user_id', user.id).single();
    if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { data: msg, error: mErr } = await supabaseAdmin.from('support_ticket_messages').insert({ ticket_id: id, sender_id: user.id, is_admin: false, content: text }).select().single();
    if (mErr) return res.status(500).json({ error: mErr.message });
    await supabaseAdmin.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', id);
    return res.status(201).json(msg);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Send failed' });
  }
});

app.get('/api/admin/tickets', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const status = (req.query.status && String(req.query.status).trim()) || '';
  const q = (req.query.q && String(req.query.q).trim()) || '';
  try {
    let query = supabaseAdmin.from('support_tickets').select('id, user_id, subject, status, created_at, updated_at').order('updated_at', { ascending: false }).limit(200);
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) query = query.eq('status', status);
    const { data: tickets, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    if (!tickets || tickets.length === 0) return res.status(200).json([]);
    const userIds = [...new Set(tickets.map(t => t.user_id))];
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, alias, first_name, last_name').in('id', userIds);
    const byId = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const searchLower = q ? q.toLowerCase() : '';
    const out = (tickets || []).map(t => {
      const p = byId[t.user_id] || {};
      const name = [p.alias, [p.first_name, p.last_name].filter(Boolean).join(' '), p.email].find(Boolean) || 'User';
      const match = !searchLower || [name, p.email, t.subject].some(s => (s || '').toLowerCase().includes(searchLower));
      return { ...t, user_email: p.email, user_name: name, _match: match };
    });
    const filtered = q ? out.filter(r => r._match) : out;
    filtered.forEach(r => delete r._match);
    return res.status(200).json(filtered);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List failed' });
  }
});

app.get('/api/admin/tickets/:id', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const id = req.params.id;
  try {
    const { data: ticket, error: tErr } = await supabaseAdmin.from('support_tickets').select('id, user_id, subject, status, created_at, updated_at').eq('id', id).single();
    if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { data: messages } = await supabaseAdmin.from('support_ticket_messages').select('id, sender_id, is_admin, content, created_at').eq('ticket_id', id).order('created_at', { ascending: true });
    const { data: profile } = await supabaseAdmin.from('profiles').select('id, email, alias, first_name, last_name').eq('id', ticket.user_id).single();
    const userName = [profile?.alias, [profile?.first_name, profile?.last_name].filter(Boolean).join(' '), profile?.email].find(Boolean) || 'User';
    return res.status(200).json({ ...ticket, user_name: userName, user_email: profile?.email, messages: messages || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed' });
  }
});

app.patch('/api/admin/tickets/:id', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const id = req.params.id;
  const { status: newStatus } = req.body || {};
  if (!newStatus || !['open', 'in_progress', 'resolved', 'closed'].includes(newStatus)) return res.status(400).json({ error: 'status must be open, in_progress, resolved, or closed' });
  try {
    const { error } = await supabaseAdmin.from('support_tickets').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Updated' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update failed' });
  }
});

app.post('/api/admin/tickets/:id/messages', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const id = req.params.id;
  const { content } = req.body || {};
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return res.status(400).json({ error: 'content required' });
  try {
    const { data: ticket, error: tErr } = await supabaseAdmin.from('support_tickets').select('id').eq('id', id).single();
    if (tErr || !ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { data: msg, error: mErr } = await supabaseAdmin.from('support_ticket_messages').insert({ ticket_id: id, sender_id: user.id, is_admin: true, content: text }).select().single();
    if (mErr) return res.status(500).json({ error: mErr.message });
    await supabaseAdmin.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', id);
    return res.status(201).json(msg);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Send failed' });
  }
});

// --- Admin: list users, get user detail (profile, balance, subscriptions, withdrawals) ---
app.get('/api/admin/users', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const q = (req.query.q && String(req.query.q).trim()).toLowerCase() || '';
  try {
    const { data: profiles, error } = await supabaseAdmin.from('profiles').select('id, email, phone, alias, first_name, last_name, created_at, updated_at, trust_score, charter_accepted_at, avatar_url').order('created_at', { ascending: false }).limit(500);
    if (error) return res.status(500).json({ error: error.message });
    let list = profiles || [];
    if (q) {
      list = list.filter(p => [p.email, p.phone, p.alias, p.first_name, p.last_name].some(v => (v || '').toLowerCase().includes(q)));
    }
    return res.status(200).json(list);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'List failed' });
  }
});

app.get('/api/admin/users/:id', async (req, res) => {
  const admin = await checkAdmin(req);
  if (!admin.ok || !supabaseAdmin) return res.status(403).json({ error: 'Forbidden' });
  const user = admin.user;
  const userId = req.params.id;
  try {
    const { data: profile, error: pErr } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
    if (pErr || !profile) return res.status(404).json({ error: 'User not found' });
    const { data: balance } = await supabaseAdmin.from('user_balances').select('balance_cents').eq('user_id', userId).single();
    const { data: txs } = await supabaseAdmin.from('balance_transactions').select('id, amount_cents, type, reference_type, reference_id, metadata, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
    const { data: offers } = await supabaseAdmin.from('offers').select('id, service, service_name, plan, price, max_slots, visibility, created_at').eq('owner_id', userId).order('created_at', { ascending: false });
    const { data: slots } = await supabaseAdmin.from('offer_slots').select('offer_id, slot_index, status, user_id, reserved_at, accepted_at').eq('user_id', userId);
    const { data: withdrawals } = await supabaseAdmin.from('withdrawal_requests').select('id, amount_cents, status, created_at, updated_at').eq('user_id', userId).order('created_at', { ascending: false });
    return res.status(200).json({
      profile,
      balance_cents: balance?.balance_cents ?? 0,
      balance_transactions: txs || [],
      offers_owned: offers || [],
      slots_joined: slots || [],
      withdrawal_requests: withdrawals || []
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed' });
  }
});

// --- 30-day payouts: credit owners (contribution - platform fee) when period ends ---
const PLATFORM_FEE_PERCENT = 10; // 10% fee; owner receives 90%

async function processPayoutsCron(req, res) {
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: 'Database not configured' });
  const now = new Date().toISOString();
  try {
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, offer_id, slot_index, period_end, contribution_price, status')
      .lte('period_end', now)
      .not('subscriber_confirmed_at', 'is', null)
      .in('status', ['active', 'canceling', 'ended']);
    if (subsErr) return res.status(500).json({ error: subsErr.message });
    let processed = 0;
    for (const sub of subs || []) {
      const refId = `payout_${sub.offer_id}_${sub.slot_index}_${sub.period_end}`;
      const { data: existing } = await supabaseAdmin.from('balance_transactions').select('id').eq('reference_type', 'payout_30d').eq('reference_id', refId).maybeSingle();
      if (existing) continue;
      const { data: offer } = await supabaseAdmin.from('offers').select('owner_id, service_name').eq('id', sub.offer_id).single();
      if (!offer || !offer.owner_id) continue;
      const contribution_cents = Math.round(Number(sub.contribution_price) * 100) || 0;
      if (contribution_cents <= 0) continue;
      const payout_cents = Math.round(contribution_cents * (1 - PLATFORM_FEE_PERCENT / 100));
      if (payout_cents <= 0) continue;
      const metadata = { offer_id: sub.offer_id, slot_index: sub.slot_index, period_end: sub.period_end, service_name: offer.service_name || null };
      const { error: txErr } = await supabaseAdmin.rpc('apply_balance_transaction', {
        p_user_id: offer.owner_id,
        p_amount_cents: payout_cents,
        p_type: 'payout_owner',
        p_reference_type: 'payout_30d',
        p_reference_id: refId,
        p_metadata: metadata
      });
      if (!txErr) processed += 1;
    }
    return res.status(200).json({ message: 'Payouts processed', processed });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Payout job failed' });
  }
}

app.get('/api/cron/process-payouts', processPayoutsCron);
app.post('/api/cron/process-payouts', processPayoutsCron);

// Change password (Bearer token); requires current_password for verification
app.post('/api/auth/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const { current_password, new_password } = req.body || {};
  if (!current_password || String(current_password).length === 0) return res.status(400).json({ error: 'Current password is required' });
  if (!new_password || String(new_password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    const email = user.email;
    if (!email) return res.status(400).json({ error: 'Account has no email; cannot verify current password' });
    if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });
    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({ email, password: String(current_password) });
    if (signInError) return res.status(400).json({ error: 'Current password is incorrect' });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: String(new_password) });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Password updated' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Update failed' });
  }
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
