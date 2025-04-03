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
        </head>
        <body>
            <h1>Register</h1>

            ${registerError && registerError.length > 0 ? `<div style="color: red;">${registerError}</div>` : ''}

            <form id="register-form" action="/register" method="POST">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
                <br>
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
                <br>
                <button type="submit">Register</button>
            </form>
            
            <p>Already have an account? <a href="/login">Login here</a></p>
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
        </head>
        <body>
            <h1>Login</h1>

            ${errorMessage && errorMessage.length > 0 ? `<div style="color: red;">${errorMessage}</div>` : ''}

            <form id="login-form" action="/login" method="POST">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
                <br>
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
                <br>
                <button type="submit">Login</button>
            </form>

            <p>Don't have an account? <a href="/register">Register here</a></p>
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
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Diary Archive</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 20px;
                    }
                    ul {
                        list-style-type: none; /* Removes bullet points */
                        padding: 0;
                    }
                    nav {
                        margin-bottom: 20px;
                    }
                    nav a {
                        margin: 0 15px;
                        text-decoration: none;
                        color: blue;
                    }
                    .entry-section {
                        margin: 20px 0;
                    }
                    .entry-list li {
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <!-- Navigation Tabs -->
                <nav>
                    <a href="/main">Main Page</a>
                    <a href="/practice">Practice Techniques</a>
                    <a href="/write">Write</a>
                </nav>

                <h1>Welcome to your diary archive!</h1>
                
                <!-- Your Entries Section -->
                <div class="entry-section">
                    <h2>Your Entries (Public & Private)</h2>
                    <ul>
                        ${userEntries.map(entry => `
                            <li>
                                <a href="/entry/${entry._id}">${entry.content.substring(0, 50)}</a>
                                <span>[${entry.status}]</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <!-- Other Users' Public Entries -->
                <div class="entry-section">
                    <h2>Other Users' Public Entries</h2>
                    <ul>
                        ${publicEntries.map(entry => `
                            <li>${entry.user.username}: <a href="/entry/${entry._id}">${entry.content.substring(0, 50)}</a></li>
                        `).join('')}
                    </ul>
                </div>
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
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Diary Entry</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 20px;
                    }
                    nav {
                        margin-bottom: 20px;
                    }
                    nav a {
                        margin: 0 15px;
                        text-decoration: none;
                        color: blue;
                    }
                </style>
            </head>
            <body>
                <!-- Navigation Tabs -->
                <nav>
                    <a href="/main">Main Page</a>
                    <a href="/practice">Practice Techniques</a>
                    <a href="/write">Write</a>
                    <a href="/archive">Diary Archive</a>
                </nav>

                <h2>Diary Entry</h2>
                <p><strong>Author:</strong> ${entry.user.username}</p>
                <p>${entry.content}</p>

                <!-- Update and Delete Buttons (if the current user owns the entry) -->
                ${updateDeleteButtons}
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>N+7 Technique</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
            }
            nav {
                margin-bottom: 20px;
            }
            nav a {
                margin: 0 15px;
                text-decoration: none;
                color: blue;
            }
            textarea {
                width: 40%;
                height: 100px;
                margin: 10px 0;
            }
            button {
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <!-- Navigation Tabs -->
        <nav>
            <a href="/main">Main Page</a>
            <a href="/practice-techniques">Practice Techniques</a>
            <a href="/archive">Diary Archive</a>
        </nav>

        <h1>N+7 Explained:</h1>
        <p>
            The N+7 technique, invented in 1961 by Jean Lescure, a member of Oulipo, involves replacing each 
            noun in an input text with the seventh one following it in a dictionary.
        </p>

        <textarea id="input-text"></textarea>
        <button  id="transform-btn">Transform</button>
        <textarea id="output-text" readonly></textarea>

        <p>* Please save your work as an entry if you want it to be saved (copy/paste to write/add an entry).</p>
        <script>
            const transformButton = document.getElementById('transform-btn');
            const inputTextarea = document.getElementById('input-text');
            const outputTextarea = document.getElementById('output-text');
        
            transformButton.addEventListener('click', async () => {
                const inputText = inputTextarea.value;
                // Make a POST request to our server route
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
                    // data.transformed is the N+7 result
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