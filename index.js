import express from 'express';
import pg from 'pg';
import bodyParser from 'body-parser';
import fetchRandomBooks from './fetchRandomBooks.js';
import bcrypt from 'bcrypt';
import env from 'dotenv';
import nodemailer from 'nodemailer';
import passport from 'passport';
import { Strategy } from 'passport-local';
import GoogleStrategy from 'passport-google-oauth2';
import session from 'express-session';

env.config();
const app = express();
const port = 3000;
const saltRounds = 10;
let otp = -1;
let count = 0;
let emailToUpdatePassword = '';

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

async function getData() {
  try {
    const result = await db.query("Select * from books");
    const data = result.rows;
    return data;
  }
  catch (err) {
    console.log(err);
  }
}

async function getDataById(id) {
  try {
    const result = await db.query("Select * from books where id = $1", [id]);
    const data = result.rows[0];
    return data;
  }
  catch (err) {
    console.log("Error in getDataById" + err);
  }
}

async function insertIfEmpty(apiData) {
  try {
    apiData.forEach(async data => {
      await db.query("insert into books(title,author,rating,content,image,previewlink,booklink) values($1,$2,$3,$4,$5,$6,$7)", [data.title, data.author, data.rating, data.content, data.image, data.previewLink, data.bookLink]);
    });
    let data = await getData();
    return data;
  }
  catch (err) {
    console.log("Error in insertIfEmpty" + err);
    res.send("here here")
  }
}

function generateOTP() {
  count += 1;
  otp = Math.floor(100000 + Math.random() * 900000);

  setTimeout(() => {
    otp = -1;
  }, 600000);
}

app.get('/home', (req,res) => {
  res.render('home.ejs');
});

app.get('/', async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      let data = await getData();

      if (data.length === 0) {
        let apiData = await fetchRandomBooks();
        data = await insertIfEmpty(apiData);
      }
      res.render("index.ejs", { bookData: data, isEmpty: data.length === 0 });
    }
    else{
      res.redirect('/home');
    }
  }
  catch (err) {
    console.log(err);
    res.status(500).send("Internal Server error fetching the index.ejs file");
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get('/verify_Email', (req, res) => {
  res.render('forgotPassword.ejs');
});

app.get('/add', (req, res) => {
  try {
    res.status(200).render('addReview.ejs');
  }
  catch (err) {
    res.status(500).send("Internal Server error fetching the addReview.ejs file");
  }
});

app.get('/signOut', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}))

app.get('/delete/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(id);

    await db.query("DELETE FROM books WHERE id = $1", [id]);

    res.status(200).redirect('/');
  }
  catch (err) {
    res.status(500).send("Error deleting the data");
  }
});

app.get('/edit/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let data = await getDataById(id);
    res.status(200).render('editReview.ejs', { bookData: data });
  }
  catch (err) {
    res.status(500).send("Internal Server error fetching the editReview.ejs file");
  }
});

app.get('/verify_otp', (req, res) => {
  try {

    generateOTP();

    const emailBody = `
    <p>Dear User,</p>
    <p>We received a request to reset the password for your account. To proceed with resetting your password, please use the following One-Time Password (OTP):</p>
    <p><strong>${otp}</strong></p>
    <p>This OTP is valid for the next 10 minutes. Please do not share this code with anyone.</p>
    <p>If you did not request a password reset, please ignore this email or contact our support team immediately.</p>
    <p>Best regards,<br>
    Booklytic`
      ;


    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'kraarush709@gmail.com',
        pass: process.env.GOOGLE_SECURE_PASS,
      },
    });

    let mailOptions = {
      from: 'kraarush709@gmail.com',
      to: emailToUpdatePassword,
      subject: 'Password Reset OTP',
      html: emailBody,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        res.render('otp.ejs', { isSent: false, failedToSentOtp: true });
      }
      else {
        res.render('otp.ejs', { isSent: true, isResent: count > 1 });
      }
    });


  } catch (err) {
    console.error("Error in verify_otp route: " + err);
    res.status(500).send("Error sending otp");
  }
});

app.get('/auth/google/booklytic', passport.authenticate('google', {
  successRedirect: '/',
  failureRedirect: '/login',
})
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.status(400).render('register.ejs', { ifExist: true });
    }
    else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log(err);
          res.send('Error hashing the password' + err);
        }
        else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) returning *",
            [email, hash]);
            req.login(user, (err) => {
              res.redirect("/");
            });
        }
      });
    }
  }
  catch (err) {
    console.log(err);
  }

});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      res.status(404).render('login.ejs', { isPasswordCorrect: false });
    }
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  })(req, res, next);
});

app.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  const result = await db.query("select * from users where email = $1", [email]);

  if (result.rows.length === 0) {
    res.render('forgotPassword.ejs', { isExist: false });
  }
  else {
    emailToUpdatePassword = email;
    count = 0;
    res.render('otp.ejs', { isSent: false }); // i will not send the isExist as true until i get otp for verification
  }
});

app.post('/verify_otp', (req, res) => {
  const userOtp = req.body.otp;

  if (otp == -1) {
    res.render('otp.ejs', { isSent: true, inCorrectOtp: "OTP expired try again" });
  }
  else if (otp == userOtp) {
    res.render('forgotPassword.ejs', { isExist: true });
  }
  else {
    res.render('otp.ejs', { isSent: true, inCorrectOtp: "Incorrect OTP" });

  }
});

app.post('/set-new-password', async (req, res) => {
  const newPassword = req.body.newPassword;
  bcrypt.hash(newPassword, saltRounds, async (err, hash) => {
    if (err) {
      console.log(err);
      res.send("Error hashing the new Password");
    }
    else {
      await db.query("update users set password = $1 where email = $2", [hash, emailToUpdatePassword]);
      emailToUpdatePassword = '';
      res.render('updatedNewPassword.ejs');
    }
  })
});

app.post('/addReview', async (req, res) => {
  try {
    const title = req.body.title;
    const author = req.body.author;
    const rating = req.body.rating;
    const content = req.body.content;

    if (title && author && rating && content) {
      const result = await db.query("insert into books(title,author,rating,content) values($1,$2,$3,$4) returning *", [title, author, rating, content]);
      res.redirect('/');
    }
    else {
      res.render('addReview.ejs', { message: "Enter all values to proceed" });
    }
  }
  catch (err) {
    console.log(err);
    res.status(500).json({ type: 'Internal server error', message: 'Error inserting into database' });
  }
});

app.post('/editReview/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await getDataById(id);
    const title = req.body.title || data.title;
    const author = req.body.author || data.author;
    const rating = req.body.rating || data.rating;
    const content = req.body.content || data.content;

    await db.query("UPDATE books SET title = $1, author = $2, rating = $3, content = $4 WHERE id = $5", [title, author, rating, content, id]);

    res.redirect('/');
  }
  catch (err) {
    console.log(err);
    res.status(500).json({ type: 'Internal server error', message: 'Error updating database' });
  }
});

passport.use('local',
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/booklytic",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
},
  async (accessToken, refreshToken, profile, cb) => {
    try {
      const result = await db.query("select * from users where email = $1", [profile.email]);

      if (result.rows.length == 0) {
        const result = await db.query(
          "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING *",
          [profile.email, 'google']
        );
        const user = result.rows[0];
        cb(null, user);
      }
      else {
        cb(null, result.rows[0]);
      }
    }
    catch (err) {
      console.log("Error in google strategy " + err);
    }
  }
));

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});


app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});                                                       