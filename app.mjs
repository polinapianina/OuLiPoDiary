import './config.mjs';
console.log('DSN from env:', process.env.DSN); // Debug
import mongoose from 'mongoose';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport'; 
import initializePassport from './passport-config.js'; 
import User from './models/User.js'; 
import DiaryEntry from './models/DiaryEntry.js';
import bcrypt from 'bcrypt'; 
import session from 'express-session'; 
import flash from 'connect-flash';
import { Server } from 'socket.io'; 
import http from 'http';
import { transformN7 } from './n7.mjs';
import { transformSnowball } from './snowball.mjs';
import { transformAntonymic } from './antonymic.mjs';

// express app + setup paths
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// connect to MongoDB
mongoose.connect(process.env.DSN).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

// adding the Socket.IO interogation for "real-time" public entries list update
const server = http.createServer(app); 
const io = new Server(server);

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// broadcasting new public entries in real-time
const broadcastNewEntry = async () => {
    const publicEntries = await DiaryEntry.find({ status: 'public', deleted: false }).populate('user', 'username');
    io.emit('updatePublicEntries', publicEntries);
};

// middleware to parse url-encoded data and json payloads
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const router = express.Router();

router.post('/n7-transform', (req, res) => {
  const { text } = req.body; // expecting JSON { text: "..." }
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }
  const transformed = transformN7(text);
  return res.json({ transformed });
});

router.post('/snowball-transform', (req, res) => {
    const { text } = req.body;
    const poem = transformSnowball(text);
    res.json({ poem });
  });

  router.post('/antonymic-transform', async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    const result = await transformAntonymic(text);
    res.json({ result });
  });

app.use(router);

// session and flash middleware setup (correct order is important)
app.use(session({
    secret: 'secret-key', // replace with a secure key
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

// initialize passport and session handling
initializePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.locals.DICTIONARY_API_URL = process.env.DICTIONARY_API_URL;
    res.locals.DICTIONARY_API_KEY = process.env.DICTIONARY_API_KEY;
    next();
});

// default route: redirect to registration page
app.get('/', (req, res) => {
    res.redirect('/register');
});

// serve the registration form ROUTE (GET request)
app.get('/register', (req, res) => {
    const registerError = req.flash('registerError');
    const registerPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Register</title>
        <link 
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" 
        >
        </head>
        <body>
        <!-- Nav (optional) -->
        <nav class="navbar navbar-expand-md navbar-light bg-light mb-4">
            <div class="container">
            <a class="navbar-brand" href="/main">OuLiPien Diary</a>
            <button 
                class="navbar-toggler" 
                type="button" 
                data-bs-toggle="collapse" 
                data-bs-target="#navbarSupportedContent"
            >
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <ul class="navbar-nav ms-auto">
                <li class="nav-item"><a class="nav-link" href="/login">Login</a></li>
                </ul>
            </div>
            </div>
        </nav>

        <div class="container">
            <h1 class="mb-4">Register</h1>
            
            <form action="/register" method="POST" class="mx-auto" style="max-width: 400px;">
            <div class="mb-3">
                <label for="username" class="form-label">Username</label>
                <input 
                type="text"
                class="form-control"
                id="username"
                name="username"
                required
                >
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <input 
                type="password"
                class="form-control"
                id="password"
                name="password"
                required
                >
            </div>
            <button type="submit" class="btn btn-primary w-100">Register</button>
            </form>

            <p class="mt-3">
            Already have an account? <a href="/login">Login here</a>
            </p>
        </div>

        <script 
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js">
        </script>
        </body>
        </html>
    `;
    
    res.send(registerPage);
});

// serve the login form ROUTE (GET request)
app.get('/login', (req, res) => {
    const errorMessage = req.flash('error');
    
    const loginPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login</title>
        <link 
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        >
        </head>
        <body>
        <nav class="navbar navbar-expand-md navbar-light bg-light mb-4">
            <div class="container">
            <a class="navbar-brand" href="/">OuLiPien Diary</a>
            <!-- etc. -->
            </div>
        </nav>

        <div class="container">
            <h1>Login</h1>
            <form action="/login" method="POST" style="max-width:400px;margin:auto;">
            <div class="mb-3">
                <label for="username" class="form-label">Username:</label>
                <input type="text" id="username" name="username" class="form-control" required>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Password:</label>
                <input type="password" id="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-primary w-100">Login</button>
            </form>
        </div>

        <script 
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js">
        </script>
        </body>
        </html>
    `;
    
    res.send(loginPage);
});

// user registration ROUTE (POST request)
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        // if the username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            req.flash('registerError', 'Sorry, this username is already taken');
            return res.redirect('/register');
        }

        // hashing the password here
        const hashedPassword = await bcrypt.hash(password, 10);
        // creating new user here
        const newUser = new User({ username, hash: hashedPassword });
        // saving the new user in the database here
        await newUser.save();
        // redirecting to the login page after registration
        res.redirect('/login');
    } catch (error) {
        console.error('Registration error:', error); // debug
        req.flash('registerError', 'An error occurred during registration. Please try again.');
        return res.redirect('/register');
    }
});

// user login with Passport.js authentication ROUTE (POST request)
app.post('/login', passport.authenticate('local', {
    successRedirect: '/main',
    failureRedirect: '/login', // Redirect to login if unsuccessful
    failureFlash: 'Invalid username or password' // Flash message on failure
}));

// the main page after login ROUTE (GET request)
app.get('/main', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, 'views', 'main.html'));
    } else {
        res.redirect('/register');
    }
});

// user logout route (POST request)
app.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.status(200).redirect('/login');
    });
});

app.get('/write', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }
    res.sendFile(path.join(__dirname, 'views', 'write.html'));
});

// save the entry ROUTE (POST reqs)
app.post('/save-entry', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
    }

    const { content, type } = req.body;

    if (!content || !type) {
        return res.status(400).send('Invalid entry data');
    }

    try {
        const newEntry = new DiaryEntry({
            user: req.user._id,
            content: content,
            status: type,
            createdAt: new Date(),
        });

        await newEntry.save();
        res.status(200).send('Entry saved successfully');

        if (type === 'public') {
            broadcastNewEntry();
        }
    } catch (error) {
        console.error('Error saving entry:', error);
        res.status(500).send('Error saving entry');
    }
});

app.get('/practice', (req, res) => {
    if(!req.isAuthenticated()){
        return res.redirect('/register');
    }
    res.sendFile(path.join(__dirname, 'views', 'practice-techniques.html'));
});

app.get('/archive', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }

    try {
        // attempting to fetch user's entries
        const userEntries = await DiaryEntry.find({ user: req.user._id, deleted: false });
        
        // fetching public entries from other users
        const publicEntries = await DiaryEntry.find({ user: { $ne: req.user._id }, status: 'public', deleted: false }).populate('user', 'username');

        // rendering the archive page
        let archivePage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Diary Archive</title>
          <!-- Bootstrap CSS -->
          <link 
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
          />
        </head>
        <body>
          <nav class="navbar navbar-expand-md navbar-light bg-light mb-4">
            <div class="container">
              <a class="navbar-brand" href="/main">OuLiPien Diary</a>
              <button 
                class="navbar-toggler"
                type="button" 
                data-bs-toggle="collapse" 
                data-bs-target="#navbarSupportedContent"
              >
                <span class="navbar-toggler-icon"></span>
              </button>
              <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <ul class="navbar-nav ms-auto">
                  <li class="nav-item"><a class="nav-link" href="/practice">Practice Techniques</a></li>
                  <li class="nav-item"><a class="nav-link" href="/write">Write</a></li>
                </ul>
              </div>
            </div>
          </nav>
        
          <div class="container">
            <h1 class="mb-4 text-center">Welcome to your diary archive!</h1>
        
            <!-- Your Entries Section -->
            <div class="mb-5">
              <h2>Your Entries (Public & Private)</h2>
              <ul class="list-group">
                ${userEntries.map(entry => `
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <a href="/entry/${entry._id}">
                      ${entry.content.substring(0, 50)}
                    </a>
                    <span class="badge bg-secondary">${entry.status}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
        
            <!-- Other Users' Public Entries -->
            <div>
              <h2>Other Users' Public Entries</h2>
              <ul class="list-group">
                ${publicEntries.map(entry => `
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${entry.user.username}</span>
                    <a href="/entry/${entry._id}">
                      ${entry.content.substring(0, 50)}
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        
          <!-- Bootstrap JS -->
          <script 
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js">
          </script>
        </body>
        </html>
        `;
        

        res.send(archivePage);
    } catch (error) {
        console.error('Error retrieving entries:', error);
        res.status(500).send('Error retrieving entries');
    }
});


// single diary entry ROUTE (GET reqs)
app.get('/entry/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }

    try {
        const entry = await DiaryEntry.findById(req.params.id).populate('user', 'username');

        if (!entry) {
            return res.status(404).send('Entry not found');
        }

        if (entry.status === 'private' && !entry.user.equals(req.user._id)) {
            return res.status(403).send('Unauthorized access to this entry');
        }

        let updateDeleteButtons = '';
        if (entry.user.equals(req.user._id)) {
            updateDeleteButtons = `
                <form action="/entry/${entry._id}/update-status" method="POST">
                    <button type="submit">${entry.status === 'private' ? 'Make Public' : 'Make Private'}</button>
                </form>
                <form action="/entry/${entry._id}/delete" method="POST">
                    <button type="submit">Delete Entry</button>
                </form>
            `;
        }

        let entryPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Diary Entry</title>
          <!-- Bootstrap CSS -->
          <link 
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
          />
        </head>
        <body>
          <!-- Navbar -->
          <nav class="navbar navbar-expand-md navbar-light bg-light mb-4">
            <div class="container">
              <a class="navbar-brand" href="/main">OuLiPien Diary</a>
              <button 
                class="navbar-toggler" 
                type="button" 
                data-bs-toggle="collapse" 
                data-bs-target="#navbarSupportedContent"
              >
                <span class="navbar-toggler-icon"></span>
              </button>
              <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <ul class="navbar-nav ms-auto">
                  <li class="nav-item"><a class="nav-link" href="/practice">Practice Techniques</a></li>
                  <li class="nav-item"><a class="nav-link" href="/write">Write</a></li>
                  <li class="nav-item"><a class="nav-link" href="/archive">Diary Archive</a></li>
                </ul>
              </div>
            </div>
          </nav>
        
          <div class="container">
            <h2 class="mb-3">Diary Entry</h2>
            <p><strong>Author:</strong> ${entry.user.username}</p>
            <div class="border p-3 mb-4">
              ${entry.content}
            </div>
        
            <!-- Update/Delete Buttons, only if user is owner -->
            ${updateDeleteButtons}
          </div>
        
          <!-- Bootstrap JS -->
          <script 
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js">
          </script>
        </body>
        </html>
        `;
        

        res.send(entryPage);
    } catch (error) {
        console.error('Error retrieving entry:', error);
        res.status(500).send('Error retrieving entry');
    }
});

// update entry status (private <-> public) POST
app.post('/entry/:id/update-status', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }

    try {
        const entry = await DiaryEntry.findById(req.params.id);

        if (!entry) {
            return res.status(404).send('Entry not found');
        }

        if (!entry.user.equals(req.user._id)) {
            return res.status(403).send('Unauthorized');
        }

        entry.status = entry.status === 'private' ? 'public' : 'private';
        await entry.save();

        res.redirect(`/entry/${entry._id}`);
    } catch (error) {
        console.error('Error updating entry status:', error);
        res.status(500).send('Error updating entry status');
    }
});

// delete entry ROUTE (POST reqs)
app.post('/entry/:id/delete', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }

    try {
        const entry = await DiaryEntry.findById(req.params.id);

        if (!entry) {
            return res.status(404).send('Entry not found');
        }

        if (!entry.user.equals(req.user._id)) {
            return res.status(403).send('Unauthorized');
        }

        entry.deleted = true;
        await entry.save();

        res.redirect('/archive');
    } catch (error) {
        console.error('Error deleting entry:', error);
        res.status(500).send('Error deleting entry');
    }
});

// Practice Techniques Main Page
app.get('/practice-techniques', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }
    res.sendFile(path.join(__dirname, 'views', 'practice-techniques.html'));
});

// N+7 Technique Page
app.get('/practice-techniques/n7', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>N+7 Technique</title>
    <!-- Bootstrap CSS -->
    <link 
        rel="stylesheet" 
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
    />
    </head>
    <body>
    <!-- Navbar -->
    <nav class="navbar navbar-expand-md navbar-light bg-light">
        <div class="container">
        <a class="navbar-brand" href="/main">OuLiPien Diary</a>
        <button 
            class="navbar-toggler" 
            type="button"
            data-bs-toggle="collapse" 
            data-bs-target="#navbarSupportedContent"
        >
            <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav ms-auto">
            <li class="nav-item"><a class="nav-link" href="/practice-techniques">Practice Techniques</a></li>
            <li class="nav-item"><a class="nav-link" href="/archive">Diary Archive</a></li>
            <li class="nav-item"><a class="nav-link" href="/write">Write</a></li>
            </ul>
        </div>
        </div>
    </nav>

    <div class="container my-4">
        <h1 class="mb-3">N+7 Explained</h1>
        <p class="lead">
        The N+7 technique, invented in 1961 by Jean Lescure, a member of Oulipo, involves 
        replacing each noun in an input text with the seventh one following it in a dictionary.
        </p>

        <!-- Input field -->
        <div class="mb-3">
        <label for="input-text" class="form-label">Enter text:</label>
        <textarea 
            id="input-text" 
            class="form-control" 
            rows="4" 
            placeholder="Write here..."
        ></textarea>
        </div>

        <button id="transform-btn" class="btn btn-primary mb-3">Transform</button>

        <!-- Output field -->
        <div class="mb-3">
        <label for="output-text" class="form-label">Transformed text:</label>
        <textarea 
            id="output-text" 
            class="form-control" 
            rows="4" 
            readonly
            placeholder="Transformed text will appear here..."
        ></textarea>
        </div>

        <p class="text-muted">
        * Please save your work as an entry if you want it to be saved (copy/paste to 
        <a href="/write">Write</a>).
        </p>
    </div>

    <!-- Bootstrap JS -->
    <script 
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js">
    </script>

    <script>
        const transformButton = document.getElementById('transform-btn');
        const inputTextarea = document.getElementById('input-text');
        const outputTextarea = document.getElementById('output-text');

        transformButton.addEventListener('click', async () => {
        const inputText = inputTextarea.value;
        try {
            const response = await fetch('/n7-transform', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: inputText })
            });
            if (!response.ok) {
            throw new Error('Server error while transforming text');
            }
            const data = await response.json();
            outputTextarea.value = data.transformed;
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        }
        });
    </script>
    </body>
    </html>

    `);
});


// Antonymic Technique Page
app.get('/practice-techniques/antonymic', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }
    res.sendFile(path.join(__dirname, 'views', 'antonymic.html'));
});

// the Snowball Technique page
app.get('/practice-techniques/snowball', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/register');
    }
    res.sendFile(path.join(__dirname, 'views', 'snowball.html'));
});


// starting the server
const PORT = process.env.PORT || 33695;
console.log('Using PORT for listening:', PORT);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});