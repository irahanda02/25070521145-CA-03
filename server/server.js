
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'dear-wardrobe-local-dev-secret-change-before-deployment';

const client = new MongoClient('mongodb://127.0.0.1:27017');

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
  })
);

app.use(express.json({ limit: '8mb' }));

let users;
let clothes;
let outfits;

// ==================== AUTHENTICATION ====================

function authenticate(req, res, next) {
  const authorization = req.headers.authorization || '';

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({
      message: 'Please log in to continue.',
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Your session is invalid or expired. Please log in again.',
    });
  }
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

// ==================== START SERVER ====================

async function startServer() {
  try {
    await client.connect();

    const db = client.db('dear_wardrobe');

    users = db.collection('users');
    clothes = db.collection('clothes');
    outfits = db.collection('outfits');

    await users.createIndex(
      { email: 1 },
      { unique: true }
    );

    console.log('Connected to local MongoDB: dear_wardrobe');

    // ==================== HOME / HEALTH ====================

    app.get('/', (req, res) => {
      res.send('Dear Wardrobe API is running!');
    });

    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        message: 'Dear Wardrobe API is running.',
      });
    });

    // ==================== REGISTER ====================

    app.post('/api/auth/register', async (req, res) => {
      try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '')
          .trim()
          .toLowerCase();
        const password = String(req.body.password || '');

        if (!name || !email || !password) {
          return res.status(400).json({
            message: 'Name, email, and password are required.',
          });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({
            message: 'Please enter a valid email address.',
          });
        }

        if (password.length < 8) {
          return res.status(400).json({
            message: 'Password must be at least 8 characters.',
          });
        }

        const existingUser = await users.findOne({ email });

        if (existingUser) {
          return res.status(409).json({
            message: 'An account with this email already exists. Please log in.',
          });
        }

        const user = {
          name,
          email,
          passwordHash: await bcrypt.hash(password, 12),
          createdAt: new Date(),
        };

        const result = await users.insertOne(user);
        user._id = result.insertedId;

        const token = jwt.sign(
          {
            userId: user._id.toString(),
            email: user.email,
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.status(201).json({
          token,
          user: safeUser(user),
        });
      } catch (error) {
        console.error('Register error:', error);

        if (error.code === 11000) {
          return res.status(409).json({
            message: 'An account with this email already exists. Please log in.',
          });
        }

        return res.status(500).json({
          message: 'Could not create account.',
        });
      }
    });

    // ==================== LOGIN ====================

    app.post('/api/auth/login', async (req, res) => {
      try {
        const email = String(req.body.email || '')
          .trim()
          .toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
          return res.status(400).json({
            message: 'Email and password are required.',
          });
        }

        const user = await users.findOne({ email });

        if (
          !user ||
          !(await bcrypt.compare(password, user.passwordHash))
        ) {
          return res.status(401).json({
            message: 'Email or password is incorrect.',
          });
        }

        const token = jwt.sign(
          {
            userId: user._id.toString(),
            email: user.email,
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          token,
          user: safeUser(user),
        });
      } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
          message: 'Could not log in right now.',
        });
      }
    });

    // ==================== LOAD CLOTHES ====================

    app.get('/api/clothes', authenticate, async (req, res) => {
      try {
        const items = await clothes
          .find({
            userId: req.user.userId,
          })
          .sort({ createdAt: -1 })
          .toArray();

        return res.json(items);
      } catch (error) {
        console.error('Load clothes error:', error);

        return res.status(500).json({
          message: 'Could not load clothes.',
        });
      }
    });

    // ==================== ADD CLOTHING ====================

    app.post('/api/clothes', authenticate, async (req, res) => {
      try {
        const {
          name,
          category,
          color,
          image,
          emoji,
          type,
        } = req.body;

        if (!String(name || '').trim() || !category) {
          return res.status(400).json({
            message: 'Name and category are required.',
          });
        }

        const item = {
          userId: req.user.userId,
          name: String(name).trim(),
          category: String(category),
          color: color || '',
          image: image || '',
          emoji: emoji || '👗',
          type: type || 'custom',
          createdAt: new Date(),
        };

        const result = await clothes.insertOne(item);

        return res.status(201).json({
          ...item,
          _id: result.insertedId,
        });
      } catch (error) {
        console.error('Add clothing error:', error);

        return res.status(500).json({
          message: 'Could not save clothing item.',
        });
      }
    });

    // ==================== DELETE CLOTHING ====================

    app.delete('/api/clothes/:id', authenticate, async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).json({
            message: 'Invalid clothing item ID.',
          });
        }

        const result = await clothes.deleteOne({
          _id: new ObjectId(req.params.id),
          userId: req.user.userId,
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            message: 'Item not found in your account.',
          });
        }

        return res.json({ deleted: true });
      } catch (error) {
        console.error('Delete clothing error:', error);

        return res.status(500).json({
          message: 'Could not delete clothing item.',
        });
      }
    });

    // ==================== LOAD SAVED OUTFITS ====================

    app.get('/api/outfits', authenticate, async (req, res) => {
      try {
        const savedOutfits = await outfits
          .find({
            userId: req.user.userId,
          })
          .sort({ createdAt: -1 })
          .toArray();

        return res.json(savedOutfits);
      } catch (error) {
        console.error('Load outfits error:', error);

        return res.status(500).json({
          message: 'Could not load saved outfits.',
        });
      }
    });

    // ==================== SAVE OUTFIT ====================

    app.post('/api/outfits', authenticate, async (req, res) => {
      try {
        const name = String(req.body.name || 'My new look').trim();
        const items = Array.isArray(req.body.items)
          ? req.body.items
          : [];

        if (items.length === 0) {
          return res.status(400).json({
            message: 'Add at least one item to save an outfit.',
          });
        }

        const outfit = {
          userId: req.user.userId,
          name,
          items,
          createdAt: new Date(),
        };

        const result = await outfits.insertOne(outfit);

        return res.status(201).json({
          ...outfit,
          _id: result.insertedId,
        });
      } catch (error) {
        console.error('Save outfit error:', error);

        return res.status(500).json({
          message: 'Could not save outfit.',
        });
      }
    });

    // ==================== START LISTENING ====================

    app.listen(PORT, () => {
      console.log(`Dear Wardrobe API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
}

startServer();
